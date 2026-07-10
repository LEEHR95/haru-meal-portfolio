import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BottomSheet from '../components/BottomSheet.jsx'
import DateTimePickerField, { toDateValue, isoToDateValue, dateValueToISO } from '../components/DateTimePickerField.jsx'
import { useActivePetId, useActivePet, useToast } from '../store/useApp.js'
import { ROUTES } from '../routes.js'
import { getLogs, saveLog, deleteLog, updateLog, FEEDING_TYPE_OPTIONS, FEEDING_TYPE_LABEL, getFeedingTypeLabel, legacyToFeedingType } from '../utils/dietLog.js'
import { fetchDietLogAnalysis } from '../api/dietLog.js'

const ANALYSIS_MIN_LOGS = 5
// 요약 카드는 리스트(전체 기록)와 같은 데이터를 봐야 한다.
// backend analyze()의 기본 window_days=30은 과거 기록을 제외해 카드를 비우므로
// backend 허용 최대치(365)를 넘겨 사실상 전체 기록을 집계한다.
const ANALYSIS_WINDOW_DAYS = 365
const FEEDING_TYPE_ORDER = ['meal', 'topping', 'snack', 'other']

const REACTIONS = ['잘 먹음', '보통', '안 먹음', '민감 반응']
const STOOL_STATUS_OPTIONS = ['정상', '무른 변', '설사', '변비', '기타']

const REACTION_COLOR = {
  '잘 먹음': 'var(--safe)',
  '보통': 'var(--ink-2)',
  '안 먹음': 'var(--ink-3)',
  '민감 반응': 'var(--caution)',
}

const STOOL_STATUS_COLOR = {
  '정상': 'var(--safe)',
  '무른 변': 'var(--caution)',
  '설사': 'var(--danger, #D85A30)',
  '변비': 'var(--primary)',
  '기타': 'var(--ink-2)',
}

const REACTION_EMOJI = {
  '잘 먹음': '😍',
  '보통': '🙂',
  '안 먹음': '😕',
  '민감 반응': '⚠️',
}

function normalizePrefillReaction(value) {
  return REACTIONS.includes(value) ? value : ''
}

function normalizeStoolNote(value) {
  return String(value || '').trim()
}

function formatStoolStatusLabel(status, note) {
  const normalizedStatus = String(status || '').trim()
  const normalizedNote = normalizeStoolNote(note)
  if (!normalizedStatus) return ''
  if (normalizedStatus === '기타' && normalizedNote) return `${normalizedStatus} (${normalizedNote})`
  return normalizedStatus
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatLogDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}


const CONTAINER = {
  // 다른 페이지(.page-container)와 동일한 콘텐츠 폭(PC 1024px 중앙정렬)으로 통일.
  // 기존엔 --app-max-width(1200px)라 식생활 기록만 더 넓었음.
  maxWidth: 1024,
  margin: '0 auto',
  padding: '0 16px',
}

const CARD = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '14px 16px',
  marginBottom: 10,
}

const INPUT = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 14,
  color: 'var(--ink-1)',
  boxSizing: 'border-box',
}

const LABEL = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--ink-2)',
  marginBottom: 6,
}

// 기록 부족 안내 (1~4건)
function InsufficientAnalysisCard() {
  return (
    <div style={{ ...CARD, background: 'var(--surface-2)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>
        📊 식생활 요약
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>
        아직 패턴을 보기엔 기록이 조금 부족해요. 5번 이상 기록하면 급여 유형과 반응 흐름을 정리해드릴게요.
      </p>
    </div>
  )
}

// 분석 요약 카드 — backend analyze() 결과만 표시 (frontend는 규칙 계산 안 함, label 변환만)
function AnalysisSummaryCard({ analysis }) {
  const counts = analysis.feedingType_counts || {}
  const total = FEEDING_TYPE_ORDER.reduce((sum, k) => sum + (counts[k] || 0), 0)
  if (total === 0) return null

  const snackPct = Math.round((analysis.snack_ratio || 0) * 100)
  const snackAlert = !!analysis.snack_alert
  const mealIngredients = Array.isArray(analysis.recent_meal_ingredients) ? analysis.recent_meal_ingredients : []
  // 민감 반응 재료는 '해당 기록의 전체 재료'가 아니라 memo/stoolNote에서 직접
  // 의심으로 지목된 재료(backend suspect_ingredients)만 표시한다.
  // 원인 미확정(언급 없음) 기록은 아무 재료도 더하지 않아 폭증을 막는다.
  const sensitiveIngredients = Array.from(new Set(
    (analysis.sensitive_events || []).flatMap((e) => e.suspect_ingredients || [])
  ))
  const stoolDist = analysis.stool_distribution || {}
  const stoolEntries = Object.entries(stoolDist).filter(([, n]) => n > 0)

  // V1 고도화 — 신규 additive 필드 (계산은 backend, 여기선 표시만)
  const frequent = Array.isArray(analysis.frequent_ingredients) ? analysis.frequent_ingredients : []
  const positive = Array.isArray(analysis.positive_ingredients) ? analysis.positive_ingredients : []
  const toppingIngredients = Array.isArray(analysis.recent_topping_ingredients) ? analysis.recent_topping_ingredients : []
  const weight = analysis.weight_trend || {}
  const lastFeeding = analysis.last_feeding_summary || null
  const regularity = analysis.diet_regularity || {}
  const feedings7 = regularity.feedings_last_7
  const feedings30 = regularity.feedings_last_30

  // V1 P0 UI 노출 — backend 값만 표시(계산 없음). 없으면 숨김.
  const win7 = analysis.window_summaries?.last_7 || null
  const showWin7 = !!win7 && Number(win7.feedings) > 0
  const diversity = analysis.diet_diversity || null
  const showDiversity = !!diversity && Number(diversity.unique_ingredients) > 0
  const diversitySkewed = !!diversity
    && Number(diversity.total_entries) >= 4
    && Number(diversity.top_ingredient_share) >= 0.5

  const WEIGHT_DIRECTION_LABEL = { increase: '증가', decrease: '감소', stable: '유지' }
  const showWeight = weight.direction && Number(weight.samples) >= 2
  const weightDelta = typeof weight.delta_kg === 'number' ? weight.delta_kg : null

  const sectionTitle = { fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }
  const chip = {
    fontSize: 11, fontWeight: 500, color: 'var(--ink-2)',
    background: 'var(--surface-2)', borderRadius: 6, padding: '3px 8px',
  }
  const chipRow = { display: 'flex', flexWrap: 'wrap', gap: 6 }

  return (
    <div style={{ ...CARD, padding: '16px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 14 }}>
        📊 식생활 요약 <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-3)' }}>(최근 {total}건)</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 급여 유형 분포 */}
        <div>
          <div style={sectionTitle}>급여 유형 분포</div>
          <div style={chipRow}>
            {FEEDING_TYPE_ORDER.filter((k) => (counts[k] || 0) > 0).map((k) => (
              <span key={k} style={chip}>{FEEDING_TYPE_LABEL[k] ?? k} {counts[k]}건</span>
            ))}
          </div>
        </div>

        {/* 간식 비중 */}
        <div>
          <div style={sectionTitle}>간식 비중</div>
          <div style={{ fontSize: 13, color: snackAlert ? 'var(--caution)' : 'var(--ink-2)', fontWeight: snackAlert ? 700 : 500 }}>
            {snackPct}%
          </div>
          {snackAlert && (
            <p style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6, margin: '6px 0 0' }}>
              간식 비중이 높게 기록되어 있어요. 의학적 경고가 아니라 기록 기반 행동 패턴 관찰이에요.
            </p>
          )}
        </div>

        {/* 최근 7일 / 30일 급여 횟수 */}
        {(typeof feedings7 === 'number' || typeof feedings30 === 'number') && (
          <div>
            <div style={sectionTitle}>급여 횟수</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              최근 7일 {feedings7 ?? 0}회 · 최근 30일 {feedings30 ?? 0}회
            </div>
          </div>
        )}

        {/* 최근 7일 요약 (window_summaries.last_7 — backend 값만 표시) */}
        {showWin7 && (
          <div>
            <div style={sectionTitle}>최근 7일 요약</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              급여 {win7.feedings}회 · 기록된 날 {win7.active_days}일 · 민감 반응 {win7.sensitive_count}회
            </div>
          </div>
        )}

        {/* 자주 먹인 재료 TOP5 */}
        {frequent.length > 0 && (
          <div>
            <div style={sectionTitle}>자주 먹인 재료 TOP5</div>
            <div style={chipRow}>
              {frequent.map((it, i) => (
                <span key={`${it.name}-${i}`} style={chip}>{it.name} {it.count}회</span>
              ))}
            </div>
          </div>
        )}

        {/* 재료 다양성 (diet_diversity — backend 값만 표시, 관찰 톤) */}
        {showDiversity && (
          <div>
            <div style={sectionTitle}>재료 다양성</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              최근 기록 기준 재료 {diversity.unique_ingredients}종
            </div>
            {diversitySkewed && (
              <p style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6, margin: '6px 0 0' }}>
                최근 기록이 한 재료에 조금 치우쳐 있어요. 기록 기반 관찰이에요.
              </p>
            )}
          </div>
        )}

        {/* 긍정 반응 재료 */}
        {positive.length > 0 && (
          <div>
            <div style={sectionTitle}>긍정 반응 재료</div>
            <div style={chipRow}>
              {positive.map((it, i) => (
                <span key={`${it.name}-${i}`} style={{ ...chip, color: 'var(--safe)' }}>👍 {it.name}</span>
              ))}
            </div>
          </div>
        )}

        {/* 최근 주식 재료 */}
        {mealIngredients.length > 0 && (
          <div>
            <div style={sectionTitle}>최근 주식 재료</div>
            <div style={chipRow}>
              {mealIngredients.map((ing, i) => (
                <span key={`${ing}-${i}`} style={chip}>{ing}</span>
              ))}
            </div>
          </div>
        )}

        {/* 토핑 재료 */}
        {toppingIngredients.length > 0 && (
          <div>
            <div style={sectionTitle}>토핑 재료</div>
            <div style={chipRow}>
              {toppingIngredients.map((ing, i) => (
                <span key={`${ing}-${i}`} style={chip}>{ing}</span>
              ))}
            </div>
          </div>
        )}

        {/* 민감 반응 재료 */}
        {sensitiveIngredients.length > 0 && (
          <div>
            <div style={sectionTitle}>민감 반응 재료</div>
            <div style={chipRow}>
              {sensitiveIngredients.map((ing, i) => (
                <span key={`${ing}-${i}`} style={{ ...chip, color: 'var(--caution)' }}>⚠️ {ing}</span>
              ))}
            </div>
          </div>
        )}

        {/* 체중 추세 */}
        {showWeight && (
          <div>
            <div style={sectionTitle}>체중 추세</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              {weight.first_kg}kg → {weight.latest_kg}kg
              {weightDelta !== null && ` (${weightDelta > 0 ? '+' : ''}${weightDelta}kg, ${WEIGHT_DIRECTION_LABEL[weight.direction] ?? ''})`}
            </div>
          </div>
        )}

        {/* 변 상태 분포 */}
        {stoolEntries.length > 0 && (
          <div>
            <div style={sectionTitle}>변 상태 분포</div>
            <div style={chipRow}>
              {stoolEntries.map(([status, n]) => (
                <span key={status} style={chip}>💩 {status} {n}건</span>
              ))}
            </div>
          </div>
        )}

        {/* 마지막 급여 */}
        {lastFeeding && (lastFeeding.ingredients?.length > 0 || lastFeeding.fedAt) && (
          <div>
            <div style={sectionTitle}>마지막 급여</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              {[
                lastFeeding.fedAt,
                FEEDING_TYPE_LABEL[lastFeeding.feedingType] ?? lastFeeding.feedingType,
                (lastFeeding.ingredients || []).join(', '),
                lastFeeding.reaction,
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DietLogPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const activePetId = useActivePetId()
  const activePet = useActivePet()
  const { show: showToast } = useToast()

  const [logs, setLogs] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(() => !!(location.state?.prefill))
  const [editingLog, setEditingLog] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)

  const [ingredientsText, setIngredientsText] = useState('')
  const [reaction, setReaction] = useState('')
  const [fedAt, setFedAt] = useState(() => toDateValue(new Date()))
  const [feedingType, setFeedingType] = useState('meal')
  const [weightKg, setWeightKg] = useState('')
  const [stoolStatus, setStoolStatus] = useState('')
  const [stoolNote, setStoolNote] = useState('')
  const [memo, setMemo] = useState('')

  // 레시피 상세 → 급여 기록하기 / 반응 기록 CTA 경유 시 prefill 처리
  // useRef로 마운트 시점의 state를 캡처해 효과 재실행 방지
  const prefillRef = useRef(location.state?.prefill ?? null)

  // ⋮ 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!openMenuId) return
    const close = () => setOpenMenuId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openMenuId])

  const reload = useCallback(() => {
    setLogs(getLogs(activePetId).sort((a, b) => new Date(b.fedAt) - new Date(a.fedAt)))
  }, [activePetId])

  useEffect(() => {
    reload()
  }, [reload])

  // 분석 요약 — 기록 5건 이상일 때만 backend API 호출 (규칙은 backend single source)
  useEffect(() => {
    if (!activePetId || logs.length < ANALYSIS_MIN_LOGS) {
      setAnalysis(null)
      return
    }
    let cancelled = false
    fetchDietLogAnalysis({ dogId: activePetId, logs, windowDays: ANALYSIS_WINDOW_DAYS })
      .then((res) => { if (!cancelled) setAnalysis(res || null) })
      .catch(() => { if (!cancelled) setAnalysis(null) })
    return () => { cancelled = true }
  }, [activePetId, logs])

  useEffect(() => {
    const prefill = prefillRef.current
    if (!prefill) return
    prefillRef.current = null
    setEditingLog(null)
    setIngredientsText(Array.isArray(prefill.ingredients) ? prefill.ingredients.join(', ') : '')
    setReaction(normalizePrefillReaction(prefill.reaction))
    setFedAt(toDateValue(new Date()))
    setFeedingType('meal')
    setWeightKg('')
    setStoolStatus('')
    setStoolNote('')
    setMemo('')
    setSheetOpen(true)
    // 뒤로가기/재진입 시 반복 오픈 방지 — 현재 엔트리의 location.state만 비운다
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, navigate])

  function openNewSheet() {
    setEditingLog(null)
    setIngredientsText('')
    setReaction('')
    setFedAt(toDateValue(new Date()))
    setFeedingType('meal')
    setWeightKg('')
    setStoolStatus('')
    setStoolNote('')
    setMemo('')
    setSheetOpen(true)
  }

  function openEditSheet(log) {
    setEditingLog(log)
    setIngredientsText(Array.isArray(log.ingredients) ? log.ingredients.join(', ') : '')
    setReaction(log.reaction || '')
    setFedAt(isoToDateValue(log.fedAt))
    setFeedingType(log.feedingType || legacyToFeedingType(log.mealTime))
    setWeightKg(log.weightKg != null ? String(log.weightKg) : '')
    setStoolStatus(typeof log.stoolStatus === 'string' ? log.stoolStatus : '')
    setStoolNote(typeof log.stoolNote === 'string' ? log.stoolNote : '')
    setMemo(log.memo || '')
    setSheetOpen(true)
  }

  function handleSave() {
    if (!activePetId) {
      showToast('프로필을 먼저 등록해 주세요.')
      return
    }
    const parsed = ingredientsText.split(',').map((item) => item.trim()).filter(Boolean)
    if (parsed.length === 0) {
      showToast('재료를 1개 이상 입력해 주세요.')
      return
    }
    if (!reaction) {
      showToast('반응을 선택해 주세요.')
      return
    }

    const parsedWeight = weightKg.trim() !== '' ? parseFloat(weightKg) : null
    if (parsedWeight !== null && Number.isNaN(parsedWeight)) {
      showToast('체중은 숫자로 입력해 주세요.')
      return
    }

    const normalizedStoolStatus = stoolStatus || null
    const normalizedStoolNote = stoolStatus === '기타' ? normalizeStoolNote(stoolNote) : ''
    const normalizedMemo = memo.trim()
    const nextFedAt = dateValueToISO(fedAt)

    if (editingLog) {
      const updated = updateLog({
        ...editingLog,
        ingredients: parsed,
        reaction,
        weightKg: parsedWeight,
        stoolStatus: normalizedStoolStatus,
        stoolNote: normalizedStoolNote,
        memo: normalizedMemo,
        fedAt: nextFedAt,
        feedingType,
      })
      if (!updated) {
        showToast('저장에 실패했어요. 잠시 후 다시 시도해주세요.')
        return
      }
      setSheetOpen(false)
      reload()
      showToast('기록이 수정되었어요.')
      return
    }

    const now = new Date().toISOString()
    const saved = saveLog({
      id: crypto.randomUUID(),
      dogId: activePetId,
      ingredients: parsed,
      reaction,
      amountG: null,
      weightKg: parsedWeight,
      stoolStatus: normalizedStoolStatus,
      stoolNote: normalizedStoolNote,
      photoUrl: null,
      memo: normalizedMemo,
      fedAt: nextFedAt,
      feedingType,
      createdAt: now,
    })
    if (!saved) {
      showToast('저장에 실패했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    setSheetOpen(false)
    reload()
    showToast('기록이 저장되었어요.')
  }

  function handleDelete(id) {
    if (!window.confirm('이 기록을 삭제할까요?')) return
    const deleted = deleteLog(id)
    if (!deleted) {
      showToast('삭제에 실패했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    reload()
    showToast('기록이 삭제되었어요.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 명시적 높이 체인(height:100% → flex:1 scroll)으로 .app-main flex 컬럼
          메인축 높이 reflow 의존 제거 — 초기 진입 시 목록이 바로 표시되도록 함 */}
      <div className="app-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 80 }}>
      <div style={{ ...CONTAINER, paddingTop: 20, paddingBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)', margin: 0 }}>
          {activePet?.name ? `${activePet.name}의 식생활 기록` : '식생활 기록'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '4px 0 0' }}>급여와 반응을 기록해요</p>
      </div>

      {!activePetId && (
        <div style={{ ...CONTAINER, paddingTop: 48, textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: 'var(--surface-2)',
              margin: '0 auto 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 22 }}>🐾</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 16 }}>
            프로필을 먼저 등록해 주세요.
          </p>
          <button
            type="button"
            className="press"
            onClick={() => navigate(ROUTES.profile)}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            프로필 등록하기
          </button>
        </div>
      )}

      {activePetId && logs.length > 0 && (
        <div style={{ ...CONTAINER, paddingTop: 16 }}>
          {logs.length < ANALYSIS_MIN_LOGS
            ? <InsufficientAnalysisCard />
            : analysis && <AnalysisSummaryCard analysis={analysis} />}
        </div>
      )}

      {activePetId && (
        <div style={{ ...CONTAINER, paddingTop: 16 }}>
          {logs.length === 0 ? (
            <div style={{ paddingTop: 40, textAlign: 'center' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  background: 'var(--surface-2)',
                  margin: '0 auto 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img src="/icons/meal-log.png" alt="" width={26} height={26} style={{ objectFit: 'contain' }} />
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 4 }}>아직 기록이 없어요.</p>
              <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>아래 버튼을 눌러 첫 기록을 남겨보세요.</p>
            </div>
          ) : (() => {
            // 날짜별 그룹 (logs는 이미 fedAt 내림차순 정렬 상태)
            const groups = []
            for (const log of logs) {
              const d = formatLogDate(log.fedAt)
              const last = groups[groups.length - 1]
              if (last && last.date === d) last.items.push(log)
              else groups.push({ date: d, items: [log] })
            }
            return groups.map(({ date, items }) => (
              <div key={date}>
                {/* 날짜 그룹 헤더 */}
                <div style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--ink-3)',
                  paddingTop: 12, paddingBottom: 6,
                  borderBottom: '1px solid var(--border)', marginBottom: 8,
                }}>
                  {date}
                </div>
                {/* 해당 날짜 카드들 */}
                {items.map((log) => (
                  <div key={log.id} style={CARD}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      {/* 카드 본문 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* 급여 유형 · 체중 */}
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>
                          {getFeedingTypeLabel(log) ?? '기타'}
                          {log.weightKg != null && (
                            <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 4 }}>
                              · 체중 {log.weightKg}kg
                            </span>
                          )}
                        </div>
                        {/* 재료칩 */}
                        {(Array.isArray(log.ingredients) ? log.ingredients : []).length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {(Array.isArray(log.ingredients) ? log.ingredients : []).map((ing, i) => (
                              <span key={`${ing}-${i}`} style={{
                                fontSize: 11, fontWeight: 500, color: 'var(--ink-2)',
                                background: 'var(--surface-2)', borderRadius: 6, padding: '2px 6px',
                              }}>
                                {ing}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* 반응 */}
                        {log.reaction && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: REACTION_COLOR[log.reaction] ?? 'var(--ink-2)', marginBottom: 4 }}>
                            {REACTION_EMOJI[log.reaction] ?? ''} {log.reaction}
                          </div>
                        )}
                        {/* 변 상태 — 배경 없이 텍스트만 */}
                        {typeof log.stoolStatus === 'string' && log.stoolStatus.trim() !== '' && (
                          <div style={{ fontSize: 12, color: STOOL_STATUS_COLOR[log.stoolStatus] ?? 'var(--ink-2)', marginBottom: 4 }}>
                            💩 변 상태: {formatStoolStatusLabel(log.stoolStatus, log.stoolNote)}
                          </div>
                        )}
                        {/* 메모 — 인용구 스타일 */}
                        {log.memo ? (
                          <div style={{
                            marginTop: 8, paddingLeft: 10,
                            borderLeft: '2px solid var(--border)',
                            fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6,
                          }}>
                            {log.memo}
                          </div>
                        ) : null}
                      </div>
                      {/* ⋮ 더보기 메뉴 */}
                      <div
                        style={{ position: 'relative', flexShrink: 0 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label="더보기"
                          onClick={() => setOpenMenuId(openMenuId === log.id ? null : log.id)}
                          style={{
                            width: 32, height: 32,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 16, color: 'var(--ink-3)', borderRadius: 6,
                            letterSpacing: 1,
                          }}
                        >
                          ⋮
                        </button>
                        {openMenuId === log.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: 34, zIndex: 50,
                            background: '#FFFFFF', borderRadius: 10,
                            border: '1px solid var(--border)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                            overflow: 'hidden', minWidth: 80,
                          }}>
                            <button
                              type="button"
                              className="press"
                              onClick={() => { openEditSheet(log); setOpenMenuId(null) }}
                              style={{
                                display: 'block', width: '100%', padding: '11px 16px',
                                textAlign: 'left', background: 'none',
                                border: 'none', borderBottom: '1px solid var(--border)',
                                cursor: 'pointer', fontSize: 13, color: 'var(--ink-1)',
                              }}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className="press"
                              onClick={() => { handleDelete(log.id); setOpenMenuId(null) }}
                              style={{
                                display: 'block', width: '100%', padding: '11px 16px',
                                textAlign: 'left', background: 'none', border: 'none',
                                cursor: 'pointer', fontSize: 13, color: 'var(--danger, #D85A30)',
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          })()
          }
        </div>
      )}
      </div>

      {activePetId && (
        <button
          type="button"
          className="press"
          onClick={openNewSheet}
          aria-label="새 기록 작성"
          style={{
            position: 'fixed',
            bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
            right: 20,
            width: 52,
            height: 52,
            borderRadius: 999,
            background: 'var(--primary)',
            border: 'none',
            color: '#fff',
            fontSize: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            zIndex: 90,
          }}
        >
          +
        </button>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} panelClassName="diet-log-sheet">
        <div className="diet-log-form-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-1)', margin: 0 }}>
            {editingLog ? '기록 수정' : '새 기록'}
          </p>
          <button
            type="button"
            className="press"
            aria-label="닫기"
            onClick={() => setSheetOpen(false)}
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
          <label style={LABEL}>재료 <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(쉼표로 구분)</span></label>
          <input
            type="text"
            style={INPUT}
            placeholder="예: 오리안심, 단호박, 브로콜리"
            value={ingredientsText}
            onChange={(event) => setIngredientsText(event.target.value)}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>반응</label>
          <div className="diet-log-reaction-grid">
            {REACTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className="press"
                onClick={() => setReaction(item)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  border: reaction === item ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: reaction === item ? 'color-mix(in srgb, var(--primary) 10%, white)' : 'var(--surface)',
                  fontSize: 13,
                  fontWeight: reaction === item ? 700 : 500,
                  color: reaction === item ? 'var(--primary)' : 'var(--ink-2)',
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
          <label style={LABEL}>날짜</label>
          <DateTimePickerField value={fedAt} onChange={setFedAt} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>급여 유형</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {FEEDING_TYPE_OPTIONS.map(({ value: v, label }) => (
              <button
                key={v}
                type="button"
                className="press"
                onClick={() => setFeedingType(v)}
                style={{
                  padding: '10px 4px',
                  borderRadius: 10,
                  border: feedingType === v ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: feedingType === v ? 'color-mix(in srgb, var(--primary) 10%, white)' : 'var(--surface)',
                  fontSize: 13,
                  fontWeight: feedingType === v ? 700 : 500,
                  color: feedingType === v ? 'var(--primary)' : 'var(--ink-2)',
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
          <label style={LABEL}>체중 <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(선택, kg)</span></label>
          <input
            type="number"
            inputMode="decimal"
            style={INPUT}
            placeholder="예: 5.2"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            min="0"
            step="0.1"
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>변 상태 <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(선택)</span></label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STOOL_STATUS_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className="press"
                onClick={() => {
                  setStoolStatus((current) => {
                    const nextStatus = current === item ? '' : item
                    if (nextStatus !== '기타') setStoolNote('')
                    return nextStatus
                  })
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: stoolStatus === item ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: stoolStatus === item ? 'color-mix(in srgb, var(--primary) 12%, white)' : 'var(--surface)',
                  fontSize: 13,
                  fontWeight: stoolStatus === item ? 700 : 400,
                  color: stoolStatus === item ? 'var(--primary)' : 'var(--ink-2)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {stoolStatus === '기타' && (
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL}>변 상태 세부 내용 <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(선택)</span></label>
            <input
              type="text"
              style={INPUT}
              placeholder="점액변, 혈변 등 자세한 내용을 입력해 주세요."
              value={stoolNote}
              onChange={(event) => setStoolNote(event.target.value)}
            />
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={LABEL}>메모 <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(선택)</span></label>
          <textarea
            style={{ ...INPUT, minHeight: 60, resize: 'vertical' }}
            placeholder="급여 후 특이사항을 적어보세요."
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </div>

        <button
          type="button"
          className="press"
          onClick={handleSave}
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
          {editingLog ? '수정 저장' : '기록 저장'}
        </button>
        </div>
      </BottomSheet>
    </div>
  )
}
