import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconChevron } from './icons/index.jsx'

export default function Dropdown({
  label,
  value,
  options = [],
  onChange,
  placeholder,
  disabled = false,
  leftDot,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      {label && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, fontWeight: 500 }}>
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        className="press"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          width: '100%',
          background: disabled ? 'var(--bg-tint)' : 'var(--surface-2)',
          border: `1px solid ${open ? 'var(--primary)' : 'transparent'}`,
          borderRadius: 24,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          minWidth: 0,
          color: value ? 'var(--ink-1)' : 'var(--ink-4)',
          fontSize: 13,
          fontWeight: value ? 500 : 400,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
            flex: 1,
            justifyContent: value ? 'flex-start' : 'center',
          }}
        >
          {value && leftDot && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: leftDot,
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value || placeholder}
          </span>
        </span>
        <IconChevron
          dir={open ? 'up' : 'down'}
          size={14}
          color={disabled ? 'var(--ink-4)' : 'var(--ink-3)'}
        />
      </button>

      {open && options.length > 0 && (
        <div
          className="fade-in"
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            zIndex: 50,
            maxHeight: 240,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {options.map((opt) => {
            const v = typeof opt === 'string' ? opt : opt.value
            const l = typeof opt === 'string' ? opt : opt.label
            const dot = typeof opt === 'object' ? opt.dot : null
            const active = v === value
            return (
              <button
                key={v}
                type="button"
                role="option"
                aria-selected={active}
                className="press"
                onClick={() => {
                  onChange?.(v)
                  setOpen(false)
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: active ? 'var(--surface-2)' : 'transparent',
                  color: 'var(--ink-1)',
                  fontSize: 13,
                  padding: '10px 12px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontWeight: active ? 600 : 500,
                }}
              >
                {dot && (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: dot,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span style={{ flex: 1 }}>{l}</span>
                {active && <IconCheck size={16} color="var(--primary)" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
