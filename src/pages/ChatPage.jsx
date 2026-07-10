import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import pawSectionIconUrl from '../components/icons/paw-icon-02.png'
import { GUIDE_RESPONSES, INGREDIENTS, RELATED_INGREDIENTS } from '../data/index.js'
import { useActivePetId, useApp, useProfile, useToast } from '../store/useApp.js'
import { ROUTES } from '../routes.js'
import { IconBack, IconCheck, IconCopy, IconSend } from '../components/icons/index.jsx'
import { calcKPI } from '../utils/kpi.js'
import { fetchChatAnswer, fetchKPI } from '../api/chat.js'
import { trackChatQuestion } from '../lib/analytics.js'
import { fetchRecipes } from '../api/recipes.js'
import { API_ENABLED } from '../api/client.js'
import { getAnonymousSessionId } from '../lib/session.js'
import { ERROR_MSG } from '../utils/errorMessages.js'
import { buildDietLogSummary } from '../utils/dietLogSummary.js'
import { getLogs } from '../utils/dietLog.js'

// ─── 상수 ────────────────────────────────────────────────────
const DAILY_LIMIT = 15

const SUGGESTED_QUESTIONS = [
  '소고기는 하루에 얼마나 줘야 해?',
  '브로콜리는 데쳐서 줘야 해?',
]

// AI 대화로 전송하지 않고 /contact 로 직접 이동하는 칩
const CONTACT_CHIP_LABEL = '서비스 문의하기'
const CONTACT_ACTION = {
  label: CONTACT_CHIP_LABEL,
  to: `${ROUTES.contact}?type=error_report`,
}
const CONTACT_INTENT_MESSAGE = '문의가 필요하시면 아래 버튼을 눌러 접수해 주세요.'
const CONTACT_INTENT_KEYWORDS = new Set([
  '문의하기',
  '문의',
  '오류제보',
  '서비스문의',
  '문의할래',
  '고객센터',
])

// ─── 가이드 칩셋 생성 ────────────────────────────────────────
// 단일 재료 → 기존 3종 / 다중 재료 → 복합 질문 3종
const CONTACT_CHIP_TEXT = CONTACT_CHIP_LABEL

let messageSeq = 0

function createMessage(role, text, extra = {}) {
  const createdAt = Date.now()

  return {
    id: `${role}-${createdAt}-${messageSeq++}`,
    role,
    text,
    createdAt,
    ...extra,
  }
}

function guidedChipsFor(topic, isMulti) {
  if (isMulti) {
    return [
      '각 재료 급여량 알려줘',
      '알레르기 체크해줘',
      '같이 쓸 수 있는 조합은?',
    ]
  }
  return [
    '어떤 부위가 안전한가요?',
    `${topic} 알레르기 체크법`,
    '급여량 및 조리법',
  ]
}

// ─── Rule v1: 재료 비율 계산 ──────────────────────────────────
const _PROTEIN_KEYWORDS = ['소고기', '돼지고기', '닭', '오리', '연어', '참치', '대구', '계란', '달걀', '고기', '생선', '칠면조', '양고기', '메추리']

function _isMain(name) {
  return _PROTEIN_KEYWORDS.some((kw) => name.includes(kw))
}

function _computeShares(names, totalKcal) {
  const main = names.filter(_isMain)
  const sub = names.filter((n) => !_isMain(n))
  if (main.length === 0) {
    const share = totalKcal / names.length
    return Object.fromEntries(names.map((n) => [n, share]))
  }
  const mainTotal = sub.length > 0 ? totalKcal * 0.7 : totalKcal
  const subTotal = sub.length > 0 ? totalKcal * 0.3 : 0
  const shares = {}
  main.forEach((n) => { shares[n] = mainTotal / main.length })
  sub.forEach((n) => { shares[n] = subTotal / sub.length })
  return shares
}

// ─── 재료별 급여량 계산 (Rule v1 공유 헬퍼) ─────────────────────
// answerGuided와 send() 양쪽에서 동일한 공식으로 계산
function computeServings(topics, kpi) {
  if (!kpi?.snackKcal || !topics || topics.length === 0) return []
  const calcable = topics.filter((name) => INGREDIENTS[name]?.cal != null)
  if (calcable.length === 0) return []
  const shares = _computeShares(calcable, kpi.snackKcal)
  return calcable.map((name) => ({
    name,
    grams: Math.round((shares[name] / INGREDIENTS[name].cal) * 100),
    kcal: Math.round(shares[name] * 10) / 10,
  }))
}

// ─── 클립보드 복사 유틸 (navigator.clipboard → execCommand fallback) ──
function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')  // eslint-disable-line no-document-touch
      document.body.removeChild(ta)
      if (ok) resolve()
      else reject(new Error('execCommand copy failed'))
    } catch (e) {
      reject(e)
    }
  })
}

// ─── LLM 답변 후처리 (markdown 기호 제거 + 섹션 헤더 이모지 제거) ──
function sanitizeBotAnswer(text) {
  if (!text) return text
  return text
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s?/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^---+$/gm, '')
    // 섹션 제목 앞 이모지 제거 — "🥕 권장량" → "권장량" (LLM이 여전히 이모지를 쓰는 경우 safety net)
    .replace(/^[^가-힣ᄀ-ᇿ㄰-㆏a-zA-Z]*?(권장량|주의사항|참고)\s*$/gmu, '$1')
}

// 섹션 헤더 감지 — 줄 전체가 정해진 라벨인 경우 paw 아이콘 + 볼드 렌더링
const _SECTION_LABELS = new Set([
  '권장량', '주의사항', '참고',
  '민감 반응 기록', '최근 급여 재료', '긍정 반응 재료', '자주 먹인 재료', '반복 급여 재료',
])
function isSectionHeader(line) {
  return _SECTION_LABELS.has(line.trim())
}

function normalizeIntentText(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[?!.,~]/g, '')
}

function isContactIntent(text) {
  return CONTACT_INTENT_KEYWORDS.has(normalizeIntentText(text))
}

// 배열 정규화 — profile 필드가 배열이 아닌 경우 []로 fallback
// safety_checker.py 가 health_conditions 를 배열로 읽으므로 동일한 방어 처리 필요
function normProfileArr(v) {
  return Array.isArray(v) ? v : []
}

function resolveProfileAgeFields(profile) {
  const rawAgeMonths = Number(profile?.ageMonths ?? profile?.age_months)
  const ageMonths = Number.isFinite(rawAgeMonths) && rawAgeMonths > 0
    ? Math.round(rawAgeMonths)
    : null

  const rawAgeYears = Number(profile?.ageYears ?? profile?.age_years ?? profile?.age)
  const ageYears = ageMonths != null
    ? +(ageMonths / 12).toFixed(2)
    : (Number.isFinite(rawAgeYears) && rawAgeYears > 0 ? +rawAgeYears.toFixed(2) : null)

  return { ageYears, ageMonths }
}

function normalizeTopicName(name) {
  return String(name || '').trim()
}

function mergeTopicLists(baseTopics = [], incomingTopics = []) {
  const merged = []
  const seen = new Set()

  ;[...baseTopics, ...incomingTopics].forEach((name) => {
    const normalized = normalizeTopicName(name)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    merged.push(normalized)
  })

  return merged
}

// ─── 가이드 답변 생성 ─────────────────────────────────────────
function answerGuided(question, topic, profile, allTopics, kpi) {
  // 다중 재료 전용 질문 처리
  if (allTopics && allTopics.length > 1) {
    if (question === '각 재료 급여량 알려줘') {
      const snackKcal = kpi?.snackKcal
      const petLabel = profile ? `${profile.name}(${profile.weight}kg)` : '강아지'

      const unknown = allTopics.filter((name) => INGREDIENTS[name]?.cal == null)

      if (!snackKcal || allTopics.every((name) => INGREDIENTS[name]?.cal == null)) {
        const lines = allTopics.map((name) => {
          const meta = INGREDIENTS[name]
          const per = meta?.servingPerKg ?? 4
          const grams = profile ? Math.round(profile.weight * per) : null
          return grams ? `• ${name}: 하루 약 ${grams}g` : `• ${name}: 체중 기준 권장량 확인 필요`
        })
        return `${allTopics.join(', ')}의 하루 권장량이에요.\n${lines.join('\n')}\n간식은 전체 식사량의 10% 이내로 조절해주세요.`
      }

      const servings = computeServings(allTopics, kpi)
      const amountLines = [
        ...servings.map(({ name, grams }) => `• ${name}: 약 ${grams}g`),
        ...unknown.map((name) => `• ${name}: 칼로리 정보 준비 중이에요`),
      ]

      const calcableNames = servings.map((s) => s.name)
      const tips = calcableNames
        .map((name) => {
          const note = INGREDIENTS[name]?.note
          return note ? `✓ ${name}: ${note}` : null
        })
        .filter(Boolean)
      tips.push('✓ 처음 급여하는 조합이라면 절반 정도부터 시작해 보세요.')

      const totalKcal = Math.round(snackKcal)
      const hasMain = calcableNames.some(_isMain)
      const intro = allTopics.join(', ')

      return [
        `${intro}을(를) 함께 급여하려고 하시네요.`,
        '',
        `${petLabel} 기준으로 계산했어요.`,
        '',
        amountLines.join('\n'),
        '',
        `총 예상 칼로리:\n약 ${totalKcal}kcal`,
        '',
        '함께 급여 팁',
        '',
        tips.join('\n'),
        '',
        hasMain
          ? '메인 재료 비중을 높게 계산했어요.\n칼로리에 따라 실제 급여량(g)은 달라질 수 있어요.'
          : '칼로리에 따라 실제 급여량(g)은 달라질 수 있어요.',
      ].join('\n')
    }
    if (question === '알레르기 체크해줘') {
      return `${allTopics.join(', ')}을(를) 처음 급여할 때는 하나씩 따로 시작해주세요. 1) 손톱만큼 소량으로 시작 2) 24시간 관찰 (가려움·설사·구토·발진) 3) 이상 없으면 양을 천천히 늘려주세요. 여러 재료를 동시에 시작하면 알레르기 원인을 특정하기 어려워요.`
    }
    if (question === '같이 쓸 수 있는 조합은?') {
      return `${allTopics.join('+')} 조합은 간식 레시피에 활용할 수 있어요. 단백질(${allTopics.filter(n => INGREDIENTS[n]?.cal && INGREDIENTS[n].cal > 100).slice(0,2).join(', ') || allTopics[0]})과 채소를 함께 건조하거나 쪄서 주시면 균형 잡힌 간식이 돼요. 각 재료의 주의사항을 확인하고 향신료·소금 없이 조리해주세요.`
    }
  }

  if (!topic) return null

  if (question === '어떤 부위가 안전한가요?') {
    const related = RELATED_INGREDIENTS[topic] ?? []
    const safe = related.filter((r) => r.level === 'safe').map((r) => r.name)
    const danger = related.filter((r) => r.level === 'danger')
    let body = `${topic}는 부위에 따라 안전도가 달라요.`
    if (safe.length) body += ` 안전한 부위: ${safe.slice(0, 3).join(', ')}.`
    if (danger.length) body += ` 피해야 할 부위: ${danger.map((d) => d.name).join(', ')}.`
    if (!related.length) body += ' 자세한 부위별 안전성은 등록된 정보가 없어요. 수의사와 상의해주세요.'
    return body
  }

  if (question.endsWith('알레르기 체크법')) {
    return `${topic}을(를) 처음 급여할 때는 1) 손톱만큼 소량으로 시작 2) 24시간 동안 가려움·설사·구토·발진이 없는지 관찰 3) 이상 없으면 양을 천천히 늘려주세요. 같은 군 단백질에 교차 알레르기가 있을 수 있으니 주의해요.`
  }

  if (question === '급여량 및 조리법') {
    const meta = INGREDIENTS[topic]
    const per = meta?.servingPerKg ?? 4
    const grams = profile ? Math.round(profile.weight * per) : null
    const tip = meta?.note ?? ''
    let body = grams
      ? `${profile.name}(${profile.weight}kg) 기준 하루 ${grams}g 이내가 적정량이에요.`
      : '체중에 따라 권장량이 달라져요. 프로필을 설정하면 정확한 양을 알려드릴게요.'
    body += ' 조리는 향신료·소금·기름 없이 푹 익혀서 잘게 잘라 급여하는 것이 안전해요.'
    if (tip) body += ` 참고: ${tip}`
    return body
  }

  return null
}

// ─── 자유 입력에서 재료명 감지 ────────────────────────────────
// 텍스트에 INGREDIENTS 키가 포함되면 해당 재료를 topic으로 반환.
// 긴 이름 우선 매칭(예: "닭가슴살"이 "닭"보다 먼저 잡히도록).
function detectTopicsFromText(text) {
  const matches = Object.keys(INGREDIENTS)
    .map((name) => ({ name, index: text.indexOf(name) }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index || b.name.length - a.name.length)

  return mergeTopicLists([], matches.map(({ name }) => name))
}
// ─── 자유 입력 답변 ───────────────────────────────────────────
function answerFree(text, topic, profile) {
  const t = text.trim()
  if (GUIDE_RESPONSES[t]) {
    const r = GUIDE_RESPONSES[t]
    return typeof r === 'function' ? r(profile) : r
  }
  if (topic && t.includes('알레르기')) return answerGuided(`${topic} 알레르기 체크법`, topic, profile)
  if (topic && (t.includes('부위') || t.includes('어디'))) return answerGuided('어떤 부위가 안전한가요?', topic, profile)
  if (topic && (t.includes('급여') || t.includes('얼마') || t.includes('조리') || t.includes('만들'))) return answerGuided('급여량 및 조리법', topic, profile)
  if (t.includes('급여') || t.includes('얼마') || t.includes('몇')) {
    return profile
      ? `${profile.name}(${profile.weight}kg) 기준으로 하루 권장 급여량은 약 ${Math.round(profile.weight * 6)}g 이내예요.`
      : '체중에 따라 권장량이 달라져요. 프로필을 설정하면 정확한 권장량을 알려드릴게요.'
  }
  return '재료별 안전성과 권장량을 알려드릴게요. 더 구체적인 질문을 해주시면 정확하게 답변드릴 수 있어요.'
}

// ─── 맞춤 급여 가이드 카드 (채팅 상단) ───────────────────────────
function FeedingGuideCard({ profile, kpi, allTopics, onProfile }) {
  const cardStyle = {
    width: '100%',
    background: 'color-mix(in srgb, var(--primary-soft) 62%, white)',
    border: '1px solid rgba(0, 0, 0, 0.04)',
    borderRadius: 16,
    padding: '12px 13px 10px',
  }

  if (!profile || !kpi) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>
            프로필을 설정하면 맞춤 급여량을 알려드려요
          </p>
          <button
            type="button"
            className="press"
            onClick={onProfile}
            style={{
              background: 'var(--surface)',
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            프로필 설정하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            background: 'color-mix(in srgb, var(--primary) 90%, transparent)',
            border: '1px solid color-mix(in srgb, var(--primary) 60%, white)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: 2,
          }}
        >
          <img
            src="/icons/하루한끼_문구없.png"
            alt=""
            width={46}
            height={46}
            style={{ objectFit: 'contain', display: 'block' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>맞춤 급여 가이드</div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>
            {profile.name}({profile.weight}kg) 하루 권장량 기준
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>1일 간식 권장량</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>
                약 {kpi.snackGrams}g
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>권장 칼로리</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>
                {kpi.snackKcal}kcal
              </span>
            </div>
          </div>
          {allTopics && allTopics.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>
              선택 재료: {allTopics.join(' · ')}
            </div>
          )}
        </div>
      </div>
    </div>
    )
}

// ─── 관련 레시피 섹션 (트리거 버튼 방식) ─────────────────────
// defaultExpanded=true: 트리거 버튼 없이 리스트 바로 표시 (Bubble 내부에서 외부 트리거로 사용 시)
function RelatedRecipesSection({ topics, allergies, onNavigate, defaultExpanded = false }) {
  const [recipes, setRecipes] = useState(null)
  const [showRecipes, setShowRecipes] = useState(defaultExpanded)
  const [expanded, setExpanded] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!topics || topics.length === 0 || !API_ENABLED || fetchedRef.current) return
    fetchedRef.current = true
    fetchRecipes({ pageSize: 100 })
      .then((res) => {
        const items = res?.items || []
        const allergyList = (allergies || []).map((a) => a.toLowerCase())
        const matched = items
          .filter((r) => r.safety !== 'danger')
          .filter((r) => {
            if (!allergyList.length) return true
            return !(r.ingredients || []).some((ing) =>
              allergyList.some((a) => (ing.name || '').toLowerCase().includes(a))
            )
          })
          .map((r) => {
            const score = topics.filter((topic) =>
              (r.ingredients || []).some((ing) => {
                const iName = (ing.name || '').toLowerCase()
                const tName = topic.toLowerCase()
                return iName.includes(tName) || tName.includes(iName)
              })
            ).length
            return { ...r, _score: score }
          })
          .filter((r) => r._score > 0)
          .sort((a, b) => b._score - a._score)
        setRecipes(matched)
      })
      .catch(() => setRecipes([]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (recipes === null) return null

  const chipStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  }

  if (!showRecipes) {
    return (
      <button
        type="button"
        className="press"
        onClick={() => setShowRecipes(true)}
        style={{ ...chipStyle, color: 'var(--primary)', alignSelf: 'flex-start' }}
      >
        이 재료로 만들 수 있는 레시피
      </button>
    )
  }

  const visible = expanded ? recipes : recipes.slice(0, 2)
  const hasMore = !expanded && recipes.length > 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>선택한 재료로 만들 수 있어요.</div>
      {recipes.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>관련 레시피 준비 중이에요</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {visible.map((r) => (
              <button
                key={r.id}
                type="button"
                className="press"
                onClick={() => onNavigate(r.id)}
                style={{ ...chipStyle, color: 'var(--ink-1)' }}
              >
                {r.name || r.title}
              </button>
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              style={{
                background: 'none', border: 'none', padding: '2px 4px',
                fontSize: 12, color: 'var(--primary)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              더 보기 ({recipes.length - 2}개)
            </button>
          )}
        </>
      )}
    </div>
  )
}

function buildInitialAiMessage(initialTopics, profile) {
  if (initialTopics.length > 1) {
    return `방금 검색하신 ${initialTopics.join(', ')}에 대해 궁금한 점이 있으신가요? 아래 버튼을 선택하시면 바로 알려드릴게요!`
  }
  if (initialTopics.length === 1) {
    return `'${initialTopics[0]}'에 대해 더 궁금한 점이 있으신가요? 아래 버튼을 선택하시면 바로 알려드릴게요!`
  }
  return profile
    ? `안녕하세요 ${profile.name} 보호자님\n우리 아이 급여량, 재료 안전성, 조리 방법까지 편하게 물어보세요.`
    : '안녕하세요 보호자님\n우리 아이 급여량, 재료 안전성, 조리 방법까지 편하게 물어보세요.'
}

// ─── 말풍선 컴포넌트 ─────────────────────────────────────────
function Bubble({ message, onAction, recipeTopics, recipeAllergies, onRecipeNavigate }) {
  const { role, text, loading, action } = message
  const [copied, setCopied] = useState(false)
  const [showRecipes, setShowRecipes] = useState(false)
  const { show: showToast } = useToast()

  if (role === 'system') {
    return (
      <div style={{
        alignSelf: 'center',
        background: 'var(--surface-2)', color: 'var(--ink-3)',
        fontSize: 11, padding: '4px 12px', borderRadius: 12,
      }}>
        {text}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="fade-in" style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div aria-label="답변 생성 중" style={{ padding: '4px 8px' }}>
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    )
  }

  const isUser = role === 'user'

  const handleCopy = () => {
    if (!text) return
    copyToClipboard(text)
      .then(() => {
        showToast('복사되었습니다.')
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {
        showToast('복사에 실패했어요.')
      })
  }

  // \n 기준 줄별 렌더링 — 빈 줄(\n\n)은 여백 처리
  const lines = String(text ?? '').split('\n')

  // ── user 메시지 ──
  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          className="fade-in"
          style={{
            maxWidth: '78%',
            background: 'var(--primary)',
            color: 'var(--surface)',
            borderRadius: 16,
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {lines.map((line, i) =>
            line === '' ? <div key={i} style={{ height: 4 }} /> : <div key={i}>{line}</div>
          )}
        </div>
      </div>
    )
  }

  // ── assistant 메시지 ──
  return (
    <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-start' }}>
      {/* 말풍선 + 액션 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
      {/* 답변 텍스트 카드 */}
      <div className="fade-in assistant-message">
        {lines.map((line, i) => {
          if (line === '') return <div key={i} style={{ height: 10 }} />
          if (isSectionHeader(line)) return (
            <div key={i} style={{ fontWeight: 700, marginTop: 8, marginBottom: 2, display: 'flex', alignItems: 'center' }}>
              <img
                src={pawSectionIconUrl}
                alt=""
                style={{ width: 14, height: 14, objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle', marginRight: 6, flexShrink: 0 }}
              />
              {line.trim()}
            </div>
          )
          return <div key={i}>{line}</div>
        })}
        {action ? (
          <button
            type="button"
            className="press"
            onClick={() => onAction?.(action)}
            style={{
              marginTop: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 14px',
              borderRadius: 999,
              background: 'var(--surface-2)',
              border: '1px solid var(--divider)',
              color: 'var(--primary)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {action.label}
          </button>
        ) : null}
      </div>
      {/* 액션 영역: 복사 아이콘 + 레시피 칩 (action 없는 답변에만) */}
      {!action && text && (
        <>
          <div className="assistant-actions">
            <button
              type="button"
              className="assistant-icon-action press"
              onClick={handleCopy}
              aria-label="답변 복사"
            >
              {copied
                ? <IconCheck size={16} color="var(--primary)" />
                : <IconCopy size={16} />
              }
            </button>
            {recipeTopics && (
              <button
                type="button"
                className="assistant-chip-action press"
                onClick={() => setShowRecipes((p) => !p)}
              >
                이 재료로 만들 수 있는 레시피
              </button>
            )}
          </div>
          {/* 레시피 리스트 — 칩 클릭 시 확장 */}
          {showRecipes && recipeTopics && (
            <RelatedRecipesSection
              topics={recipeTopics}
              allergies={recipeAllergies}
              onNavigate={onRecipeNavigate}
              defaultExpanded
            />
          )}
        </>
      )}
      </div>
    </div>
  )
}

// ─── 급여 상담 화면 ───────────────────────────────────────────
export default function ChatPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { dispatch } = useApp()
  const profile = useProfile()
  const { show: showToast } = useToast()
  const activePetId = useActivePetId()
  // 식생활 기록(dietLogs/dietLogSummary)은 mount 시 memo로 캐싱하지 않는다.
  // 로그인 후 서버→localStorage 복원(GET /diet-log/list 병합)이 비동기라, mount 시점에
  // 캐싱하면 복원 전 빈 값이 굳어 "기록은 있는데 챗봇만 못 잡는" race 가 생긴다.
  // → 메시지 전송 시점에 LS에서 최신값을 직접 읽는다(handleSend 내부, fetchChatAnswer 직전).

  const rawTopic = searchParams.get('topic') || ''
  // topic param은 단일("연어") 또는 콤마 구분("연어,당근,고구마") 모두 지원
  const initialTopics = rawTopic
    ? rawTopic.split(',').map((s) => decodeURIComponent(s.trim())).filter(Boolean)
    : []
  const initialTopic = initialTopics[0] ?? null   // 단일 호환용 (answerGuided 등에 전달)

  // phase: 'choosing' | 'guided' | 'free'
  const [topic, setTopic] = useState(initialTopic)
  const [allTopics, setAllTopics] = useState(initialTopics)
  const [phase, setPhase] = useState(initialTopic ? 'guided' : 'choosing')
  const [input, setInput] = useState('')
  const [count, setCount] = useState(0)
  const [serverLimitReached, setServerLimitReached] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [messages, setMessages] = useState(() => [
    {
      from: 'ai',
      text: buildInitialAiMessage(initialTopics, profile),
    },
    {
      from: 'system',
      text: '안정적인 상담 품질 유지를 위해 일일 사용량이 제한될 수 있어요.',
    },
  ])

  const normalizedMessages = useMemo(() => (
    messages.map((message) => {
      if (message.role && message.id) return message

      const role = message.role ?? (message.from === 'ai' ? 'assistant' : message.from)
      const text = message.text ?? ''

      return {
        ...message,
        id: message.id ?? `${role}-${text}`,
        role,
      }
    })
  ), [messages])

  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const composerRef = useRef(null)
  const [composerHeight, setComposerHeight] = useState(120)

  // 새 메시지 도착 시 스크롤 하단
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, phase])

  useEffect(() => {
    const composerEl = composerRef.current
    if (!composerEl) return undefined

    const updateComposerHeight = () => {
      const nextHeight = Math.ceil(composerEl.offsetHeight || 120)
      setComposerHeight((prev) => (prev === nextHeight ? prev : nextHeight))
    }

    updateComposerHeight()

    let frameId = window.requestAnimationFrame(updateComposerHeight)
    let resizeObserver

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        window.cancelAnimationFrame(frameId)
        frameId = window.requestAnimationFrame(updateComposerHeight)
      })
      resizeObserver.observe(composerEl)
    }

    window.addEventListener('resize', updateComposerHeight)
    window.visualViewport?.addEventListener('resize', updateComposerHeight)

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateComposerHeight)
      window.visualViewport?.removeEventListener('resize', updateComposerHeight)
    }
  }, [])

  const [apiKpi, setApiKpi] = useState(null)
  const localKpi = useMemo(() => calcKPI(profile), [profile])
  const profileAge = useMemo(() => resolveProfileAgeFields(profile), [profile])

  useEffect(() => {
    if (!API_ENABLED || !profile?.weight) return
    fetchKPI({
      weightKg: profile.weight,
      ageYears: profileAge.ageYears ?? 0,
      isNeutered: profile.isNeutered ?? true,
      activityLevel: profile.activityLevel || '보통',
    }).then((res) => {
      if (res) setApiKpi({ rer: res.rer, mer: res.mer, snackKcal: Math.round(res.snack_kcal), snackGrams: res.snack_grams })
    })
  }, [profile, profileAge.ageYears])

  const kpi = apiKpi ?? localKpi
  const limitReached = count >= DAILY_LIMIT || serverLimitReached
  const canSend = input.trim() && !limitReached && !isLoading

  // Case A → 가이드 칩 선택
  const askGuided = async (question) => {
    // 급여량 질문은 backend API 경유 — serving g 수치를 backend에서 통일 계산
    if (question === '각 재료 급여량 알려줘') {
      send(question)
      return
    }
    setMessages((prev) => [...prev, createMessage('user', question)])
    setCount((c) => c + 1)

    // 부위 안전성: Rule Engine(check_ingredient) 경유 — RELATED_INGREDIENTS.level 직접 사용 금지
    if (question === '어떤 부위가 안전한가요?' && topic && API_ENABLED) {
      const related = RELATED_INGREDIENTS[topic] ?? []
      if (related.length > 0) {
        const loadingMsg = createMessage('assistant', '...', { loading: true })
        setMessages((prev) => [...prev, loadingMsg])
        setPhase('free')
        const checkedParts = await Promise.all(
          related.map(async (r) => {
            try {
              const res = await fetchSafety(r.name, profile ?? {})
              return { name: r.name, level: res?.level ?? 'unknown' }
            } catch {
              return { name: r.name, level: 'unknown' }
            }
          })
        )
        const safe = checkedParts.filter((r) => r.level === 'safe').map((r) => r.name)
        const danger = checkedParts.filter((r) => r.level === 'danger')
        let body = `${topic}는 부위에 따라 안전도가 달라요.`
        if (safe.length) body += ` 안전한 부위: ${safe.slice(0, 3).join(', ')}.`
        if (danger.length) body += ` 피해야 할 부위: ${danger.map((d) => d.name).join(', ')}.`
        if (!related.length) body += ' 자세한 부위별 안전성은 등록된 정보가 없어요. 수의사와 상의해주세요.'
        setMessages((prev) => prev.map((m) =>
          m.id === loadingMsg.id ? { ...m, text: body, loading: false } : m
        ))
        return
      }
    }

    const ans = answerGuided(question, topic, profile, allTopics.length > 1 ? allTopics : null, kpi)
      || '재료별 안전성과 권장량을 알려드릴게요. 더 구체적인 질문을 해주시면 정확하게 답변드릴 수 있어요.'
    setTimeout(() => {
      setMessages((prev) => [...prev, createMessage('assistant', ans)])
    }, 600)
    setPhase('free')
  }

  // 자유 입력 전송
  const send = (text) => {
    const t = (text || input).trim()
    if (!t || limitReached) return
    const userMessage = createMessage('user', t)
    setInput('')
    setPhase('free')

    if (isContactIntent(t)) {
      setMessages((prev) => [
        ...prev,
        userMessage,
        createMessage('assistant', CONTACT_INTENT_MESSAGE, { action: CONTACT_ACTION }),
      ])
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }

    trackChatQuestion()
    setMessages((prev) => [...prev, userMessage])
    setCount((c) => c + 1)

    // 입력 텍스트에서 재료명 감지 → topic 전환 (현재 topic보다 우선)
    const detectedTopics = detectTopicsFromText(t)
    const effectiveTopic = detectedTopics[0] ?? topic ?? allTopics[0] ?? null

    if (effectiveTopic && effectiveTopic !== topic) {
      setTopic(effectiveTopic)
    }

    // 로딩 말풍선 추가 (id로 나중에 교체)
    const loadingMessage = createMessage('assistant', '...', { loading: true })
    setMessages((prev) => [...prev, loadingMessage])

    const resolve = (answer) => {
      setMessages((prev) =>
        prev.map((message) => (
          message.id === loadingMessage.id
            ? { ...message, text: answer, loading: false }
            : message
        ))
      )
      setIsLoading(false)
    }

    // API 우선 → 실패 시 mock 폴백
    // health_conditions: safety_checker.py 가 profile.get("health_conditions", []) 로 읽는 필드
    // profile 에서 camelCase / snake_case 혼용 대응 및 배열 정규화
    // age_years / age_months: safety_checker.py _age_years() 가 읽는 필드명으로 변환
    //   우선순위: profile.ageMonths(개월) → /12 변환 > ageYears/age_years > profile.age
    const chatProfile = profile
      ? {
          name: profile.name,
          weight: profile.weight,
          age: profile.age,
          // safety_checker.py: _age_years() reads age_years first, then age_months/12
          age_years: profileAge.ageYears,
          age_months: profileAge.ageMonths,
          neutered: profile.isNeutered ?? profile.neutered ?? true,
          activity: profile.activity,
          allergies: normProfileArr(profile.allergies),
          health_conditions: normProfileArr(
            profile.healthConditions ?? profile.health_conditions ?? profile.conditions
          ),
        }
      : null

    setIsLoading(true)
    const topicForApi = allTopics.length > 0 ? allTopics.join(',') : effectiveTopic
    // serving g 계산은 backend 전용 — frontend computeServings 는 payload에 포함하지 않음
    // haru_session_id: 비로그인 quota 추적용 (기존 앱 패턴 재사용)
    const _sid = getAnonymousSessionId()

    // 전송 시점에 최신 LS 기록을 읽어 담는다 (서버→LS 복원 타이밍과 무관하게 최신 반영)
    const dietLogs = getLogs(activePetId)
    const dietLogSummary = buildDietLogSummary(activePetId)

    fetchChatAnswer({ message: t, topic: topicForApi, profile: chatProfile, sessionId: _sid, dietLogSummary, dietLogs })
      .then((res) => {
        if (res?.__quota_exceeded) {
          setServerLimitReached(true)
          resolve('오늘 상담 횟수를 모두 사용했어요. 내일 자정에 다시 이용해 주세요.')
          return
        }

        const answer = res?.answer
        const returnedTopics = Array.isArray(res?.topics)
          ? mergeTopicLists([], res.topics)
          : []

        setAllTopics(returnedTopics)
        setTopic(returnedTopics[0] ?? null)

        if (answer) {
          resolve(sanitizeBotAnswer(answer))
        } else {
          showToast(ERROR_MSG.chatResponse)
          resolve(answerFree(t, effectiveTopic, profile))
        }
      })
      .catch(() => {
        showToast(ERROR_MSG.chatResponse)
        resolve(answerFree(t, effectiveTopic, profile))
      })

    // 전송 후 입력창 포커스 유지
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // 최근 검색어에 topic 추가
  useEffect(() => {
    initialTopics.forEach((name) => dispatch({ type: 'addSearch', value: name }))
  }, [initialTopic, dispatch])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleMessageAction = (action) => {
    if (!action?.to) return
    navigate(action.to)
  }

  const handleBack = () => {
    const historyIndex = window.history.state?.idx
    if ((typeof historyIndex === 'number' && historyIndex > 0) || window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(ROUTES.home, { replace: true })
  }

  return (
    <div className="chat-page">
      <div
        className="chat-shell"
        style={{ '--chat-composer-height': `${composerHeight}px` }}
      >
        <header className="chat-header">
          <button
            type="button"
            className="press chat-header__back"
            onClick={handleBack}
            aria-label="뒤로가기"
          >
            <IconBack size={20} color="currentColor" />
          </button>
          <h1 className="chat-header__title">AI 상담</h1>
          <div className="chat-header__spacer" aria-hidden="true" />
        </header>

      {/* 채팅 스크롤 영역 */}
      <div ref={scrollRef} className="chat-scroll app-scroll">
        <div className="chat-content">
        <FeedingGuideCard
          profile={profile}
          kpi={kpi}
          allTopics={allTopics.length > 0 ? allTopics : null}
          onProfile={() => navigate(ROUTES.profile)}
        />

        {normalizedMessages.map((message, index) => {
          // 마지막 assistant 메시지에만 레시피 칩 표시
          const isLastAssistant =
            message.role === 'assistant' &&
            !normalizedMessages.slice(index + 1).some((m) => m.role === 'assistant')
          return (
            <Bubble
              key={message.id}
              message={message}
              onAction={handleMessageAction}
              recipeTopics={isLastAssistant && allTopics.length > 0 && !limitReached ? allTopics : null}
              recipeAllergies={profile?.allergies}
              onRecipeNavigate={(id) => navigate(ROUTES.detail(id))}
            />
          )
        })}

        {/* 추천 질문 칩 (직접 진입 시) */}
        {!limitReached && phase === 'choosing' && (
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', paddingLeft: 4 }}>
            {/* AI 대화 칩 — send()로 전송 */}
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--divider)',
                  borderRadius: 20,
                  padding: '10px 16px',
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  lineHeight: 1.45,
                  textAlign: 'left',
                  cursor: 'pointer',
                  maxWidth: '92%',
                }}
              >
                {q}
              </button>
            ))}
            {/* 문의하기 칩 — AI 전송 없이 /contact 직접 이동 */}
            <button
              type="button"
              onClick={() => navigate(CONTACT_ACTION.to)}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--divider)',
                borderRadius: 20,
                padding: '10px 16px',
                fontSize: 13,
                color: 'var(--ink-2)',
                lineHeight: 1.45,
                textAlign: 'left',
                cursor: 'pointer',
                maxWidth: '92%',
              }}
            >
              {CONTACT_CHIP_TEXT}
            </button>
          </div>
        )}

        {/* Case A: 가이드 칩셋 (냉장고 파먹기 진입 시) */}
        {!limitReached && phase === 'guided' && topic && (
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 4 }}>
            {guidedChipsFor(topic, allTopics.length > 1).map((q) => (
              <button
                key={q}
                type="button"
                className="press"
                onClick={() => askGuided(q)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--primary)',
                  borderRadius: 20, padding: '8px 14px',
                  fontSize: 12, fontWeight: 500,
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* 관련 레시피: Bubble 내 assistant-actions 영역으로 이동 (마지막 AI 메시지에 통합) */}

        {/* 소프트 제한 도달 */}
        {limitReached && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 14, textAlign: 'center',
            color: 'var(--ink-2)', fontSize: 13,
          }}>
            오늘 상담이 모두 완료됐어요.<br />내일 다시 이어서 사용할 수 있어요.
          </div>
        )}
        </div>
      </div>

      {/* 입력 독 */}
      <div ref={composerRef} className="chat-composer-wrap">
        <div className="chat-composer-shell">
          <div className="chat-composer">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            disabled={limitReached || isLoading}
            placeholder={
              limitReached
                ? '내일 다시 이용해주세요'
                : isLoading
                  ? '답변을 생성하고 있어요...'
                  : '궁금한 점을 바로 입력해보세요'
            }
            aria-label="메시지 입력"
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              minWidth: 0,
              color: 'var(--ink-1)',
            }}
          />
          <button
            type="button"
            className="press"
            onClick={() => send()}
            disabled={!canSend}
            aria-label="전송"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: canSend ? 'var(--primary)' : 'var(--surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconSend size={18} color={canSend ? 'var(--surface)' : 'var(--ink-4)'} />
          </button>
        </div>

        {/* 면책 조항 — 입력창 하단 고정 */}
        <div className="chat-composer-note">
          AI 검증 결과는 참고용으로 제공되며, 반려견 상태에 따라 실제 급여 반응은 달라질 수 있어요.
        </div>
      </div>
      </div>
      </div>
    </div>
  )
}
