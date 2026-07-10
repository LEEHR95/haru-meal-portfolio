import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../routes.js'

export default function OfflinePage() {
  const navigate = useNavigate()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70dvh',
      padding: '40px 24px',
      textAlign: 'center',
      gap: 16,
    }}>
      <div style={{ fontSize: 56, lineHeight: 1 }}>🐾</div>

      <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-1)', margin: 0 }}>
        인터넷 연결이 없어요
      </p>

      <p style={{
        fontSize: 14,
        color: 'var(--ink-2)',
        lineHeight: 1.7,
        maxWidth: 280,
        margin: 0,
      }}>
        네트워크를 확인한 뒤 다시 시도해주세요.<br />
        이전에 방문한 페이지는 오프라인에서도 볼 수 있어요.
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => location.reload()}
          style={{
            padding: '12px 28px',
            background: 'var(--primary)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
        <button
          onClick={() => navigate(ROUTES.home)}
          style={{
            padding: '12px 24px',
            background: 'var(--surface)',
            color: 'var(--ink-2)',
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 12,
            border: '1px solid var(--divider)',
            cursor: 'pointer',
          }}
        >
          홈으로
        </button>
      </div>
    </div>
  )
}
