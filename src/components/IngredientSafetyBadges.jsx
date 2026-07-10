import { useEffect, useRef, useState } from 'react'
import SafetyBadge from './SafetyBadge.jsx'

/** 알러지 등록 재료 배지 */
export function AllergyBadge({ onDangerBg = false }) {
  return (
    <span style={{
      background: onDangerBg ? 'var(--surface)' : 'var(--danger-bg)',
      color: 'var(--danger-fg)',
      fontSize: 11,
      fontWeight: 700,
      borderRadius: 20,
      padding: '2px 8px',
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>
      알러지
    </span>
  )
}

/** 주의 필요 배지 — 클릭/호버 시 note 툴팁 */
export function CautionBadgeWithTooltip({ note, size = 's' }) {
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

  if (!note) return <SafetyBadge level="caution" size={size} />

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="press"
        onClick={() => setOpen((v) => !v)}
        aria-label="주의사항 보기"
        aria-expanded={open}
        style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <SafetyBadge level="caution" size={size} />
      </button>
      {open && (
        <div
          className="fade-in"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            zIndex: 50,
            minWidth: 200,
            maxWidth: 260,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: 'var(--ink-2)',
            lineHeight: 1.5,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {note}
        </div>
      )}
    </div>
  )
}

/**
 * 재료 안전성 배지 묶음 — SafetyBadge + 알러지 + 주의 툴팁
 */
export function IngredientSafetyBadges({ level, note, isAllergic, onDangerBg = false, size = 's' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {level === 'caution' && note ? (
        <CautionBadgeWithTooltip note={note} size={size} />
      ) : (
        <SafetyBadge level={level} size={size} />
      )}
      {isAllergic && <AllergyBadge onDangerBg={onDangerBg} />}
    </div>
  )
}
