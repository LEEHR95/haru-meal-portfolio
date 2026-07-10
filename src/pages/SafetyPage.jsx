import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { INGREDIENTS, RECIPES, RELATED_INGREDIENTS } from '../data/index.js'
import { useApp, useProfile } from '../store/useApp.js'
import { fetchSafety } from '../api/safety.js'
import { fetchIngredients } from '../api/ingredients.js'
import { API_ENABLED } from '../api/client.js'
import { ROUTES } from '../routes.js'
import SafetyBadge from '../components/SafetyBadge.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import TopBar from '../components/TopBar.jsx'
import Disclaimer from '../components/Disclaimer.jsx'

const LEVEL_DESC = {
  safe:    '급여 가능한 재료예요. 적정량을 지켜서 급여해주세요.',
  caution: '주의가 필요한 재료예요. 소량만 급여하세요.',
  danger:  '급여하면 안 되는 재료예요. 즉시 제거해주세요.',
}

const SUGGEST_POOL = ['닭가슴살', '블루베리', '사과', '치즈', '브로콜리', '연어', '당근', '고구마']

const FALLBACK_DATA = {
  level: 'caution',
  cal: 50,
  note: '아직 데이터베이스에 없는 재료예요. 수의사 상담을 권장해요.',
  servingPerKg: 2,
}

// ─── KPI 블록 ─────────────────────────────────────────────────
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

function pickEffectiveNote({ apiLevel, apiNote, fallbackNote, effectiveLevel }) {
  const normalizedFallback = typeof fallbackNote === 'string' && fallbackNote.trim() !== ''
    ? fallbackNote
    : undefined
  if (apiLevel === 'unknown' && effectiveLevel !== 'unknown') return normalizedFallback
  if (typeof apiNote === 'string' && apiNote.trim() !== '' && (!apiLevel || apiLevel === effectiveLevel || effectiveLevel === 'unknown')) {
    return apiNote
  }
  return normalizedFallback
}

const _normIng = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '')
const _RELATED_META = (() => {
  const map = new Map()
  Object.values(RELATED_INGREDIENTS).forEach((items) => {
    items.forEach((item) => {
      const key = _normIng(item.name)
      if (key && !map.has(key)) map.set(key, item)
    })
  })
  return map
})()

function KPIBlock({ label, value, unit }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 0 4px' }}>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span className="t-kpi">{value}</span>
        <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>{unit}</span>
      </div>
    </div>
  )
}

// ─── 안전성 결과 화면 ─────────────────────────────────────────
export default function SafetyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { dispatch } = useApp()
  const profile = useProfile()
  const { ingredient: raw } = useParams()
  const keyword = decodeURIComponent(raw ?? '당근')
  const parent = location.state?.parent ?? ''
  const preferredName = location.state?.ingredient ?? keyword
  const stateInDb = Boolean(location.state?.inIngredientsDb)
  const stateKcal = location.state?.kcal_per_100g

  const [resolvedName, setResolvedName] = useState(null)
  const [pickList, setPickList] = useState(null)
  const [apiResult, setApiResult] = useState(null)
  const [apiIngredient, setApiIngredient] = useState(null)
  const [ingKcal, setIngKcal] = useState(null)
  const [loading, setLoading] = useState(true)

  const displayName = resolvedName ?? preferredName

  const loadSafety = useCallback(async (fullName, kcalFromIng) => {
    const safetyRes = await fetchSafety(fullName, profile || {})
    if (safetyRes) setApiResult(safetyRes)
    if (kcalFromIng != null) setIngKcal(kcalFromIng)
  }, [profile])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPickList(null)
    setResolvedName(null)
    setApiResult(null)
    setApiIngredient(null)
    setIngKcal(null)

    const run = async () => {
      if (API_ENABLED) {
        const res = await fetchIngredients({
          keyword: preferredName,
          parent: parent || undefined,
          lite: true,
        })
        if (cancelled) return

        const items = res?.items ?? []
        const exact = items.find((i) => i.name === preferredName)

        if (exact) {
          setResolvedName(exact.name)
          setApiIngredient(exact)
          await loadSafety(exact.name, exact.kcal_per_100g)
        } else if (items.length > 1) {
          setPickList(items)
        } else if (items.length === 1) {
          const full = items[0].name
          setResolvedName(full)
          setApiIngredient(items[0])
          await loadSafety(full, items[0].kcal_per_100g)
        } else if (stateInDb) {
          setResolvedName(preferredName)
          await loadSafety(preferredName, stateKcal ?? undefined)
        } else {
          setResolvedName(preferredName)
          await loadSafety(preferredName)
        }
      } else {
        setResolvedName(preferredName)
        await loadSafety(preferredName)
      }
      if (!cancelled) setLoading(false)
    }

    run()
    return () => { cancelled = true }
  }, [preferredName, parent, loadSafety, stateInDb, stateKcal])

  const handlePick = (item) => {
    setPickList(null)
    navigate(ROUTES.safety(item.name), {
      replace: true,
      state: {
        ingredient: item.name,
        parent: parent || undefined,
        kcal_per_100g: item.kcal_per_100g ?? null,
        inIngredientsDb: true,
      },
    })
  }

  const mockInfo = INGREDIENTS[displayName]
  const relatedMeta = mockInfo ? null : _RELATED_META.get(_normIng(displayName))
  const knownInDb = Boolean(apiIngredient || stateInDb || mockInfo || relatedMeta)
  const cal = ingKcal ?? stateKcal ?? apiIngredient?.kcal_per_100g ?? mockInfo?.cal
    ?? (knownInDb ? null : FALLBACK_DATA.cal)
  const effectiveLevel = pickKnownLevel(
    apiResult?.level,
    apiIngredient?.level,
  ) ?? 'unknown'
  const data = {
    ...(knownInDb && !mockInfo ? {} : (mockInfo ?? FALLBACK_DATA)),
    cal,
    level: effectiveLevel,
    note: pickEffectiveNote({
      apiLevel: apiResult?.level,
      apiNote: apiResult?.reasons?.[0],
      fallbackNote: mockInfo?.note ?? relatedMeta?.reason ?? (knownInDb ? undefined : FALLBACK_DATA.note),
      effectiveLevel,
    }),
  }
  LEVEL_DESC.unknown ??= '아직 안전성 정보를 확인하지 못한 재료예요. 급여 전 재료 정보를 다시 확인해주세요.'
  const desc = LEVEL_DESC[data.level] ?? LEVEL_DESC.unknown

  const isAllergic = profile?.allergies?.some(
    (a) => displayName.includes(a) || a.includes(displayName),
  ) ?? false
  const isAllergyCaution = Boolean(
    apiResult?.level === 'caution' && apiResult?.reasons?.some((reason) => String(reason || '').includes('알러지'))
  ) || isAllergic

  const { grams, kcal } = useMemo(() => {
    if (!profile || data.level === 'danger' || data.level === 'unknown' || isAllergyCaution || !data.cal) {
      return { grams: null, kcal: null }
    }
    const w = profile.weight ?? 5
    const rer = w * 30 + 70
    const mer = rer * (profile.activityFactor ?? 1.6)
    const snackAllowance = mer * 0.1
    const g = Math.round(snackAllowance / (data.cal / 100))
    const k = Math.round((g / 100) * data.cal)
    return { grams: g, kcal: k }
  }, [profile, data, isAllergyCaution])

  const related = useMemo(
    () => RECIPES.filter((r) =>
      r.ingredients.some((i) => i.name === displayName || i.name.includes(keyword)),
    ).slice(0, 4),
    [displayName, keyword],
  )

  const suggestions = SUGGEST_POOL.filter((n) => n !== keyword && n !== displayName).slice(0, 5)

  const handleCTA = () => {
    if (!profile) navigate(ROUTES.profile)
    else navigate(ROUTES.chat)
  }

  const handleSuggest = (name) => {
    dispatch({ type: 'addSearch', value: name })
    navigate(ROUTES.safety(name), { replace: true, state: { ingredient: name } })
  }

  if (loading && !pickList) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
        <TopBar onBack={() => navigate(-1)} title="" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--ink-3)' }}>
          불러오는 중...
        </div>
      </div>
    )
  }

  if (pickList) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
        <TopBar onBack={() => navigate(-1)} title="" />
        <div className="app-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 24px' }}>
          <h1 className="t-headline-s" style={{ margin: '0 0 8px', fontSize: 20 }}>어떤 재료인가요?</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5 }}>
            「{preferredName}」와(과) 일치하는 재료가 여러 개예요. 선택해주세요.
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pickList.map((item) => (
              <li key={item.name}>
                <button
                  type="button"
                  className="press"
                  onClick={() => handlePick(item)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14, color: 'var(--ink-1)', lineHeight: 1.4 }}>{item.name}</span>
                  <SafetyBadge level={item.level} size="s" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <TopBar onBack={() => navigate(-1)} title="" />

      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <section style={{ padding: '4px 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <h1 className="t-headline-l" style={{ margin: 0 }}>{displayName}</h1>
            <SafetyBadge level={data.level} />
            {isAllergic && (
              <span style={{
                background: 'var(--danger-bg)',
                color: 'var(--danger-fg)',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 20,
              }}>
                알러지
              </span>
            )}
          </div>
          <p className="t-body" style={{ margin: 0, color: 'var(--ink-2)' }}>{desc}</p>
          {isAllergic && (
            <p className="t-body-s" style={{ margin: '8px 0 0', color: 'var(--danger-fg)', fontWeight: 500 }}>
              알러지 등록 재료예요. 급여 전 주의하세요.
            </p>
          )}
          {data.note && (
            <p className="t-body-s" style={{ margin: '10px 0 0', color: 'var(--ink-3)' }}>
              {data.note}
            </p>
          )}
        </section>

        <section style={{ padding: '0 20px 20px' }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            {(data.level === 'danger' || data.level === 'unknown' || isAllergyCaution) ? (
              <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 14, color: 'var(--danger-fg)', fontWeight: 600 }}>
                  급여를 권장하지 않아요
                </div>
                <div className="t-body-s" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
                  안전한 대체 재료가 필요하다면 급여 상담에서 확인해보세요.
                </div>
              </div>
            ) : profile ? (
              <>
                <div style={{ display: 'flex' }}>
                  <KPIBlock label="권장 급여량" value={grams} unit="g" />
                  <div style={{ width: 1, background: 'var(--divider)', margin: '4px 0' }} />
                  <KPIBlock label="예상 칼로리" value={kcal} unit="kcal" />
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', marginTop: 4, marginBottom: 14 }}>
                  {profile.name}({profile.weight}kg) 기준 · MER × 10% 간식 허용량
                </div>
              </>
            ) : (
              <div style={{ padding: '8px 4px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.5 }}>
                  프로필을 설정하면<br />급여량을 계산해드려요
                </div>
              </div>
            )}
            <button
              type="button"
              className="press"
              onClick={handleCTA}
              style={{
                width: '100%',
                background: 'var(--primary)', color: '#fff',
                borderRadius: 8, padding: 12,
                fontSize: 14, fontWeight: 600,
              }}
            >
              {profile ? '더 알아보기' : '프로필 설정하기'}
            </button>
          </div>
        </section>

        {related.length > 0 && (
          <section style={{ padding: '8px 0 24px' }}>
            <div className="t-subtitle" style={{ padding: '0 20px 12px', fontWeight: 600 }}>
              {displayName}가 들어간 레시피
            </div>
            <div className="h-scroll" style={{ display: 'flex', gap: 12, padding: '0 20px 4px' }}>
              {related.map((r) => (
                <RecipeCard
                  key={r.id}
                  recipe={r}
                  layout="mini"
                  onClick={() => navigate(ROUTES.detail(r.id))}
                />
              ))}
            </div>
          </section>
        )}

        <section style={{ padding: '0 20px 16px' }}>
          <div className="t-subtitle-s" style={{ color: 'var(--ink-2)', marginBottom: 10 }}>
            다른 재료도 확인해보세요
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map((n) => (
              <button
                key={n}
                type="button"
                className="press"
                onClick={() => handleSuggest(n)}
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 20,
                  padding: '7px 14px',
                  fontSize: 12,
                  color: 'var(--ink-2)',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        <Disclaimer />
      </div>
    </div>
  )
}
