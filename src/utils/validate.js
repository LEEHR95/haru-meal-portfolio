/**
 * 하루한끼 — 입력값 검증 유틸
 * 클라이언트 측 1차 검증. 서버(FastAPI Pydantic)에서 2차 검증.
 */

export const RECIPE_NAME_MAX = 50
export const INGREDIENT_NAME_MAX = 200
export const WEIGHT_MIN = 0.1
export const WEIGHT_MAX = 100

/** 주입 위험 특수문자 패턴 */
const UNSAFE_CHARS = /[<>"';&{}\\]/

/** 숫자 + 선택 단위 (분량 필드) */
const AMOUNT_RE = /^[\d./\s]+(g|kg|ml|L|개|장|조각|스푼|컵|큰술|작은술|적당량|생략가능|cc)?$/

/**
 * @param {string} v
 * @returns {string|null} 에러 메시지 또는 null(정상)
 */
export function validateRecipeName(v) {
  const t = (v ?? '').trim()
  if (!t) return '레시피 이름을 입력해주세요.'
  if (t.length > RECIPE_NAME_MAX) return `레시피 이름은 ${RECIPE_NAME_MAX}자 이내로 입력해주세요.`
  if (UNSAFE_CHARS.test(t)) return '사용할 수 없는 특수문자가 포함돼 있어요.'
  return null
}

/**
 * @param {string} v
 * @returns {string|null}
 */
export function validateIngredientName(v) {
  const t = (v ?? '').trim()
  if (!t) return '재료명을 입력해주세요.'
  if (t.length > INGREDIENT_NAME_MAX) return `재료명은 ${INGREDIENT_NAME_MAX}자 이내로 입력해주세요.`
  if (UNSAFE_CHARS.test(t)) return '사용할 수 없는 특수문자가 포함돼 있어요.'
  return null
}

/**
 * 분량은 선택 항목. 입력 시 숫자+단위 형식 권장.
 * @param {string} v
 * @returns {string|null}
 */
export function validateAmount(v) {
  const t = (v ?? '').trim()
  if (!t) return null
  if (t.length > 30) return '분량은 30자 이내로 입력해주세요.'
  if (!AMOUNT_RE.test(t)) return '분량 형식: 숫자 + 단위 (예: 100g, 2개)'
  return null
}

/**
 * 체중: 0.1 ~ 100 kg
 * @param {string|number} v
 * @returns {string|null}
 */
export function validateWeight(v) {
  if (v === '' || v === null || v === undefined) return '체중을 입력해주세요.'
  const n = parseFloat(v)
  if (isNaN(n)) return '숫자로 입력해주세요.'
  if (n < WEIGHT_MIN || n > WEIGHT_MAX) return `체중은 ${WEIGHT_MIN}~${WEIGHT_MAX}kg 사이로 입력해주세요.`
  return null
}
