/**
 * POST /api/chat
 * POST /api/chat/kpi RER/MER calculation
 */
import { apiFetch, authFetch } from './client.js'

/**
 * Chat answer.
 * @param {{ message:string, topic?:string, profile?:object, sessionId?:string, dietLogSummary?:object, dietLogs?:object[] }} body
 * @returns {Promise<{answer:string, topics:string[]}|{__quota_exceeded:true}|null>}
 */
export async function fetchChatAnswer({ message, topic, profile, sessionId, dietLogSummary, dietLogs } = {}) {
  const res = await authFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      topic: topic || null,
      profile: profile || null,
      session_id: sessionId || null,
      diet_log_summary: dietLogSummary || null,      // legacy — 과도기 하위호환
      diet_logs: Array.isArray(dietLogs) ? dietLogs : null,  // raw logs → backend feedingType 분석
    }),
  })
  if (!res) return null
  if (res.__status === 429) return { __quota_exceeded: true }

  return {
    answer: res.answer ?? res.reply ?? '',
    topics: Array.isArray(res.topics) ? res.topics : [],
  }
}

/**
 * RER/MER/snack allowance calculation
 * @param {{ weightKg, ageYears, isNeutered, activityLevel }} profile
 * @returns {Promise<{rer,mer,snack_kcal,snack_grams}|null>}
 */
export async function fetchKPI({ weightKg, ageYears = 0, isNeutered = true, activityLevel = '보통' } = {}) {
  return apiFetch('/api/chat/kpi', {
    method: 'POST',
    body: JSON.stringify({
      weight_kg: weightKg,
      age_years: ageYears,
      is_neutered: isNeutered,
      activity_level: activityLevel,
    }),
  })
}
