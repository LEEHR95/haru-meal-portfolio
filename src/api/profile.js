/**
 * GET  /api/profile?session_id=...
 * POST /api/profile
 */
import { apiFetch, authFetch, buildQuery } from './client.js'
import { getAnonymousSessionId, normalizeAnonymousSessionId } from '../lib/session.js'
import { getCached, setCached, clearCached } from './cache.js'

function emitReactionUpdate(recipeId, payload) {
  // 반응이 바뀌면 배치 집계 캐시는 더 이상 신선하지 않다 → 무효화(다음 조회 시 갱신).
  clearCached('rxbulk:')
  if (typeof window === 'undefined') return
  if (!recipeId || !payload?.stats) return
  window.dispatchEvent(new CustomEvent('haru:reaction-updated', {
    detail: {
      recipeId,
      stats: payload.stats,
      userReaction: payload.userReaction ?? null,
    },
  }))
}

/**
 * API 응답 또는 localStorage 프로필 → 앱 state 형태 (ProfilePage.buildProfile)
 * @param {object|null} profile
 */
export function normalizeProfileFromApi(profile) {
  if (!profile || typeof profile !== 'object') return null
  const activity = profile.activityLevel || profile.activity || '보통'
  const neutered = profile.neutered ?? profile.isNeutered ?? true
  const gender = profile.gender === 'male' || profile.gender === 'female' ? profile.gender : null
  // 다견 필드: 없는 경우 안전한 기본값으로 통일
  const pets = Array.isArray(profile.pets) ? profile.pets : []
  const activePetId = profile.activePetId ?? profile.active_pet_id ?? null
  const breedId = profile.breedId ?? profile.breed_id ?? null
  const breedSizeGroup = profile.breedSizeGroup ?? profile.breed_size_group ?? null
  const breedSizeSource = profile.breedSizeSource ?? profile.breed_size_source ?? null
  const breedMeta = profile.breedMeta ?? profile.breed_meta ?? null
  const ageMonths = Number(profile.ageMonths ?? profile.age_months)
  const normalizedAgeMonths = Number.isFinite(ageMonths) && ageMonths >= 0
    ? Math.round(ageMonths)
    : (Number(profile.age) >= 0 ? Math.round(Number(profile.age || 0) * 12) : 0)
  const puppyThresholdMonths = Number(profile.puppyThresholdMonths ?? profile.puppy_threshold_months)
  const normalizedThreshold = Number.isFinite(puppyThresholdMonths) && puppyThresholdMonths > 0
    ? Math.round(puppyThresholdMonths)
    : null
  const rawLifeStage = String(profile.lifeStage ?? profile.life_stage ?? '').trim().toLowerCase()
  const rawIsPuppy = profile.isPuppy ?? profile.is_puppy
  const lifeStage = rawLifeStage === 'puppy' || rawLifeStage === 'adult'
    ? rawLifeStage
    : (rawIsPuppy === true || rawIsPuppy === false ? (rawIsPuppy ? 'puppy' : 'adult') : null)
  const isPuppy = rawIsPuppy === true || rawIsPuppy === false
    ? rawIsPuppy
    : (lifeStage === 'puppy' ? true : lifeStage === 'adult' ? false : null)
  return {
    name: profile.name || '',
    breed: profile.breed || '',
    breedId,
    breedSizeGroup,
    breedSizeSource,
    breedMeta,
    age: Number(profile.age) || 0,
    ageMonths: normalizedAgeMonths,
    lifeStage,
    isPuppy,
    puppyThresholdMonths: normalizedThreshold,
    weight: Number(profile.weight) || 0,
    gender,
    neutered,
    isNeutered: neutered,
    activity,
    activityLevel: activity,
    activityFactor:
      profile.activityFactor
      ?? (activity === '높음' ? 2.0 : activity === '낮음' ? 1.2 : 1.6),
    conditions: profile.conditions ?? profile.healthConditions ?? [],
    allergies: profile.allergies ?? [],
    favorites: profile.favorites ?? profile.favoriteIngredients ?? [],
    preferredStyles: profile.preferredStyles ?? profile.preferredSnackTypes ?? [],
    pets,
    activePetId,
  }
}

export function normalizeSavedProfileResponse(response) {
  if (!response || typeof response !== 'object') return response
  const normalized = normalizeProfileFromApi(response.profile)
  if (!normalized) return response
  return {
    ...response,
    profile: normalized,
    pets: normalized.pets,
    activePetId: normalized.activePetId,
  }
}

export function normalizeFetchedProfileResponse(response) {
  if (!response || typeof response !== 'object') return null
  const normalized = normalizeProfileFromApi(response.profile)
  return {
    ...response,
    profile: normalized,
    pets: Array.isArray(normalized?.pets) ? normalized.pets : [],
    activePetId: normalized?.activePetId ?? null,
  }
}

/**
 * Supabase Auth 세션의 user.id (React context와 불일치할 때 폴백)
 * @returns {Promise<string|null>}
 */
export async function getAuthUserId() {
  try {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      return null
    }
    const { supabase } = await import('../lib/supabase.js')
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.id ?? null
  } catch {
    return null
  }
}

/**
 * 프로필 저장·조회용 session_id — 비로그인 시 anon_<uuid> 형식의 haru_session_id
 * @param {{ contextUserId?: string|null, getAnonymousSessionId: () => string }} opts
 */
export async function resolveProfileSessionId({
  contextUserId,
  getAnonymousSessionId: resolveAnonymousSessionId = getAnonymousSessionId,
}) {
  const ctx = (contextUserId || '').trim()
  if (ctx) return ctx
  const authId = await getAuthUserId()
  if (authId) return authId
  return resolveAnonymousSessionId()
}

/**
 * 프로필 조회.
 * @param {string|null} sessionId — 비로그인: haru_session_id
 */
export async function fetchProfile(sessionId) {
  const rawSid = String(sessionId || '').trim()
  const sid = normalizeAnonymousSessionId(rawSid)

  // 비로그인 경로: session_id 쿼리 (기존 동작 유지)
  if (sid) {
    const qs = buildQuery({ session_id: sid })
    const response = await apiFetch(`/api/profile${qs}`)
    return normalizeFetchedProfileResponse(response)
  }
  if (rawSid) {
    return normalizeFetchedProfileResponse({ profile: null })
  }

  // 로그인 경로: JWT Authorization 헤더로 사용자 식별 (user_id Query 제거)
  const response = await authFetch('/api/profile')
  return normalizeFetchedProfileResponse(response)
}

/**
 * 프로필 저장.
 * @param {string|null} sessionId — 비로그인: haru_session_id
 * @param {object} profile — buildProfile / normalizeProfileFromApi 형태
 * @param {{ userId?: string, pets?: object[], activePetId?: string|null }} [opts]
 *   opts.userId      — 더 이상 user_id Body에 포함하지 않음. JWT로 대체.
 *                      로그인 경로 판별 신호로만 사용.
 *   opts.pets        — 저장할 반려견 배열
 *   opts.activePetId — 활성 pet id
 */
export async function saveProfile(sessionId, profile, opts = {}) {
  const sid = normalizeAnonymousSessionId(sessionId)
  const uid = String(opts.userId || '').trim()
  const petsArr = Array.isArray(opts.pets) ? opts.pets : []

  // ── 로그인 경로: JWT Authorization 헤더로 사용자 식별 (user_id Body 제거) ──
  if (uid) {
    const activePetId = opts.activePetId ?? null
    const activePet = (activePetId && petsArr.find(p => p.id === activePetId)) || petsArr[0]
    const pBase = normalizeProfileFromApi(activePet) ?? normalizeProfileFromApi(profile) ?? {}

    const response = await authFetch('/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        // user_id 제거 — backend가 JWT sub에서 추출
        pets: petsArr,
        active_pet_id: activePetId,
        pet_name: pBase.name || '',
        breed: pBase.breed || '',
        breed_id: pBase.breedId || null,
        breed_size_group: pBase.breedSizeGroup || null,
        breed_size_source: pBase.breedSizeSource || null,
        breed_meta: pBase.breedMeta || null,
        gender: pBase.gender ?? null,
        age_years: pBase.age || 0,
        age_months: pBase.ageMonths ?? null,
        life_stage: pBase.lifeStage || null,
        is_puppy: pBase.isPuppy ?? null,
        puppy_threshold_months: pBase.puppyThresholdMonths ?? null,
        weight_kg: pBase.weight || 0,
        is_neutered: pBase.neutered ?? true,
        activity_level: pBase.activity || '보통',
        allergies: pBase.allergies || [],
        health_conditions: pBase.conditions || [],
        favorite_ingredients: pBase.favorites || [],
        preferred_snack_types: pBase.preferredStyles || [],
      }),
    })
    return normalizeSavedProfileResponse(response)
  }

  // ── 비로그인: 기존 session_id 경로 유지 ─────────────────────────
  if (!sid) return null
  const p = normalizeProfileFromApi(profile) ?? profile
  return apiFetch('/api/profile', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sid,
      pet_name: p.name || '',
      breed: p.breed || '',
      breed_id: p.breedId || null,
      breed_size_group: p.breedSizeGroup || null,
      breed_size_source: p.breedSizeSource || null,
      breed_meta: p.breedMeta || null,
      gender: p.gender ?? null,
      age_years: p.age || 0,
      age_months: p.ageMonths ?? null,
      life_stage: p.lifeStage || null,
      is_puppy: p.isPuppy ?? null,
      puppy_threshold_months: p.puppyThresholdMonths ?? null,
      weight_kg: p.weight || 0,
      is_neutered: p.neutered ?? true,
      activity_level: p.activity || '보통',
      allergies: p.allergies || [],
      health_conditions: p.conditions || [],
      favorite_ingredients: p.favorites || [],
      preferred_snack_types: p.preferredStyles || [],
    }),
  })
}

/**
 * 급여 반응 기록
 */
export async function recordReaction({ recipeId, reaction, sessionId, dogId, dogProfile }) {
  if (!String(sessionId || '').trim()) return null
  const response = await apiFetch('/api/reactions', {
    method: 'POST',
    body: JSON.stringify({
      recipe_id: recipeId,
      reaction,
      session_id: sessionId || null,
      dog_id: dogId || null,
      dog_profile: dogProfile || null,
    }),
  })
  emitReactionUpdate(recipeId, response)
  return response
}

/**
 * 급여 반응 해제
 */
export async function deleteReaction({ recipeId, sessionId, dogId }) {
  if (!String(sessionId || '').trim()) return null
  const qs = buildQuery({ session_id: sessionId || null, dog_id: dogId || null })
  const response = await apiFetch(`/api/reactions/${encodeURIComponent(recipeId)}${qs}`, {
    method: 'DELETE',
  })
  emitReactionUpdate(recipeId, response)
  return response
}

/**
 * 급여 반응 통계 조회 (+ sessionId·dogId 동봉 시 해당 강아지 '내 반응'도 응답)
 * @param {string} recipeId
 * @param {{ sessionId?: string, dogId?: string }} [options]
 * @returns {Promise<{count:number, show:boolean, stats?:object, userReaction?:string|null}|null>}
 */
export async function fetchReactionStats(recipeId, options = {}) {
  const { sessionId, dogId, ...fetchOptions } = options
  const qs = buildQuery({ session_id: sessionId || null, dog_id: dogId || null })
  return apiFetch(`/api/reactions/${encodeURIComponent(recipeId)}${qs}`, {
    method: 'GET',
    cache: 'no-store',
    ...fetchOptions,
  })
}

/**
 * 여러 레시피 만족도 집계를 1요청으로 조회 (보관함 등 다건 카드용).
 * 단건 GET /{id} 를 N번 호출하던 것을 1회로 대체. 60초 메모리 캐시(재방문 즉시).
 * @param {string[]} recipeIds
 * @returns {Promise<Record<string,{count:number,show:boolean,stats?:object}>>}
 */
export async function fetchReactionStatsBulk(recipeIds = []) {
  const ids = [...new Set((recipeIds ?? []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (ids.length === 0) return {}
  const cacheKey = `rxbulk:${[...ids].sort().join(',')}`
  const cached = getCached(cacheKey)
  if (cached) return cached
  const res = await apiFetch('/api/reactions/stats', {
    method: 'POST',
    body: JSON.stringify({ recipe_ids: ids }),
  })
  const map = (res && res.stats) ? res.stats : {}
  setCached(cacheKey, map, 60000)
  return map
}
