/**
 * RER / MER / 간식 권장량 계산 유틸
 *
 * ChatPage 맞춤 급여 가이드 카드와 HomePage 간단 급여 가이드에서 공용으로 사용한다.
 */

/**
 * 반려견 프로필 기반 RER / MER / 간식 권장량 계산
 *
 * @param {{ weight?: number, activityFactor?: number } | null} profile
 * @returns {{ rer: number, mer: number, snackKcal: number, snackGrams: number } | null}
 */
export function calcKPI(profile) {
  if (!profile) return null
  const w = profile.weight ?? 5
  const rer = Math.round(w * 30 + 70)
  const mer = Math.round(rer * (profile.activityFactor ?? 1.6))
  const snackKcal = Math.round(mer * 0.1)
  const snackGrams = Math.round(w * 6)
  return { rer, mer, snackKcal, snackGrams }
}
