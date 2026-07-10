import { useEffect, useRef, useState } from 'react'
import { IconBulb, IconClose } from './icons/index.jsx'

export default function HelpTooltip({ content, label = '도움말', trigger = 'question' }) {
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
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="press"
        aria-label={label}
        aria-expanded={open}
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: open ? 'var(--primary-soft)' : 'var(--surface-2)',
          color: open ? 'var(--primary)' : 'var(--ink-3)',
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {trigger === 'bulb' ? (
          <IconBulb size={14} color={open ? 'var(--primary)' : 'var(--ink-3)'} />
        ) : (
          '?'
        )}
      </button>
      {open && (
        <div
          className="fade-in"
          role="tooltip"
          style={{
            position: 'absolute',
            top: 28,
            right: 0,
            minWidth: 260,
            maxWidth: 300,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 14,
            zIndex: 80,
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="닫기"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: 'var(--ink-3)',
              padding: 4,
            }}
          >
            <IconClose size={14} color="var(--ink-3)" />
          </button>
          {content}
        </div>
      )}
    </span>
  )
}
