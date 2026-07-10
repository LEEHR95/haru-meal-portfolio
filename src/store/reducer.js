import { buildInitialState, generatePetId } from './initialState.js'

function normalizeBookmarkIds(value) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(
    value
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  ))
}

function logReducer(scope, payload = {}) {
  console.info(`[haru][reducer] ${scope}`, payload)
}

/**
 * @param {ReturnType<typeof buildInitialState>} state
 * @param {{ type: string } & Record<string, unknown>} action
 */
export function appReducer(state, action) {
  switch (action.type) {

    // ─── 검색어 ────────────────────────────────────────────────
    case 'addSearch': {
      const v = String(action.value ?? '').trim()
      if (!v) return state
      const arr = [v, ...state.recentSearches.filter((x) => x !== v)].slice(0, 5)
      return { ...state, recentSearches: arr }
    }
    case 'removeSearch':
      return {
        ...state,
        recentSearches: state.recentSearches.filter((x) => x !== action.value),
      }

    // ─── 북마크 ───────────────────────────────────────────────
    case 'toggleBookmark': {
      const has = state.bookmarks.includes(action.id)
      return {
        ...state,
        bookmarks: has
          ? state.bookmarks.filter((x) => x !== action.id)
          : [...state.bookmarks, action.id],
      }
    }
    case 'setBookmarks':
      logReducer('setBookmarks', {
        nextCount: normalizeBookmarkIds(action.value).length,
        rawType: Array.isArray(action.value) ? 'array' : typeof action.value,
      })
      return {
        ...state,
        bookmarks: normalizeBookmarkIds(action.value),
      }

    // ─── 최근 본 레시피 ──────────────────────────────────────
    case 'viewRecipe': {
      const arr = [
        action.id,
        ...state.recentlyViewed.filter((x) => x !== action.id),
      ].slice(0, 5)
      return { ...state, recentlyViewed: arr }
    }

    // ─── 급여 반응 ────────────────────────────────────────────
    case 'setReaction':
      return {
        ...state,
        reactions: { ...state.reactions, [action.id]: action.value },
      }

    // ─── 프로필 ──────────────────────────────────────────────
    case 'setProfile': {
      const value = action.value
      logReducer('setProfile', {
        hasValue: value !== null && value !== undefined,
        activePetId: state.activePetId,
        petCount: state.pets?.length ?? 0,
      })
      if (value === null || value === undefined) {
        return { ...state, profile: null }
      }
      // activePetId가 있으면 해당 펫 항목을 업데이트 (호환 레이어)
      if (state.activePetId && state.pets?.length > 0) {
        const pets = state.pets.map((p) =>
          p.id === state.activePetId ? { ...p, ...value, id: p.id } : p,
        )
        const activePet = pets.find((p) => p.id === state.activePetId) ?? value
        return { ...state, profile: activePet, pets }
      }
      // activePet 없음 — 새 펫 항목 생성
      const id = generatePetId()
      const newPet = { ...value, id }
      return { ...state, profile: newPet, pets: [newPet], activePetId: id }
    }

    // ─── 인증 ─────────────────────────────────────────────────
    case 'setAuthReady':
      return { ...state, authReady: Boolean(action.value) }
    case 'login':
      return { ...state, isLoggedIn: true, user: action.value ?? null }
    case 'logout':
      return {
        ...state,
        isLoggedIn: false,
        user: null,
        profile: null,
        pets: [],
        activePetId: null,
        bookmarks: Array.isArray(action.bookmarks) ? action.bookmarks : [],
      }

    // ─── 초기화 ──────────────────────────────────────────────
    case 'reset':
      return buildInitialState()

    // ─── 토스트 ──────────────────────────────────────────────
    case 'toast':
      return { ...state, toast: action.value }
    case 'clearToast':
      return { ...state, toast: null }

    // ─── 다견 (MVP: 무료 최대 2마리) ─────────────────────────
    case 'addPet': {
      if ((state.pets?.length ?? 0) >= 2) return state
      const id = generatePetId()
      const newPet = { ...action.value, id }
      return { ...state, pets: [...(state.pets ?? []), newPet], activePetId: id, profile: newPet }
    }
    case 'removePet': {
      const filtered = (state.pets ?? []).filter((p) => p.id !== action.id)
      const newActiveId = state.activePetId === action.id
        ? (filtered[0]?.id ?? null)
        : state.activePetId
      const newActive = filtered.find((p) => p.id === newActiveId) ?? null
      return { ...state, pets: filtered, activePetId: newActiveId, profile: newActive }
    }
    case 'updatePet': {
      const pets = (state.pets ?? []).map((p) =>
        p.id === action.id ? { ...p, ...action.value, id: p.id } : p,
      )
      const profile = state.activePetId === action.id
        ? (pets.find((p) => p.id === action.id) ?? state.profile)
        : state.profile
      return { ...state, pets, profile }
    }
    case 'setActivePetId': {
      const newActive = (state.pets ?? []).find((p) => p.id === action.id) ?? null
      return { ...state, activePetId: action.id ?? null, profile: newActive }
    }

    // ── dogs API 전체 hydrate ──────────────────────────────────
    // fetch_dogs_by_user 결과를 state에 한번에 반영.
    // payload:  { pets: [...], activePetId: "..." }
    //        또는 { value: [...], activePetId: "..." }
    case 'setPets': {
      const raw = action.pets ?? action.value ?? []
      const pets = Array.isArray(raw) ? raw : []
      logReducer('setPets', {
        nextCount: pets.length,
        requestedActivePetId: action.activePetId ?? null,
        prevCount: state.pets?.length ?? 0,
        prevActivePetId: state.activePetId,
      })

      // 빈 배열 방어: profile/activePetId도 함께 초기화
      if (pets.length === 0) {
        return { ...state, pets: [], activePetId: null, profile: null }
      }

      // activePetId 결정
      //   1순위: payload.activePetId가 pets 안에 실제 존재하면 사용
      //   2순위: pets[0].id fallback
      const reqId = action.activePetId ?? null
      const validId =
        (reqId && pets.some((p) => p.id === reqId))
          ? reqId
          : (pets[0]?.id ?? null)

      const activePet = pets.find((p) => p.id === validId) ?? pets[0] ?? null

      return { ...state, pets, activePetId: validId, profile: activePet }
    }

    default:
      return state
  }
}
