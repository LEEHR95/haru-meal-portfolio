/**
 * 하루한끼 API 기본 클라이언트
 *
 * VITE_API_URL 이 설정돼 있으면 백엔드를 호출하고,
 * 없으면 mock 데이터를 반환하는 폴백으로 동작한다.
 */

const _configuredApi = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
/** 개발 시 VITE_API_URL 미설정이면 Vite /api 프록시(동일 origin) 사용 — 모바일 LAN 테스트용 */
export const API_URL = _configuredApi || (import.meta.env.DEV ? '' : '')

/** API가 활성화되어 있는지 여부 */
export const API_ENABLED = Boolean(_configuredApi || import.meta.env.DEV)

/**
 * API fetch 래퍼.
 * 실패 시 null 반환 (호출부에서 mock 폴백 처리).
 */
export async function apiFetch(path, options = {}) {
  if (!API_ENABLED) return null
  try {
    const method = String(options.method || 'GET').toUpperCase()
    const bypassCache = method === 'GET' && options.cache === 'no-store'
    const requestPath = bypassCache
      ? `${path}${path.includes('?') ? '&' : '?'}_ts=${Date.now()}`
      : path
    const headers = { 'Content-Type': 'application/json', ...options.headers }
    if (bypassCache) {
      headers['Cache-Control'] = 'no-cache, no-store, max-age=0'
      headers.Pragma = 'no-cache'
    }

    const res = await fetch(`${API_URL}${requestPath}`, {
      ...options,
      method,
      headers,
    })
    if (!res.ok) {
      if (res.status === 429) {
        console.warn(`[api] ${path} → HTTP 429 (quota exceeded)`)
        return { __status: 429 }
      }
      if (res.status === 422) {
        const detail = await res.clone().json().catch(() => null)
        console.warn(`[api] ${path} → HTTP 422`, detail)
      } else {
        console.warn(`[api] ${path} → HTTP ${res.status}`)
      }
      return null
    }
    return await res.json()
  } catch (err) {
    if (err?.name === 'AbortError') {
      return null
    }
    console.warn(`[api] ${path} 오류:`, err)
    return null
  }
}

/**
 * 인증 필요 API fetch 래퍼.
 * Supabase access_token을 Authorization: Bearer 헤더로 자동 첨부.
 * 토큰 없음(비로그인) 상태에서도 호출 가능 — 헤더 생략되어 backend 401 반환.
 */
export async function authFetch(path, options = {}) {
  const { getAccessToken } = await import('../lib/auth.js')
  const token = await getAccessToken()
  return apiFetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}

/** query string 직렬화 헬퍼 */
export function buildQuery(params) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue
    if (Array.isArray(v)) {
      v.forEach((item) => q.append(k, item))
    } else {
      q.set(k, String(v))
    }
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}
