import { useState } from 'react'
import SafetyBadge from './SafetyBadge.jsx'
import { IconHeart } from './icons/index.jsx'

// 카드 표시 전용: 분량 제거 (matchedNames 비교는 원본 유지)
const _IC_AMOUNT_RE = /^(.+?)\s+(생략가능|적당량|약간|\d+(?:\.\d+)?\s*(?:g|kg|ml|L|개|장|작은술|큰술|스푼|봉지|줄기|묶음|다발|쪽|편|조각|컵|T(?:bsp)?|t(?:sp)?))$/i

function stripIngredientAmount(ingredient) {
  const raw = typeof ingredient === 'string' ? ingredient : (ingredient?.name ?? '')
  if (!raw) return ''
  if (typeof ingredient !== 'string' && (ingredient?.amount ?? '').trim()) return raw
  const m = raw.match(_IC_AMOUNT_RE)
  return m ? m[1].trim() : raw
}

export function RecipeThumb({ imageUrl, label, ratio = 1, radius = 12 }) {
  const [imgError, setImgError] = useState(false)
  const showImage = Boolean(imageUrl) && !imgError

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: ratio,
        borderRadius: radius,
        overflow: 'hidden',
        background: showImage ? 'var(--surface-2)' : 'var(--recipe-thumb-placeholder-bg, #EDE8DF)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={label || ''}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
        />
      ) : (
        <img
          src="/icons/하루한끼_문구.png"
          alt=""
          style={{ width: '58%', height: 'auto', objectFit: 'contain', opacity: 1 }}
        />
      )}
    </div>
  )
}

export function BookmarkBtn({ active, onClick, floating = false, size = 22 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press"
      aria-label={active ? '북마크 해제' : '북마크 추가'}
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        background: floating ? 'rgba(255,255,255,0.85)' : 'transparent',
        backdropFilter: floating ? 'blur(8px)' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <IconHeart
        filled={active}
        size={size - 2}
        color={active ? 'var(--primary)' : 'var(--ink-3)'}
      />
    </button>
  )
}

function CardClickRoot({ onClick, className, style, children }) {
  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget) return
    if (!onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(e)
    }
  }

  return (
    <article
      role="button"
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={className}
      style={{ ...style, cursor: onClick ? 'pointer' : undefined }}
    >
      {children}
    </article>
  )
}

export default function IngredientCard({
  recipe,
  matchCount,
  matchedNames = [],
  bookmarked = false,
  onToggleBookmark,
  onClick,
}) {
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : []
  const ingredientCount = ingredients.length

  return (
    <CardClickRoot
      onClick={onClick}
      className="press recipe-card recipe-card--ingredient"
      style={{
        textAlign: 'left',
        width: '100%',
        display: 'flex',
        gap: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ width: 76, flexShrink: 0 }}>
        <RecipeThumb
          color={recipe?.color}
          imageUrl={recipe?.imageUrl}
          label={recipe?.name}
          ratio={1}
        />
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          paddingTop: 2,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink-1)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1,
            }}
          >
            {recipe?.name}
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              padding: '2px 8px',
              borderRadius: 10,
              flexShrink: 0,
            }}
          >
            {matchCount}/{ingredientCount || 1} 일치
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SafetyBadge level={recipe?.safety} size="s" />
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{recipe?.type}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {ingredients.map((ingredient, index) => {
            const ingredientName = typeof ingredient === 'string' ? ingredient : (ingredient?.name ?? '')
            const displayName = stripIngredientAmount(ingredient)
            return (
              <span key={ingredientName || index}>
                <span
                  style={{
                    color: matchedNames.includes(ingredientName) ? 'var(--primary)' : 'var(--ink-3)',
                    fontWeight: matchedNames.includes(ingredientName) ? 600 : 400,
                  }}
                >
                  {displayName}
                </span>
                {index < ingredients.length - 1 && (
                  <span style={{ color: 'var(--ink-4)' }}> · </span>
                )}
              </span>
            )
          })}
        </div>
      </div>
      <BookmarkBtn
        active={bookmarked}
        onClick={(e) => {
          e.stopPropagation()
          onToggleBookmark?.()
        }}
      />
    </CardClickRoot>
  )
}
