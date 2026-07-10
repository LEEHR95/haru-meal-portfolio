/** 개발용 데모 프로필 */
export const DEMO_PROFILE = {
  name: '콩이',
  breed: '푸들',
  age: 3,
  weight: 5,
  neutered: true,
  activity: '보통',
  conditions: [],
  allergies: ['양파'],
  favorites: ['고구마', '닭가슴살'],
  preferredStyles: ['육포류', '촉촉식'],
}

// ─── localStorage 키 ───────────────────────────────────────────
/** 로그인하고 저장하기 — OAuth 전 폼 값 (haru_profile 과 분리) */
export const LS_PENDING_PROFILE = 'haru_pending_profile'
/** +추가 → 로그인 경로에서 로그인 후 새 pet 자동 생성 신호 */
export const LS_PENDING_ADD_PET = 'haru_pending_add_pet'
export const LS_BOOKMARKS = 'haru_bookmarks'

const LS = {
  bookmarks: LS_BOOKMARKS,
  recentSearches: 'haru_recentSearches',
  profile: 'haru_profile',
  pets: 'haru_pets',
  activePetId: 'haru_activePetId',
}

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeLS(key, value) {
  try {
    localStorage.setItem(LS[key], JSON.stringify(value))
  } catch {
    // storage full or unavailable — ignore silently
  }
}

export function clearLS() {
  Object.values(LS).forEach((k) => {
    try { localStorage.removeItem(k) } catch { /* ignore */ }
  })
}

/** 브라우저 호환 UUID 생성 */
export function generatePetId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
  } catch { /* ignore */ }
  return `pet_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * haru_profile(단일) → haru_pets[0] 1회 마이그레이션.
 * haru_pets가 이미 존재하면 건드리지 않음 — 멱등성 보장.
 */
function migrateLegacyProfile() {
  try {
    if (localStorage.getItem(LS.pets) !== null) return
    const raw = localStorage.getItem(LS.profile)
    if (!raw) return
    const profile = JSON.parse(raw)
    if (!profile || typeof profile !== 'object') return
    const id = generatePetId()
    localStorage.setItem(LS.pets, JSON.stringify([{ ...profile, id }]))
    localStorage.setItem(LS.activePetId, id)
  } catch { /* ignore */ }
}

/** 앱 시작 시 localStorage에서 복원된 초기 상태를 반환 */
export function buildInitialState() {
  migrateLegacyProfile()
  const petsRaw = readLS(LS.pets, null)
  const petsList = Array.isArray(petsRaw) ? petsRaw : []
  const activePetId = readLS(LS.activePetId, null) ?? null
  const activePet = activePetId
    ? petsList.find((p) => p.id === activePetId) ?? null
    : null
  // profile = activePet alias. activePet 없으면 haru_profile 폴백 (마이그레이션 미적용 환경)
  const profile = activePet ?? readLS(LS.profile, null)
  return {
    profile,
    pets: petsList,
    activePetId,
    authReady: false,
    isLoggedIn: false,
    user: null,
    bookmarks: readLS(LS.bookmarks, []),
    recentSearches: readLS(LS.recentSearches, []),
    recentlyViewed: [],
    reactions: {},
    toast: null,
  }
}

/** 순수 기본값 (reset 액션용) */
export const EMPTY_STATE = {
  profile: null,
  pets: [],
  activePetId: null,
  authReady: false,
  isLoggedIn: false,
  user: null,
  bookmarks: [],
  recentSearches: [],
  recentlyViewed: [],
  reactions: {},
  toast: null,
}
