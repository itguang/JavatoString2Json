import React, { useEffect, useImperativeHandle, useRef } from 'react'
import { EditorState, Transaction } from '@codemirror/state'
import {
  EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine,
  highlightActiveLineGutter, placeholder as placeholderExtension
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search'
import { foldGutter, foldKeymap, syntaxHighlighting, HighlightStyle, bracketMatching } from '@codemirror/language'
import { json } from '@codemirror/lang-json'
import { tags } from '@lezer/highlight'

// 输入停止 300ms 后才触发转换，避免逐字符解析大文本
const INPUT_DEBOUNCE_MS = 300

// 颜色全部引用 CSS 变量，亮/暗主题切换时由 CSS 自动生效，不用重建编辑器
const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12.5px',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--editor-bg)'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65' },
  '.cm-content': { padding: '8px 0', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0 12px 0 8px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--selection-bg)'
  },
  '.cm-activeLine': { backgroundColor: 'var(--active-line-bg)' },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--text-tertiary)',
    border: 'none',
    paddingLeft: '4px'
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-secondary)' },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '32px', padding: '0 6px 0 4px' },
  '.cm-foldGutter .cm-gutterElement': { width: '14px', color: 'var(--text-tertiary)', cursor: 'pointer' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--chip-bg)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: '4px',
    padding: '0 6px',
    margin: '0 2px'
  },
  '.cm-placeholder': { color: 'var(--text-tertiary)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--match-bg)',
    outline: '1px solid var(--match-border)'
  },
  '.cm-searchMatch': { backgroundColor: 'var(--search-match-bg)', outline: '1px solid var(--search-match-border)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--search-current-bg)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--match-bg)' },
  '.cm-panels': { backgroundColor: 'var(--panel-header-bg)', color: 'var(--text-primary)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--border)' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--border)' }
})

const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--syntax-key)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: tags.number, color: 'var(--syntax-number)' },
  { tag: [tags.bool, tags.null], color: 'var(--syntax-keyword)', fontWeight: '600' },
  { tag: [tags.separator, tags.punctuation, tags.brace, tags.squareBracket], color: 'var(--text-tertiary)' }
])

const sharedExtensions = [
  editorTheme,
  lineNumbers(),
  highlightActiveLineGutter(),
  drawSelection(),
  EditorView.lineWrapping,
  search({ top: true }),
  highlightSelectionMatches()
]

function buildInputExtensions ({ placeholder, onSubmit, notifyChange }) {
  return [
    ...sharedExtensions,
    history(),
    placeholderExtension(placeholder),
    keymap.of([
      { key: 'Mod-Enter', run: () => { onSubmit(); return true } },
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap
    ]),
    EditorView.updateListener.of(update => {
      if (!update.docChanged) return
      // 只响应用户操作（输入、粘贴、撤销等）；通过 setText 程序化写入的内容由调用方自己决定是否转换
      const userTransaction = update.transactions.find(transaction => transaction.annotation(Transaction.userEvent))
      if (!userTransaction) return
      notifyChange(update.state.doc, { immediate: userTransaction.isUserEvent('input.paste') || userTransaction.isUserEvent('input.drop') })
    })
  ]
}

function buildOutputExtensions () {
  return [
    ...sharedExtensions,
    // 输入通常是一整行很长的文本，高亮当前行会让整块变灰，所以只在输出里启用
    highlightActiveLine(),
    EditorState.readOnly.of(true),
    foldGutter({ openText: '▾', closedText: '▸' }),
    bracketMatching(),
    json(),
    syntaxHighlighting(jsonHighlightStyle),
    keymap.of([...foldKeymap, ...searchKeymap, ...defaultKeymap])
  ]
}

/**
 * CodeMirror 6 封装。CodeMirror 只渲染可视区域，MB 级文本也不会卡顿。
 *
 * mode="input"：可编辑，用户修改后防抖回调 onTextChange(text)，粘贴时立即回调
 * mode="output"：只读 JSON，语法高亮、折叠、搜索；内容由 value 控制
 *
 * 通过 ref 暴露 setText / getText / focus / selectRange
 */
export default function CodeEditor ({ ref, mode, value, placeholder = '', onTextChange, onSubmit }) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const debounceTimerRef = useRef(null)
  // 回调放进 ref，编辑器只创建一次，不随父组件重渲染重建
  const callbacksRef = useRef({ onTextChange, onSubmit })
  callbacksRef.current = { onTextChange, onSubmit }

  useEffect(() => {
    function notifyChange (doc, { immediate }) {
      clearTimeout(debounceTimerRef.current)
      const emit = () => callbacksRef.current.onTextChange?.(doc.toString())
      if (immediate) {
        emit()
      } else {
        debounceTimerRef.current = setTimeout(emit, INPUT_DEBOUNCE_MS)
      }
    }

    const extensions = mode === 'input'
      ? buildInputExtensions({ placeholder, onSubmit: () => callbacksRef.current.onSubmit?.(), notifyChange })
      : buildOutputExtensions()

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({ doc: value ?? '', extensions })
    })
    viewRef.current = view

    return () => {
      clearTimeout(debounceTimerRef.current)
      view.destroy()
      viewRef.current = null
    }
    // 编辑器只在挂载时创建；value 的更新由下面的 effect 处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    if (value === undefined) return
    replaceDocument(viewRef.current, value)
  }, [value])

  useImperativeHandle(ref, () => ({
    setText (text) {
      clearTimeout(debounceTimerRef.current)
      replaceDocument(viewRef.current, text)
    },
    getText () {
      return viewRef.current?.state.doc.toString() ?? ''
    },
    focus () {
      viewRef.current?.focus()
    },
    selectRange (from, to) {
      const view = viewRef.current
      if (!view) return
      const docLength = view.state.doc.length
      view.dispatch({
        selection: { anchor: Math.min(from, docLength), head: Math.min(to, docLength) },
        scrollIntoView: true
      })
      view.focus()
    }
  }), [])

  return <div className='code-editor' ref={containerRef} />
}

function replaceDocument (view, text) {
  if (!view || view.state.doc.toString() === text) return
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor: 0 },
    scrollIntoView: true
  })
}
