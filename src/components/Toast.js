import React, { useCallback, useEffect, useRef, useState } from 'react'

const TOAST_DURATION_MS = 1800

/**
 * 轻提示。返回 [toastElement, showToast]，showToast(message, type) 中 type 为 'success' | 'error' | 'info'
 */
export function useToast () {
  const [toast, setToast] = useState(null)
  const hideTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(hideTimerRef.current), [])

  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(hideTimerRef.current)
    // key 每次变化，连续提示时动画能重新播放
    setToast({ message, type, key: Date.now() })
    hideTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }, [])

  const toastElement = toast && (
    <div key={toast.key} className={`toast toast-${toast.type}`} role='status'>{toast.message}</div>
  )
  return [toastElement, showToast]
}
