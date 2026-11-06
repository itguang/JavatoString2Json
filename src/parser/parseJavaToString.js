/**
 * 解析 Java toString 字符串为 JS 值
 *
 * 支持的输入格式：
 * - Lombok：Request(vehicle=VehicleRequest(vehicleId=VE-1, brand=英菲尼迪), channel=Android)
 * - IDE 生成：User{id=123, name='张三', address=Address{city='北京'}}
 * - 集合：[Item(a=1), Item(a=2)]、Map：{k1=v1, k2=v2}
 * - 裸字段列表：id=123, name=test
 * - ClassName@hashcode（保留原字符串）
 *
 * 解析器是宽松的：遇到无法识别的内容会跳过并记录 warning，保证一定能结束，不会死循环。
 */

const CODE = {
  TAB: 9,
  LF: 10,
  VT: 11,
  FF: 12,
  CR: 13,
  SPACE: 32,
  DOUBLE_QUOTE: 34,
  DOLLAR: 36,
  SINGLE_QUOTE: 39,
  OPEN_PAREN: 40,
  CLOSE_PAREN: 41,
  COMMA: 44,
  DOT: 46,
  EQUALS: 61,
  AT: 64,
  OPEN_BRACKET: 91,
  CLOSE_BRACKET: 93,
  UNDERSCORE: 95,
  OPEN_BRACE: 123,
  CLOSE_BRACE: 125
}

const MAX_WARNINGS = 50

// 顶层裸字段列表没有右括号，用 -1 表示“读到输入末尾为止”
const NO_CLOSER = -1

const JAVA_DATE_PATTERN = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}) (\d{2}):(\d{2}):(\d{2}) ([A-Za-z]{1,5}|GMT[+-]\d{2}:\d{2}) (\d{4})$/

const MONTH_NUMBERS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
}

// Java 在中国时区输出的 Date.toString() 时区缩写是 CST（China Standard Time, +08:00），
// 而 JS 的 Date 会把 CST 当成美国中部时间（-06:00），差 14 小时，所以这里显式映射
const TIMEZONE_OFFSETS = {
  CST: '+08:00',
  GMT: 'Z',
  UTC: 'Z'
}

// 超过 15 位有效数字的数值转成 Number 会丢精度（如雪花 ID），保留为字符串
const MAX_SAFE_DIGITS = 15
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/

function isWhitespace (code) {
  return code === CODE.SPACE || code === CODE.LF || code === CODE.CR ||
    code === CODE.TAB || code === CODE.VT || code === CODE.FF
}

function isIdentifierStart (code) {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
    code === CODE.UNDERSCORE || code === CODE.DOLLAR
}

function isIdentifierPart (code) {
  return isIdentifierStart(code) || (code >= 48 && code <= 57) || code === CODE.DOT
}

function isAlphanumeric (code) {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

function isOpener (code) {
  return code === CODE.OPEN_PAREN || code === CODE.OPEN_BRACE || code === CODE.OPEN_BRACKET
}

function isCloser (code) {
  return code === CODE.CLOSE_PAREN || code === CODE.CLOSE_BRACE || code === CODE.CLOSE_BRACKET
}

function closerOf (openerCode) {
  if (openerCode === CODE.OPEN_PAREN) return CODE.CLOSE_PAREN
  if (openerCode === CODE.OPEN_BRACE) return CODE.CLOSE_BRACE
  return CODE.CLOSE_BRACKET
}

function parseJavaDate (text) {
  const match = JAVA_DATE_PATTERN.exec(text)
  if (!match) return null

  const [, , monthName, day, hour, minute, second, zone, year] = match
  let offset = TIMEZONE_OFFSETS[zone]
  if (!offset && zone.startsWith('GMT')) offset = zone.slice(3)

  const timestamp = offset
    ? Date.parse(`${year}-${MONTH_NUMBERS[monthName]}-${day.padStart(2, '0')}T${hour}:${minute}:${second}${offset}`)
    : Date.parse(text) // 其他时区缩写（EST、PST 等）交给 Date 自己识别
  return Number.isNaN(timestamp) ? null : timestamp
}

function toNumberIfSafe (text) {
  if (!NUMBER_PATTERN.test(text)) return null
  // 007、0123 这类以 0 开头的多位数通常是编码，不当数字处理
  const unsigned = text[0] === '-' ? text.slice(1) : text
  if (unsigned.length > 1 && unsigned[0] === '0' && unsigned[1] !== '.') return null

  const digitCount = unsigned.replace('.', '').length
  if (digitCount > MAX_SAFE_DIGITS) return null
  return Number(text)
}

/**
 * @param {string} input Java toString 字符串
 * @param {{ convertDates?: boolean, convertNumbers?: boolean }} options
 *   convertDates: 把 Java Date.toString() 格式的时间转为毫秒时间戳（默认开启）
 *   convertNumbers: 把数字字符串转为数值类型（默认关闭）
 * @returns {{ value: any, warnings: Array<{ offset: number, line: number, column: number, message: string }> }}
 */
export function parseJavaToString (input, options = {}) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('请输入有效的 Java toString 字符串')
  }
  const { convertDates = true, convertNumbers = false } = options

  const text = input
  const length = text.length
  const warnings = []
  let pos = 0

  function addWarning (offset, message) {
    if (warnings.length >= MAX_WARNINGS) return
    let line = 1
    let lineStart = 0
    for (let i = 0; i < offset; i++) {
      if (text.charCodeAt(i) === CODE.LF) {
        line++
        lineStart = i + 1
      }
    }
    warnings.push({ offset, line, column: offset - lineStart + 1, message: `第 ${line} 行第 ${offset - lineStart + 1} 列：${message}` })
  }

  function skipWhitespace () {
    while (pos < length && isWhitespace(text.charCodeAt(pos))) pos++
  }

  function nextNonWhitespaceCode (from) {
    let index = from
    while (index < length && isWhitespace(text.charCodeAt(index))) index++
    return index < length ? text.charCodeAt(index) : NO_CLOSER
  }

  function isValueEnd (code) {
    return code === NO_CLOSER || code === CODE.COMMA || isCloser(code)
  }

  /**
   * 从 from 开始是否是 “key=” 的形式。
   * 用于判断 ( 或 { 后面是字段列表还是普通文本，以及值里的逗号是否是字段分隔符。
   */
  function looksLikeFieldStart (from) {
    let index = from
    while (index < length && isWhitespace(text.charCodeAt(index))) index++
    const keyStart = index
    while (index < length) {
      const code = text.charCodeAt(index)
      if (code === CODE.EQUALS) return index > keyStart
      if (code === CODE.COMMA || code === CODE.LF || isOpener(code) || isCloser(code) ||
        code === CODE.SINGLE_QUOTE || code === CODE.DOUBLE_QUOTE) {
        return false
      }
      index++
    }
    return false
  }

  function looksLikeFieldList (from, closeCode) {
    return nextNonWhitespaceCode(from) === closeCode || looksLikeFieldStart(from)
  }

  function parseValue (inFields) {
    skipWhitespace()
    if (pos >= length) return ''

    const code = text.charCodeAt(pos)
    if (code === CODE.OPEN_BRACKET) return parseArray()
    if (code === CODE.OPEN_BRACE && looksLikeFieldList(pos + 1, CODE.CLOSE_BRACE)) {
      pos++
      return parseFields(CODE.CLOSE_BRACE)
    }
    if (code === CODE.SINGLE_QUOTE || code === CODE.DOUBLE_QUOTE) {
      const quoted = tryParseQuotedString()
      if (quoted !== undefined) return quoted
    }
    if (isIdentifierStart(code)) {
      const named = tryParseNamedValue()
      if (named !== undefined) return named
    }
    return parsePrimitive(inFields)
  }

  function parseArray () {
    const openPos = pos
    pos++ // 跳过 [
    const result = []

    while (true) {
      skipWhitespace()
      if (pos >= length) {
        addWarning(openPos, "缺少与之匹配的 ']'")
        return result
      }
      const code = text.charCodeAt(pos)
      if (code === CODE.CLOSE_BRACKET) {
        pos++
        return result
      }
      if (code === CODE.COMMA) {
        pos++
        continue
      }
      if (isCloser(code)) {
        addWarning(pos, `多余的 '${text[pos]}'，已忽略`)
        pos++
        continue
      }

      result.push(parseValue(false))
      skipWhitespace()
      if (pos < length && text.charCodeAt(pos) === CODE.COMMA) pos++
    }
  }

  /**
   * 解析 key=value 列表，直到 closeCode。
   * 每一轮至少消费一个字符，确保不会死循环。
   */
  function parseFields (closeCode) {
    const openPos = pos - 1
    const result = {}

    while (true) {
      skipWhitespace()
      if (pos >= length) {
        if (closeCode !== NO_CLOSER) addWarning(openPos, `缺少与之匹配的 '${String.fromCharCode(closeCode)}'`)
        return result
      }

      const code = text.charCodeAt(pos)
      if (code === closeCode) {
        pos++
        return result
      }
      if (code === CODE.COMMA) {
        pos++
        continue
      }
      if (isCloser(code)) {
        addWarning(pos, `多余的 '${text[pos]}'，已忽略`)
        pos++
        continue
      }

      const keyStart = pos
      while (pos < length) {
        const keyCode = text.charCodeAt(pos)
        if (keyCode === CODE.EQUALS || keyCode === CODE.COMMA || isCloser(keyCode)) break
        pos++
      }

      if (pos >= length || text.charCodeAt(pos) !== CODE.EQUALS) {
        addWarning(keyStart, `无法识别的内容 '${text.slice(keyStart, pos).trim().slice(0, 30)}'，已忽略`)
        continue
      }

      const key = text.slice(keyStart, pos).trim()
      pos++ // 跳过 =
      const value = parseValue(true)
      assignField(result, key, value)
    }
  }

  // Lombok @ToString(callSuper = true) 会生成 super=Parent(...)，把父类字段展开到当前对象；
  // 父类没有自定义 toString 时是 super=ClassName@hash，没有信息量，直接丢弃
  function assignField (target, key, value) {
    if (key !== 'super') {
      target[key] = value
      return
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(target, value)
    }
  }

  /**
   * 解析以标识符开头的值：ClassName(...)、ClassName{...}、ClassName@hash。
   * 都不匹配时返回 undefined，并回退 pos，交给 parsePrimitive 处理。
   */
  function tryParseNamedValue () {
    const start = pos
    while (pos < length && isIdentifierPart(text.charCodeAt(pos))) pos++
    const code = pos < length ? text.charCodeAt(pos) : NO_CLOSER

    if (code === CODE.AT) {
      let hashEnd = pos + 1
      while (hashEnd < length && isAlphanumeric(text.charCodeAt(hashEnd))) hashEnd++
      if (hashEnd > pos + 1 && isValueEnd(nextNonWhitespaceCode(hashEnd))) {
        pos = hashEnd
        return text.slice(start, pos)
      }
    }

    if (code === CODE.OPEN_PAREN || code === CODE.OPEN_BRACE) {
      const closeCode = closerOf(code)
      if (looksLikeFieldList(pos + 1, closeCode)) {
        pos++
        return parseFields(closeCode)
      }
    }

    pos = start
    return undefined
  }

  /**
   * 引号字符串：只有引号后面紧跟分隔符（逗号、右括号或结尾）才算结束，
   * 这样 name='O'Brien' 这类内容不会被提前截断。找不到合法结尾时返回 undefined。
   * Java toString 不会转义字符串内容，所以这里保留原文，不处理反斜杠。
   */
  function tryParseQuotedString () {
    const quote = text[pos]
    let searchFrom = pos + 1
    while (true) {
      const closeIndex = text.indexOf(quote, searchFrom)
      if (closeIndex === -1) return undefined
      if (isValueEnd(nextNonWhitespaceCode(closeIndex + 1))) {
        const value = text.slice(pos + 1, closeIndex)
        pos = closeIndex + 1
        return value
      }
      searchFrom = closeIndex + 1
    }
  }

  /**
   * 普通值：读到同层级的逗号或右括号为止，内部括号按层级跳过。
   * 在字段列表里，逗号后面不是 “key=” 时视为值的一部分（例如 remark=a, b, c）。
   */
  function parsePrimitive (inFields) {
    const start = pos
    let depth = 0

    while (pos < length) {
      const code = text.charCodeAt(pos)
      if (isOpener(code)) {
        depth++
      } else if (isCloser(code)) {
        if (depth === 0) break
        depth--
      } else if (code === CODE.COMMA && depth === 0) {
        if (!inFields) break
        const nextCode = nextNonWhitespaceCode(pos + 1)
        if (isValueEnd(nextCode) || looksLikeFieldStart(pos + 1)) break
      }
      pos++
    }

    return convertPrimitive(text.slice(start, pos).trim())
  }

  function convertPrimitive (raw) {
    if (raw === 'null') return null
    if (raw === 'true') return true
    if (raw === 'false') return false

    if (convertDates && raw.length >= 24 && raw.length <= 40) {
      const timestamp = parseJavaDate(raw)
      if (timestamp !== null) return timestamp
    }
    if (convertNumbers) {
      const number = toNumberIfSafe(raw)
      if (number !== null) return number
    }
    return raw
  }

  function parseTopLevel () {
    skipWhitespace()
    const startsWithBracket = text.charCodeAt(pos) === CODE.OPEN_BRACKET

    // 裸字段列表：id=123, name=test（Foo(a=1) 的 = 在括号之后，不会命中）
    if (!startsWithBracket && looksLikeFieldStart(pos)) {
      return parseFields(NO_CLOSER)
    }

    const value = parseValue(false)
    skipWhitespace()
    if (pos < length) {
      addWarning(pos, '之后的内容未能解析')
    }

    // 单元素 List 的 toString 形如 [Request(...)]，用户关心的是里面的对象，直接展开
    const isSingleObjectList = startsWithBracket && Array.isArray(value) && value.length === 1 &&
      typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])
    return isSingleObjectList ? value[0] : value
  }

  const value = parseTopLevel()
  return { value, warnings }
}
