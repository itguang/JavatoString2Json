import { useCallback, useEffect, useRef, useState } from 'react'
import { convertToJson } from './convertToJson.js'

// 兜底：解析器出现意料之外的死循环时，不让 Worker 一直占着 CPU
const PARSE_TIMEOUT_MS = 10000

const IDLE_RESULT = { status: 'idle', json: '', warnings: [], lineCount: 0, parseMs: 0, error: '' }

function toResult (response) {
  if (response.error) return { ...IDLE_RESULT, status: 'error', error: response.error }
  return { status: 'done', json: response.json, warnings: response.warnings, lineCount: response.lineCount, parseMs: response.parseMs, error: '' }
}

function createParserWorker () {
  try {
    return new Worker(new URL('./parser.worker.js', import.meta.url), { name: 'parser' })
  } catch (error) {
    console.warn('[Java转JSON] 无法创建 Web Worker，改为主线程解析：', error)
    return null
  }
}

/**
 * 在 Web Worker 中解析 Java toString，避免大内容阻塞界面。
 * - 新请求到来时，正在执行的旧请求直接终止（重建 Worker），保证总是尽快响应最新输入
 * - Worker 不可用时降级到主线程解析
 */
export function useJsonConverter () {
  const [result, setResult] = useState(IDLE_RESULT)
  const workerRef = useRef(null)
  const workerUnavailableRef = useRef(false)
  const pendingRequestRef = useRef(null)
  const latestRequestIdRef = useRef(0)
  const timeoutTimerRef = useRef(null)

  const finishRequest = useCallback((requestId, response) => {
    if (requestId !== latestRequestIdRef.current) return
    clearTimeout(timeoutTimerRef.current)
    pendingRequestRef.current = null
    setResult(toResult(response))
  }, [])

  const convertOnMainThread = useCallback((request) => {
    // 先让出一帧，让“解析中”的状态渲染出来
    setTimeout(() => finishRequest(request.requestId, convertToJson(request.text, request.options)), 16)
  }, [finishRequest])

  const startWorker = useCallback(() => {
    const worker = createParserWorker()
    if (!worker) {
      workerUnavailableRef.current = true
      return null
    }
    worker.onmessage = (event) => finishRequest(event.data.requestId, event.data)
    worker.onerror = (event) => {
      // 通常是 Worker 脚本加载失败（例如 file:// 路径问题），之后都走主线程
      console.warn('[Java转JSON] Web Worker 出错，改为主线程解析：', event.message)
      event.preventDefault()
      worker.terminate()
      workerRef.current = null
      workerUnavailableRef.current = true
      if (pendingRequestRef.current) convertOnMainThread(pendingRequestRef.current)
    }
    workerRef.current = worker
    return worker
  }, [finishRequest, convertOnMainThread])

  useEffect(() => {
    startWorker()
    return () => {
      clearTimeout(timeoutTimerRef.current)
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [startWorker])

  const restartWorker = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    return startWorker()
  }, [startWorker])

  const convert = useCallback((text, options) => {
    const requestId = ++latestRequestIdRef.current
    clearTimeout(timeoutTimerRef.current)

    if (!text.trim()) {
      pendingRequestRef.current = null
      setResult(IDLE_RESULT)
      return
    }

    const isPreviousRequestRunning = pendingRequestRef.current !== null
    const request = { requestId, text, options }
    pendingRequestRef.current = request
    setResult(previous => ({ ...previous, status: 'parsing', error: '' }))

    if (workerUnavailableRef.current) {
      convertOnMainThread(request)
      return
    }

    const worker = isPreviousRequestRunning ? restartWorker() : (workerRef.current || startWorker())
    if (!worker) {
      convertOnMainThread(request)
      return
    }

    worker.postMessage(request)
    timeoutTimerRef.current = setTimeout(() => {
      if (requestId !== latestRequestIdRef.current) return
      restartWorker()
      finishRequest(requestId, { error: `解析超过 ${PARSE_TIMEOUT_MS / 1000} 秒，已中止。请检查输入格式` })
    }, PARSE_TIMEOUT_MS)
  }, [convertOnMainThread, finishRequest, restartWorker, startWorker])

  return { result, convert }
}
