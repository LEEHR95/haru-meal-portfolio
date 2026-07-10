/**
 * GET /api/ingredients — 농사로 재료 목록 (안전성 레벨 + 칼로리 포함)
 */
import { apiFetch, buildQuery } from './client.js'
import { getCached, setCached } from './cache.js'

/**
 * 농사로 재료 목록 조회 (재료 데이터는 거의 안 바뀌고 lite 응답이 ~270KB라
 * 5분 메모리 캐시 — HomePage 재진입 시 재요청 0)
 * @param {{ keyword?: string, parent?: string, category?: string, lite?: boolean }} options
 * @returns {Promise<{items: {name:string, level:string, kcal_per_100g:number|null, category:string}[], total:number}|null>}
 */
export async function fetchIngredients({ keyword = '', parent = '', category = '', lite = false } = {}) {
  const qs = buildQuery({
    keyword: keyword || undefined,
    parent: parent || undefined,
    category: category || undefined,
    lite: lite ? '1' : undefined,
  })
  const cacheKey = `ingredients:${qs}`
  const cached = getCached(cacheKey)
  if (cached) return cached
  const res = await apiFetch(`/api/ingredients${qs}`)
  if (res) setCached(cacheKey, res, 5 * 60 * 1000)
  return res
}
