const DISCLAIMER_TEXT =
  '이 서비스는 의료·수의학적 진단 또는 처방을 대체하지 않습니다. 식이 변경 전 반드시 수의사와 상담하세요.'

export default function Disclaimer({ compact = false }) {
  return (
    <div
      style={{
        borderTop: compact ? 'none' : '1px solid var(--divider)',
        padding: compact ? '8px 0' : '12px 16px',
        fontSize: 9,
        color: 'var(--ink-3)',
        lineHeight: 1.4,
      }}
    >
      {DISCLAIMER_TEXT}
    </div>
  )
}

export { DISCLAIMER_TEXT }
