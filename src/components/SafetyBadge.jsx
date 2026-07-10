const LEVEL_STYLES = {
  safe:    { bg: 'var(--safe-bg)',    fg: 'var(--safe-fg)',    bd: null,              label: '급여 가능', icon: null, weight: 700 },
  caution: { bg: 'var(--caution-bg)', fg: 'var(--caution-fg)', bd: null,              label: '주의 필요', icon: null, weight: 700 },
  danger:  { bg: 'var(--danger-bg)',  fg: 'var(--danger-fg)',  bd: 'var(--danger-bd)', label: '급여 금지', icon: null, weight: 800 },
  unknown: { bg: 'var(--surface-2)',  fg: 'var(--ink-3)',      bd: null,              label: '확인 필요', icon: null, weight: 700 },
}

export default function SafetyBadge({ level, size = 'm' }) {
  const c = LEVEL_STYLES[level] ?? LEVEL_STYLES.unknown
  const small = size === 's'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: c.icon ? 3 : 0,
        background: c.bg,
        color: c.fg,
        border: c.bd ? `1px solid ${c.bd}` : '1px solid transparent',
        borderRadius: 20,
        padding: small ? '2px 8px' : '4px 12px',
        fontSize: small ? 10 : 11,
        fontWeight: c.weight,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      {c.icon && <span style={{ fontSize: small ? 9 : 10, lineHeight: 1 }}>{c.icon}</span>}
      {c.label}
    </span>
  )
}
