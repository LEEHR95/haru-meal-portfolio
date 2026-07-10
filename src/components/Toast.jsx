import { useEffect } from 'react'

export default function Toast({ msg, onDone, duration = 1800 }) {
  useEffect(() => {
    if (!msg) return undefined
    const t = setTimeout(() => onDone?.(), duration)
    return () => clearTimeout(t)
  }, [msg, onDone, duration])

  if (!msg) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        top: 60,
        zIndex: 200,
        width: '100%',
        maxWidth: 'var(--app-max-width)',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        padding: '0 16px',
      }}
    >
      <div
        className="fade-in"
        style={{
          background: 'var(--ink-1)',
          color: 'var(--surface)',
          padding: '10px 16px',
          borderRadius: 24,
          fontSize: 13,
          fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}
      >
        {msg}
      </div>
    </div>
  )
}
