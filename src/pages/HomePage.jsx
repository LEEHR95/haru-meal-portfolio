import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INGREDIENTS, RECIPES, RELATED_INGREDIENTS } from '../data/index.js'
import { useBookmarks, useProfile, useRecentSearches, useToast } from '../store/useApp.js'
import { isIngredientAllergic } from '../utils/allergyMatch.js'
import { calcKPI } from '../utils/kpi.js'
import { fetchRecipes } from '../api/recipes.js'
import { fetchIngredients } from '../api/ingredients.js'
import { trackIngredientSearch } from '../lib/analytics.js'
import { API_ENABLED } from '../api/client.js'
import { fetchSafety } from '../api/safety.js'
import { ROUTES } from '../routes.js'
import { IngredientSafetyBadges } from '../components/IngredientSafetyBadges.jsx'
import SafetyBadge from '../components/SafetyBadge.jsx'
import EmptyState from '../components/EmptyState.jsx'
import RecipeCardSkeleton from '../components/RecipeCardSkeleton.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import IngredientCard from '../components/IngredientCard.jsx'
import {
  IconChevron,
  IconClose,
  IconSearch,
} from '../components/icons/index.jsx'

const RECIPE_PAGE_SIZE = 5
const EXAMPLE_INGREDIENTS = ['당근', '고구마', '연어', '양파']
const RELATED_SHEET_CLOSE_MS = 180
const KNOWN_LEVELS = new Set(['safe', 'caution', 'danger'])

/** 배열이 아닌 값을 빈 배열로 정규화 */
const toArray = (value) => Array.isArray(value) ? value : []
const tokenizeIngredientName = (value) =>
  String(value || '')
    .split(/[\s,()\/]+/)
    .map((part) => part.trim())
    .filter(Boolean)

const isKnownLevel = (level) => KNOWN_LEVELS.has(level)

const buildRelatedMetaMap = (relatedIngredients) => {
  const metaMap = {}
  Object.values(relatedIngredients).flat().forEach((item) => {
    if (!item?.name) return
    const current = metaMap[item.name] ?? {}
    metaMap[item.name] = {
      ...current,
      note: current.note ?? item.reason,
      level: current.level ?? item.level,
    }
  })
  return metaMap
}

const RELATED_META_MAP = buildRelatedMetaMap(RELATED_INGREDIENTS)
const RELATED_NAME_SET = new Set(Object.keys(RELATED_META_MAP))
const GENERIC_PART_QUERY_SET = new Set(['안심', '등심', '간', '목', '발', '근위', '갈비'])

const buildGenericPartPrompt = (term) =>
  `어떤 고기의 ${term}인지 선택해주세요. 소${term}, 닭${term}처럼 구체적으로 입력해주세요.`

const buildGenericPartSheetTitle = (term) =>
  `어떤 고기의 ${term}인지 선택해주세요.`

const normalizeIngredientKey = (value) =>
  String(value ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,/g, ' ')
    .replace(/(?:생것|삶은것|익힌것|국산|수입산)/g, ' ')
    .replace(/(?:1\+\+|1\+|[123])등급/g, ' ')
    .replace(/\s+/g, '')
    .trim()

const startsWithAny = (text, prefixes) => prefixes.some((prefix) => text.startsWith(prefix))

const isGenericPartQuery = (name) => GENERIC_PART_QUERY_SET.has(normalizeIngredientKey(name))

const getFallbackCanonicalRule = (name) => {
  const key = normalizeIngredientKey(name)
  if (!key) return null

  if (key.includes('안심')) {
    if (startsWithAny(key, ['소안심', '소고기안심', '쇠고기안심', '한우안심', '소고기한우안심', '쇠고기한우안심', '송아지안심', '송아지고기안심'])) {
      return { key: '소안심', representative: '소안심' }
    }
    if (startsWithAny(key, ['돼지안심', '돼지고기안심'])) {
      return { key: '돼지안심', representative: '돼지안심' }
    }
    if (startsWithAny(key, ['닭안심', '닭고기안심'])) {
      return { key: '닭안심', representative: '닭안심' }
    }
    if (startsWithAny(key, ['오리안심', '오리고기안심'])) {
      return { key: '오리안심', representative: '오리안심' }
    }
    if (startsWithAny(key, ['칠면조안심', '칠면조고기안심'])) {
      return { key: '칠면조안심', representative: '칠면조안심' }
    }
  }

  if (key.includes('갈비')) {
    if (startsWithAny(key, ['소갈비', '소고기갈비', '쇠고기갈비', '한우갈비', '소고기한우갈비', '쇠고기한우갈비'])) {
      return { key: '소갈비', representative: '소갈비' }
    }
    if (startsWithAny(key, ['돼지갈비', '돼지고기갈비'])) {
      return { key: '돼지갈비', representative: '돼지갈비' }
    }
    if (startsWithAny(key, ['양갈비', '어린양고기갈비', '양고기갈비'])) {
      return { key: '양갈비', representative: '양갈비' }
    }
  }

  if (key.includes('등심')) {
    if (startsWithAny(key, ['소등심', '소고기등심', '쇠고기등심', '한우등심', '소고기한우등심', '쇠고기한우등심', '송아지등심', '송아지고기등심'])) {
      return { key: '소등심', representative: '소등심' }
    }
    if (startsWithAny(key, ['돼지등심', '돼지고기등심'])) {
      return { key: '돼지등심', representative: '돼지등심' }
    }
  }

  return null
}

const getCandidateCanonicalKey = (name, canonicalName) => {
  const canonical = String(canonicalName ?? '').trim()
  if (canonical) {
    // API canonical_name도 getFallbackCanonicalRule로 추가 dedupe
    // 예: "소고기 한우 등심" → "소등심" (소등심 그룹에 합류)
    const normalizedCanonical = normalizeIngredientKey(canonical)
    const fallbackRule = getFallbackCanonicalRule(normalizedCanonical)
    if (fallbackRule) return fallbackRule.key
    return normalizedCanonical  // key는 항상 공백 없는 정규화 형태 — 공백 차이로 인한 중복 방지
  }
  const rule = getFallbackCanonicalRule(name)
  return rule?.key ?? normalizeIngredientKey(name)
}

const getCandidateRepresentativeName = (name, canonicalName) => {
  const canonical = String(canonicalName ?? '').trim()
  if (canonical) {
    const normalizedCanonical = normalizeIngredientKey(canonical)
    const fallbackRule = getFallbackCanonicalRule(normalizedCanonical)
    if (fallbackRule) return fallbackRule.representative
    return canonical
  }
  const rule = getFallbackCanonicalRule(name)
  return rule?.representative ?? String(name ?? '').trim()
}

// 관련 재료 목록을 canonical 대표명 기준으로 dedupe.
// 검색용 alias(소고기안심, 소고기 안심)와 generic part(안심, 등심, 갈비)를 UI에서 제거한다.
const dedupeRelatedItems = (items) => {
  const seen = new Set()
  return (items ?? []).filter((item) => {
    if (!item?.name) return false
    if (isGenericPartQuery(item.name)) return false
    const key = getCandidateCanonicalKey(item.name, '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const findCandidateMatches = (term, selectedNames, candidateOptions) => {
  const searchTerm = String(term ?? '').trim()
  if (!searchTerm) return []
  const genericQuery = isGenericPartQuery(searchTerm)
  const normalizedSearchTerm = normalizeIngredientKey(searchTerm)

  const list = candidateOptions.filter((candidate) => {
    if (selectedNames.includes(candidate.name)) return false
    if (genericQuery && isGenericPartQuery(candidate.name)) return false
    return candidate.aliases.some((alias) => {
      const rawAlias = String(alias ?? '').trim()
      if (!rawAlias) return false
      if (genericQuery) {
        return normalizeIngredientKey(rawAlias).includes(normalizedSearchTerm)
      }
      return rawAlias.includes(searchTerm)
    })
  })

  list.sort((a, b) => {
    const aExact = a.aliases.includes(searchTerm) ? 0 : 1
    const bExact = b.aliases.includes(searchTerm) ? 0 : 1
    if (aExact !== bExact) return aExact - bExact

    const aStarts = a.name.startsWith(searchTerm) || a.aliases.some((alias) => alias.startsWith(searchTerm)) ? 0 : 1
    const bStarts = b.name.startsWith(searchTerm) || b.aliases.some((alias) => alias.startsWith(searchTerm)) ? 0 : 1
    if (aStarts !== bStarts) return aStarts - bStarts

    return a.name.length - b.name.length
  })

  return list.slice(0, 6)
}

/**
 * Safety level 우선순위 조회
 * profileSafetyMap[name] → ingredientMap[name] → fallbackLevel → 'unknown'
 */
const pickKnownLevel = (...levels) => {
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

const getEffectiveLevel = (name, profileSafetyMap, ingredientLevelMap) =>
  pickKnownLevel(
    profileSafetyMap[name]?.level,
    ingredientLevelMap[name]?.level,
  ) ?? 'unknown'

/**
 * Safety note 우선순위 조회 — 빈 문자열은 유효한 note로 취급하지 않음
 * profileSafetyMap[name].note → reasons.join(' ') → fallbackNote
 */
const getEffectiveNote = (name, fallbackNote, profileSafetyMap, effectiveLevel) => {
  const mapLevel = profileSafetyMap[name]?.level
  const mapNote = profileSafetyMap[name]?.note
  const normalizedFallback = typeof fallbackNote === 'string' && fallbackNote.trim() !== '' ? fallbackNote : undefined
  if (mapLevel === 'unknown' && effectiveLevel !== 'unknown') return normalizedFallback
  if (typeof mapNote === 'string' && mapNote.trim() !== '' && (!mapLevel || mapLevel === effectiveLevel || effectiveLevel === 'unknown')) {
    return mapNote
  }
  const joinedReasons = profileSafetyMap[name]?.reasons?.join(' ')
  if (typeof joinedReasons === 'string' && joinedReasons.trim() !== '' && (!mapLevel || mapLevel === effectiveLevel || effectiveLevel === 'unknown')) {
    return joinedReasons
  }
  return normalizedFallback
}

const getKnownMetaNote = (name, ingredientMetaMap, ingredientLevelMap) => {
  if (!isKnownLevel(ingredientLevelMap[name]?.level)) return undefined
  const note = ingredientMetaMap[name]?.note
  return typeof note === 'string' && note.trim() !== '' ? note : undefined
}

const toPositiveNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

const getCardServingGuide = ({ profile, level, isAllergic, primaryMeta, secondaryMeta, parentMeta }) => {
  if (!profile?.weight || isAllergic || level === 'danger' || !isKnownLevel(level)) {
    return { grams: null, kcalPer100g: null, servingPerKg: null, source: null }
  }

  const primaryServingPerKg = toPositiveNumber(primaryMeta?.servingPerKg)
  const primaryKcal = toPositiveNumber(primaryMeta?.kcal)
  const secondaryServingPerKg = toPositiveNumber(secondaryMeta?.servingPerKg)
  const secondaryKcal = toPositiveNumber(secondaryMeta?.kcal)
  const parentServingPerKg = toPositiveNumber(parentMeta?.servingPerKg)
  const parentKcal = toPositiveNumber(parentMeta?.kcal)

  if (primaryServingPerKg != null) {
    return {
      grams: Math.round(profile.weight * primaryServingPerKg),
      kcalPer100g: primaryKcal,
      servingPerKg: primaryServingPerKg,
      source: 'servingPerKg',
    }
  }

  const snackKpi = calcKPI(profile)
  if (snackKpi?.snackKcal && primaryKcal != null) {
    return {
      grams: Math.round(snackKpi.snackKcal / (primaryKcal / 100)),
      kcalPer100g: primaryKcal,
      servingPerKg: null,
      source: 'kcal',
    }
  }

  if (secondaryServingPerKg != null) {
    return {
      grams: Math.round(profile.weight * secondaryServingPerKg),
      kcalPer100g: secondaryKcal ?? primaryKcal,
      servingPerKg: secondaryServingPerKg,
      source: 'servingPerKg',
    }
  }

  if (snackKpi?.snackKcal && secondaryKcal != null) {
    return {
      grams: Math.round(snackKpi.snackKcal / (secondaryKcal / 100)),
      kcalPer100g: secondaryKcal,
      servingPerKg: null,
      source: 'kcal',
    }
  }

  if (parentServingPerKg != null) {
    return {
      grams: Math.round(profile.weight * parentServingPerKg),
      kcalPer100g: parentKcal ?? secondaryKcal ?? primaryKcal,
      servingPerKg: parentServingPerKg,
      source: 'servingPerKg',
    }
  }

  if (snackKpi?.snackKcal && parentKcal != null) {
    return {
      grams: Math.round(snackKpi.snackKcal / (parentKcal / 100)),
      kcalPer100g: parentKcal,
      servingPerKg: null,
      source: 'kcal',
    }
  }

  return { grams: null, kcalPer100g: primaryKcal ?? secondaryKcal ?? parentKcal, servingPerKg: null, source: null }
}

// ─── 내부 컴포넌트: 자동완성 하이라이트 텍스트 ──────────────
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function Highlight({ text, term }) {
  const safeText = String(text ?? '')
  const safeTerm = String(term ?? '').trim()

  if (!safeTerm) return <>{safeText}</>

  const matcher = new RegExp(`(${escapeRegExp(safeTerm)})`, 'ig')
  const parts = safeText.split(matcher)

  if (parts.length === 1) return <>{safeText}</>

  const normalizedTerm = safeTerm.toLocaleLowerCase()

  return (
    <>
      {parts.map((part, index) => (
        part.toLocaleLowerCase() === normalizedTerm ? (
          <span key={`${part}-${index}`} style={{ color: 'var(--primary)', fontWeight: 700 }}>
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      ))}
    </>
  )
}

function FloatingChatFAB({ onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="press home-chat-fab"
      aria-label="AI 상담"
    >
      <img
        src="/icons/하루한끼_문구없.png"
        alt=""
        className="home-chat-fab__icon"
        width={32}
        height={32}
        style={{ objectFit: 'contain' }}
      />
      <span className="home-chat-fab__label">AI 상담</span>
    </button>
  )
}

// ─── 메인 화면 ───────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate()
  const profile = useProfile()
const { recentSearches, add: addSearch, remove: removeSearch } = useRecentSearches()
  const { isBookmarked, toggle: toggleBookmark } = useBookmarks()
  const { show: showToast } = useToast()

  const [q, setQ] = useState('')
  const [selected, setSelected] = useState([])  // [{ name, level }]
  const [relatedSheet, setRelatedSheet] = useState(null)  // { title, items, parentName? } | null
  const [relatedPickFeedback, setRelatedPickFeedback] = useState(null)  // 선택 직후 피드백용 name
  const [partsSheet, setPartsSheet] = useState(null)      // { parentName, items } | null
  const [selectedParts, setSelectedParts] = useState({})  // { [ingredientName]: {name,level,reason}|null }
  const [dropdownIdx, setDropdownIdx] = useState(-1)
  const [recipePage, setRecipePage] = useState(1)
  const [animatingChips, setAnimatingChips] = useState(() => new Set())
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [nudgeShowing, setNudgeShowing] = useState(false)
  const [profileBtnHover, setProfileBtnHover] = useState(false)
  const recipesFetchedRef = useRef(false)
  const ingredientsFetchedRef = useRef(false)
  const relatedSheetCloseTimerRef = useRef(null)
  const searchInputRef = useRef(null)

  // ─ 프로필 기반 Safety 데이터 ─────────────────────────────────
  const [profileSafetyMap, setProfileSafetyMap] = useState({})

  // fetchSafety가 읽을 수 있도록 profile shape 보정 (원본 mutate 없음)
  const safetyProfile = useMemo(() => {
    const conditions = toArray(
      profile?.healthConditions ??
      profile?.health_conditions ??
      profile?.conditions,
    )
    const allergies = toArray(profile?.allergies)
    return {
      ...profile,
      allergies,
      healthConditions: conditions,
      health_conditions: conditions,
      isNeutered: profile?.isNeutered ?? profile?.neutered ?? true,
    }
  }, [profile])

  // fetchSafety 재호출 기준 시그니처 (배열 정렬 → 순서 무관)
  const safetyProfileSignature = useMemo(() => {
    const conditions = toArray(
      profile?.healthConditions ??
      profile?.health_conditions ??
      profile?.conditions,
    )
    const allergies = toArray(profile?.allergies)
    return JSON.stringify({
      age: profile?.age,
      weight: profile?.weight,
      isNeutered: profile?.isNeutered ?? profile?.neutered ?? true,
      allergies: [...allergies].sort(),
      conditions: [...conditions].sort(),
    })
  }, [profile])

  const kpi = useMemo(() => calcKPI(profile), [profile])

  // ─ Supabase 실제 레시피 풀 (없으면 mock 폴백) ─
  const [apiRecipes, setApiRecipes] = useState(null)
  // API 응답 도착 전엔 mock(RECIPES)로 추천을 그렸다가 교체되며 "깜빡임"이 났다.
  // recipesLoaded 로 로딩 동안엔 mock 대신 스켈레톤을 보여 교체 플래시를 없앤다.
  // (API_ENABLED=false면 처음부터 mock 사용이 정상이므로 loaded=true로 시작)
  const [recipesLoaded, setRecipesLoaded] = useState(!API_ENABLED)
  useEffect(() => {
    if (!API_ENABLED) return
    if (recipesFetchedRef.current) return
    recipesFetchedRef.current = true
    fetchRecipes({ pageSize: 100 })
      .then((res) => {
        if (res?.items?.length) setApiRecipes(res.items)
      })
      .finally(() => setRecipesLoaded(true))
  }, [])
  const recipePool = apiRecipes ?? RECIPES
  const recipesLoading = API_ENABLED && !recipesLoaded

  // ─ 농사로 재료 목록 (없으면 mock INGREDIENTS 폴백) ─
  // { name → { level, kcal_per_100g } } 맵으로 변환해 자동완성·칩에서 사용
  const [apiIngredients, setApiIngredients] = useState(null)
  useEffect(() => {
    if (!API_ENABLED) return
    if (ingredientsFetchedRef.current) return
    ingredientsFetchedRef.current = true
    fetchIngredients({ lite: true }).then((res) => {
      if (!res?.items?.length) return
      setApiIngredients(res.items)
    })
  }, [])
  // API 재료 + mock 재료 병합 (API level·kcal 우선, mock note·servingPerKg 유지)
  const ingredientLevelMap = useMemo(() => {
    if (API_ENABLED) {
      const truthMap = {}
      for (const item of apiIngredients ?? []) {
        const names = [item?.name, item?.display_name, item?.canonical_name]
        names.forEach((candidateName) => {
          const key = String(candidateName ?? '').trim()
          if (!key) return
          truthMap[key] = { level: item.level, kcal: item.kcal_per_100g ?? null }
        })
      }
      return truthMap
    }
    if (!apiIngredients) {
      const fallbackMap = {}
      for (const [name, meta] of Object.entries(INGREDIENTS)) {
        fallbackMap[name] = { level: meta.level }
      }
      return fallbackMap
    }
    return {}
  }, [apiIngredients])

  const ingredientMetaMap = useMemo(() => {
    const merged = { ...RELATED_META_MAP, ...INGREDIENTS }
    for (const item of apiIngredients ?? []) {
      const names = [item?.name, item?.display_name, item?.canonical_name]
      names.forEach((candidateName) => {
        const key = String(candidateName ?? '').trim()
        if (!key) return
        if (!merged[key]) {
          merged[key] = { kcal: item.kcal_per_100g ?? null }
          return
        }
        merged[key] = {
          ...merged[key],
          kcal: item.kcal_per_100g ?? merged[key].kcal,
        }
      })
    }

    for (const [name, relatedMeta] of Object.entries(RELATED_META_MAP)) {
      if (!name) continue
      const current = merged[name]
      if (!current) {
        merged[name] = {
          level: relatedMeta.level ?? 'unknown',
          note: relatedMeta.note,
          displayName: name,
          rawName: name,
        }
        continue
      }

      const nextLevel = pickKnownLevel(current.level, relatedMeta.level) ?? 'unknown'
      merged[name] = {
        ...current,
        level: nextLevel,
        note: current.note ?? relatedMeta.note,
        displayName: current.displayName ?? name,
        rawName: current.rawName ?? name,
      }
    }
    return merged
  }, [apiIngredients])

  const { candidateOptions, candidateAliasMap } = useMemo(() => {
    const candidateMap = new Map()

    const registerCandidate = (name, canonicalName = '') => {
      const rawName = String(name ?? '').trim()
      if (!rawName) return
      const canonicalKey = getCandidateCanonicalKey(rawName, canonicalName)
      if (!canonicalKey) return

      const representativeName = getCandidateRepresentativeName(rawName, canonicalName)
      const current = candidateMap.get(canonicalKey)
      if (!current) {
        candidateMap.set(canonicalKey, {
          key: canonicalKey,
          name: representativeName,
          aliases: new Set([rawName, representativeName]),
        })
        return
      }

      current.aliases.add(rawName)
      current.aliases.add(representativeName)
      if (String(canonicalName ?? '').trim()) {
        current.name = representativeName
      }
    }

    for (const item of apiIngredients ?? []) {
      registerCandidate(item?.name, item?.canonical_name)
      registerCandidate(item?.display_name, item?.canonical_name)
      registerCandidate(item?.canonical_name, item?.canonical_name)
    }

    Object.keys(ingredientMetaMap).forEach((name) => {
      registerCandidate(name)
    })

    // RELATED_INGREDIENTS에서 종+부위 조합 후보 파생
    // DB/API에 데이터가 없어도 종별 후보(소안심, 돼지안심, 닭안심...)를 보장
    Object.entries(RELATED_INGREDIENTS).forEach(([parentName, parts]) => {
      if (!Array.isArray(parts)) return
      parts.forEach((part) => {
        if (!part?.name) return
        const composedKey = normalizeIngredientKey(parentName + part.name)
        const canonicalRule = getFallbackCanonicalRule(composedKey)
        if (!canonicalRule) return  // 알려진 부위(안심/갈비/등심)만 파생, 삼겹살 등 미매핑 부위 제외
        registerCandidate(canonicalRule.representative, canonicalRule.key)
      })
    })

    const aliasMap = {}
    const options = [...candidateMap.values()].map((entry) => {
      const aliases = [...entry.aliases]
      aliases.forEach((alias) => {
        aliasMap[alias] = entry.name
      })
      aliasMap[entry.name] = entry.name
      return {
        key: entry.key,
        name: entry.name,
        aliases,
      }
    })

    return { candidateOptions: options, candidateAliasMap: aliasMap }
  }, [apiIngredients, ingredientMetaMap])

  const allNames = useMemo(
    () => candidateOptions.flatMap((candidate) => candidate.aliases),
    [candidateOptions],
  )

  // ─ Safety 호출 대상 이름 수집 ──────────────────────────────────
  // selected + selectedParts + relatedSheet 후보까지 포함해
  // 바텀시트 열린 상태에서도 프로필 Safety 결과를 미리 확보한다
  const safetyTargetNames = useMemo(() => {
    const names = new Set()
    selected.forEach((s) => { if (s?.name) names.add(s.name) })
    // selectedParts: composed canonical name도 포함해 profileSafetyMap에 부위 safety 확보
    Object.entries(selectedParts).forEach(([parentName, part]) => {
      if (!part?.name) return
      const composedKey = normalizeIngredientKey(parentName + part.name)
      const composedCanonical =
        candidateAliasMap[composedKey] ??
        getFallbackCanonicalRule(composedKey)?.representative
      if (composedCanonical) names.add(composedCanonical)
      else names.add(part.name)
    })
    // relatedSheet: 부위 바텀시트의 경우 parentName + 부위명 composed key로 safety 조회
    relatedSheet?.items?.forEach((item) => {
      if (!item?.name) return
      if (relatedSheet.parentName) {
        const composedKey = normalizeIngredientKey(relatedSheet.parentName + item.name)
        const composedCanonical =
          candidateAliasMap[composedKey] ??
          getFallbackCanonicalRule(composedKey)?.representative
        if (composedCanonical) names.add(composedCanonical)
        else names.add(item.name)
      } else {
        names.add(item.name)
      }
    })
    if (relatedSheet?.parentName) names.add(relatedSheet.parentName)
    // partsSheet items 방어적 추가 (현재 dead code지만 활성화 대비)
    partsSheet?.items?.forEach((item) => {
      if (!item?.name) return
      if (partsSheet.parentName) {
        const composedKey = normalizeIngredientKey(partsSheet.parentName + item.name)
        const composedCanonical =
          candidateAliasMap[composedKey] ??
          getFallbackCanonicalRule(composedKey)?.representative
        if (composedCanonical) names.add(composedCanonical)
        else names.add(item.name)
      } else {
        names.add(item.name)
      }
    })
    if (partsSheet?.parentName) names.add(partsSheet.parentName)
    return [...names]
  }, [selected, selectedParts, relatedSheet, partsSheet, candidateAliasMap])

  // ─ 프로필 기반 Safety 비동기 호출 ─────────────────────────────
  // - Promise.allSettled: 일부 실패해도 나머지 결과 반영
  // - cancelled 플래그: 언마운트/재호출 경합 방지
  // - setProfileSafetyMap: 이전 state와 merge 하지 않고 새 Map으로 교체
  //   → 프로필 변경 시 이전 결과 잔류 방지
  useEffect(() => {
    if (!API_ENABLED) return
    if (safetyTargetNames.length === 0) {
      setProfileSafetyMap({})
      return
    }

    let cancelled = false

    const fetchAll = async () => {
      const results = await Promise.allSettled(
        safetyTargetNames.map((name) => fetchSafety(name, safetyProfile)),
      )
      if (cancelled) return

      const nextMap = {}
      results.forEach((result, index) => {
        const name = safetyTargetNames[index]
        if (result.status === 'fulfilled' && result.value) {
          const reasons = toArray(result.value.reasons)
          nextMap[name] = {
            level: result.value.level,
            reasons,
            note: reasons.length > 0 ? reasons.join(' ') : undefined,
          }
        }
        // 실패한 항목은 nextMap에 넣지 않음 → 렌더에서 ingredientMap/mock fallback 사용
      })
      setProfileSafetyMap(nextMap)
    }

    fetchAll()
    return () => { cancelled = true }
  // safetyTargetNames 배열 동일성 대신 join 문자열로 비교
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safetyTargetNames.join('\0'), safetyProfileSignature])

  useEffect(() => {
    if (!profile?.weight && !nudgeDismissed) {
      const t = window.setTimeout(() => setNudgeShowing(true), 20)
      return () => window.clearTimeout(t)
    }
  }, [profile?.weight, nudgeDismissed])

  const isAllergic = useCallback(
    (name) => isIngredientAllergic(name, profile?.allergies),
    [profile?.allergies],
  )

  // ─ 자동완성 (검색창 아래 최대 6건, 컴팩트 드롭다운만) ─
  const resolveCandidateName = useCallback(
    (name) => candidateAliasMap[name] ?? getFallbackCanonicalRule(name)?.representative ?? null,
    [candidateAliasMap],
  )
  const searchTerm = q.trim()
  const normalizedExactNameMap = useMemo(() => {
    const map = new Map()
    allNames.forEach((name) => {
      const normalized = normalizeIngredientKey(name)
      if (normalized && !map.has(normalized)) map.set(normalized, name)
    })
    return map
  }, [allNames])
  const normalizedSearchTerm = normalizeIngredientKey(searchTerm)
  const isGenericPartSearch = GENERIC_PART_QUERY_SET.has(searchTerm)
  const exactMatchName = normalizedSearchTerm
    ? (normalizedExactNameMap.get(normalizedSearchTerm) ?? null)
    : null
  const exactSelectableName = isGenericPartSearch ? null : exactMatchName
  const matchCandidates = useMemo(() => {
    return findCandidateMatches(searchTerm, selected.map((item) => item.name), candidateOptions)
  }, [searchTerm, selected, candidateOptions])
  const hasExactName = Boolean(searchTerm && resolveCandidateName(searchTerm))
  const showDropdown = Boolean(searchTerm && matchCandidates.length > 0 && !hasExactName)
  const searchActionLabel = isGenericPartSearch && matchCandidates.length > 0
    ? '후보 보기'
    : (!hasExactName && matchCandidates.length > 1 ? '선택' : '추가')

  const openSearchResultsSheet = useCallback((term, candidates, { generic = false } = {}) => {
    if (!term || candidates.length === 0) return
    setRelatedSheet({
      title: generic ? buildGenericPartSheetTitle(term) : `"${term}" 검색 결과`,
      items: candidates.map((name) => ({ name })),
    })
    setQ('')
    setDropdownIdx(-1)
  }, [])

  // ─ 재료 추가 ─
  const markChipAnimate = useCallback((name) => {
    setAnimatingChips((prev) => new Set(prev).add(name))
    window.setTimeout(() => {
      setAnimatingChips((prev) => {
        const next = new Set(prev)
        next.delete(name)
        return next
      })
    }, 220)
  }, [])

  const openCandidateSheet = useCallback((term) => {
    const items = findCandidateMatches(term, selected.map((item) => item.name), candidateOptions)
      .map((candidate) => ({ name: candidate.name }))
    if (items.length === 0) return false
    setRelatedSheet({
      title: `"${term}" 검색 결과`,
      items,
    })
    setQ('')
    setDropdownIdx(-1)
    return true
  }, [selected, candidateOptions])

  const addIngredient = useCallback((name, parentName) => {
    const sourceName = String(name ?? '').trim()
    const resolvedName = resolveCandidateName(sourceName) ?? sourceName
    if (!resolvedName) return
    if (!parentName && isGenericPartQuery(resolvedName)) {
      openCandidateSheet(sourceName || resolvedName)
      return
    }
    if (selected.find((s) => s.name === resolvedName)) return
    const level = ingredientLevelMap[resolvedName]?.level ?? 'unknown'
    setSelected((prev) => [...prev, { name: resolvedName, level, parent: parentName }])
    markChipAnimate(resolvedName)
    setQ('')
    setDropdownIdx(-1)
    setRecipePage(1)
    addSearch(resolvedName)
  }, [selected, ingredientLevelMap, addSearch, markChipAnimate, resolveCandidateName, openCandidateSheet])

  const submitSearch = useCallback(() => {
    const term = q.trim()
    if (!term) return
    trackIngredientSearch()
    if (isGenericPartQuery(term) && openCandidateSheet(term)) {
      return
    }
    const exactCandidateName = resolveCandidateName(term)
    if (exactCandidateName) {
      addIngredient(exactCandidateName)
      return
    }
    if (ingredientMetaMap[term]) {
      addIngredient(term)
      return
    }
    if (matchCandidates.length === 1) {
      addIngredient(matchCandidates[0].name)
      return
    }
    if (matchCandidates.length > 1 && openCandidateSheet(term)) {
      setRelatedSheet({
        title: `"${term}" 검색 결과`,
        items: matchCandidates.map((candidate) => ({ name: candidate.name })),
      })
      setQ('')
      return
    }
    showToast(`"${term}"는 아직 DB에 없어요.`)
  }, [q, matchCandidates, ingredientMetaMap, addIngredient, showToast, resolveCandidateName, openCandidateSheet])

  const removeIngredient = useCallback((name) => {
    setSelected((prev) => prev.filter((x) => x.name !== name))
    setSelectedParts((prev) => { const next = { ...prev }; delete next[name]; return next })
    setRecipePage(1)
  }, [])

  const closePickerSheets = useCallback(() => {
    if (relatedSheetCloseTimerRef.current) {
      window.clearTimeout(relatedSheetCloseTimerRef.current)
      relatedSheetCloseTimerRef.current = null
    }
    setRelatedPickFeedback(null)
    setRelatedSheet(null)
    setPartsSheet(null)
  }, [])

  const schedulePickerClose = useCallback(() => {
    if (relatedSheetCloseTimerRef.current) {
      window.clearTimeout(relatedSheetCloseTimerRef.current)
    }
    relatedSheetCloseTimerRef.current = window.setTimeout(() => {
      relatedSheetCloseTimerRef.current = null
      setRelatedPickFeedback(null)
      setRelatedSheet(null)
      setPartsSheet(null)
    }, RELATED_SHEET_CLOSE_MS)
  }, [])

  const pickRelatedIngredient = useCallback((name, e) => {
    e?.stopPropagation?.()
    const pickerOpen = relatedSheet || partsSheet
    if (!pickerOpen) return

    const parentName = relatedSheet?.parentName ?? partsSheet?.parentName

    if (parentName) {
      // 부위 선택 — selected에 추가하지 않고 selectedParts에만 기록
      setSelectedParts((prev) => {
        if (prev[parentName]?.name === name) {
          // 같은 부위 재선택 → 해제
          const next = { ...prev }
          delete next[parentName]
          return next
        }
        const relatedList = RELATED_INGREDIENTS[parentName] ?? []
        const partMeta = relatedList.find((r) => r.name === name) ?? { name }
        return { ...prev, [parentName]: partMeta }
      })
      setRelatedPickFeedback(name)
      schedulePickerClose()
      return
    }

    // parentName 없음 (검색 결과 바텀시트) — selected 로직
    const alreadySelected = selected.some((x) => x.name === name)
    if (alreadySelected) {
      removeIngredient(name)
      closePickerSheets()
      return
    }
    addIngredient(name)
    setRelatedPickFeedback(name)
    schedulePickerClose()
  }, [
    relatedSheet,
    partsSheet,
    selected,
    addIngredient,
    removeIngredient,
    closePickerSheets,
    schedulePickerClose,
  ])

  useEffect(() => () => {
    if (relatedSheetCloseTimerRef.current) {
      window.clearTimeout(relatedSheetCloseTimerRef.current)
    }
  }, [])

  const clearAll = useCallback(() => {
    setSelected([])
    setSelectedParts({})
    setRecipePage(1)
  }, [])

  const dismissNudge = useCallback(() => {
    setNudgeShowing(false)
    window.setTimeout(() => setNudgeDismissed(true), 220)
  }, [])

  // ─ 매칭 레시피 (실제 레시피 풀 + partial 매칭 + 알러지 필터) ─
  const { matched, allergyFilteredCount } = useMemo(() => {
    if (selected.length === 0) return { matched: [], allergyFilteredCount: 0 }
    const selNames = selected.map((s) => s.name)
    const mapped = recipePool.map((r) => {
      // API 응답({name}) / mock(문자열) 양쪽 처리
      const ingList = r.ingredients ?? []
      const ingNames = ingList.map((i) => (typeof i === 'string' ? i : (i.name ?? '')).trim()).filter(Boolean)
      // 선택 재료와 부분 매칭
      const matches = ingNames.filter((ingName) =>
        selNames.some((sel) => ingName.includes(sel) || sel.includes(ingName)),
      )
      // 알러지 재료 포함 여부
      const hasAllergy = ingNames.some((ingName) =>
        isIngredientAllergic(ingName, profile?.allergies),
      )
      return { recipe: r, count: matches.length, matchedNames: matches, hasAllergy }
    })

    const withMatch = mapped.filter((x) => x.count > 0)
    // 알러지 재료 포함 레시피 제외 (표시만 하는 게 아니라 완전히 제거)
    const allergyFiltered = withMatch.filter((x) => x.hasAllergy)
    const safe = withMatch
      .filter((x) => !x.hasAllergy)
      .sort((a, b) => b.count - a.count || b.recipe.ingredients.length - a.recipe.ingredients.length)

    return { matched: safe, allergyFilteredCount: allergyFiltered.length }
  }, [selected, recipePool, profile?.allergies])

  const recipeTotal = matched.length
  const recipeVisible = Math.min(recipePage * RECIPE_PAGE_SIZE, recipeTotal)
  const visibleMatched = matched.slice(0, recipeVisible)
  const hasMoreRecipes = recipeVisible < recipeTotal

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', position: 'relative' }}>

      {/* 스크롤 영역 */}
      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {/* 히어로 + 검색 */}
        <section className="page-inset-x" style={{ paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-1)' }}>
          <h1 className="t-headline home-hero-title" style={{ margin: '8px 0 18px' }}>
            냉장고 재료,
            <br className="home-hero-title__break" />
            {' '}
            {profile?.name ? `${profile.name}에게 괜찮을까?` : '우리 강아지에게 괜찮을까?'}
          </h1>

          {/* 검색창 + 자동완성 */}
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--surface)',
              border: `1px solid ${showDropdown ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: showDropdown ? '12px 12px 0 0' : 12,
              padding: '14px 16px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            }}>
              <IconSearch size={18} color="var(--ink-3)" />
              <input
                ref={searchInputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setDropdownIdx(-1) }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    if (showDropdown) setDropdownIdx((i) => Math.min(i + 1, matchCandidates.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    if (showDropdown) setDropdownIdx((i) => Math.max(i - 1, 0))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (showDropdown && dropdownIdx >= 0) {
                      addIngredient(matchCandidates[dropdownIdx].name)
                    } else {
                      submitSearch()
                    }
                  } else if (e.key === 'Escape') {
                    setQ('')
                    setDropdownIdx(-1)
                  }
                }}
                placeholder="검색할 재료를 입력해보세요 (예: 당근)"
                aria-label="재료 검색"
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  fontSize: 14, color: 'var(--ink-1)', minWidth: 0,
                }}
              />
              {q && !hasExactName && matchCandidates.length > 1 && (
                <button
                  type="button"
                  className="press"
                  onClick={submitSearch}
                  style={{
                    background: 'var(--primary)', color: '#fff',
                    fontSize: 12, fontWeight: 600,
                    padding: '6px 12px', borderRadius: 8,
                  }}
                >
                  {searchActionLabel}
                </button>
              )}
              {q && (hasExactName || matchCandidates.length <= 1) && (
                <button
                  type="button"
                  className="press"
                  onClick={submitSearch}
                  style={{
                    background: 'var(--primary)', color: '#fff',
                    fontSize: 12, fontWeight: 600,
                    padding: '6px 12px', borderRadius: 8,
                  }}
                >
                  {searchActionLabel}
                </button>
              )}
            </div>

            {showDropdown && (
              <div
                className="fade-in"
                role="listbox"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--primary)',
                  borderTop: 'none',
                  borderRadius: '0 0 12px 12px',
                  padding: 4,
                  maxHeight: 220, overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
              >
                {matchCandidates.map((candidate, idx) => {
                  const meta = ingredientMetaMap[candidate.name]
                  const itemLevel = getEffectiveLevel(candidate.name, profileSafetyMap, ingredientLevelMap)
                  const isHighlighted = idx === dropdownIdx
                  return (
                    <button
                      key={candidate.key}
                      type="button"
                      role="option"
                      aria-selected={isHighlighted}
                      className="press"
                      onClick={() => addIngredient(candidate.name)}
                      onMouseEnter={() => setDropdownIdx(idx)}
                      onMouseLeave={() => setDropdownIdx(-1)}
                      style={{
                        width: '100%', textAlign: 'left',
                        background: isHighlighted ? 'var(--primary-soft)' : 'transparent',
                        padding: '10px 12px', borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 13, color: isHighlighted ? 'var(--primary)' : 'var(--ink-1)', fontWeight: isHighlighted ? 600 : 400 }}>
                        <Highlight text={candidate.name} term={searchTerm} />
                      </span>
                      {meta && <SafetyBadge level={itemLevel} size="s" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 예시 재료 */}
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>예시 재료:</span>
            {EXAMPLE_INGREDIENTS.map((s) => (
              <button
                key={s}
                type="button"
                className="press"
                onClick={() => addIngredient(s)}
                style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2 }}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* 프로필 설정 유도 배너 */}
        {!nudgeDismissed && !profile?.weight && (
          <div
            className="page-inset-x"
            style={{
              overflow: 'hidden',
              opacity: nudgeShowing ? 1 : 0,
              transform: nudgeShowing ? 'translateY(0)' : 'translateY(-8px)',
              maxHeight: nudgeShowing ? 120 : 0,
              paddingTop: nudgeShowing ? 'var(--space-2)' : 0,
              transition: nudgeShowing
                ? 'opacity 0.3s ease, transform 0.3s ease, max-height 0.3s ease, padding-top 0.3s ease'
                : 'opacity 0.2s ease, transform 0.2s ease, max-height 0.25s ease, padding-top 0.25s ease',
            }}
          >
            <div style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <p style={{ margin: 0, flex: 1, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                맞춤 급여량 계산을 위해 반려견 프로필을 먼저 설정해 주세요.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className="press"
                  onClick={() => navigate(ROUTES.profile)}
                  onMouseEnter={() => setProfileBtnHover(true)}
                  onMouseLeave={() => setProfileBtnHover(false)}
                  style={{
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--primary)',
                    border: '1px solid var(--primary)',
                    borderRadius: 8,
                    padding: '5px 10px',
                    background: 'transparent',
                    transform: profileBtnHover ? 'scale(1.02)' : 'scale(1)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  프로필 설정하기
                </button>
                <button
                  type="button"
                  className="press"
                  onClick={dismissNudge}
                  aria-label="배너 닫기"
                  style={{
                    width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink-3)',
                  }}
                >
                  <IconClose size={14} color="var(--ink-3)" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 선택된 재료 칩 */}
        {selected.length > 0 && (
          <section className="page-inset-x" style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="t-subtitle-s" style={{ color: 'var(--ink-2)' }}>
                선택한 재료{' '}
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{selected.length}</span>
              </div>
              <button
                type="button"
                className="press"
                onClick={clearAll}
                style={{ fontSize: 11, color: 'var(--ink-3)', textDecoration: 'underline', textUnderlineOffset: 2, padding: 4 }}
              >
                모두 지우기
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selected.map((s) => {
                return (
                  <div
                    key={s.name}
                    className={animatingChips.has(s.name) ? 'chip-enter' : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'var(--primary-soft)', color: 'var(--primary)',
                      borderRadius: 20, padding: '6px 4px 6px 12px',
                      fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {s.name}
                    <button
                      type="button"
                      className="press"
                      onClick={() => removeIngredient(s.name)}
                      aria-label={`${s.name} 제거`}
                      style={{
                        width: 20, height: 20, borderRadius: 999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--primary)',
                      }}
                    >
                      <IconClose size={12} color="var(--primary)" />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 재료별 결과 카드 */}
        {selected.length > 0 && (
          <section
            className="page-inset-x ingredient-result-grid"
            style={{ paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-1)' }}
          >
            {selected.map((s) => {
              const meta = ingredientMetaMap[s.name]
              const related = dedupeRelatedItems(RELATED_INGREDIENTS[s.name])
              const allergic = isAllergic(s.name)
              const activePart = selectedParts[s.name] ?? null
              const selectedItemName = resolveCandidateName(s.name) ?? s.name

              // profileSafetyMap 우선 적용
              const effectiveLevel = getEffectiveLevel(s.name, profileSafetyMap, ingredientLevelMap)
              const effectiveNote  = getEffectiveNote(
                s.name,
                getKnownMetaNote(s.name, ingredientMetaMap, ingredientLevelMap),
                profileSafetyMap,
                effectiveLevel,
              )
              // 부위 level/note: raw 부위명("갈비") 대신 composed canonical("소갈비")으로 조회
              const resolvedActivePartName = activePart
                ? (candidateAliasMap[normalizeIngredientKey(s.name + activePart.name)] ??
                   getFallbackCanonicalRule(normalizeIngredientKey(s.name + activePart.name))?.representative ??
                   activePart.name)
                : null
              const resolvedActivePartMeta = resolvedActivePartName ? ingredientMetaMap[resolvedActivePartName] : null
              const selectedItemMeta = ingredientMetaMap[selectedItemName] ?? meta ?? null
              const parentMeta = activePart ? meta ?? null : null
              const activePartLevel = resolvedActivePartName
                ? getEffectiveLevel(resolvedActivePartName, profileSafetyMap, ingredientLevelMap)
                : null
              const activePartNote = resolvedActivePartName
                ? getEffectiveNote(resolvedActivePartName, activePart.reason, profileSafetyMap, activePartLevel)
                : undefined
              const servingLevel = activePartLevel ?? effectiveLevel
              const { grams: servingG } = getCardServingGuide({
                profile,
                level: servingLevel,
                isAllergic: allergic,
                primaryMeta: resolvedActivePartMeta ?? selectedItemMeta,
                secondaryMeta: resolvedActivePartMeta ? selectedItemMeta : null,
                parentMeta,
              })

              const isPartSelected = Boolean(activePart)
              const displayName = activePart?.name ?? s.name
              const displayLevel = activePartLevel ?? effectiveLevel
              const displayNote = activePartNote ?? effectiveNote
              const displayMeta = resolvedActivePartMeta ?? meta
              const shouldHideServing = (
                allergic
                || displayLevel === 'danger'
                || displayLevel === 'unknown'
                || (isPartSelected && displayLevel === 'caution')
              )

              const displayServingPerKg = displayMeta?.servingPerKg
              let displayServingG = (profile?.weight && displayServingPerKg && !shouldHideServing)
                ? Math.round(profile.weight * displayServingPerKg)
                : null
              if (displayServingG == null && !shouldHideServing && kpi) {
                const kcalPer100g = (displayMeta?.kcal ?? displayMeta?.cal)
                if (kcalPer100g) displayServingG = Math.round((kpi.snackKcal / kcalPer100g) * 100)
              }

              const guidanceMessage = (() => {
                if (allergic || displayLevel === 'danger') return null
                if (isPartSelected && displayLevel === 'unknown') {
                  return '아직 안전성 정보를 확인하지 않은 부위예요. 급여 전 다시 확인해주세요.'
                }
                if (isPartSelected && displayLevel === 'caution') {
                  return '소량 급여가 필요한 부위예요. 자세한 급여량은 AI 상담에서 확인해보세요.'
                }
                if (displayServingG == null) {
                  return '자세한 급여량은 AI 상담에서 확인해보세요.'
                }
                return '더 자세한 급여량은 AI 상담에서 확인해보세요.'
              })()

              const headerRow = (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>{displayName}</span>
                    <IngredientSafetyBadges
                      level={displayLevel}
                      note={displayNote}
                      isAllergic={allergic}
                      onDangerBg={allergic}
                    />
                  </div>
                </div>
              )

              const cardBody = (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {displayNote && (
                    <p style={{ fontSize: 11, color: 'var(--ink-2)', margin: 0, lineHeight: 1.4 }}>
                      {displayNote}
                    </p>
                  )}
                  {displayServingG != null && (
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {profile?.name || '반려견'} 기준 약 {displayServingG}g/일
                    </div>
                  )}
                  {activePart && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 12, background: 'var(--primary-soft)', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', flexShrink: 0, whiteSpace: 'nowrap' }}>✓ {activePart.name}</span>
                        {activePartNote && <span style={{ color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>· {activePartNote}</span>}
                        <SafetyBadge level={activePartLevel} size="s" />
                      </div>
                      {!resolvedActivePartMeta?.kcal && (
                        <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                          부위별 칼로리 정보 준비 중이에요
                        </span>
                      )}
                    </div>
                  )}

                  {related.length > 0 && (
                    <button
                      type="button"
                      className="press"
                      onClick={() => setRelatedSheet({
                        title: `${s.name} 관련 재료`,
                        items: related,
                        parentName: s.name,
                      })}
                      style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--primary)', fontWeight: 600, padding: '4px 0' }}
                    >
                      부위 정보 보기 ›
                    </button>
                  )}
                </div>
              )

              if (allergic) {
                // 알러지 카드 전용 body — activePart SafetyBadge 숨김, 알러지 UI 톤 유지
                const allergyCardBody = (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {displayNote && (
                      <p style={{ fontSize: 11, color: 'var(--ink-2)', margin: 0, lineHeight: 1.4 }}>
                        {displayNote}
                      </p>
                    )}
                    {activePart && (
                      <div style={{ fontSize: 12, background: 'var(--primary-soft)', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', flexShrink: 0, whiteSpace: 'nowrap' }}>✓ {activePart.name}</span>
                        {activePartNote && <span style={{ color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>· {activePartNote}</span>}
                        {/* 상태칩 제거 — 알러지 카드 내부 */}
                      </div>
                    )}
                    {related.length > 0 && (
                      <button
                        type="button"
                        className="press"
                        onClick={() => setRelatedSheet({
                          title: `${s.name} 관련 재료`,
                          items: related,
                          parentName: s.name,
                        })}
                        style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--primary)', fontWeight: 600, padding: '4px 0' }}
                      >
                        부위 정보 보기 ›
                      </button>
                    )}
                  </div>
                )

                return (
                  <div
                    key={s.name}
                    className="ingredient-result-card ingredient-result-card--allergy"
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 'var(--card-pad)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* 좌측 알러지 인디케이터 바 */}
                    <div style={{
                      position: 'absolute',
                      left: 0, top: 0, bottom: 0,
                      width: 5,
                      background: 'var(--danger-fg)',
                      borderRadius: '12px 0 0 12px',
                    }} />

                    {/* 헤더: 재료명 + 우리 아이 알러지 배지 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>{displayName}</span>
                      <span style={{
                        background: 'var(--danger-bg)',
                        color: 'var(--danger-fg)',
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 20,
                        padding: '2px 8px',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}>
                        우리 아이 알러지
                      </span>
                    </div>

                    {/* 안내 문구 */}
                    <div style={{ fontSize: 11, color: 'var(--danger-fg)' }}>
                      우리 아이 알러지 재료예요
                    </div>

                    {/* 본문 */}
                    <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 8 }}>
                      {allergyCardBody}
                    </div>
                  </div>
                )
              }

              // 주의 필요 — 흰 배경 + 좌측 5px 노란 바
              if (displayLevel === 'caution') {
                return (
                  <div
                    key={s.name}
                    className="ingredient-result-card ingredient-result-card--caution"
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 'var(--card-pad)',
                      display: 'flex', flexDirection: 'column', gap: 6,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      left: 0, top: 0, bottom: 0,
                      width: 5,
                      background: 'var(--caution-fg)',
                      borderRadius: '12px 0 0 12px',
                    }} />
                    {headerRow}
                    <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 8 }}>
                      {cardBody}
                    </div>
                  </div>
                )
              }

              // 급여 금지 — 연분홍 배경 + 레드 테두리
              if (displayLevel === 'danger') {
                return (
                  <div
                    key={s.name}
                    className="ingredient-result-card ingredient-result-card--danger"
                    style={{
                      background: '#FFF5F5',
                      border: '1px solid #C62828',
                      borderRadius: 12,
                      padding: 'var(--card-pad)',
                      display: 'flex', flexDirection: 'column', gap: 6,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                  >
                    {headerRow}
                    <div style={{ borderTop: '1px solid var(--danger-bd)', paddingTop: 8 }}>
                      {cardBody}
                    </div>
                  </div>
                )
              }

              if (displayLevel === 'unknown') {
                return (
                  <div
                    key={s.name}
                    className="ingredient-result-card ingredient-result-card--unknown"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 'var(--card-pad)',
                      display: 'flex', flexDirection: 'column', gap: 6,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                  >
                    {headerRow}
                    <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 8 }}>
                      {cardBody}
                    </div>
                  </div>
                )
              }

              // 급여 가능 (safe) — 흰 배경, 테두리 없음
              return (
                <div
                  key={s.name}
                  className="ingredient-result-card"
                  style={{
                    background: 'var(--surface)',
                    borderRadius: 12,
                    padding: 'var(--card-pad)',
                    display: 'flex', flexDirection: 'column', gap: 6,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  {headerRow}
                  <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 8 }}>
                    {cardBody}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* 매칭 레시피 목록 */}
        {selected.length > 0 && (
          <>
            <div
              className="page-inset-x"
              style={{ height: 1, background: 'var(--divider)', marginTop: 'var(--section-gap)', marginBottom: 'var(--space-1)' }}
            />
            <section className="page-inset-x" style={{ paddingTop: 'var(--space-2)', paddingBottom: 88 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="t-subtitle" style={{ fontWeight: 700, color: 'var(--ink-1)' }}>추천 레시피</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{recipeTotal}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5 }}>
                  입력 재료와 많이 일치할수록 상위에 표시돼요.
                </div>
                {allergyFilteredCount > 0 && (
                  <div style={{
                    marginTop: 6,
                    fontSize: 11, color: 'var(--danger-fg)',
                    background: 'var(--danger-bg)',
                    borderRadius: 6, padding: '4px 10px',
                    display: 'inline-block',
                  }}>
                    ⚠️ 알러지 재료 포함 레시피 {allergyFilteredCount}개 제외됨
                  </div>
                )}
              </div>

              {recipesLoading ? (
                <div className="home-recipe-grid">
                  <RecipeCardSkeleton count={3} />
                </div>
              ) : recipeTotal === 0 ? (
                <EmptyState custom="선택한 재료가 들어간 레시피가 아직 없어요. 다른 재료를 추가해보세요." />
              ) : (
                <div className="home-recipe-grid">
                  {visibleMatched.map(({ recipe, count, matchedNames }, idx) => (
                    <div key={recipe.id} style={{ position: 'relative' }}>
                      {idx < 3 && (
                        <div style={{
                          position: 'absolute', top: -1, left: -1, zIndex: 2,
                          background: 'var(--primary)', color: '#fff',
                          fontSize: 10, fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px 0 12px 0',
                          letterSpacing: 0.4,
                        }}>
                          TOP {idx + 1}
                        </div>
                      )}
                      <IngredientCard
                        recipe={recipe}
                        matchCount={count}
                        matchedNames={matchedNames}
                        bookmarked={isBookmarked(recipe.id)}
                        onToggleBookmark={() => toggleBookmark(recipe.id)}
                        onClick={() => {
                          navigate(ROUTES.detail(recipe.id))
                        }}
                      />
                    </div>
                  ))}

                  {hasMoreRecipes && (
                    <button
                      type="button"
                      className="press"
                      onClick={() => setRecipePage((p) => p + 1)}
                      style={{
                        alignSelf: 'center', marginTop: 4,
                        background: 'var(--surface)',
                        border: '1px solid var(--border-strong)',
                        color: 'var(--ink-2)',
                        borderRadius: 8, padding: '10px 20px',
                        fontSize: 13, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      레시피 더보기 ({recipeVisible}/{recipeTotal})
                      <IconChevron dir="down" size={14} color="var(--ink-2)" />
                    </button>
                  )}
                  {!hasMoreRecipes && recipeTotal > RECIPE_PAGE_SIZE && (
                    <button
                      type="button"
                      className="press"
                      onClick={() => setRecipePage(1)}
                      style={{ alignSelf: 'center', color: 'var(--ink-3)', fontSize: 12, padding: '6px 14px' }}
                    >
                      접기
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {/* 빈 상태 (재료 미선택) */}
        {selected.length === 0 && (
          <section className="page-inset-x" style={{ paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-6)' }}>
            {/* 서비스 허브 카드 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  className="press"
                  onClick={() => searchInputRef.current?.focus()}
                  aria-label="냉장고 파먹기"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 8, padding: '16px 12px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    textAlign: 'center', cursor: 'pointer',
                  }}
                >
                  <img src="/icons/fridge.png" alt="" width={40} height={40} style={{ objectFit: 'contain' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>냉장고 파먹기</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>가진 재료로 급여 가능 여부 확인</span>
                </button>

                <button
                  type="button"
                  className="press"
                  onClick={() => navigate(ROUTES.chat)}
                  aria-label="AI 상담"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 8, padding: '16px 12px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    textAlign: 'center', cursor: 'pointer',
                  }}
                >
                  <img src="/icons/chat.png" alt="" width={40} height={40} style={{ objectFit: 'contain' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>AI 상담</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>우리 아이 기준으로 더 물어보기</span>
                </button>

                <button
                  type="button"
                  className="press"
                  onClick={() => navigate(ROUTES.feed)}
                  aria-label="레시피"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 8, padding: '16px 12px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    textAlign: 'center', cursor: 'pointer',
                  }}
                >
                  <img src="/icons/recipe.png" alt="" width={40} height={40} style={{ objectFit: 'contain' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>레시피</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>안전한 간식 레시피 둘러보기</span>
                </button>

                <button
                  type="button"
                  className="press"
                  onClick={() => navigate(ROUTES.dietLog)}
                  aria-label="식생활 기록"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 8, padding: '16px 12px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    textAlign: 'center', cursor: 'pointer',
                  }}
                >
                  <img src="/icons/meal-log.png" alt="" width={40} height={40} style={{ objectFit: 'contain' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>식생활 기록</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>먹인 것과 반응을 남기기</span>
                </button>
              </div>
            </div>

            {recentSearches.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div className="t-subtitle-s" style={{ color: 'var(--ink-2)', marginBottom: 10 }}>
                  최근 검색어
                </div>
                <div className="h-scroll" style={{ display: 'flex', gap: 8 }}>
                  {recentSearches.map((term) => (
                    <div
                      key={term}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--surface-2)',
                        borderRadius: 20, padding: '7px 6px 7px 14px',
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        className="press"
                        onClick={() => addIngredient(term)}
                        style={{ fontSize: 12, color: 'var(--ink-2)' }}
                      >
                        {term}
                      </button>
                      <button
                        type="button"
                        className="press"
                        onClick={() => removeSearch(term)}
                        aria-label={`${term} 검색어 삭제`}
                        style={{
                          width: 20, height: 20, borderRadius: 999,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--ink-3)',
                        }}
                      >
                        <IconClose size={12} color="var(--ink-3)" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              padding: 'var(--space-6) var(--page-pad-x)', textAlign: 'center',
              color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.6,
              background: 'var(--surface-2)', borderRadius: 12,
            }}>
              재료를 검색하면<br />안전성과 추천 레시피를 함께 보여드려요
            </div>
          </section>
        )}

        <div style={{ height: 8 }} />
      </div>

      <BottomSheet open={!!partsSheet} onClose={() => setPartsSheet(null)}>
        {partsSheet && (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 16 }}>
              {partsSheet.parentName} 권장 부위
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '55vh', overflowY: 'auto' }}>
              {partsSheet.items.map((r) => {
                const alreadySelected = selectedParts[partsSheet.parentName]?.name === r.name
                const isPickFeedback = relatedPickFeedback === r.name
                const showHighlight = alreadySelected || isPickFeedback
                const resolvedPartName = partsSheet.parentName
                  ? (candidateAliasMap[normalizeIngredientKey(partsSheet.parentName + r.name)] ??
                     getFallbackCanonicalRule(normalizeIngredientKey(partsSheet.parentName + r.name))?.representative ??
                     r.name)
                  : r.name
                const itemLevel = getEffectiveLevel(resolvedPartName, profileSafetyMap, ingredientLevelMap)
                const itemNote = getEffectiveNote(resolvedPartName, r.reason, profileSafetyMap, itemLevel)
                return (
                  <li key={r.name}>
                    <button
                      type="button"
                      className="related-ingredient-row"
                      onClick={(e) => pickRelatedIngredient(r.name, e)}
                      aria-label={alreadySelected ? `${r.name} 부위 선택 해제` : `${r.name} 부위 선택`}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        background: showHighlight ? 'var(--primary-soft)' : 'transparent',
                        border: 'none',
                        borderRadius: 8,
                        textAlign: 'left',
                        padding: '10px 8px',
                        cursor: 'pointer',
                        transform: isPickFeedback ? 'scale(1.01)' : 'scale(1)',
                        transition: 'background 0.18s ease, transform 0.18s ease, opacity 0.18s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', width: 14, textAlign: 'center' }}>
                          {showHighlight ? '✓' : ''}
                        </span>
                        <span style={{ fontSize: 14, color: showHighlight ? 'var(--primary)' : 'var(--ink-1)', fontWeight: showHighlight ? 600 : 400 }}>
                          {r.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {itemNote && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{itemNote}</span>}
                        <SafetyBadge level={itemLevel} size="s" />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className="press"
              onClick={() => setPartsSheet(null)}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink-2)',
              }}
            >
              닫기
            </button>
          </>
        )}
      </BottomSheet>

      <BottomSheet open={!!relatedSheet} onClose={closePickerSheets}>
        {relatedSheet && (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 16 }}>
              {relatedSheet.title}
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '55vh', overflowY: 'auto' }}>
              {/* 알러지 부모 재료의 바텀시트에서는 배지 전부 숨김 */}
              {(() => {
                const hideItemBadges = relatedSheet.parentName && isAllergic(relatedSheet.parentName)
                return relatedSheet.items.map((r) => {
                  const alreadySelected = relatedSheet.parentName
                    ? selectedParts[relatedSheet.parentName]?.name === r.name
                    : !!selected.find((x) => x.name === r.name)
                  const isPickFeedback = relatedPickFeedback === r.name
                  const showHighlight = alreadySelected || isPickFeedback
                  // 부위 바텀시트: raw 부위명("등심") 대신 composed canonical("돼지등심")으로 level 조회
                  const resolvedPartName = relatedSheet.parentName
                    ? (candidateAliasMap[normalizeIngredientKey(relatedSheet.parentName + r.name)] ??
                       getFallbackCanonicalRule(normalizeIngredientKey(relatedSheet.parentName + r.name))?.representative ??
                       r.name)
                    : r.name
                  const itemLevel = getEffectiveLevel(resolvedPartName, profileSafetyMap, ingredientLevelMap)
                  const itemNote  = getEffectiveNote(resolvedPartName, r.reason, profileSafetyMap, itemLevel)
                  return (
                    <li key={r.name}>
                      <button
                        type="button"
                        className="related-ingredient-row"
                        onClick={(e) => pickRelatedIngredient(r.name, e)}
                        aria-label={alreadySelected ? `${r.name} 선택 해제` : `${r.name} 선택`}
                        style={{
                          width: '100%',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          gap: 2,
                          background: showHighlight ? 'var(--primary-soft)' : 'transparent',
                          border: 'none',
                          borderRadius: 8,
                          textAlign: 'left',
                          padding: '10px 8px',
                          cursor: 'pointer',
                          transform: isPickFeedback ? 'scale(1.01)' : 'scale(1)',
                          opacity: isPickFeedback ? 1 : undefined,
                          transition: 'background 0.18s ease, transform 0.18s ease, opacity 0.18s ease',
                        }}
                      >
                        {/* 상단: 체크마크 + 재료명 + 배지 */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', width: 14, flexShrink: 0, textAlign: 'center' }}>
                              {showHighlight ? '✓' : ''}
                            </span>
                            <span style={{ fontSize: 14, color: showHighlight ? 'var(--primary)' : 'var(--ink-1)', fontWeight: showHighlight ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.name}
                            </span>
                          </div>
                          {!hideItemBadges && (
                            <div style={{ flexShrink: 0 }}>
                              <SafetyBadge level={itemLevel} size="s" />
                            </div>
                          )}
                        </div>
                        {/* 하단: 설명 문구 (있을 때만) */}
                        {!hideItemBadges && itemNote && (
                          <div style={{ marginLeft: 22, fontSize: 10, color: 'var(--ink-3)', whiteSpace: 'normal', overflowWrap: 'break-word', lineHeight: 1.4 }}>
                            {itemNote}
                          </div>
                        )}
                      </button>
                    </li>
                  )
                })
              })()}
            </ul>
            <button
              type="button"
              className="press"
              onClick={closePickerSheets}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink-2)',
              }}
            >
              닫기
            </button>
          </>
        )}
      </BottomSheet>

      <FloatingChatFAB
        onOpen={() => {
          const topicParam = selected.length > 0
            ? selected.map((s) => {
                const partName = selectedParts[s.name]?.name
                if (!partName) return encodeURIComponent(s.name)
                const composedRaw = normalizeIngredientKey(s.name + partName)
                const composedCanonical = resolveCandidateName(composedRaw) ?? composedRaw
                return encodeURIComponent(composedCanonical)
              }).join(',')
            : null
          navigate(topicParam ? `${ROUTES.chat}?topic=${topicParam}` : ROUTES.chat)
        }}
      />
    </div>
  )
}
