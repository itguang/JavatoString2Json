import React, { useEffect, useRef, useState } from 'react'

const MIN_RATIO = 0.2
const MAX_RATIO = 0.8
const NARROW_QUERY = '(max-width: 640px)'

function useMediaQuery (query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const handleChange = event => setMatches(event.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [query])
  return matches
}

/**
 * 两栏布局，中间分隔条可拖拽。窗口宽度不超过 640px 时改为上下排列。
 * ratio 是第一栏所占比例，由父组件持有（便于持久化）。
 */
export default function SplitPane ({ first, second, ratio, onRatioChange }) {
  const containerRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const isVertical = useMediaQuery(NARROW_QUERY)

  function handlePointerDown (event) {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function handlePointerMove (event) {
    if (!dragging) return
    const rect = containerRef.current.getBoundingClientRect()
    const nextRatio = isVertical
      ? (event.clientY - rect.top) / rect.height
      : (event.clientX - rect.left) / rect.width
    onRatioChange(Math.min(MAX_RATIO, Math.max(MIN_RATIO, nextRatio)), { final: false })
  }

  function handlePointerUp (event) {
    if (!dragging) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    setDragging(false)
    onRatioChange(ratio, { final: true })
  }

  return (
    <div ref={containerRef}
      className={`split-pane ${isVertical ? 'split-pane-vertical' : 'split-pane-horizontal'}${dragging ? ' split-pane-dragging' : ''}`}>
      <div className='split-pane-item' style={{ flexBasis: `${ratio * 100}%` }}>{first}</div>
      <div className='split-pane-divider' role='separator' aria-orientation={isVertical ? 'horizontal' : 'vertical'}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
        onDoubleClick={() => onRatioChange(0.5, { final: true })} title='拖拽调整宽度，双击恢复'>
        <span className='split-pane-handle' />
      </div>
      <div className='split-pane-item split-pane-item-rest'>{second}</div>
    </div>
  )
}
