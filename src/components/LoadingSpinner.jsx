export default function LoadingSpinner({ size = 24 }) {
  return (
    <div
      className="loading-spinner"
      style={{
        width: size,
        height: size,
        border: '2.5px solid var(--primary-soft)',
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
      }}
      role="status"
      aria-label="로딩 중"
    />
  )
}
