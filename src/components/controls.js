import React from 'react'

export function Button ({ icon, children, variant = 'ghost', title, disabled, onClick }) {
  return (
    <button type='button' className={`btn btn-${variant}`} title={title} disabled={disabled} onClick={onClick}>
      {icon}
      {children && <span>{children}</span>}
    </button>
  )
}

export function Toggle ({ checked, label, title, onChange }) {
  return (
    <button type='button' role='switch' aria-checked={checked} title={title}
      className={`toggle${checked ? ' toggle-on' : ''}`} onClick={() => onChange(!checked)}>
      <span className='toggle-dot' />
      {label}
    </button>
  )
}

export function SegmentedControl ({ value, options, title, onChange }) {
  return (
    <div className='segmented' role='radiogroup' title={title}>
      {options.map(option => (
        <button type='button' key={option.value} role='radio' aria-checked={option.value === value}
          className={option.value === value ? 'segmented-item segmented-item-active' : 'segmented-item'}
          onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function PaneHeader ({ title, subtitle, children }) {
  return (
    <div className='pane-header'>
      <div className='pane-title'>
        {title}
        {subtitle && <span className='pane-subtitle'>{subtitle}</span>}
      </div>
      <div className='pane-actions'>{children}</div>
    </div>
  )
}
