import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RECIPES } from '../data/index.js'
import { useApp, useAuthReady, useBookmarks, useIsLoggedIn, useToast, useUser } from '../store/useApp.js'
import { ROUTES } from '../routes.js'
import { fetchRecipes, deleteRecipe } from '../api/recipes.js'
import { API_ENABLED } from '../api/client.js'
import { fetchBookmarks } from '../api/bookmarks.js'
import { ERROR_MSG } from '../utils/errorMessages.js'
import RecipeCard from '../components/RecipeCard.jsx'
import RecipeCardSkeleton from '../components/RecipeCardSkeleton.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { IconChevron, IconPlus } from '../components/icons/index.jsx'
import { signInWithGoogle } from '../lib/auth.js'
import pawIconImg from '../components/icons/paw-icon-02.png'
import useRecipeReactionSummaries from '../hooks/useRecipeReactionSummaries.js'

function uniqueById(list = []) {
  const seen = new Set()
  return list.filter((item) => {
    const id = item?.id
    if (!id) return true
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function formatRecipeDate(createdAt) {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day} added`
}

function enrichWithReaction(recipe, statsMap) {
  const s = statsMap?.[recipe?.id]
  if (!s) return recipe
  return {
    ...recipe,
    totalReactions: s.count ?? 0,
    reactionStats: s.stats ?? undefined,
  }
}

function ArchiveTabs({ tab, onChange }) {
  const tabs = [
    { id: 'saved', label: '저장한 레시피' },
    { id: 'mine', label: '내가 만든 레시피' },
  ]
  return (
    <div className="page-inset-x" style={{ paddingTop: 0, paddingBottom: 8 }}>
      <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 4, gap: 4 }}>
        {tabs.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              className="press archive-tab-btn"
              onClick={() => onChange(t.id)}
              style={{
                flex: 1,
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--primary)' : 'var(--ink-3)',
                borderRadius: 6,
                padding: '8px 0',
                fontWeight: active ? 600 : 500,
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const BTN_PRIMARY = {
  background: 'var(--primary)',
  color: '#fff',
  borderRadius: 8,
  padding: '12px 20px',
  fontSize: 14,
  fontWeight: 600,
}

function EmptyPanel({ message, buttonLabel, onButton }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 16px' }}>
        {message}
      </div>
      {buttonLabel && onButton && (
        <button type="button" className="press" onClick={onButton} style={BTN_PRIMARY}>
          {buttonLabel}
        </button>
      )}
    </div>
  )
}

function SavedRecipesTab({ recipePool, bookmarks, isBookmarked, toggleBookmark, openRecipe, loading, introEnabled, onIntroPlayed }) {
  const navigate = useNavigate()
  const bookmarkedRecipes = useMemo(
    () => uniqueById(recipePool.filter((r) => bookmarks.includes(r.id))),
    [recipePool, bookmarks],
  )
  const bookmarkedRecipeIds = useMemo(
    () => bookmarkedRecipes.map((recipe) => recipe?.id).filter(Boolean),
    [bookmarkedRecipes],
  )
  const {
    reactionMap,
    isResolved: isReactionResolved,
  } = useRecipeReactionSummaries(bookmarkedRecipeIds, { enabled: API_ENABLED })
  const resolvedBookmarkedRecipes = useMemo(
    () => bookmarkedRecipes.filter((recipe) => isReactionResolved(recipe?.id)),
    [bookmarkedRecipes, isReactionResolved],
  )
  const hasPendingCardMetadata = bookmarkedRecipes.length > resolvedBookmarkedRecipes.length
  const decoratedBookmarkedRecipes = useMemo(
    () => resolvedBookmarkedRecipes.map((recipe) => enrichWithReaction(recipe, reactionMap)),
    [reactionMap, resolvedBookmarkedRecipes],
  )

  const [showListIntro, setShowListIntro] = useState(introEnabled)

  useEffect(() => {
    if (!introEnabled) return
    if (loading || decoratedBookmarkedRecipes.length === 0 || hasPendingCardMetadata) return
    const timeoutId = setTimeout(() => {
      setShowListIntro(false)
      onIntroPlayed?.()
    }, 520)
    return () => clearTimeout(timeoutId)
  }, [decoratedBookmarkedRecipes.length, hasPendingCardMetadata, introEnabled, loading, onIntroPlayed])

  if (loading || (bookmarkedRecipes.length > 0 && decoratedBookmarkedRecipes.length === 0 && hasPendingCardMetadata)) {
    return <RecipeCardSkeleton count={4} className="recipe-card-list--intro" />
  }

  if (bookmarkedRecipes.length === 0) {
    return (
      <EmptyPanel
        message="아직 저장한 레시피가 없어요. 마음에 드는 레시피를 북마크해 보세요."
        buttonLabel="레시피 보러가기"
        onButton={() => navigate(ROUTES.feed)}
      />
    )
  }

  return (
    <div className={showListIntro ? 'recipe-feed-grid recipe-card-list--intro' : 'recipe-feed-grid'}>
      {decoratedBookmarkedRecipes.map((r, index) => (
        <RecipeCard
          key={r.id || ('recipe-' + index)}
          recipe={r}
          layout="h"
          bookmarked={isBookmarked(r.id)}
          onToggleBookmark={() => toggleBookmark(r.id)}
          onClick={() => openRecipe(r)}
        />
      ))}
      {hasPendingCardMetadata && decoratedBookmarkedRecipes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
          <LoadingSpinner />
        </div>
      )}
    </div>
  )
}

function AuthInitializingPanel() {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <LoadingSpinner />
      <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 16 }}>
        로그인 상태를 확인하고 있어요
      </div>
    </div>
  )
}

function MyRecipesTab({ authReady, isLoggedIn, user, openRecipe, showToast, onLoginClick, introEnabled, onIntroPlayed }) {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showListIntro, setShowListIntro] = useState(introEnabled)

  useEffect(() => {
    if (!isLoggedIn || !user?.id || !API_ENABLED) {
      setRecipes([])
      return undefined
    }
    let cancelled = false
    setLoading(true)
    fetchRecipes({ authorId: user.id, pageSize: 100 })
      .then((res) => {
        if (!cancelled) setRecipes(res?.items ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [isLoggedIn, user?.id])

  const displayRecipes = useMemo(() => uniqueById(recipes), [recipes])

  useEffect(() => {
    if (!introEnabled) return
    if (loading || displayRecipes.length === 0) return
    const timeoutId = setTimeout(() => {
      setShowListIntro(false)
      onIntroPlayed?.()
    }, 520)
    return () => clearTimeout(timeoutId)
  }, [displayRecipes.length, introEnabled, loading, onIntroPlayed])

  const confirmDelete = async () => {
    if (!deleteTarget?.id || !user?.id) return
    setDeleting(true)
    const ok = await deleteRecipe(deleteTarget.id, user.id)
    setDeleting(false)
    if (!ok) {
      showToast('Could not delete the recipe. Please try again in a moment.')
      return
    }
    setRecipes((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    setDeleteTarget(null)
    showToast('Recipe deleted.')
  }

  return (
    <>
      <button
        type="button"
        className="press"
        onClick={() => navigate(ROUTES.register)}
        style={{
          ...BTN_PRIMARY,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginBottom: 12,
        }}
      >
        <IconPlus size={16} color="#fff" />
        {'레시피 등록'}
      </button>

      {!authReady ? (
        <AuthInitializingPanel />
      ) : !isLoggedIn ? (
        <EmptyPanel
          message="내가 만든 레시피를 관리하려면 로그인이 필요해요."
          buttonLabel="로그인하기"
          onButton={onLoginClick}
        />
      ) : loading ? (
        <RecipeCardSkeleton count={3} className="recipe-card-list--intro" />
      ) : displayRecipes.length === 0 ? (
        <EmptyPanel
          message={
            <>
              <p style={{ margin: 0, fontWeight: 600 }}>{'아직 등록한 레시피가 없어요.'}</p>
              <p style={{ margin: '6px 0 0' }}>{'우리 아이를 위한 첫 레시피를 기록해 보세요.'}</p>
            </>
          }
          buttonLabel="레시피 등록하기"
          onButton={() => navigate(ROUTES.register)}
        />
      ) : (
        <div className={showListIntro ? 'recipe-feed-grid recipe-card-list--intro' : 'recipe-feed-grid'}>
          {displayRecipes.map((recipe, index) => (
            <div
              key={recipe.id || ('recipe-' + index)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <RecipeCard
                recipe={recipe}
                layout="h"
                onClick={() => openRecipe(recipe)}
              />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 12px 12px',
                borderTop: '1px solid var(--divider)',
              }}>
                <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                  {formatRecipeDate(recipe.createdAt)}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="press"
                    onClick={() => navigate(`/register?edit=${encodeURIComponent(recipe.id)}`)}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--ink-2)',
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: 'var(--surface-2)',
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="press"
                    onClick={() => setDeleteTarget(recipe)}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--danger-fg)',
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: 'var(--danger-bg)',
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomSheet open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>레시피를 삭제할까요?</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            {deleteTarget?.name ? `"${deleteTarget.name}"이(가) 영구 삭제돼요.` : '이 레시피가 영구 삭제돼요.'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="press"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              style={{
                flex: 1,
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                borderRadius: 8,
                padding: 14,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              취소
            </button>
            <button
              type="button"
              className="press"
              disabled={deleting}
              onClick={confirmDelete}
              style={{
                flex: 1,
                background: 'var(--danger-fg)',
                color: '#fff',
                borderRadius: 8,
                padding: 14,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              삭제
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}

/** Bookmark page for saved recipes and recipes created by the user. */
export default function BookmarkPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { dispatch } = useApp()
  const { isBookmarked, toggle: toggleBookmark, bookmarks } = useBookmarks()
  const { show: showToast } = useToast()
  const authReady = useAuthReady()
  const isLoggedIn = useIsLoggedIn()
  const user = useUser()

  const tabParam = searchParams.get('tab')
  const tab = tabParam === 'mine' ? 'mine' : 'saved'
  const setTab = (next) => {
    const params = new URLSearchParams(searchParams)
    params.set('mode', 'bookmark')
    if (next === 'mine') params.set('tab', 'mine')
    else params.delete('tab')
    setSearchParams(params, { replace: true })
  }

  const [loginSheet, setLoginSheet] = useState(false)
  const [playedTabIntros, setPlayedTabIntros] = useState({ saved: false, mine: false })

  const [apiRecipes, setApiRecipes] = useState(() => (API_ENABLED ? undefined : null))
  const [savedLoading, setSavedLoading] = useState(API_ENABLED)
  const [bookmarksLoading, setBookmarksLoading] = useState(false)
  const fetchedRef = useRef(false)
  useEffect(() => {
    if (!API_ENABLED) return undefined
    if (fetchedRef.current) return undefined
    fetchedRef.current = true
    setSavedLoading(true)
    fetchRecipes({ pageSize: 100 }).then((res) => {
      if (res?.items?.length) setApiRecipes(res.items)
      else {
        if (res === null) showToast(ERROR_MSG.recipeLoad)
        setApiRecipes(null)
      }
    }).finally(() => {
      setSavedLoading(false)
    })
    return undefined
  }, [showToast])

  useEffect(() => {
    // 비로그인/계정 미확정 상태에서는 북마크 로딩이 진행 중일 이유가 없으므로 항상 해제.
    if (!isLoggedIn || !user?.id || !API_ENABLED) {
      setBookmarksLoading(false)
      return undefined
    }
    let cancelled = false
    setBookmarksLoading(true)
    fetchBookmarks(user.id).then((res) => {
      if (!cancelled && Array.isArray(res)) {
        dispatch({ type: 'setBookmarks', value: res })
      }
    }).finally(() => {
      if (!cancelled) setBookmarksLoading(false)
    })
    // fetch 진행 중 로그아웃/계정 전환/언마운트로 effect가 정리될 때도 로딩이 true로 남지 않게 해제.
    return () => {
      cancelled = true
      setBookmarksLoading(false)
    }
  }, [isLoggedIn, user?.id, dispatch])

  const recipePool = apiRecipes === undefined ? [] : (apiRecipes ?? RECIPES)

  const openRecipe = (r) => {
    dispatch({ type: 'viewRecipe', id: r.id })
    navigate(ROUTES.detail(r.id))
  }

  const savedIntroEnabled = !playedTabIntros.saved
  const myIntroEnabled = !playedTabIntros.mine

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch {
      showToast('Could not start login. Please try again in a moment.')
    }
    setLoginSheet(false)
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <header className="page-inset-x page-title-header">
        <div className="page-h1">{'보관함'}</div>
      </header>

      <ArchiveTabs tab={tab} onChange={setTab} />

      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {/* 식생활 기록 진입 카드 */}
        <div className="page-inset-x" style={{ paddingTop: 12, paddingBottom: 4 }}>
          <button
            type="button"
            className="press"
            onClick={() => navigate(ROUTES.dietLog)}
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '14px 16px',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={pawIconImg} alt="" aria-hidden="true" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>식생활 기록</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>급여·반응 기록 확인하기</div>
              </div>
            </div>
            <IconChevron dir="right" size={14} color="var(--ink-3)" />
          </button>
        </div>

        <section className="page-inset-x" style={{ paddingBottom: 80 }}>
          {tab === 'saved' ? (
            <SavedRecipesTab
              recipePool={recipePool}
              bookmarks={bookmarks}
              isBookmarked={isBookmarked}
              toggleBookmark={toggleBookmark}
              openRecipe={openRecipe}
              loading={savedLoading || bookmarksLoading}
              introEnabled={savedIntroEnabled}
              onIntroPlayed={() => {
                setPlayedTabIntros((prev) => (prev.saved ? prev : { ...prev, saved: true }))
              }}
            />
          ) : (
            <MyRecipesTab
              authReady={authReady}
              isLoggedIn={isLoggedIn}
              user={user}
              openRecipe={openRecipe}
              showToast={showToast}
              onLoginClick={() => setLoginSheet(true)}
              introEnabled={myIntroEnabled}
              onIntroPlayed={() => {
                setPlayedTabIntros((prev) => (prev.mine ? prev : { ...prev, mine: true }))
              }}
            />
          )}
        </section>
      </div>

      <BottomSheet open={loginSheet} onClose={() => setLoginSheet(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 4px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>로그인이 필요해요</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            로그인하면 저장한 레시피와 내가 만든 레시피를
            기기와 상관없이 이어서 볼 수 있어요.
          </div>
          <button
            type="button"
            className="press"
            onClick={handleGoogleLogin}
            style={{
              width: '100%',
              background: '#FFFFFF',
              border: '1px solid var(--border-strong)',
              color: '#3c4043',
              borderRadius: 8,
              padding: '13px 14px',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Google로 로그인하기
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
