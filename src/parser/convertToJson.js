import { parseJavaToString } from './parseJavaToString.js'

function countLines (text) {
  let lines = 1
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) lines++
  }
  return lines
}

/**
 * 解析并格式化为 JSON 文本。Worker 和主线程降级方案共用这一个入口。
 * @param {string} text
 * @param {{ convertDates: boolean, convertNumbers: boolean, indent: number }} options
 */
export function convertToJson (text, options) {
  const startedAt = performance.now()
  try {
    const { value, warnings } = parseJavaToString(text, options)
    const json = JSON.stringify(value, null, options.indent)
    return {
      json,
      warnings,
      lineCount: countLines(json),
      parseMs: Math.round(performance.now() - startedAt)
    }
  } catch (error) {
    return { error: error.message || '转换失败，请检查输入格式' }
  }
}
