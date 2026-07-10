/**
 * GET  /api/recipes
 * GET  /api/recipes/{id}
 * POST /api/recipes
 * PUT  /api/recipes/{id}
 * DELETE /api/recipes/{id}
 */
import { apiFetch, authFetch, buildQuery } from './client.js'
import { getCached, setCached, clearCached } from './cache.js'

/**
 * 레시피 피드 목록 (60초 메모리 캐시 — 재방문 시 재요청 안 함, 생성/수정/삭제 시 무효화)
 * @returns {Promise<{items:object[], total:number, page:number, pageSize:number}|null>}
 */
export async function fetchRecipes({ snackType, authorId, page = 1, pageSize = 20 } = {}) {
  const qs = buildQuery({
    snack_type: snackType || undefined,
    author_id: authorId || undefined,
    page,
    page_size: pageSize,
  })
  const cacheKey = `recipes:${qs}`
  const cached = getCached(cacheKey)
  if (cached) return cached
  const res = await apiFetch(`/api/recipes${qs}`)
  if (res) setCached(cacheKey, res, 60000)
  return res
}

/**
 * 레시피 단건 조회
 * @param {string} id
 */
export async function fetchRecipe(id) {
  return apiFetch(`/api/recipes/${encodeURIComponent(id)}`)
}

/**
 * 레시피 등록. JWT 기반 — author_id Body 제거됨.
 */
export async function createRecipe(body) {
  clearCached('recipes:')  // 새 레시피가 목록에 바로 반영되도록 캐시 무효화
  return authFetch('/api/recipes', {
    method: 'POST',
    body: JSON.stringify({
      title: body.title,
      ingredients: body.ingredients,
      instructions: body.instructions,
      snack_type: body.snackType || null,
      tags: body.tags || [],
      image_url: body.imageUrl || null,
      allergies: body.allergies || [],
      health_conditions: body.healthConditions || [],
      // author_id 제거 — backend가 JWT sub에서 추출
    }),
  })
}

/**
 * 레시피 수정. JWT 기반 — user_id Query 제거됨.
 * @param {string} _userId — 더 이상 사용하지 않음 (하위 호환 유지)
 */
export async function updateRecipe(id, body, _userId) {
  clearCached('recipes:')
  return authFetch(`/api/recipes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: body.title,
      ingredients: body.ingredients,
      instructions: body.instructions,
      snack_type: body.snackType ?? null,
      tags: body.tags ?? [],
      image_url: body.imageUrl ?? null,
      allergies: body.allergies || [],
      health_conditions: body.healthConditions || [],
    }),
  })
}

/**
 * 레시피 삭제. JWT 기반 — user_id Query 제거됨.
 * @param {string} _userId — 더 이상 사용하지 않음 (하위 호환 유지)
 */
export async function deleteRecipe(id, _userId) {
  clearCached('recipes:')
  return authFetch(`/api/recipes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
