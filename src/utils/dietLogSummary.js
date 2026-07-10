import { getLogs } from './dietLog.js'

function sanitizeName(name) {
  return String(name).replace(/[\n\r[\]]/g, '').slice(0, 20).trim()
}

function sanitizeShortText(value, maxLength = 40) {
  return String(value || '').replace(/[\n\r[\]]/g, '').slice(0, maxLength).trim()
}

// ── 민감 반응 의심 재료 추출 (backend extract_suspect_ingredients 미러) ───────
// 전체 ingredients가 아니라 다음 두 조건을 만족하는 재료만 의심으로 본다.
//   1) 증상/의심 표현이 있는 같은 구절에서 재료명/계열명이 언급되고,
//   2) 그 언급이 대체/교체/첫 급여(또는 A→B 화살표) 문맥이 아니어야 한다.
// app/core/diet_log_analysis.py extract_suspect_ingredients와 동일 정책.
const _ANIMAL_PREFIX_RE = /[\s(]/

// 증상·의심 표현 — 같은 구절에 있을 때만 의심 인정
const SUSPECT_KEYWORDS = [
  '알러지', '알레르기', '의심', '가려', '간지러', '핥', '긁',
  '구토', '토함', '토했', '토하', '게워',
  '무른 변', '무른변', '묽', '설사', '점액', '혈변',
  '발진', '두드러기', '붓', '부음', '소화불량', '재발', '이상반응', '트러블',
]
// 대체·교체·첫 급여 등 '원인 아님' 문맥
const REPLACEMENT_KEYWORDS = ['대체', '변경', '교체', '바꾸', '바꿔', '첫 급여', '첫급여', '처음 급여', '처음급여']
const REPLACEMENT_ARROWS = ['→', '->', '➝', '⇒', '=>']
const SEGMENT_SPLIT_RE = /[.\n。!?！？]/

function animalPrefix(name) {
  return String(name).trim().split(_ANIMAL_PREFIX_RE)[0]
}

function hasSuspectContext(segment) {
  return SUSPECT_KEYWORDS.some((kw) => segment.includes(kw))
}

function mentionTokens(name, prefix) {
  const tokens = [name]
  if (prefix.length >= 2) tokens.push(prefix)
  else if (prefix) tokens.push(`${prefix}고기`)
  return tokens
}

function mentionSpans(name, prefix, segment) {
  const spans = []
  for (const token of mentionTokens(name, prefix)) {
    if (!token) continue
    let start = 0
    while (true) {
      const idx = segment.indexOf(token, start)
      if (idx < 0) break
      spans.push([idx, token.length])
      start = idx + token.length
    }
  }
  return spans
}

function isReplacementMention(segment, idx, length) {
  const window = segment.slice(Math.max(0, idx - 4), idx + length + 10)
  if (REPLACEMENT_KEYWORDS.some((kw) => window.includes(kw))) return true
  return REPLACEMENT_ARROWS.some((arrow) => window.includes(arrow))
}

/**
 * 민감 반응 기록에서 증상 근접 + 비-대체 문맥의 의심 재료만 추출한다.
 * 언급이 없거나 대체 문맥뿐이면 빈 배열(= 원인 미확정)을 반환한다.
 */
export function extractSuspectIngredients(ingredients, memo = '', stoolNote = '') {
  const text = `${memo || ''}\n${stoolNote || ''}`
  if (!text.trim()) return []
  const segments = text.split(SEGMENT_SPLIT_RE).filter((s) => s.trim())
  const suspects = []
  const seen = new Set()
  for (const raw of ingredients || []) {
    const name = String(raw).trim()
    if (!name || seen.has(name)) continue
    const prefix = animalPrefix(name)
    for (const segment of segments) {
      if (!hasSuspectContext(segment)) continue
      const spans = mentionSpans(name, prefix, segment)
      if (spans.length === 0) continue
      if (spans.some(([idx, length]) => !isReplacementMention(segment, idx, length))) {
        suspects.push(name)
        seen.add(name)
        break
      }
    }
  }
  return suspects
}

export function buildDietLogSummary(dogId) {
  if (!dogId) return null
  const logs = getLogs(dogId)
  if (logs.length === 0) return null

  const sorted = [...logs].sort((a, b) => new Date(b.fedAt) - new Date(a.fedAt))
  const recent = sorted.slice(0, 10)

  const ingSet = new Set()
  const ingredientCounts = {}
  const reactions = {}
  const wellEatenSet = new Set()
  const sensitiveSet = new Set()
  for (const log of recent) {
    for (const ing of log.ingredients || []) {
      const s = sanitizeName(ing)
      if (!s) continue
      ingSet.add(s)
      ingredientCounts[s] = (ingredientCounts[s] || 0) + 1
      if (log.reaction === '잘 먹음' || log.reaction === '보통') wellEatenSet.add(s)
    }
    // 민감 반응 재료는 전체 ingredients가 아니라 memo/stoolNote에서 지목된 의심 재료만
    if (log.reaction === '민감 반응') {
      for (const suspect of extractSuspectIngredients(log.ingredients, log.memo, log.stoolNote)) {
        const clean = sanitizeName(suspect)
        if (clean) sensitiveSet.add(clean)
      }
    }
    if (log.reaction) {
      reactions[log.reaction] = (reactions[log.reaction] || 0) + 1
    }
  }

  const recentSensitiveEvents = sorted
    .filter((log) => log.reaction === '민감 반응')
    .slice(0, 3)
    .map((log) => ({
      // 전체 재료가 아닌 의심 재료만 — 원인 미확정 이벤트는 아래 filter에서 제외
      ingredients: extractSuspectIngredients(log.ingredients, log.memo, log.stoolNote)
        .map(sanitizeName).filter(Boolean),
      fedAt: log.fedAt,
      stoolStatus: sanitizeShortText(log.stoolStatus),
      stoolNote: sanitizeShortText(log.stoolNote, 80),
      memo: typeof log.memo === 'string' ? log.memo.trim().slice(0, 100) : '',
    }))
    .filter((e) => e.ingredients.length > 0)

  const repeatedIngredients = Object.entries(ingredientCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    .map(([name]) => name)

  return {
    count: logs.length,
    recent_ingredients: [...ingSet].slice(0, 20),
    reactions,
    recentSensitiveEvents,
    recent_logs: recent
      .map((log) => ({
        ingredients: (log.ingredients || []).map(sanitizeName).filter(Boolean),
        reaction: log.reaction || null,
        fedAt: log.fedAt,
        stoolStatus: sanitizeShortText(log.stoolStatus),
        stoolNote: sanitizeShortText(log.stoolNote, 80),
        memo: typeof log.memo === 'string' ? log.memo.trim().slice(0, 100) : '',
      }))
      .filter((log) => log.ingredients.length > 0),
    well_eaten_ingredients: [...wellEatenSet].slice(0, 20),
    sensitive_ingredients: [...sensitiveSet].slice(0, 20),
    repeated_ingredients: repeatedIngredients.slice(0, 10),
  }
}
