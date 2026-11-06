import React, { useCallback, useEffect, useRef, useState } from 'react'
import CodeEditor from './components/CodeEditor'
import SplitPane from './components/SplitPane'
import StatusBar from './components/StatusBar'
import { useToast } from './components/Toast'
import { Button, PaneHeader, SegmentedControl, Toggle } from './components/controls'
import { BracesIcon, ClearIcon, CompressIcon, CopyIcon, ErrorIcon, PasteIcon, SampleIcon } from './components/icons'
import { useJsonConverter } from './parser/useJsonConverter'
import { copyText, loadSetting, onPluginEnter, readClipboardText, saveSetting } from './platform'

const DEFAULT_OPTIONS = { convertDates: true, convertNumbers: true, indent: 2 }
const DEFAULT_SPLIT_RATIO = 0.45

const INDENT_OPTIONS = [{ value: 2, label: '2' }, { value: 4, label: '4' }]

const SAMPLE_TEXT = 'OrderDetail(super=BaseEntity(id=10086, createTime=Mon Jan 01 10:00:00 CST 2024, creator=admin), ' +
  'orderNo=TH202401010001, status=PAID, amount=1299.00, remark=周末到店, 请提前联系, ' +
  'customer=Customer{name=\'张三\', phone=\'138****0000\', vip=true}, ' +
  'items=[OrderItem(sku=TIRE-205-55-R16, name=米其林轮胎, quantity=4, price=299.00), OrderItem(sku=SERVICE-001, name=四轮定位, quantity=1, price=103.00)], ' +
  'extra={source=APP, channel=Android}, coupon=null, handler=com.tuhu.order.OrderHandler@6d06d69c)'

// 剪贴板内容形如 Foo(a=..., Foo{a=..., [Foo(a=..., {a=..., a=... 时才自动读入，避免把无关内容塞进输入框
const JAVA_TO_STRING_PATTERN = /^\s*\[?\s*([\w$.]+)?[({]?\s*[\w$.]+=/

function looksLikeJavaToString (text) {
  return typeof text === 'string' && JAVA_TO_STRING_PATTERN.test(text)
}

function toCompactJson (json) {
  return JSON.stringify(JSON.parse(json))
}

export default function App () {
  const inputEditorRef = useRef(null)
  const { result, convert } = useJsonConverter()
  const [toastElement, showToast] = useToast()
  const [options, setOptions] = useState(() => ({ ...DEFAULT_OPTIONS, ...loadSetting('options', {}) }))
  const [splitRatio, setSplitRatio] = useState(() => loadSetting('splitRatio', DEFAULT_SPLIT_RATIO))
  const [inputLength, setInputLength] = useState(0)
  const [warningIndex, setWarningIndex] = useState(0)

  // uTools 事件回调只注册一次，通过 ref 读取最新的选项
  const optionsRef = useRef(options)
  optionsRef.current = options

  const runConvert = useCallback((text, convertOptions = optionsRef.current) => {
    setInputLength(text.length)
    setWarningIndex(0)
    convert(text, convertOptions)
  }, [convert])

  const loadInputText = useCallback((text) => {
    inputEditorRef.current.setText(text)
    runConvert(text)
  }, [runConvert])

  const convertCurrentInput = useCallback(() => {
    runConvert(inputEditorRef.current.getText())
  }, [runConvert])

  const handlePasteFromClipboard = useCallback(async () => {
    const clipboardText = await readClipboardText()
    if (!clipboardText.trim()) {
      showToast('剪贴板是空的', 'info')
      return
    }
    loadInputText(clipboardText)
  }, [loadInputText, showToast])

  const handleClear = useCallback(() => {
    loadInputText('')
    inputEditorRef.current.focus()
  }, [loadInputText])

  const handleCopy = useCallback(async ({ compact }) => {
    if (!result.json) return
    try {
      await copyText(compact ? toCompactJson(result.json) : result.json)
      showToast(compact ? '已复制压缩后的 JSON' : '已复制 JSON')
    } catch (error) {
      console.error('[Java转JSON] 复制失败：', error)
      showToast('复制失败：' + error.message, 'error')
    }
  }, [result.json, showToast])

  const handleOptionChange = useCallback((key, value) => {
    const nextOptions = { ...optionsRef.current, [key]: value }
    setOptions(nextOptions)
    saveSetting('options', nextOptions)
    runConvert(inputEditorRef.current.getText(), nextOptions)
  }, [runConvert])

  const handleSplitRatioChange = useCallback((ratio, { final }) => {
    setSplitRatio(ratio)
    if (final) saveSetting('splitRatio', ratio)
  }, [])

  const handleWarningClick = useCallback(() => {
    const warnings = result.warnings
    if (warnings.length === 0) return
    const warning = warnings[warningIndex % warnings.length]
    inputEditorRef.current.selectRange(warning.offset, warning.offset + 1)
    setWarningIndex(warningIndex + 1)
  }, [result.warnings, warningIndex])

  useEffect(() => {
    onPluginEnter(async ({ type, payload }) => {
      // 通过选中文本 / 匹配指令进入：payload 就是要转换的内容
      if ((type === 'regex' || type === 'over') && typeof payload === 'string') {
        loadInputText(payload)
        return
      }
      // 通过关键字进入：剪贴板里像是 toString 就直接读入
      const clipboardText = await readClipboardText()
      if (looksLikeJavaToString(clipboardText) && clipboardText !== inputEditorRef.current.getText()) {
        loadInputText(clipboardText)
        showToast('已从剪贴板读取', 'info')
      }
      inputEditorRef.current.focus()
    })
  }, [loadInputText, showToast])

  useEffect(() => {
    function handleKeyDown (event) {
      const isModifierPressed = event.metaKey || event.ctrlKey
      if (isModifierPressed && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        handleCopy({ compact: false })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCopy])

  const hasOutput = Boolean(result.json)

  const inputPane = (
    <section className='pane'>
      <PaneHeader title='Java toString'>
        <Button icon={<PasteIcon />} title='用剪贴板内容替换输入' onClick={handlePasteFromClipboard}>粘贴</Button>
        <Button icon={<SampleIcon />} title='加载示例' onClick={() => loadInputText(SAMPLE_TEXT)}>示例</Button>
        <Button icon={<ClearIcon />} title='清空输入' onClick={handleClear}>清空</Button>
      </PaneHeader>
      <div className='pane-body'>
        <CodeEditor ref={inputEditorRef} mode='input'
          placeholder={'粘贴或输入 Java toString 字符串，例如：\nUser(id=1, name=张三, tags=[a, b])'}
          onTextChange={runConvert} onSubmit={convertCurrentInput} />
      </div>
    </section>
  )

  const outputPane = (
    <section className='pane'>
      <PaneHeader title='JSON'>
        <Toggle label='时间戳' checked={options.convertDates}
          title='把 Java Date 格式的时间（如 Mon Jan 01 10:00:00 CST 2024）转为毫秒时间戳'
          onChange={value => handleOptionChange('convertDates', value)} />
        <Toggle label='数值' checked={options.convertNumbers}
          title='把数字字符串转为数值类型；超过 15 位或以 0 开头的保留字符串'
          onChange={value => handleOptionChange('convertNumbers', value)} />
        <SegmentedControl value={options.indent} options={INDENT_OPTIONS} title='缩进空格数'
          onChange={value => handleOptionChange('indent', value)} />
        <span className='pane-actions-divider' />
        <Button icon={<CompressIcon />} title='复制压缩为一行的 JSON' disabled={!hasOutput}
          onClick={() => handleCopy({ compact: true })} />
        <Button icon={<CopyIcon />} variant='primary' title='复制格式化的 JSON（⌘⇧C）' disabled={!hasOutput}
          onClick={() => handleCopy({ compact: false })}>复制</Button>
      </PaneHeader>
      <div className={`pane-body${result.status === 'parsing' ? ' pane-body-busy' : ''}`}>
        <CodeEditor mode='output' value={result.json} />
        {!hasOutput && result.status !== 'parsing' && (
          <OutputPlaceholder error={result.error}
            onPaste={handlePasteFromClipboard} onLoadSample={() => loadInputText(SAMPLE_TEXT)} />
        )}
      </div>
    </section>
  )

  return (
    <div className='app'>
      <SplitPane first={inputPane} second={outputPane} ratio={splitRatio} onRatioChange={handleSplitRatioChange} />
      <StatusBar result={result} inputLength={inputLength} warningIndex={warningIndex} onWarningClick={handleWarningClick} />
      {toastElement}
    </div>
  )
}

function OutputPlaceholder ({ error, onPaste, onLoadSample }) {
  if (error) {
    return (
      <div className='output-placeholder output-placeholder-error'>
        <ErrorIcon />
        <p>{error}</p>
      </div>
    )
  }
  return (
    <div className='output-placeholder'>
      <div className='output-placeholder-icon'><BracesIcon size={28} /></div>
      <p className='output-placeholder-title'>粘贴 Java toString，自动转换为 JSON</p>
      <p className='output-placeholder-hint'>支持 Lombok @ToString、IDE 生成的 toString、List / Map 嵌套</p>
      <div className='output-placeholder-actions'>
        <Button icon={<PasteIcon />} variant='primary' onClick={onPaste}>从剪贴板粘贴</Button>
        <Button icon={<SampleIcon />} variant='outline' onClick={onLoadSample}>加载示例</Button>
      </div>
    </div>
  )
}
