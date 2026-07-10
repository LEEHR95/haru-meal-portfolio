/**
 * POST /api/safety/{ingredient}
 * Profile data is sent in the JSON body to avoid leaking it through URLs.
 */
import { apiFetch } from './client.js'

/**
 * @param {string} ingredient
 * @param {{ allergies?: string[], healthConditions?: string[], health_conditions?: string[], weight?: number, age?: number, isNeutered?: boolean }} profile
 * @returns {Promise<{ingredient:string, level:string, flagged_ingredients:string[], reasons:string[]}|null>}
 */
export async function fetchSafety(ingredient, profile = {}) {
  const payload = {
    allergies: profile.allergies || [],
    health_conditions: profile.healthConditions || profile.health_conditions || [],
    weight_kg: profile.weight || 0,
    age_years: profile.age || 0,
    is_neutered: profile.isNeutered ?? true,
  }

  return apiFetch(`/api/safety/${encodeURIComponent(ingredient)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
