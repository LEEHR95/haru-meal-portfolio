import { useContext } from 'react'
import { AppContext } from './appContext.js'
import { ERROR_MSG } from '../utils/errorMessages.js'
import { addBookmark, removeBookmark } from '../api/bookmarks.js'

const LS_BOOKMARKS = 'haru_bookmarks'

/**
 * 전역 상태 + dispatch 반환
 * @returns {{ state: import('./initialState.js').EMPTY_STATE & Record<string, unknown>, dispatch: import('react').Dispatch<{ type: string } & Record<string, unknown>> }}
 */
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

/** 자주 쓰는 derived value를 한 번에 */

/** 기존 단일 프로필 호환 — activePet을 반환 */
export function useProfile() {
  const { state } = useApp()
  return state.profile
}

/** 전체 펫 목록 */
export function usePets() {
  const { state } = useApp()
  return state.pets ?? []
}

/** 현재 선택된 펫 ID */
export function useActivePetId() {
  const { state } = useApp()
  return state.activePetId ?? null
}

/** 현재 선택된 펫 객체 (useProfile과 동일값, 명시적 다견용) */
export function useActivePet() {
  const { state } = useApp()
  if (state.activePetId && state.pets?.length) {
    return state.pets.find((p) => p.id === state.activePetId) ?? state.profile ?? null
  }
  return state.profile ?? null
}

export function useIsLoggedIn() {
  const { state } = useApp()
  return state.isLoggedIn
}

export function useAuthReady() {
  const { state } = useApp()
  return state.authReady
}

export function useUser() {
  const { state } = useApp()
  return state.user
}

export function useBookmarks() {
  const { state, dispatch } = useApp()
  const { show } = useToast()
  const isBookmarked = (id) => state.bookmarks.includes(id)
  const toggle = async (id) => {
    const recipeId = String(id || '').trim()
    if (!recipeId) return
    const has = state.bookmarks.includes(recipeId)
    if (!state.isLoggedIn) {
      const next = has
        ? state.bookmarks.filter((x) => x !== recipeId)
        : [...state.bookmarks, recipeId]
      try {
        localStorage.setItem(LS_BOOKMARKS, JSON.stringify(next))
      } catch {
        show(ERROR_MSG.bookmark)
        return
      }
      dispatch({ type: 'toggleBookmark', id: recipeId })
      return
    }

    const userId = String(state.user?.id || '').trim()
    if (!userId) {
      show(ERROR_MSG.bookmark)
      return
    }

    dispatch({ type: 'toggleBookmark', id: recipeId })
    const result = has
      ? await removeBookmark(recipeId, userId)
      : await addBookmark(recipeId, userId)

    if (!result?.ok) {
      dispatch({ type: 'toggleBookmark', id: recipeId })
      show(ERROR_MSG.bookmark)
      return
    }

    if (Array.isArray(result.bookmarks)) {
      dispatch({ type: 'setBookmarks', value: result.bookmarks })
    }
  }
  return { bookmarks: state.bookmarks, isBookmarked, toggle }
}

export function useRecentSearches() {
  const { state, dispatch } = useApp()
  const add = (value) => dispatch({ type: 'addSearch', value })
  const remove = (value) => dispatch({ type: 'removeSearch', value })
  return { recentSearches: state.recentSearches, add, remove }
}

export function useToast() {
  const { state, dispatch } = useApp()
  const show = (value) => dispatch({ type: 'toast', value })
  const clear = () => dispatch({ type: 'clearToast' })
  return { toast: state.toast, show, clear }
}
