import { IconBack } from './icons/index.jsx'

export default function TopBar({ onBack, right, title, transparent = false, className }) {
  return (
    <div
      className={className}
      style={{
        height: 48,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        background: transparent ? 'transparent' : 'var(--bg)',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="press"
        aria-label="뒤로 가기"
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-1)',
        }}
      >
        <IconBack size={22} />
      </button>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-1)' }}>{title}</div>
      <div
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {right}
      </div>
    </div>
  )
}
