import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RECIPES } from '../data/index.js'
import { useApp, useBookmarks, useProfile, useToast } from '../store/useApp.js'
import { ROUTES } from '../routes.js'
import { fetchRecipes } from '../api/recipes.js'
import { fetchReactionStats } from '../api/profile.js'
import { API_ENABLED } from '../api/client.js'
import { ERROR_MSG } from '../utils/errorMessages.js'
import { isIngredientAllergic } from '../utils/allergyMatch.js'
import RecipeCard from '../components/RecipeCard.jsx'
import BookmarkPage from './Bookmark.jsx'
import { IconChevron, IconPlus } from '../components/icons/index.jsx'

const RECO_MAX = 5

function enrichWithReaction(recipe, statsMap) {
  const s = statsMap?.[recipe?.id]
  if (!s) return recipe
  return {
    ...recipe,
    totalReactions: s.count ?? 0,
    reactionStats: s.stats ?? undefined,
  }
}

// ─── /feed — 레시피 큐레이션 페이지 ──────────────────────────
function FeedPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { dispatch } = useApp()
  const profile = useProfile()
  const { isBookmarked, toggle: toggleBookmark } = useBookmarks()
  const { show: showToast } = useToast()
  const [activeRecoIndex, setActiveRecoIndex] = useState(0)

  const mode = searchParams.get('mode') === 'bookmark' ? 'bookmark' : 'all'

  // ─ Supabase 실제 레시피 목록 (없으면 mock 폴백) ─
  const [apiRecipes, setApiRecipes] = useState(() => (API_ENABLED ? undefined : null))
  const [showRecoIntro, setShowRecoIntro] = useState(true)
  const [reactionMap, setReactionMap] = useState({})
  const reactionFetchedRef = useRef(new Set())
  const fetchedRef = useRef(false)
  const recoIntroPlayedRef = useRef(false)
  useEffect(() => {
    if (mode === 'bookmark') return
    if (!API_ENABLED) return
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetchRecipes({ pageSize: 100 }).then((res) => {
      if (res?.items?.length) {
        setApiRecipes(res.items)
      }
      else {
        if (res === null) {
          showToast(ERROR_MSG.recipeLoad)
        }
        setApiRecipes(null)
      }
    })
  }, [mode, showToast])
  const isRecipeSourceReady = !API_ENABLED || apiRecipes !== undefined
  const recipePool = apiRecipes === undefined ? [] : (apiRecipes ?? RECIPES)

  const uniqueRecipePool = useMemo(() => {
    const list = Array.isArray(recipePool) ? recipePool : []
    const seen = new Set()
    return list.filter((recipe) => {
      const key = recipe?.id
      if (!key) return true
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [recipePool])

  const openRecipe = (r) => {
    dispatch({ type: 'viewRecipe', id: r.id })
    navigate(ROUTES.detail(r.id))
  }

  // ─ 추천 레시피 — 우선순위 정렬 ─
  const recoItems = useMemo(() => {
    if (!profile) return []
    const favTerms = (profile.favorites || []).map((n) => n.toLowerCase())
    const scored = uniqueRecipePool.map((r) => {
      const names = r.ingredients.map((i) => (typeof i === 'string' ? i : i.name ?? '').toLowerCase())
      let score = 0
      if (r.safety === 'danger') return { recipe: r, score: -1000 }
      const hasAllergy = names.some((n) => isIngredientAllergic(n, profile.allergies))
      if (!hasAllergy) score += 10
      const hasFav = favTerms.some((fav) => names.some((n) => n.includes(fav) || fav.includes(n)))
      if (hasFav) score += 20
      return { recipe: r, score }
    })
    return scored
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, RECO_MAX)
      .map(({ recipe }) => recipe)
  }, [profile, uniqueRecipePool])

  useEffect(() => {
    setActiveRecoIndex((prev) => {
      if (recoItems.length === 0) return 0
      return prev % recoItems.length
    })
  }, [recoItems.length])

  // 추천 카드 급여 반응 stats 비동기 주입
  useEffect(() => {
    if (!API_ENABLED || !recoItems.length) return
    const newIds = recoItems.map(r => r.id).filter(id => id && !reactionFetchedRef.current.has(id))
    if (!newIds.length) return
    newIds.forEach(id => reactionFetchedRef.current.add(id))
    let cancelled = false
    Promise.allSettled(newIds.map(id => fetchReactionStats(id).then(s => ({ id, s }))))
      .then(results => {
        if (cancelled) return
        const patch = {}
        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value?.s) patch[r.value.id] = r.value.s
        })
        if (Object.keys(patch).length) setReactionMap(prev => ({ ...prev, ...patch }))
      })
    return () => { cancelled = true }
  }, [recoItems])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleReactionUpdate = (event) => {
      const recipeId = event?.detail?.recipeId
      const stats = event?.detail?.stats
      if (!recipeId || !stats) return
      reactionFetchedRef.current.add(recipeId)
      setReactionMap((prev) => ({ ...prev, [recipeId]: stats }))
    }
    window.addEventListener('haru:reaction-updated', handleReactionUpdate)
    return () => window.removeEventListener('haru:reaction-updated', handleReactionUpdate)
  }, [])

  useEffect(() => {
    // React Strict Mode remounts components once in development.
    // In production this effect runs for the real mount only, and we also wait
    // for the final recipe source before enabling the intro animation.
    if (recoIntroPlayedRef.current) return
    if (!isRecipeSourceReady || recoItems.length === 0) return
    recoIntroPlayedRef.current = true

    const timeoutId = setTimeout(() => {
      setShowRecoIntro(false)
    }, 520)

    return () => clearTimeout(timeoutId)
  }, [isRecipeSourceReady, recoItems.length])

  // ─ 버그 수정: 1클릭 = 정확히 1칸 이동 보장 ─
  // prevIndex = (current - 1 + total) % total 공식 고정
  const moveReco = (direction) => {
    setActiveRecoIndex((prev) => {
      const total = recoItems.length
      if (total <= 1) return prev
      if (direction < 0) {
        return (prev - 1 + total) % total   // 왼쪽: 항상 -1 이동
      }
      return (prev + 1) % total             // 오른쪽: 항상 +1 이동
    })
  }

  // 순환 오프셋 계산 (가장 짧은 경로)
  const getCircularOffset = (index) => {
    if (recoItems.length <= 1) return 0
    let offset = index - activeRecoIndex
    const half = recoItems.length / 2
    if (offset > half) offset -= recoItems.length
    if (offset < -half) offset += recoItems.length
    return offset
  }

  if (mode === 'bookmark') {
    return <BookmarkPage />
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <header className="page-inset-x page-title-header">
        <div className="page-h1">레시피</div>
      </header>

      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {/* 요구사항 3: 상단 여백 5px 추가 */}
        <section className="page-inset-x" style={{ paddingTop: 5, paddingBottom: 80 }}>

          {/* 추천 섹션 */}
          <div className="feed-reco-box" style={{ background: 'var(--primary-soft)', borderRadius: 12, padding: '14px 16px' }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                {/* 요구사항 4: 타이틀 15→18px */}
                <div className="font-heading feed-reco-box__title" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)', lineHeight: 1.3 }}>
                  {profile ? `${profile.name}를 위한 추천 레시피` : '맞춤 레시피 추천'}
                </div>
                <div className="feed-reco-box__desc" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
                  {profile ? '알러지 재료를 제외하고 추천했어요.' : '프로필을 설정하면 맞춤 레시피를 추천해드려요.'}
                </div>
              </div>
              {profile && (
                <button
                  type="button"
                  className="press"
                  onClick={() => navigate(ROUTES.feedAll)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    /* 요구사항 4: 전체보기 12→15px */
                    fontSize: 15, fontWeight: 500, color: 'var(--primary)',
                    flexShrink: 0, marginTop: 2,
                  }}
                >
                  전체보기
                  <IconChevron dir="right" size={14} color="var(--primary)" />
                </button>
              )}
            </div>

            {profile && recoItems.length > 0 ? (
              /* 캐러셀 — nav 버튼이 viewport 안에 위치하여 peek 영역에 자연스럽게 표시 */
              <div className="feed-reco-carousel">
                <div className="feed-reco-carousel__viewport">

                  {/* 왼쪽 nav — viewport 안쪽 peek 영역에 오버레이 */}
                  {recoItems.length > 1 && (
                    <button
                      type="button"
                      className="press feed-reco-carousel__nav feed-reco-carousel__nav--prev"
                      aria-label="이전 추천 레시피"
                      onClick={() => moveReco(-1)}
                    >
                      <IconChevron dir="left" size={18} color="currentColor" />
                    </button>
                  )}

                  <div className={`feed-reco-carousel__track ${showRecoIntro ? 'recipe-card-list--intro' : ''}`}>
                    {recoItems.map((recipe, index) => {
                      const offset = getCircularOffset(index)
                      const distance = Math.abs(offset)
                      const slideState = distance === 0
                        ? 'active'
                        : distance === 1
                          ? 'peek'
                          : 'far'

                      return (
                        <div
                          key={`${recipe.id || 'recipe'}-${index}`}
                          className={`feed-reco-carousel__slide feed-reco-carousel__slide--${slideState}`}
                          aria-hidden={index !== activeRecoIndex}
                          style={{
                            '--slide-offset': offset,
                            zIndex: Math.max(10 - distance, 1),
                          }}
                        >
                          <RecipeCard
                            recipe={enrichWithReaction(recipe, reactionMap)}
                            bookmarked={isBookmarked(recipe.id)}
                            onToggleBookmark={() => toggleBookmark(recipe.id)}
                            onClick={() => openRecipe(recipe)}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* 오른쪽 nav */}
                  {recoItems.length > 1 && (
                    <button
                      type="button"
                      className="press feed-reco-carousel__nav feed-reco-carousel__nav--next"
                      aria-label="다음 추천 레시피"
                      onClick={() => moveReco(1)}
                    >
                      <IconChevron dir="right" size={18} color="currentColor" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* 프로필 없음 — 안내 + 버튼 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
                <button
                  type="button"
                  className="press"
                  onClick={() => navigate(ROUTES.profile)}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'var(--primary)', color: '#fff',
                    borderRadius: 8, padding: '10px 18px',
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  프로필 설정하기
                </button>
                <button
                  type="button"
                  className="press"
                  onClick={() => navigate(ROUTES.feedAll)}
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: 13, fontWeight: 500, color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', gap: 2,
                  }}
                >
                  레시피 전체보기
                  <IconChevron dir="right" size={12} color="var(--primary)" />
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 레시피 등록 FAB */}
      <button
        type="button"
        className="press feed-register-fab"
        onClick={() => navigate(ROUTES.register)}
        aria-label="레시피 등록"
      >
        <IconPlus size={18} color="#fff" />
        <span>레시피 등록</span>
      </button>
    </div>
  )
}

export default FeedPage
