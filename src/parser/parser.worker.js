import { convertToJson } from './convertToJson.js'

self.onmessage = (event) => {
  const { requestId, text, options } = event.data
  self.postMessage({ requestId, ...convertToJson(text, options) })
}
