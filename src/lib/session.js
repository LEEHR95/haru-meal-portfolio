export const ANON_SESSION_PREFIX = 'anon_'
export const ANON_SESSION_STORAGE_KEY = 'haru_session_id'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuidLike(value) {
  return UUID_RE.test(String(value || '').trim())
}

function createAnonymousSessionId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${ANON_SESSION_PREFIX}${crypto.randomUUID()}`
    }
  } catch {
    // fall through to non-crypto fallback
  }
  return `${ANON_SESSION_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeAnonymousSessionId(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (raw.startsWith(ANON_SESSION_PREFIX)) {
    const suffix = raw.slice(ANON_SESSION_PREFIX.length)
    return isUuidLike(suffix) ? raw : ''
  }

  return isUuidLike(raw) ? `${ANON_SESSION_PREFIX}${raw}` : ''
}

export function getAnonymousSessionId() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return createAnonymousSessionId()
  }

  const stored = localStorage.getItem(ANON_SESSION_STORAGE_KEY)
  let normalized = normalizeAnonymousSessionId(stored)
  if (!normalized) {
    normalized = createAnonymousSessionId()
  }

  if (stored !== normalized) {
    localStorage.setItem(ANON_SESSION_STORAGE_KEY, normalized)
  }

  return normalized
}
