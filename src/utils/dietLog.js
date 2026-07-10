const LS_KEY = 'haru_diet_logs'

// ─── 급여 유형 (feedingType) ───────────────────────────────────────────────
export const FEEDING_TYPE_OPTIONS = [
  { value: 'meal',    label: '주식' },
  { value: 'topping', label: '토핑' },
  { value: 'snack',   label: '간식' },
  { value: 'other',   label: '기타' },
]

export const FEEDING_TYPE_LABEL = {
  meal:    '주식',
  topping: '토핑',
  snack:   '간식',
  other:   '기타',
}

// 기존 mealTime 값 → feedingType 값 (하위 호환)
const _LEGACY_MAP = { morning: 'meal', lunch: 'meal', dinner: 'meal', snack: 'snack' }

/**
 * 로그의 급여 유형 표시 문자열 반환.
 * feedingType(신규) → mealTime(기존) 순으로 폴백.
 */
export function getFeedingTypeLabel(log) {
  if (log.feedingType) return FEEDING_TYPE_LABEL[log.feedingType] ?? log.feedingType
  if (log.mealTime) return FEEDING_TYPE_LABEL[_LEGACY_MAP[log.mealTime]] ?? null
  return null
}

/** 기존 mealTime 값 → feedingType 값 변환 (수정 시 초기값 설정용) */
export function legacyToFeedingType(mealTime) {
  return _LEGACY_MAP[mealTime] ?? 'meal'
}

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeAll(logs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(logs))
    return true
  } catch {
    return false
  }
}

export function getLogs(dogId) {
  const all = readAll()
  if (!dogId) return []
  return all.filter((e) => e.dogId === dogId)
}

// ─── Supabase fire-and-forget (로그인 사용자만, LS가 주 저장소) ──────────────
// 게스트는 토큰이 없어 서버 호출을 건너뛴다. 서버 실패는 무시(LS 유지).
async function _isLoggedIn() {
  try {
    const { getAccessToken } = await import('../lib/auth.js')
    return Boolean(await getAccessToken())
  } catch {
    return false
  }
}

function _pushLogToServer(event) {
  ;(async () => {
    try {
      if (!(await _isLoggedIn())) return
      const { syncDietLogs } = await import('../api/dietLog.js')
      await syncDietLogs([event])
    } catch { /* ignore */ }
  })()
}

function _deleteLogFromServer(id) {
  ;(async () => {
    try {
      if (!(await _isLoggedIn())) return
      const { deleteDietLogRemote } = await import('../api/dietLog.js')
      await deleteDietLogRemote(id)
    } catch { /* ignore */ }
  })()
}

export function saveLog(event) {
  const all = readAll()
  const ok = writeAll([...all, event])
  if (ok) _pushLogToServer(event)
  return ok
}

export function deleteLog(id) {
  const all = readAll()
  const ok = writeAll(all.filter((e) => e.id !== id))
  if (ok) _deleteLogFromServer(id)
  return ok
}

export function updateLog(updatedEvent) {
  const all = readAll()
  let finalEvent = null
  const next = all.map((e) => {
    if (e.id !== updatedEvent.id) return e
    finalEvent = { ...updatedEvent, createdAt: e.createdAt, updatedAt: new Date().toISOString() }
    return finalEvent
  })
  const ok = writeAll(next)
  if (ok && finalEvent) _pushLogToServer(finalEvent)
  return ok
}

/**
 * 서버 기록을 LS에 멱등 병합(id 기준, updatedAt LWW). 새 기기/재로그인 복원용.
 * @returns 병합된 전체 배열
 */
export function mergeServerLogs(serverLogs) {
  if (!Array.isArray(serverLogs) || serverLogs.length === 0) return readAll()
  const byId = new Map(readAll().map((e) => [e.id, e]))
  for (const s of serverLogs) {
    if (!s || !s.id) continue
    const local = byId.get(s.id)
    if (!local) { byId.set(s.id, s); continue }
    const lu = new Date(local.updatedAt || local.createdAt || 0).getTime()
    const su = new Date(s.updatedAt || s.createdAt || 0).getTime()
    if (su >= lu) byId.set(s.id, { ...local, ...s })
  }
  const merged = [...byId.values()]
  writeAll(merged)
  return merged
}

/**
 * 로그인 직후(프로필 동기화 성공 후) 호출.
 *   1) GET /list → LS 멱등 병합(복원)
 *   2) LS 기록 → POST /sync (dogId 변환 없이 그대로 전송)
 *
 * dogId 해소·소유권 격리는 전적으로 서버가 한다:
 *   - owner_user_id 는 JWT 에서만 주입(클라 위조 불가)
 *   - dogId 는 owned → 이 user 의 dog_id_map(per-user) 순으로 해소
 *   - 해소 실패(타인 잔여 데이터 포함)는 skip — 절대 타 owner 로 귀속되지 않음
 * 따라서 클라가 owned 로 미리 거르면 legacy/재발급 dogId 기록이 dog_id_map 에
 * 닿지 못해 영원히 미마이그레이션된다. 서버가 안전하게 거르므로 전송은 LS 전체.
 * 실패/skip 기록은 LS 에 그대로 유지된다.
 */
export async function syncDietLogsOnLogin() {
  try {
    const { getAccessToken } = await import('../lib/auth.js')
    if (!(await getAccessToken())) return
    const { fetchDietLogList, syncDietLogs } = await import('../api/dietLog.js')
    const res = await fetchDietLogList()
    if (res && Array.isArray(res.logs)) mergeServerLogs(res.logs)

    const toPush = readAll().map((e) =>
      e.feedingType ? e : { ...e, feedingType: legacyToFeedingType(e.mealTime) },
    )
    if (toPush.length > 0) await syncDietLogs(toPush)
  } catch { /* ignore — LS가 주 저장소라 동기화 실패는 기능에 영향 없음 */ }
}
