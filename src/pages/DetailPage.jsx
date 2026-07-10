import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { INGREDIENTS, RECIPES, RELATED_INGREDIENTS, NONGSARO_SAFE_INGREDIENTS } from '../data/index.js'
import { useApp, useBookmarks, useProfile, useToast, useActivePetId } from '../store/useApp.js'
import { ROUTES } from '../routes.js'
import SafetyBadge from '../components/SafetyBadge.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import EmptyState from '../components/EmptyState.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { IconBack, IconHeart } from '../components/icons/index.jsx'
import { fetchRecipe } from '../api/recipes.js'
import { fetchIngredients } from '../api/ingredients.js'
import { fetchSafety } from '../api/safety.js'
import { deleteReaction, recordReaction, fetchReactionStats } from '../api/profile.js'
import { API_ENABLED } from '../api/client.js'
import { getAnonymousSessionId } from '../lib/session.js'
import { ERROR_MSG } from '../utils/errorMessages.js'
import { saveLog, FEEDING_TYPE_OPTIONS } from '../utils/dietLog.js'
import DateTimePickerField, { toDateValue, dateValueToISO } from '../components/DateTimePickerField.jsx'

// ─── 재료 canonical 매칭 헬퍼 ────────────────────────────────────────────────
// 공백 제거 + 소문자 (exact match 전처리)
const _normIng = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '')

// 대표 재료(parent) 매핑 — false positive(배↔양배추) 없도록 exact key 기반
const _CANONICAL_MAP = {
  // 닭 계열
  '닭가슴살': '닭', '닭안심': '닭', '닭다리살': '닭',
  // 소 계열 (단독 부위명 '안심'/'등심' 제외 — 돼지/소 공통 부위로 false positive 위험)
  '소고기': '소', '소홍두깨살': '소', '우둔살': '소',
  // 돼지 계열
  '돼지고기': '돼지', '돼지안심': '돼지', '돼지등심': '돼지',
  // 오리 계열
  '오리고기': '오리', '오리안심': '오리',
}

/** 재료명 → canonical parent (없으면 자기 자신) */
function canonicalIngredient(normName) {
  return _CANONICAL_MAP[normName] ?? normName
}

// ─── 급여 기록 폼 상수 ────────────────────────────────────────────────────────
const FEED_REACTIONS = ['잘 먹음', '보통', '안 먹음', '민감 반응']
const FEED_STOOL_OPTIONS = ['정상', '무른 변', '설사', '변비', '기타']

const FEED_LABEL_STYLE = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: 'var(--ink-2)', marginBottom: 6,
}
const FEED_INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '11px 12px',
  fontSize: 14, color: 'var(--ink-1)', outline: 'none',
}

/** flaggedIngredients 배열 → canonical Set */
const _flaggedCanonicalSet = (arr) =>
  new Set((arr ?? []).map((f) => canonicalIngredient(_normIng(f))).filter(Boolean))

function pickKnownLevel(...levels) {
  let sawUnknown = false
  for (const level of levels) {
    if (!level) continue
    if (level === 'unknown') {
      sawUnknown = true
      continue
    }
    return level
  }
  return sawUnknown ? 'unknown' : null
}

// A1 alias: 입력 재료명(원형) → INGREDIENTS/RELATED 키 (exact, includes 금지)
const _INGREDIENT_ALIAS_MAP = {
  '달걀': '계란',
  '오트밀': '귀리',
  '올리브유': '올리브오일',
  '단호박가루': '단호박',
  '박력쌀가루': '쌀가루',
  '시금치가루': '시금치',
  '소고기 홍두깨살': '홍두깨살',  // → RELATED safe
  '오리안심': '오리고기',           // → INGREDIENTS safe
  '저염슬라이스치즈': '치즈',
}

// RELATED_INGREDIENTS 전체 항목을 flat하게 펼친 캐시 (name 정규화 → meta)
const _RELATED_FLAT = (() => {
  const map = new Map()
  Object.values(RELATED_INGREDIENTS).forEach((items) => {
    items.forEach((item) => {
      const key = _normIng(item.name)
      if (key && !map.has(key)) map.set(key, item)  // 첫 번째 match만 사용
    })
  })
  return map
})()

/** RELATED_INGREDIENTS에서 exact name match로 meta 반환, 없으면 null */
function findRelatedMeta(name) {
  return _RELATED_FLAT.get(_normIng(name)) ?? null
}

// legacy "재료명 숫자[단위]" 분리 — 저장값 변경 없음, 표시·배지 계산 전용
const _AMOUNT_SUFFIX_RE = /^(.+?)\s+(\d+(?:\.\d+)?\s*(?:g|kg|ml|L|개|장|작은술|큰술)?)$/i

/**
 * 표시·배지 계산용 { name, amount } 반환.
 * - amount가 이미 있으면 원본 그대로.
 * - name 끝에 숫자/단위가 붙어 있으면 분리 (legacy 데이터 대응).
 */
function parseIngredientDisplay(ing) {
  const rawName = typeof ing === 'string' ? ing : (ing?.name ?? '')
  const rawAmount = typeof ing === 'string' ? '' : (ing?.amount ?? '')

  // amount가 이미 있으면 파싱 불필요
  if (rawAmount.trim()) return { name: rawName, amount: rawAmount }

  const m = rawName.match(_AMOUNT_SUFFIX_RE)
  if (m) return { name: m[1].trim(), amount: m[2].trim() }

  return { name: rawName, amount: rawAmount }
}

// 배지 래퍼 공통 스타일 — unknown 버튼과 동일한 크기·정렬
const _BADGE_WRAP = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minHeight: 36, minWidth: 44, padding: '6px 8px', flexShrink: 0,
}

// ─── DB 허용값(백엔드) ↔ 표시 레이블 ──────────────────────────────────────
const REACTIONS = [
  { key: '잘 먹었어요',              label: '잘 먹음' },
  { key: '보통이에요',                label: '보통' },
  { key: '잘 안 먹어요',              label: '안 먹음' },
  { key: '급여 후 불편 반응이 있었어요', label: '민감 반응' },
]

const REACTION_TO_DIET_LOG_LABEL = Object.fromEntries(
  REACTIONS.map(({ key, label }) => [key, label]),
)

function getSessionId() {
  return getAnonymousSessionId()
}

function buildRecipeTopicParam(recipe) {
  const names = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients
      .map((ing) => (typeof ing === 'string' ? ing : ing?.name))
      .map((name) => String(name || '').trim())
      .filter(Boolean)
    : []
  const uniqueNames = [...new Set(names)]
  if (uniqueNames.length === 0) return null
  return uniqueNames.map((name) => encodeURIComponent(name)).join(',')
}

function buildIngredientLookup(items = []) {
  const byRaw = new Map()
  const byCanonical = new Map()

  items.forEach((item) => {
    const rawName = String(item?.name || '').trim()
    const canonicalName = String(item?.canonical_name || item?.display_name || '').trim()

    if (rawName && !byRaw.has(_normIng(rawName))) {
      byRaw.set(_normIng(rawName), item)
    }
    if (canonicalName && !byCanonical.has(_normIng(canonicalName))) {
      byCanonical.set(_normIng(canonicalName), item)
    }
  })

  return { byRaw, byCanonical }
}

function getIngredientLookupMeta(name, aliasName, ingredientLookup) {
  if (!ingredientLookup) return { exactMeta: null, canonicalMeta: null }

  const exactMeta =
    ingredientLookup.byRaw.get(_normIng(name)) ??
    ingredientLookup.byRaw.get(_normIng(aliasName)) ??
    null

  if (exactMeta) {
    return { exactMeta, canonicalMeta: null }
  }

  const canonicalMeta =
    ingredientLookup.byCanonical.get(_normIng(name)) ??
    ingredientLookup.byCanonical.get(_normIng(aliasName)) ??
    null

  return { exactMeta: null, canonicalMeta }
}

function DetailHeroImage({ recipe }) {
  const [imgError, setImgError] = useState(!recipe.imageUrl)

  useEffect(() => {
    setImgError(!recipe.imageUrl)
  }, [recipe.id, recipe.imageUrl])

  const showImg = recipe.imageUrl && !imgError

  if (showImg) {
    return (
      <img
        src={recipe.imageUrl}
        alt={recipe.name}
        onError={() => setImgError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block',
        }}
      />
    )
  }

  // 이미지 없음: 웜 아이보리 배경 + 강아지 요리사 아이콘
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#F7F3EC',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <img
        src="/icons/하루한끼_문구없.png"
        alt=""
        style={{ width: '55%', height: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}

// ─── 급여 반응 섹션 ────────────────────────────────────────────
function reactionStorageKey(recipeId, petId) {
  // 강아지별 분리: 같은 레시피라도 activePet 별로 '내 반응'을 다른 키에 캐시한다.
  return `reaction_${recipeId}_${petId || 'none'}`
}

function ReactionSection({ recipeId, prefillIngredients = [] }) {
  const navigate = useNavigate()
  const activePetId = useActivePetId()
  const { show: showToast } = useToast()
  const [selected, setSelected] = useState(
    () => localStorage.getItem(reactionStorageKey(recipeId, activePetId)) || null,
  )
  const [stats, setStats] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [ctaReaction, setCtaReaction] = useState(null)
  const statsRequestIdRef = useRef(0)
  const statsAbortRef = useRef(null)

  const persistSelection = (value) => {
    const key = reactionStorageKey(recipeId, activePetId)
    if (value) {
      localStorage.setItem(key, value)
      return
    }
    localStorage.removeItem(key)
  }

  const applyReactionPayload = (payload, fallbackReaction = null) => {
    const nextReaction = payload?.userReaction ?? fallbackReaction ?? null
    setSelected(nextReaction)
    persistSelection(nextReaction)
    if (payload?.stats) {
      setStats(payload.stats)
    }
  }

  // stats(레시피 전체 집계) + 해당 강아지의 '내 반응'을 함께 받아온다.
  // session_id + dog_id 를 동봉하면 백엔드가 userReaction 도 반환 → 프로필 전환 시 복원.
  const refreshStats = useCallback(async () => {
    if (!API_ENABLED || !recipeId) return null
    statsRequestIdRef.current += 1
    const requestId = statsRequestIdRef.current

    statsAbortRef.current?.abort?.()
    const controller = new AbortController()
    statsAbortRef.current = controller

    const response = await fetchReactionStats(recipeId, {
      sessionId: getSessionId(),
      dogId: activePetId || null,
      signal: controller.signal,
    })
    if (controller.signal.aborted) return null
    if (requestId !== statsRequestIdRef.current) return null
    if (response) {
      setStats(response)
      // 서버가 이 강아지 기준 내 반응을 알려주면 화면·캐시를 그것으로 정합화한다.
      // activePet 이 있을 때만(=dog_id 로 조회했을 때만) 덮어쓴다. 프로필 없는 경우는
      // 서버가 항상 null 을 주므로 로컬 선택을 지우지 않도록 보존한다(legacy 동작).
      if (activePetId && Object.prototype.hasOwnProperty.call(response, 'userReaction')) {
        const serverReaction = response.userReaction ?? null
        setSelected(serverReaction)
        persistSelection(serverReaction)
      }
    }
    return response
  }, [recipeId, activePetId])

  // recipe 또는 activePet(강아지) 변경 시: 먼저 dog별 로컬 캐시로 즉시 반영 후 서버 정합화.
  useEffect(() => {
    setSelected(localStorage.getItem(reactionStorageKey(recipeId, activePetId)) || null)
    setCtaReaction(null)
  }, [recipeId, activePetId])

  useEffect(() => {
    if (!API_ENABLED || !recipeId) return undefined
    void refreshStats()
    return () => {
      statsAbortRef.current?.abort?.()
    }
  }, [recipeId, refreshStats])

  const handleSelect = async (key) => {
    if (!API_ENABLED || !recipeId || submitting) return

    const prevSelected = selected
    const next = selected === key ? null : key
    setSelected(next)
    persistSelection(next)
    setSubmitting(true)

    try {
      const response = next == null
        ? await deleteReaction({
          recipeId,
          sessionId: getSessionId(),
          dogId: activePetId || null,
        }).catch(() => null)
        : await recordReaction({
          recipeId,
          reaction: next,
          sessionId: getSessionId(),
          dogId: activePetId || null,
        }).catch(() => null)

      if (!response?.ok) {
        setSelected(prevSelected)
        persistSelection(prevSelected)
        return
      }

      // Policy A: same reaction click clears the server-side reaction too.
      applyReactionPayload(response, next)
      setCtaReaction(response?.userReaction ?? next ?? null)
      void refreshStats()
    } finally {
      setSubmitting(false)
    }
  }

  const total = stats?.count ?? 0
  const showStats = stats?.show && stats?.stats
  const mappedReaction = ctaReaction ? REACTION_TO_DIET_LOG_LABEL[ctaReaction] ?? null : null

  return (
    <section style={{ padding: '24px 20px 8px' }}>
      <div className="t-subtitle-s" style={{ color: 'var(--ink-2)', marginBottom: 12 }}>
        급여 반응 남기기
      </div>

      {/* 반응 버튼 4개 가로 — PC: 강제 4열, 모바일: auto-fit */}
      <div className="reaction-btn-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
        {REACTIONS.map((r) => {
          const active = selected === r.key
          return (
            <button
              key={r.key}
              type="button"
              className="press"
              disabled={submitting}
              onClick={() => handleSelect(r.key)}
              style={{
                background: active ? 'var(--primary-soft)' : 'var(--surface-2)',
                border: `1px solid ${active ? 'var(--primary)' : 'transparent'}`,
                color: active ? 'var(--primary)' : 'var(--ink-2)',
                borderRadius: 8,
                padding: '10px 4px',
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                lineHeight: 1.35,
                minHeight: 44,
                whiteSpace: 'normal',
                textAlign: 'center',
              }}
            >
              {r.label}
            </button>
          )
        })}
      </div>

      {mappedReaction && (
        <div
          style={{
            marginTop: 12,
            padding: '12px 14px',
            borderRadius: 14,
            border: '1px solid color-mix(in srgb, var(--primary) 18%, white)',
            background: 'color-mix(in srgb, var(--primary) 7%, white)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>
              {mappedReaction}으로 저장됐어요.
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.45 }}>
              이 반응을 식생활 기록에도 남길까요?
            </div>
          </div>
          <button
            type="button"
            className="press"
            onClick={() => {
              if (!activePetId) {
                showToast('프로필을 먼저 등록해 주세요.')
                return
              }
              navigate(ROUTES.dietLog, {
                state: {
                  prefill: {
                    ingredients: prefillIngredients,
                    reaction: mappedReaction,
                  },
                },
              })
            }}
            style={{
              flexShrink: 0,
              border: 'none',
              borderRadius: 999,
              background: 'var(--primary)',
              color: '#FFFFFF',
              padding: '9px 14px',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            기록하기
          </button>
        </div>
      )}

      {/* 통계: 5개 이상일 때만 표시 */}
      {total >= 5 && showStats && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12, color: 'var(--ink-2)' }}>
            {REACTIONS.map((r) => {
              const cnt = stats.stats[r.key] ?? 0
              const pct = total > 0 ? Math.round((cnt / total) * 100) : 0
              return (
                <span key={r.key}>
                  <span style={{ fontWeight: 500 }}>{r.label}</span>
                  {' '}
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{pct}%</span>
                </span>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
            총 {total}명 응답
          </div>
        </div>
      )}
    </section>
  )
}

export default function DetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { dispatch } = useApp()
  const { isBookmarked, toggle: toggleBookmark } = useBookmarks()
  const profile = useProfile()
  const { show: showToast } = useToast()
  const activePetId = useActivePetId()

  const [loading, setLoading] = useState(API_ENABLED)
  const [recipe, setRecipe] = useState(null)
  const [unknownIngredient, setUnknownIngredient] = useState(null)
  const [ingredientLookup, setIngredientLookup] = useState(null)
  const [backendSafetyMap, setBackendSafetyMap] = useState({})

  // 급여 기록 바텀시트
  const [feedSheetOpen, setFeedSheetOpen] = useState(false)
  const [feedIngredientsText, setFeedIngredientsText] = useState('')
  const [feedReaction, setFeedReaction] = useState('')
  const [feedFedAt, setFeedFedAt] = useState(() => toDateValue(new Date()))
  const [feedFeedingType, setFeedFeedingType] = useState('meal')
  const [feedWeightKg, setFeedWeightKg] = useState('')
  const [feedStoolStatus, setFeedStoolStatus] = useState('')
  const [feedStoolNote, setFeedStoolNote] = useState('')
  const [feedMemo, setFeedMemo] = useState('')

  // API에서 레시피 로드, 실패 시 mock 폴백
  useEffect(() => {
    if (!API_ENABLED) {
      const mock = RECIPES.find((r) => r.id === id) ?? null
      setRecipe(mock)
      return
    }
    setLoading(true)
    fetchRecipe(id)
      .then((res) => {
        if (res) {
          // API 응답을 DetailPage 필드 형태로 정규화
          setRecipe({
            id: res.id,
            name: res.name,
            type: res.type,
            safety: res.safety,
            flaggedIngredients: res.flaggedIngredients ?? [],
            reasons: res.reasons ?? [],
            ingredients: (res.ingredients ?? []).map((ing) =>
              typeof ing === 'string' ? { name: ing, amount: '' } : { name: ing.name ?? ing, amount: ing.amount ?? '' }
            ),
            steps: Array.isArray(res.steps) ? res.steps : (res.steps ?? '').split('\n').filter(Boolean),
            tags: res.tags ?? [],
            imageUrl: res.imageUrl ?? '',
            color: res.color ?? 'var(--primary)',
            createdAt: res.createdAt ?? '',
          })
        } else {
          showToast(ERROR_MSG.recipeLoad)
          // API 실패 → mock 폴백
          const mock = RECIPES.find((r) => r.id === id) ?? null
          setRecipe(mock)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!API_ENABLED) return undefined

    let cancelled = false

    fetchIngredients({ lite: true })
      .then((res) => {
        if (cancelled || !res?.items?.length) return
        setIngredientLookup(buildIngredientLookup(res.items))
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [])

  const bookmarked = recipe ? isBookmarked(recipe.id) : false

  // 최근 본 레시피 기록
  useEffect(() => {
    if (recipe?.id) dispatch({ type: 'viewRecipe', id: recipe.id })
  }, [recipe?.id, dispatch])


  // ── Safety Summary: recipe 저장값(flaggedIngredients, reasons) 기준 ──
  const recipeIngredientNames = useMemo(() => {
    if (!recipe?.ingredients?.length) return []
    return [...new Set(
      recipe.ingredients
        .map((ing) => parseIngredientDisplay(ing).name)
        .map((name) => String(name || '').trim())
        .filter(Boolean),
    )]
  }, [recipe])

  const dietLogPrefillIngredients = useMemo(
    () => recipeIngredientNames,
    [recipeIngredientNames],
  )

  function openFeedSheet() {
    if (!activePetId) {
      showToast('프로필을 먼저 등록해 주세요.')
      return
    }
    setFeedIngredientsText(dietLogPrefillIngredients.join(', '))
    setFeedReaction('')
    setFeedFedAt(toDateValue(new Date()))
    setFeedFeedingType('meal')
    setFeedWeightKg('')
    setFeedStoolStatus('')
    setFeedStoolNote('')
    setFeedMemo('')
    setFeedSheetOpen(true)
  }

  function handleFeedSave() {
    if (!activePetId) {
      showToast('프로필을 먼저 등록해 주세요.')
      return
    }
    const parsed = feedIngredientsText.split(',').map((s) => s.trim()).filter(Boolean)
    if (parsed.length === 0) {
      showToast('재료를 1개 이상 입력해 주세요.')
      return
    }
    if (!feedReaction) {
      showToast('반응을 선택해 주세요.')
      return
    }
    const parsedWeight = feedWeightKg.trim() !== '' ? parseFloat(feedWeightKg) : null
    if (parsedWeight !== null && Number.isNaN(parsedWeight)) {
      showToast('체중은 숫자로 입력해 주세요.')
      return
    }
    const normalizedStoolNote = feedStoolStatus === '기타' ? feedStoolNote.trim() : ''
    const now = new Date().toISOString()
    const saved = saveLog({
      id: crypto.randomUUID(),
      dogId: activePetId,
      ingredients: parsed,
      reaction: feedReaction,
      amountG: null,
      weightKg: parsedWeight,
      stoolStatus: feedStoolStatus || null,
      stoolNote: normalizedStoolNote,
      photoUrl: null,
      memo: feedMemo.trim(),
      fedAt: dateValueToISO(feedFedAt),
      feedingType: feedFeedingType,
      createdAt: now,
    })
    if (!saved) {
      showToast('저장에 실패했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    setFeedSheetOpen(false)
    navigate(ROUTES.dietLog)
  }

  const safetyProfile = useMemo(() => ({
    allergies: profile?.allergies ?? [],
    healthConditions: profile?.healthConditions ?? profile?.health_conditions ?? [],
    weight: profile?.weight ?? profile?.weight_kg ?? 0,
    age: profile?.age ?? profile?.age_years ?? 0,
    isNeutered: profile?.isNeutered ?? profile?.is_neutered ?? true,
  }), [
    profile?.age,
    profile?.age_years,
    profile?.allergies,
    profile?.healthConditions,
    profile?.health_conditions,
    profile?.isNeutered,
    profile?.is_neutered,
    profile?.weight,
    profile?.weight_kg,
  ])

  useEffect(() => {
    if (!API_ENABLED || recipeIngredientNames.length === 0) {
      setBackendSafetyMap({})
      return undefined
    }

    let cancelled = false

    const run = async () => {
      const results = await Promise.allSettled(
        recipeIngredientNames.map((name) => fetchSafety(name, safetyProfile)),
      )
      if (cancelled) return

      const nextMap = {}
      results.forEach((result, index) => {
        const name = recipeIngredientNames[index]
        if (result.status === 'fulfilled' && result.value?.level) {
          nextMap[name] = result.value
        }
      })
      setBackendSafetyMap(nextMap)
    }

    void run()
    return () => { cancelled = true }
  }, [recipeIngredientNames, safetyProfile])

  const viewerSafetySummary = useMemo(() => {
    if (!recipe) return null
    const flagged = recipe.flaggedIngredients ?? []
    const reasons = recipe.reasons ?? []
    if (recipe.safety === 'safe' && flagged.length === 0 && reasons.length === 0) return null
    return { flaggedIngredients: flagged, reasons }
  }, [recipe])

  // ─ 로딩 중
  const preparedIngredients = useMemo(() => {
    if (!recipe) return []

    const flaggedCanon = _flaggedCanonicalSet(recipe.flaggedIngredients)
    const sortPriority = { danger: 0, caution: 1, unknown: 2, safe: 3 }

    return recipe.ingredients
      .map((ing) => {
        const { name, amount } = parseIngredientDisplay(ing)
        const resolvedName = _INGREDIENT_ALIAS_MAP[name] ?? name
        const isFlagged = flaggedCanon.has(canonicalIngredient(_normIng(name)))
        const backendMeta = backendSafetyMap[name] ?? backendSafetyMap[resolvedName] ?? null
        const { exactMeta, canonicalMeta } = getIngredientLookupMeta(name, resolvedName, ingredientLookup)
        const mockMeta = INGREDIENTS[resolvedName]
        const relatedMeta = mockMeta ? null : findRelatedMeta(resolvedName)
        const nongsaroMeta = (mockMeta || relatedMeta) ? null : NONGSARO_SAFE_INGREDIENTS[name]
        const badgeLevel = isFlagged
          ? (recipe.safety === 'danger' ? 'danger' : 'caution')
          : (
            pickKnownLevel(
              backendMeta?.level,
              exactMeta?.level,
              canonicalMeta?.level,
              mockMeta?.level,
              relatedMeta?.level,
              nongsaroMeta?.level,
            ) ?? 'unknown'
          )

        return { name, amount, badgeLevel }
      })
      .sort((a, b) => (sortPriority[a.badgeLevel] ?? 3) - (sortPriority[b.badgeLevel] ?? 3))
  }, [backendSafetyMap, ingredientLookup, recipe])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <LoadingSpinner />
      </div>
    )
  }

  // ─ 레시피 없음
  if (!recipe) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
        <button
          type="button"
          className="press"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          style={{ alignSelf: 'flex-start', margin: 12, padding: 8 }}
        >
          <IconBack size={20} color="var(--ink-1)" />
        </button>
        <EmptyState
          title="레시피를 찾을 수 없어요"
          description="삭제됐거나 잘못된 주소일 수 있어요."
          action={{ label: '피드로 돌아가기', onClick: () => navigate(ROUTES.feed) }}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>

        {/*
          DOM 순서 = 모바일 기준: img → meta → ingr → steps
          CSS Grid 가 PC에서만 ingr 를 우측 컬럼으로 배치
        */}
        <div className="detail-grid-wrapper">

          {/* ── [img] 히어로 이미지 ── */}
          <div className="detail-area-img">
            <div className="detail-hero-img" style={{ position: 'relative', background: 'var(--surface-2)', flexShrink: 0 }}>
              <DetailHeroImage recipe={recipe} />
              {/* 뒤로가기 — 모바일 전용 */}
              <button
                type="button"
                className="press detail-hero-btn detail-hero-btn--back"
                onClick={() => navigate(-1)}
                aria-label="뒤로가기"
                style={{
                  position: 'absolute', top: 12, left: 12,
                  width: 40, height: 40, borderRadius: 999,
                  background: 'rgba(255,255,255,0.92)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconBack size={20} color="var(--ink-1)" />
              </button>
              {/* 북마크 — 모바일+PC */}
              <button
                type="button"
                className="press detail-hero-btn detail-hero-btn--bookmark"
                onClick={() => toggleBookmark(recipe.id)}
                aria-label={bookmarked ? '북마크 해제' : '북마크 추가'}
                style={{
                  position: 'absolute', top: 12, right: 12,
                  width: 40, height: 40, borderRadius: 999,
                  background: 'rgba(255,255,255,0.92)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconHeart size={20} filled={bookmarked} color={bookmarked ? 'var(--primary)' : 'var(--ink-4)'} />
              </button>
            </div>
          </div>

          {/* ── [meta] 레시피 제목 + 태그 ── */}
          <div className="detail-area-meta">
            <section style={{ padding: '20px 20px 8px' }}>
              <div className="t-headline-s" style={{ marginBottom: 6 }}>{recipe.name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <SafetyBadge level={recipe.safety} size="s" />
                <span style={{
                  fontSize: 11, color: 'var(--ink-3)',
                  background: 'var(--surface-2)', padding: '3px 10px', borderRadius: 12,
                }}>
                  {recipe.type}
                </span>
                {recipe.tags?.map((t) => (
                  <span key={t} style={{
                    fontSize: 11, color: 'var(--primary)',
                    background: 'var(--primary-soft)',
                    padding: '3px 10px', borderRadius: 12, fontWeight: 500,
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* ── [ingr] 준비 재료 + 안전성 (PC: 우측 스티키 사이드바) ── */}
          <div className="detail-area-ingr">

            {/* PC: ← 뒤로가기 + 준비 재료 헤더 */}
            <div className="detail-ingr-pc-header">
              <button
                type="button"
                className="press"
                onClick={() => navigate(-1)}
                aria-label="뒤로가기"
                style={{ background: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
              >
                <IconBack size={16} color="var(--ink-2)" />
              </button>
              <span className="t-section-title" style={{ margin: 0 }}>준비 재료</span>
            </div>

            {/* 안전성 Summary */}
            {(() => {
              const flagged = recipe.flaggedIngredients ?? []
              const reasons = recipe.reasons ?? []
              if (recipe.safety === 'safe' && flagged.length === 0 && reasons.length === 0) return null
              return (
                <section style={{ padding: '0 20px 12px' }}>
                  <div style={{
                    background: 'var(--caution-bg)',
                    border: '1px solid var(--caution-fg)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--caution-fg)' }}>
                      이 레시피는 주의가 필요해요
                    </div>
                    {flagged.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>주의가 필요한 재료</div>
                        <ul style={{ margin: 0, paddingLeft: 14, listStyle: 'disc' }}>
                          {flagged.map((name) => (
                            <li key={name} style={{ fontSize: 12, color: 'var(--ink-1)', lineHeight: 1.7 }}>{name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {reasons.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>주의 사유</div>
                        <ul style={{ margin: 0, paddingLeft: 14, listStyle: 'disc' }}>
                          {reasons.map((r, i) => (
                            <li key={i} style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7 }}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              )
            })()}

            {/* 준비 재료 리스트 */}
            <section style={{ padding: '20px 20px 8px' }}>
              <div className="detail-ingr-mobile-title t-section-title" style={{ marginBottom: 10 }}>준비 재료</div>
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '4px 14px',
              }}>
                {preparedIngredients.map(({ name, amount, badgeLevel }, i) => {
                    const isUnknown = badgeLevel === 'unknown'
                    return (
                      <div
                        key={name}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 0',
                          borderBottom: i < preparedIngredients.length - 1 ? '1px solid var(--divider)' : 'none',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-1)' }}>{name}</span>
                          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{amount}</span>
                        </div>
                        {isUnknown ? (
                          <button
                            type="button"
                            className="press"
                            onClick={() => setUnknownIngredient(name)}
                            style={{ ..._BADGE_WRAP, background: 'transparent', borderRadius: 999 }}
                            aria-label={`${name} 안전성 정보 요청`}
                          >
                            <SafetyBadge level="unknown" size="s" />
                          </button>
                        ) : (
                          <div style={_BADGE_WRAP}>
                            <SafetyBadge level={badgeLevel} size="s" />
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </section>
          </div>

          {/* ── [steps] 만드는 방법 + 반응 + CTA ── */}
          <div className="detail-area-steps">
            <section style={{ padding: '20px 20px 8px' }}>
              <div className="t-section-title" style={{ marginBottom: 10 }}>만드는 방법</div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recipe.steps.map((step, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 999,
                      background: 'var(--primary-soft)', color: 'var(--primary)',
                      fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--ink-1)', lineHeight: 1.55, paddingTop: 2 }}>
                      {step}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <ReactionSection recipeId={recipe.id} prefillIngredients={dietLogPrefillIngredients} />

            <section style={{ padding: '8px 20px 16px' }}>
              <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="press"
                  onClick={openFeedSheet}
                  style={{
                    width: '100%',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10, padding: 14,
                    fontSize: 14, fontWeight: 700,
                  }}
                >
                  급여 기록하기
                </button>
                <button
                  type="button"
                  className="press"
                  onClick={() => {
                    const topicParam = buildRecipeTopicParam(recipe)
                    navigate(topicParam ? `${ROUTES.chat}?topic=${topicParam}` : ROUTES.chat)
                  }}
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    color: 'var(--ink-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10, padding: 14,
                    fontSize: 14, fontWeight: 600,
                  }}
                >
                  AI 상담하기
                </button>
              </div>
            </section>

            <Disclaimer />
          </div>

        </div>
      </div>

      {/* unknown 배지 클릭 시 재료 정보 요청 시트 */}
      <BottomSheet
        open={!!unknownIngredient}
        onClose={() => setUnknownIngredient(null)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>
            안전성 정보를 확인 중이에요
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>
            이 재료는 아직 충분한 안전성 정보를 확인하지 못했어요.
            처음 급여 전 추가 확인을 권장해요.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="press"
              onClick={() => setUnknownIngredient(null)}
              style={{
                flex: 1,
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                borderRadius: 8, padding: 14,
                fontSize: 14, fontWeight: 600,
              }}
            >
              닫기
            </button>
            <button
              type="button"
              className="press"
              onClick={() => {
                const name = unknownIngredient
                setUnknownIngredient(null)
                navigate(
                  `${ROUTES.contact}?type=ingredient_request&ingredient=${encodeURIComponent(name)}`,
                )
              }}
              style={{
                flex: 1,
                background: 'var(--primary)',
                color: '#fff',
                borderRadius: 8, padding: 14,
                fontSize: 14, fontWeight: 600,
              }}
            >
              재료 정보 요청하기
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* 급여 기록 작성 시트 */}
      <BottomSheet open={feedSheetOpen} onClose={() => setFeedSheetOpen(false)} panelClassName="diet-log-sheet">
        <div className="diet-log-form-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-1)', margin: 0 }}>
            급여 기록
          </p>
          <button
            type="button"
            className="press"
            aria-label="닫기"
            onClick={() => setFeedSheetOpen(false)}
            style={{
              width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 20,
              cursor: 'pointer', marginRight: -8,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={FEED_LABEL_STYLE}>재료 <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(쉼표로 구분)</span></label>
          <input
            type="text"
            style={FEED_INPUT_STYLE}
            placeholder="예: 오리안심, 단호박, 브로콜리"
            value={feedIngredientsText}
            onChange={(e) => setFeedIngredientsText(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={FEED_LABEL_STYLE}>반응</label>
          <div className="diet-log-reaction-grid">
            {FEED_REACTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className="press"
                onClick={() => setFeedReaction(item)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  border: feedReaction === item ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: feedReaction === item ? 'color-mix(in srgb, var(--primary) 10%, white)' : 'var(--surface)',
                  fontSize: 13,
                  fontWeight: feedReaction === item ? 700 : 500,
                  color: feedReaction === item ? 'var(--primary)' : 'var(--ink-2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  minHeight: 44,
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={FEED_LABEL_STYLE}>날짜</label>
          <DateTimePickerField value={feedFedAt} onChange={setFeedFedAt} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={FEED_LABEL_STYLE}>급여 유형</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {FEEDING_TYPE_OPTIONS.map(({ value: v, label }) => (
              <button
                key={v}
                type="button"
                className="press"
                onClick={() => setFeedFeedingType(v)}
                style={{
                  padding: '10px 4px',
                  borderRadius: 10,
                  border: feedFeedingType === v ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: feedFeedingType === v ? 'color-mix(in srgb, var(--primary) 10%, white)' : 'var(--surface)',
                  fontSize: 13,
                  fontWeight: feedFeedingType === v ? 700 : 500,
                  color: feedFeedingType === v ? 'var(--primary)' : 'var(--ink-2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  minHeight: 44,
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={FEED_LABEL_STYLE}>체중 <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(선택, kg)</span></label>
          <input
            type="number"
            inputMode="decimal"
            style={FEED_INPUT_STYLE}
            placeholder="예: 5.2"
            value={feedWeightKg}
            onChange={(e) => setFeedWeightKg(e.target.value)}
            min="0"
            step="0.1"
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={FEED_LABEL_STYLE}>변 상태 <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(선택)</span></label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FEED_STOOL_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className="press"
                onClick={() => {
                  setFeedStoolStatus((current) => {
                    const next = current === item ? '' : item
                    if (next !== '기타') setFeedStoolNote('')
                    return next
                  })
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: feedStoolStatus === item ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: feedStoolStatus === item ? 'color-mix(in srgb, var(--primary) 12%, white)' : 'var(--surface)',
                  fontSize: 13,
                  fontWeight: feedStoolStatus === item ? 700 : 400,
                  color: feedStoolStatus === item ? 'var(--primary)' : 'var(--ink-2)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {feedStoolStatus === '기타' && (
          <div style={{ marginBottom: 14 }}>
            <label style={FEED_LABEL_STYLE}>변 상태 세부 내용 <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(선택)</span></label>
            <input
              type="text"
              style={FEED_INPUT_STYLE}
              placeholder="점액변, 혈변 등 자세한 내용을 입력해 주세요."
              value={feedStoolNote}
              onChange={(e) => setFeedStoolNote(e.target.value)}
            />
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={FEED_LABEL_STYLE}>메모 <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(선택)</span></label>
          <textarea
            style={{ ...FEED_INPUT_STYLE, minHeight: 60, resize: 'vertical' }}
            placeholder="급여 후 특이사항을 적어보세요."
            value={feedMemo}
            onChange={(e) => setFeedMemo(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="press"
          onClick={handleFeedSave}
          style={{
            width: '100%',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '13px 0',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          저장하기
        </button>
        </div>
      </BottomSheet>
    </div>
  )
}
