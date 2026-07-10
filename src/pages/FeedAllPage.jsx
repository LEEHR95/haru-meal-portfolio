import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RECIPES, TREAT_TYPES, matchesSnackTypeFilter } from '../data/index.js'
import { useApp, useBookmarks, useToast } from '../store/useApp.js'
import { fetchRecipes } from '../api/recipes.js'
import { API_ENABLED } from '../api/client.js'
import { ERROR_MSG } from '../utils/errorMessages.js'
import { ROUTES } from '../routes.js'
import RecipeCard from '../components/RecipeCard.jsx'
import RecipeCardSkeleton from '../components/RecipeCardSkeleton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { IconBack, IconPlus } from '../components/icons/index.jsx'
import useRecipeReactionSummaries from '../hooks/useRecipeReactionSummaries.js'

const PAGE_SIZE = 5

function enrichWithReaction(recipe, statsMap) {
  const s = statsMap?.[recipe?.id]
  if (!s) return recipe
  return {
    ...recipe,
    totalReactions: s.count ?? 0,
    reactionStats: s.stats ?? undefined,
  }
}

// ─── /feed/all — 전체 레시피 탐색 페이지 ────────────────────
export default function FeedAllPage() {
  const navigate = useNavigate()
  const { dispatch } = useApp()
  const { isBookmarked, toggle: toggleBookmark } = useBookmarks()
  const { show: showToast } = useToast()

  const [filter, setFilter] = useState('전체')
  const [allItems, setAllItems] = useState([])
  const [apiTotal, setApiTotal] = useState(0)
  const [loadedPage, setLoadedPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showListIntro, setShowListIntro] = useState(true)

  const scrollRef = useRef(null)
  const sentinelRef = useRef(null)
  const requestedPagesRef = useRef(new Set())
  const inFlightPagesRef = useRef(new Set())
  const loadedPagesRef = useRef(new Set())
  const loadingRef = useRef(false)
  const filterRef = useRef(filter)
  const showToastRef = useRef(showToast)
  const apiTotalRef = useRef(0)
  const allItemsCountRef = useRef(0)
  const filterInitRef = useRef(null)
  const listIntroPlayedRef = useRef(false)

  filterRef.current = filter
  showToastRef.current = showToast
  loadingRef.current = loading
  apiTotalRef.current = apiTotal
  allItemsCountRef.current = allItems.length

  const tabs = useMemo(() => ['전체', ...TREAT_TYPES], [])

  const clearPageGuards = () => {
    requestedPagesRef.current.clear()
    inFlightPagesRef.current.clear()
    loadedPagesRef.current.clear()
  }

  const changeFilter = (f) => {
    if (f === filter) return
    setFilter(f)
    setShowListIntro(true)
    listIntroPlayedRef.current = false
    setAllItems([])
    setApiTotal(0)
    apiTotalRef.current = 0
    allItemsCountRef.current = 0
    setLoadedPage(0)
    clearPageGuards()
  }

  const loadPage = useCallback((page) => {
    if (!page || page < 1) return
    if (!API_ENABLED) return
    if (inFlightPagesRef.current.has(page)) return
    if (loadedPagesRef.current.has(page)) return
    if (requestedPagesRef.current.has(page)) return

    requestedPagesRef.current.add(page)
    inFlightPagesRef.current.add(page)
    loadingRef.current = true
    setLoading(true)

    const snackType = filterRef.current === '전체' ? undefined : filterRef.current

    fetchRecipes({
      snackType,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        if (!res) {
          showToastRef.current(ERROR_MSG.recipeLoad)
          return
        }
        const items = res.items ?? []
        setAllItems((prev) => {
          const prevIds = new Set(prev.map((r) => r?.id).filter(Boolean))
          const nextItems = items.filter((r) => {
            if (!r?.id) return true
            if (prevIds.has(r.id)) return false
            prevIds.add(r.id)
            return true
          })
          const merged = page === 1 ? nextItems : [...prev, ...nextItems]
          allItemsCountRef.current = merged.length
          return merged
        })
        setApiTotal(res.total)
        apiTotalRef.current = res.total
        setLoadedPage(page)
        loadedPagesRef.current.add(page)
      })
      .finally(() => {
        inFlightPagesRef.current.delete(page)
        loadingRef.current = false
        setLoading(false)
      })
  }, [])

  // filter 변경 시에만 리셋 후 page 1 (StrictMode remount 시 page 1 중복 방지)
  useEffect(() => {
    const filterChanged = filterInitRef.current !== filter
    filterInitRef.current = filter

    if (filterChanged) {
      clearPageGuards()
      setAllItems([])
      setApiTotal(0)
      apiTotalRef.current = 0
      allItemsCountRef.current = 0
      setLoadedPage(0)
    }

    if (!API_ENABLED) return
    if (!filterChanged && (
      loadedPagesRef.current.has(1)
      || inFlightPagesRef.current.has(1)
      || requestedPagesRef.current.has(1)
    )) {
      return
    }
    loadPage(1)
  }, [filter, loadPage])

  const scrollReady = loadedPage >= 1
  const hasMore = API_ENABLED && scrollReady && allItems.length < apiTotal

  // 무한 스크롤 — observer는 page 1 완료 후에만 다음 페이지 요청
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return undefined

    const onIntersect = (entries) => {
      const entry = entries[0]
      if (!entry?.isIntersecting) return
      if (loadingRef.current) return
      if (!API_ENABLED) return
      if (!loadedPagesRef.current.has(1)) return

      const total = apiTotalRef.current
      const count = allItemsCountRef.current
      const hasMore = total > 0 && count < total
      if (!hasMore) return

      const maxLoaded = loadedPagesRef.current.size > 0
        ? Math.max(...loadedPagesRef.current)
        : 0
      const nextPage = maxLoaded + 1
      if (nextPage < 2) return

      loadPage(nextPage)
    }

    const observer = new IntersectionObserver(onIntersect, {
      root: scrollRef.current,
      rootMargin: '120px',
      threshold: 0,
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadPage, scrollReady, hasMore])

  // mock 폴백
  const mockFiltered = useMemo(() => {
    const base = RECIPES
    return filter !== '전체' ? base.filter((r) => matchesSnackTypeFilter(r.type, filter)) : base
  }, [filter])

  const displayItems = API_ENABLED && allItems.length > 0 ? allItems : (API_ENABLED ? [] : mockFiltered)

  const uniqueDisplayItems = useMemo(() => {
    const seen = new Set()
    return displayItems.filter((recipe) => {
      const id = recipe?.id
      if (!id) return true
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [displayItems])

  const displayReactionIds = useMemo(
    () => uniqueDisplayItems.map((recipe) => recipe?.id).filter(Boolean),
    [uniqueDisplayItems],
  )
  const {
    reactionMap,
    isResolved: isReactionResolved,
  } = useRecipeReactionSummaries(displayReactionIds, { enabled: API_ENABLED })

  const resolvedDisplayItems = useMemo(
    () => uniqueDisplayItems.filter((recipe) => isReactionResolved(recipe?.id)),
    [isReactionResolved, uniqueDisplayItems],
  )
  const hasPendingCardMetadata = uniqueDisplayItems.length > resolvedDisplayItems.length
  const decoratedDisplayItems = useMemo(
    () => resolvedDisplayItems.map((recipe) => enrichWithReaction(recipe, reactionMap)),
    [reactionMap, resolvedDisplayItems],
  )

  useEffect(() => {
    if (listIntroPlayedRef.current) return
    if (decoratedDisplayItems.length === 0 || hasPendingCardMetadata) return
    listIntroPlayedRef.current = true
    const timeoutId = setTimeout(() => {
      setShowListIntro(false)
    }, 520)
    return () => clearTimeout(timeoutId)
  }, [decoratedDisplayItems.length, hasPendingCardMetadata])

  const openRecipe = (r) => {
    dispatch({ type: 'viewRecipe', id: r.id })
    navigate(ROUTES.detail(r.id))
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* 헤더 */}
      <header className="page-inset-x page-title-header page-title-header--row">
        <button
          type="button"
          className="press"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 14, color: 'var(--ink-2)', fontWeight: 500,
          }}
        >
          <IconBack size={18} color="var(--ink-2)" />
        </button>
        <div className="t-headline-s" style={{ fontSize: 20 }}>전체 레시피</div>
      </header>

      {/* 간식 타입 필터 탭 — sticky */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg)', paddingBottom: 2 }}>
        {/* 요구사항 2: page-inset-x로 타이틀·카드와 좌측 정렬선 통일 */}
        <div
          className="h-scroll feed-filter-tabs page-inset-x"
          role="tablist"
          style={{ display: 'flex', gap: 2, paddingTop: 4, paddingBottom: 0 }}
        >
          {tabs.map((t) => {
            const active = t === filter
            return (
              <button
                key={t}
                type="button"
                role="tab"
                className="press"
                aria-selected={active}
                onClick={() => changeFilter(t)}
                style={{
                  padding: '9px 12px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--primary)' : 'var(--ink-3)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {/* 스크롤 컨테이너 */}
      <div ref={scrollRef} className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <section className="page-inset-x" style={{ paddingTop: 10, paddingBottom: 100 }}>

          {(loading && uniqueDisplayItems.length === 0) || (uniqueDisplayItems.length > 0 && resolvedDisplayItems.length === 0 && hasPendingCardMetadata) ? (
            <RecipeCardSkeleton count={5} className="recipe-card-list--intro" />
          ) : uniqueDisplayItems.length === 0 ? (
            <EmptyState kind="recipe" />
          ) : (
            <div className={showListIntro ? 'recipe-card-list--intro' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {decoratedDisplayItems.map((r, index) => (
                <RecipeCard
                  key={r.id || `recipe-${index}`}
                  recipe={r}
                  layout="h"
                  bookmarked={isBookmarked(r.id)}
                  onToggleBookmark={() => toggleBookmark(r.id)}
                  onClick={() => openRecipe(r)}
                />
              ))}
            </div>
          )}

          {/* page 1 로드 전·hasMore 없을 때 sentinel 미관찰 → loadPage(1) 반복 방지 */}
          {scrollReady && hasMore && (
            <div ref={sentinelRef} style={{ height: 1 }} />
          )}
          {(loading || hasPendingCardMetadata) && decoratedDisplayItems.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
              <LoadingSpinner />
            </div>
          )}
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
