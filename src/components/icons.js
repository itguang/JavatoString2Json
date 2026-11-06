import React from 'react'

// 线性图标，统一 16px、1.6 描边，颜色跟随 currentColor

function Icon ({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor'
      strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
      {children}
    </svg>
  )
}

export function CopyIcon () {
  return <Icon><rect x='9' y='9' width='12' height='12' rx='2' /><path d='M5 15V5a2 2 0 0 1 2-2h10' /></Icon>
}

export function CompressIcon () {
  return <Icon><path d='M4 9h16M4 15h16' /><path d='m9 4 3 3 3-3M9 20l3-3 3 3' /></Icon>
}

export function ClearIcon () {
  return <Icon><path d='M4 7h16M10 11v6M14 11v6' /><path d='M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3' /></Icon>
}

export function SampleIcon () {
  return <Icon><path d='M14 3v5h5' /><path d='M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z' /><path d='M9 13h6M9 17h4' /></Icon>
}

export function PasteIcon () {
  return <Icon><rect x='6' y='4' width='12' height='17' rx='2' /><path d='M9 4V3h6v1' /><path d='M9 11h6M9 15h4' /></Icon>
}

export function WarningIcon () {
  return <Icon size={14}><path d='M12 4 2.5 20h19z' /><path d='M12 10v4M12 17.5v.01' /></Icon>
}

export function ErrorIcon () {
  return <Icon size={14}><circle cx='12' cy='12' r='9' /><path d='M12 8v5M12 16.5v.01' /></Icon>
}

export function CheckIcon () {
  return <Icon size={14}><path d='m5 12 5 5 9-10' /></Icon>
}

export function BracesIcon ({ size = 16 }) {
  return <Icon size={size}><path d='M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1' /></Icon>
}
