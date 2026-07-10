/** 라우트 경로 단일 진실 소스 */

export const ROUTES = {
  home: '/',
  safety: (ingredient) => `/safety/${encodeURIComponent(ingredient)}`,
  feed: '/feed',
  feedAll: '/feed/all',
  detail: (id) => `/feed/${id}`,
  register: '/register',
  chat: '/chat',
  profile: '/profile',
  profileEdit: (petId) => `/profile/edit/${encodeURIComponent(petId)}`,
  profilePets: '/profile/pets',
  settings: '/settings',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
  delete: '/delete',
  offline: '/offline',
  authCallback: '/auth/callback',
  dietLog: '/diet-log',
}

/** NavBar 숨김 경로 (prototype HIDE_NAVBAR_ON + 법적 페이지) */
export const NAV_HIDDEN_PATHS = new Set([
  ROUTES.register,
  ROUTES.chat,
  ROUTES.settings,
  ROUTES.contact,
  ROUTES.privacy,
  ROUTES.terms,
  ROUTES.delete,
  ROUTES.authCallback,
])

/** prototype TAB_FOR — pathname + search → 활성 탭 key */
export function getActiveTab(pathname, search = '') {
  if (pathname === ROUTES.home || pathname.startsWith('/safety')) return 'home'
  if (pathname === ROUTES.feed || pathname === ROUTES.feedAll || pathname.startsWith('/feed/')) {
    const params = new URLSearchParams(search)
    if (params.get('mode') === 'bookmark') return 'bookmark'
    return 'feed'
  }
  if (pathname === ROUTES.profile || pathname.startsWith('/profile/')) return 'profile'
  return 'home'
}

export function shouldShowNav(pathname) {
  return !NAV_HIDDEN_PATHS.has(pathname)
}
