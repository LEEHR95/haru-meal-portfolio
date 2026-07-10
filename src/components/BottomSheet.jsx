export default function BottomSheet({ open, onClose, children, panelClassName }) {
  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        /* .app-bottom-nav(100) 위 — dim·시트가 전체 화면·하단 네비를 덮음 */
        zIndex: 200,
        background: 'rgba(20,16,12,0.4)',
        animation: 'fadeIn 0.2s ease-out',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={panelClassName}
        style={{
          width: '100%',
          maxWidth: 'var(--app-max-width)',
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: '12px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
          animation: 'sheetUp 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 4,
            background: 'var(--border-strong)',
            margin: '0 auto 16px',
          }}
        />
        {children}
      </div>
    </div>
  )
}
