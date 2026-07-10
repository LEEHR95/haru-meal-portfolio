import { authFetch } from './client.js'

/**
 * POST /api/diet-log/analysis
 *
 * raw 식생활 기록을 backend로 보내 feedingType 기반 분석 결과를 받는다.
 * 분석 규칙(비율·snack_alert 등)은 backend single source.
 * frontend는 결과 표시만 하고 규칙을 직접 계산하지 않는다.
 *
 * @param {{ dogId?:string, logs:object[], windowDays?:number }} args
 * @returns {Promise<object|null>} analyze() 결과 또는 실패 시 null
 */
export async function fetchDietLogAnalysis({ dogId, logs, windowDays = 30 } = {}) {
  if (!Array.isArray(logs) || logs.length === 0) return null
  return authFetch('/api/diet-log/analysis', {
    method: 'POST',
    body: JSON.stringify({
      dog_id: dogId || null,
      logs,
      window_days: windowDays,
    }),
  })
}

// ─── Supabase 백업·복원·다기기 동기화 (로그인 사용자 전용) ────────────────────
// 게스트는 토큰이 없어 authFetch 가 인증 헤더를 생략 → backend 401 → null.
// localStorage 는 항상 주 저장소로 유지되고, 아래는 백업/복원 보조 경로다.

/** POST /api/diet-log/sync — 로그인 사용자 기록 배열 멱등 upsert. */
export async function syncDietLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return null
  return authFetch('/api/diet-log/sync', {
    method: 'POST',
    body: JSON.stringify({ logs }),
  })
}

/** GET /api/diet-log/list — 로그인 사용자 기록 조회(LS 동일 camelCase shape). */
export async function fetchDietLogList(dogId) {
  const q = dogId ? `?dog_id=${encodeURIComponent(dogId)}` : ''
  return authFetch(`/api/diet-log/list${q}`, { method: 'GET' })
}

/** DELETE /api/diet-log/{id} — owner 조건 hard delete. */
export async function deleteDietLogRemote(id) {
  if (!id) return null
  return authFetch(`/api/diet-log/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
