import React from 'react'
import { CheckIcon, ErrorIcon, WarningIcon } from './icons'

const IS_MAC = /Mac/.test(navigator.platform)
const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl+'
const SHIFT_KEY = IS_MAC ? '⇧' : 'Shift+'

function formatCount (count) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 10_000) return `${(count / 1000).toFixed(1)}K`
  return count.toLocaleString()
}

function StatusText ({ result }) {
  if (result.status === 'parsing') {
    return <span className='status-item'><span className='spinner' />解析中…</span>
  }
  if (result.status === 'error') {
    return <span className='status-item status-error' title={result.error}><ErrorIcon />{result.error}</span>
  }
  if (result.status === 'done') {
    return <span className='status-item status-success'><CheckIcon />已转换 · {result.parseMs} ms</span>
  }
  return <span className='status-item'>就绪</span>
}

/**
 * 底部状态栏：解析状态、问题提示、输入输出规模、快捷键。
 * 有 warning 时点击可依次跳转到输入中对应的位置。
 */
export default function StatusBar ({ result, inputLength, warningIndex, onWarningClick }) {
  const warnings = result.status === 'done' ? result.warnings : []
  const currentWarning = warnings[warningIndex % Math.max(warnings.length, 1)]

  return (
    <footer className='status-bar'>
      <div className='status-left'>
        <StatusText result={result} />
        {currentWarning && (
          <button type='button' className='status-item status-warning' onClick={onWarningClick}
            title={warnings.length > 1 ? '点击跳转，再次点击查看下一处' : '点击跳转到对应位置'}>
            <WarningIcon />
            {warnings.length > 1 && <b>{warnings.length} 处问题 · </b>}
            {currentWarning.message}
          </button>
        )}
      </div>
      <div className='status-right'>
        {inputLength > 0 && <span className='status-item'>输入 {formatCount(inputLength)} 字符</span>}
        {result.status === 'done' && <span className='status-item'>输出 {formatCount(result.lineCount)} 行</span>}
        <span className='status-item status-shortcuts'>
          <kbd>{MOD_KEY}↵</kbd> 转换 <kbd>{MOD_KEY}{SHIFT_KEY}C</kbd> 复制
        </span>
      </div>
    </footer>
  )
}
