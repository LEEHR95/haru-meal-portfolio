import { useState } from 'react'
import SafetyBadge from './SafetyBadge.jsx'
import { IconHeart } from './icons/index.jsx'
import { useProfile } from '../store/useApp.js'
import pawIconUrl from './icons/paw-icon-02.png'

function shade(hex, amt) { // eslint-disable-line no-unused-vars
  const n = parseInt((hex || '#E8B57D').replace('#', ''), 16)
  let r = (n >> 16) + amt
  let g = ((n >> 8) & 0xff) + amt
  let b = (n & 0xff) + amt
  r = Math.max(0, Math.min(255, r))
  g = Math.max(0, Math.min(255, g))
  b = Math.max(0, Math.min(255, b))
  return `#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

function RecipeThumb({ imageUrl, label, ratio = 1, radius = 12 }) {
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

const GOOD_REACTION_KEY = '잘 먹었어요'
const SENSITIVE_REACTION_KEY = '급여 후 불편 반응이 있었어요'

// reactionStats 가 있을 때만 raw count 반환 (5명 미만이면 stats 자체가 없음)
function getReactionSummary(recipe) {
  const stats = recipe.reactionStats ?? recipe.reaction_stats
  if (!stats || typeof stats !== 'object') return null
  const good = Number(stats[GOOD_REACTION_KEY] ?? 0)
  const sensitive = Number(stats[SENSITIVE_REACTION_KEY] ?? 0)
  if (good === 0 && sensitive === 0) return null
  return { good, sensitive }
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

function BookmarkBtn({ active, onClick, floating = false, size = 22 }) {
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

// 카드 표시 전용: "재료명 분량" 형식에서 분량만 제거, 재료명 반환
// 상세 페이지의 parseIngredientDisplay 와 별개 — 카드에서는 분량 미노출 정책
const _CARD_AMOUNT_RE = /^(.+?)\s+(생략가능|적당량|약간|\d+(?:\.\d+)?\s*(?:g|kg|ml|L|개|장|작은술|큰술|스푼|봉지|줄기|묶음|다발|쪽|편|조각|컵|T(?:bsp)?|t(?:sp)?))$/i

function extractIngredientName(ingredient) {
  const raw = typeof ingredient === 'string' ? ingredient : (ingredient?.name ?? '')
  if (!raw) return ''
  // 별도 amount 필드가 있으면 name은 이미 분량 없이 저장됨
  if (typeof ingredient !== 'string' && (ingredient?.amount ?? '').trim()) return raw
  // name에 분량이 합쳐진 경우 정규식으로 제거
  const m = raw.match(_CARD_AMOUNT_RE)
  return m ? m[1].trim() : raw
}

function getIngredientLine(recipe, limit = null) {
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : []
  const list = limit == null ? ingredients : ingredients.slice(0, limit)
  return list
    .map(extractIngredientName)
    .filter(Boolean)
    .join(' · ')
}

export default function RecipeCard({
  recipe,
  onClick,
  bookmarked = false,
  onToggleBookmark,
  layout = 'feed',
}) {
  const profile = useProfile()
  const [cardImgError, setCardImgError] = useState(false)
  const reactionSummary = getReactionSummary(recipe)

  if (layout === 'h') {
    const ingredientLine = getIngredientLine(recipe)
    const isDanger = profile && recipe?.safety === 'danger'

    return (
      <CardClickRoot
        onClick={onClick}
        className="press recipe-card recipe-card--h"
        style={{
          textAlign: 'left',
          width: '100%',
          display: 'flex',
          alignItems: 'stretch',
          gap: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 12,
          boxShadow: isDanger
            ? '0 1px 4px rgba(0,0,0,0.05), inset 3px 0 0 var(--danger-fg)'
            : '0 1px 4px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
        {/* 요구사항 1: 이미지 폭 축소(72→64) + 클래스 추가 */}
        <div className="recipe-card--h__thumb" style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 10, overflow: 'hidden' }}>
          <RecipeThumb
            color={recipe?.color || '#E8B57D'}
            imageUrl={recipe?.imageUrl}
            label={recipe?.name}
            ratio={1}
            radius={10}
          />
        </div>
        {/* 요구사항 1: 텍스트 영역 더 확보 + 클래스 추가 */}
        <div
          className="recipe-card--h__body"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            minWidth: 0,
            justifyContent: 'center',
            paddingLeft: 2,           /* 약간의 숨통 */
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div
              className="recipe-card--h__title recipe-card__title"
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--ink-1)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {recipe?.name}
            </div>
            <BookmarkBtn
              active={bookmarked}
              onClick={(e) => {
                e.stopPropagation()
                onToggleBookmark?.()
              }}
            />
          </div>

          <div
            className="recipe-card--h__ingr"
            style={{
              fontSize: 12,
              color: 'var(--ink-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {ingredientLine}
          </div>

          {(profile || reactionSummary != null) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {profile && <SafetyBadge level={recipe?.safety} size="s" />}
              {reactionSummary != null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {reactionSummary.good > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--ink-3)' }}>
                      <img src={pawIconUrl} alt="" style={{ width: 12, height: 12, objectFit: 'contain' }} />
                      {reactionSummary.good}
                    </span>
                  )}
                  {reactionSummary.sensitive > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      민감 {reactionSummary.sensitive}
                    </span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </CardClickRoot>
    )
  }

  if (layout === 'mini') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="press recipe-card recipe-card--mini"
        style={{
          textAlign: 'left',
          width: 140,
          flexShrink: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <RecipeThumb
          color={recipe?.color}
          imageUrl={recipe?.imageUrl}
          label={recipe?.name}
          ratio={1.15}
          radius={8}
        />
        <div
          className="recipe-card__title"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ink-1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {recipe?.name}
        </div>
        {profile && <SafetyBadge level={recipe?.safety} size="s" />}
      </button>
    )
  }

  if (layout === 'v') {
    return (
      <CardClickRoot
        onClick={onClick}
        className="press recipe-card recipe-card--v"
        style={{
          textAlign: 'left',
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ position: 'relative' }}>
          <RecipeThumb
            color={recipe?.color}
            imageUrl={recipe?.imageUrl}
            label={recipe?.name}
            ratio={1.6}
          />
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <BookmarkBtn
              active={bookmarked}
              floating
              onClick={(e) => {
                e.stopPropagation()
                onToggleBookmark?.()
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 4px 4px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              className="recipe-card__title"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--ink-1)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {recipe?.name}
            </div>
            {profile && <SafetyBadge level={recipe?.safety} size="s" />}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {recipe?.type} · {getIngredientLine(recipe)}
          </div>
        </div>
      </CardClickRoot>
    )
  }

  const ingredientLine = getIngredientLine(recipe, 5)
  const hasImg = Boolean(recipe?.imageUrl) && !cardImgError
  const isFeedDanger = profile && recipe?.safety === 'danger'

  return (
    <CardClickRoot
      onClick={onClick}
      className="press recipe-card recipe-card--feed"
      style={{
        textAlign: 'left',
        width: '100%',
        height: '100%',
        background: 'var(--surface)',
        border: isFeedDanger ? '1.5px solid var(--danger-bd)' : '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        className="feed-reco-card__img"
        style={{
          flexShrink: 0,
          overflow: 'hidden',
          background: 'var(--recipe-thumb-placeholder-bg, #EDE8DF)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {hasImg ? (
          <img
            src={recipe.imageUrl}
            alt={recipe?.name || ''}
            onError={() => setCardImgError(true)}
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

      <div className="recipe-card--feed__body">
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--ink-1)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {recipe?.name}
        </div>
        {ingredientLine && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {ingredientLine}
          </div>
        )}
        {(profile || reactionSummary != null) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            {profile && <SafetyBadge level={recipe?.safety} size="s" />}
            {reactionSummary != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {reactionSummary.good > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--ink-3)' }}>
                    <img src={pawIconUrl} alt="" style={{ width: 12, height: 12, objectFit: 'contain' }} />
                    {reactionSummary.good}
                  </span>
                )}
                {reactionSummary.sensitive > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>
                    민감 {reactionSummary.sensitive}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </CardClickRoot>
  )
}
