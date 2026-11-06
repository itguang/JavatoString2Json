/**
 * uTools 能力的薄封装。
 * 所有调用都判断 window.utools 是否存在，这样直接用浏览器打开 dist/index.html 也能调试。
 */

const utools = window.utools

export function onPluginEnter (callback) {
  utools?.onPluginEnter(callback)
}

export async function copyText (text) {
  if (utools) return utools.copyText(text)
  await navigator.clipboard.writeText(text)
  return true
}

export async function readClipboardText () {
  if (window.services?.readClipboardText) return window.services.readClipboardText()
  try {
    return await navigator.clipboard.readText()
  } catch (error) {
    console.warn('[Java转JSON] 读取剪贴板失败：', error)
    return ''
  }
}

export function loadSetting (key, fallback) {
  try {
    const value = utools ? utools.dbStorage.getItem(key) : JSON.parse(localStorage.getItem(key))
    return value ?? fallback
  } catch (error) {
    console.warn(`[Java转JSON] 读取设置 ${key} 失败：`, error)
    return fallback
  }
}

export function saveSetting (key, value) {
  try {
    if (utools) {
      utools.dbStorage.setItem(key, value)
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (error) {
    console.warn(`[Java转JSON] 保存设置 ${key} 失败：`, error)
  }
}
