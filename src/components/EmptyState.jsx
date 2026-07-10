import { IconSearch } from './icons/index.jsx'

const MESSAGES = {
  search: '검색 결과가 없어요. 다른 재료를 입력해보세요.',
  recipe: '아직 등록된 레시피가 없어요.',
  network: '잠시 후 다시 시도해주세요.',
}

export default function EmptyState({ kind = 'search', custom }) {
  const msg = custom ?? MESSAGES[kind] ?? MESSAGES.search

  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        color: 'var(--ink-3)',
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          background: 'var(--surface-2)',
          margin: '0 auto 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-4)',
        }}
      >
        <IconSearch size={22} color="var(--ink-4)" />
      </div>
      {msg}
    </div>
  )
}
