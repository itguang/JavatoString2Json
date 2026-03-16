import React, { useEffect, useState, useRef } from 'react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  IconButton,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material'
import { ContentCopy, Clear, AutoFixHigh } from '@mui/icons-material'

const THEME_DIC = {
  light: createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: '#4CAF50'
      },
      secondary: {
        main: '#2E7D32'
      }
    },
    typography: {
      fontFamily: 'system-ui'
    }
  }),
  dark: createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#81C784'
      },
      secondary: {
        main: '#A5D6A7'
      }
    },
    typography: {
      fontFamily: 'system-ui'
    }
  })
}

/**
 * 解析 Java toString 字符串为 JSON 对象
 * 支持输入：
 * - [Request(vehicle=VehicleRequest(vehicleId=VE-INFLFIOWQX6, brand=Y - 英菲尼迪, displacement=2.5T-混合动力, productionYear=2017,  tid=115331, avgPrice=0.0, distance=0, onRoadTime=2017-6, properties=[], carId=), channel=Android)]
 * 支持输出:
 * {"channel":"Android","vehicle":{"distance":"0","avgPrice":"0.0","displacement":"2.5T-混合动力","vehicleId":"VE-INFLFIOWQX6","productionYear":"2017","brand":"Y - 英菲尼迪","tid":"115331","onRoadTime":"2017-6","properties":[]}}
 * - ClassName@hashcode (提取类名)
 */
function parseJavaToString(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('请输入有效的 Java toString 字符串')
  }

  let str = input.trim()
  // 移除最外层的 []
  if (str.startsWith('[') && str.endsWith(']')) {
    str = str.slice(1, -1).trim()
  }
  let pos = 0

  function skipWhitespace() {
    while (pos < str.length && /\s/.test(str[pos])) pos++
  }

  function parseValue() {
    skipWhitespace()
    if (pos >= str.length) return ''

    const ch = str[pos]
    if (ch === '[') return parseArray()
    if (ch === '{') { pos++; return parseFields('}') }
    if (ch === "'" || ch === '"') return parseQuotedString()

    const obj = tryParseObject()
    if (obj !== null) return obj

    return parsePrimitive()
  }

  function parseArray() {
    pos++ // skip [
    skipWhitespace()
    if (pos < str.length && str[pos] === ']') { pos++; return [] }

    const result = []
    while (pos < str.length && str[pos] !== ']') {
      skipWhitespace()
      result.push(parseValue())
      skipWhitespace()
      if (pos < str.length && str[pos] === ',') pos++
    }
    if (pos < str.length) pos++ // skip ]
    return result
  }

  function tryParseObject() {
    const saved = pos
    if (pos < str.length && /[a-zA-Z_$]/.test(str[pos])) {
      let name = ''
      while (pos < str.length && /[a-zA-Z0-9_$.]/.test(str[pos])) {
        name += str[pos]
        pos++
      }

      // ClassName@hashcode（保留完整字符串）
      if (pos < str.length && str[pos] === '@') {
        let full = name + '@'
        pos++
        while (pos < str.length && /[a-zA-Z0-9]/.test(str[pos])) {
          full += str[pos]
          pos++
        }
        return full
      }

      // ClassName( 或 ClassName{
      if (pos < str.length && (str[pos] === '(' || str[pos] === '{')) {
        const close = str[pos] === '(' ? ')' : '}'
        pos++
        return parseFields(close)
      }
    }
    pos = saved
    return null
  }

  function parseFields(closeChar) {
    const result = {}
    skipWhitespace()

    while (pos < str.length && str[pos] !== closeChar) {
      skipWhitespace()
      if (pos < str.length && str[pos] === closeChar) break

      let key = ''
      while (pos < str.length && str[pos] !== '=' && str[pos] !== closeChar && str[pos] !== ',') {
        key += str[pos]
        pos++
      }
      key = key.trim()
      if (!key || pos >= str.length || str[pos] !== '=') break

      pos++ // skip =
      const value = parseValue()

      // 处理 super= 字段（Java 继承时 toString 自动生成的，应去掉）
      if (key === 'super') {
        // 值为嵌套对象时，将其字段展平合并到当前对象
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(result, value)
        }
        // 值为字符串（如 ClassName@hashcode）时，直接丢弃
      } else {
        result[key] = value
      }

      skipWhitespace()
      if (pos < str.length && str[pos] === ',') pos++
    }

    if (pos < str.length && str[pos] === closeChar) pos++
    return result
  }

  function parseQuotedString() {
    const quote = str[pos]
    pos++
    let value = ''
    while (pos < str.length && str[pos] !== quote) {
      if (str[pos] === '\\' && pos + 1 < str.length) {
        value += str[pos + 1]
        pos += 2
      } else {
        value += str[pos]
        pos++
      }
    }
    if (pos < str.length) pos++
    return value
  }

  function parsePrimitive() {
    let value = ''
    let depth = 0

    while (pos < str.length) {
      const ch = str[pos]
      if (ch === '(' || ch === '{' || ch === '[') depth++
      if (ch === ')' || ch === '}' || ch === ']') {
        if (depth === 0) break
        depth--
      }
      if (ch === ',' && depth === 0) break
      value += ch
      pos++
    }

    value = value.trim()
    if (value === 'null') return null
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  }

  function isTimeString(str) {
    if (typeof str !== 'string') return false
    const timeRegex = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{2}:\d{2}:\d{2} [A-Z]{3} \d{4}$/
    return timeRegex.test(str)
  }

  function convertTimeStringsToTimestamp(obj) {
    if (typeof obj !== 'object' || obj === null) {
      if (isTimeString(obj)) {
        return new Date(obj).getTime()
      }
      return obj
    }
    if (Array.isArray(obj)) {
      return obj.map(item => convertTimeStringsToTimestamp(item))
    }
    const result = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = convertTimeStringsToTimestamp(obj[key])
      }
    }
    return result
  }

  const result = parseValue()
  const converted = convertTimeStringsToTimestamp(result)
  return JSON.stringify(converted, null, 2)
}

export default function App () {
  const [theme, setTheme] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [converting, setConverting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    window.utools.onPluginEnter(({ code, type, payload, from }) => {
      if (code === 'javaToJson' && payload) {
        setInput(payload)
        handleConvert(payload)
      }
    })

    window.utools.onPluginOut((isKill) => {})

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      setTheme(e.matches ? 'dark' : 'light')
    })
  }, [])

  const handleConvert = (inputText = input) => {
    if (!inputText.trim()) {
      setError('请输入 Java toString 字符串')
      setOutput('')
      return
    }

    setConverting(true)
    setError('')

    try {
      const result = parseJavaToString(inputText)
      // const jsonStr = JSON.stringify(result, null, 2)
      setOutput(result)
    } catch (err) {
      setError(err.message || '转换失败，请检查输入格式')
      setOutput('')
    } finally {
      setConverting(false)
    }
  }

  const handleCopy = async () => {
    if (!output) return
    try {
      await window.utools.copyText(output)
      setSnackbar({ open: true, message: '已复制到剪贴板', severity: 'success' })
    } catch (err) {
      setSnackbar({ open: true, message: '复制失败', severity: 'error' })
    }
  }

  const handleClear = () => {
    setInput('')
    setOutput('')
    setError('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleConvert()
    }
  }

  return (
    <ThemeProvider theme={THEME_DIC[theme]}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          bgcolor: 'background.default',
          p: 2,
          boxSizing: 'border-box'
        }}
      >
        {/* 标题 */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoFixHigh color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Java toString 转 JSON
          </Typography>
        </Box>

        {/* 输入区域 */}
        <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            输入 Java 对象的 toString 字符串
          </Typography>
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            rows={4}
            placeholder="例如: Person{name='John', age=30, address=Address{city='Beijing'}}"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            error={!!error}
            disabled={converting}
            sx={{
              '& .MuiInputBase-root': {
                fontFamily: 'monospace',
                fontSize: '13px'
              }
            }}
          />
          {error && (
            <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>
              {error}
            </Typography>
          )}
        </Paper>

        {/* 按钮区域 */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="contained"
            onClick={() => handleConvert()}
            disabled={converting || !input.trim()}
            startIcon={converting ? <CircularProgress size={16} color="inherit" /> : <AutoFixHigh />}
          >
            {converting ? '转换中...' : '转换为 JSON'}
          </Button>
          <Button
            variant="outlined"
            onClick={handleClear}
            disabled={converting}
            startIcon={<Clear />}
          >
            清空
          </Button>
        </Box>

        {/* 输出区域 */}
        {output && (
          <Paper sx={{ p: 2, flex: 1, overflow: 'auto' }} variant="outlined">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                转换结果 (JSON)
              </Typography>
              <IconButton size="small" onClick={handleCopy} title="复制">
                <ContentCopy fontSize="small" />
              </IconButton>
            </Box>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1,
                bgcolor: theme === 'dark' ? 'grey.900' : 'grey.100',
                borderRadius: 1,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '13px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {output}
            </Box>
          </Paper>
        )}

        {/* 提示信息 */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={2000}
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} variant="filled">
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  )
}
