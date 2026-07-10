/**
 * 프로필 알러지 ↔ 재료명 매칭 (완전·부분·alias 그룹)
 * @see app/core/safety_checker.py ALLERGY_RELATED
 */

/** 루트 키워드 → 연관 재료 (부분 일치 확장) */
export const ALLERGY_ALIASES = {
  닭: ['닭가슴살', '닭다리살', '닭안심', '닭간', '닭껍질', '닭고기'],
  소: ['소고기', '우유', '치즈', '버터'],
  돼지: ['돼지고기', '삼겹살'],
}

/**
 * 등록 알러지가 속한 루트 키 수집
 * @param {string} allergy
 * @returns {Set<string>}
 */
function rootsForAllergy(allergy) {
  const roots = new Set()
  const term = allergy.trim()
  if (!term) return roots

  for (const [root, aliases] of Object.entries(ALLERGY_ALIASES)) {
    const hitRoot =
      term === root ||
      term.includes(root) ||
      root.includes(term)
    const hitAlias = aliases.some(
      (a) => a === term || term.includes(a) || a.includes(term),
    )
    if (hitRoot || hitAlias) roots.add(root)
  }

  return roots
}

/**
 * 두 문자열이 서로 포함 관계인지 (짧은 1글자 루트는 허용)
 * @param {string} ingredient
 * @param {string} term
 */
function partialMatch(ingredient, term) {
  if (!term || !ingredient) return false
  if (ingredient === term) return true
  if (term.length >= 2 && ingredient.includes(term)) return true
  if (ingredient.length >= 2 && term.includes(ingredient)) return true
  return false
}

/**
 * 재료가 프로필 알러지에 해당하는지
 * @param {string} ingredientName
 * @param {string[] | undefined} allergies
 * @returns {boolean}
 */
export function isIngredientAllergic(ingredientName, allergies) {
  if (!ingredientName || !allergies?.length) return false

  const ing = ingredientName.trim()

  for (const raw of allergies) {
    const term = String(raw).trim()
    if (!term) continue

    if (partialMatch(ing, term)) return true

    const roots = rootsForAllergy(term)
    for (const root of roots) {
      if (ing.includes(root)) return true
      const aliases = ALLERGY_ALIASES[root] ?? []
      if (aliases.some((a) => partialMatch(ing, a))) return true
    }
  }

  return false
}
