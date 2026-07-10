import { apiFetch, authFetch, buildQuery } from './client.js'

function normalizeBookmarkIds(value) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(
    value
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  ))
}

export function unwrapBookmarksResponse(response) {
  if (!response || typeof response !== 'object') return null
  return normalizeBookmarkIds(response.bookmarks)
}

/**
 * 로그인 사용자 북마크 목록 조회.
 * JWT 기반 — user_id 파라미터 제거됨. 기존 호출부 시그니처 유지(_userId 무시).
 */
export async function fetchBookmarks(_userId) {
  const response = await authFetch('/api/bookmarks')
  return unwrapBookmarksResponse(response)
}

/**
 * 북마크 추가. JWT 기반.
 */
export async function addBookmark(recipeId, _userId) {
  return authFetch('/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ recipe_id: recipeId }),
  })
}

/**
 * 북마크 삭제. JWT 기반.
 */
export async function removeBookmark(recipeId, _userId) {
  return authFetch(`/api/bookmarks/${encodeURIComponent(recipeId)}`, {
    method: 'DELETE',
  })
}

/**
 * 비로그인 localStorage 북마크 → 서버 마이그레이션. JWT 기반.
 */
export async function migrateBookmarks(recipeIds, _userId) {
  const response = await authFetch('/api/bookmarks/migrate', {
    method: 'POST',
    body: JSON.stringify({
      recipe_ids: Array.isArray(recipeIds) ? recipeIds : [],
    }),
  })
  return unwrapBookmarksResponse(response)
}

// ── 비로그인 localStorage 전용 헬퍼 (인증 불필요) ─────────────────────────
// 하위 호환: apiFetch 직접 사용이 필요한 경우를 위해 export 유지
export { apiFetch }
