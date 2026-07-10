import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HEALTH_CONDITIONS, TREAT_TYPES } from '../data/index.js'
import BREED_OPTIONS from '../data/breed_options.json'
import { getBreedIcon } from '../constants/breedIcons.js'
import { useActivePetId, useApp, useIsLoggedIn, usePets, useToast, useUser } from '../store/useApp.js'
import { LS_PENDING_PROFILE, generatePetId } from '../store/initialState.js'
import { ROUTES } from '../routes.js'
import { validateWeight } from '../utils/validate.js'
import BottomSheet from '../components/BottomSheet.jsx'
import { IconBack, IconClose } from '../components/icons/index.jsx'
import {
  saveProfile as apiSaveProfile,
  resolveProfileSessionId,
} from '../api/profile.js'
import { API_ENABLED } from '../api/client.js'
import { signInWithGoogle } from '../lib/auth.js'
import { getAnonymousSessionId } from '../lib/session.js'

// ─── 공통 input 스타일 ─────────────────────────────────────────
const P_INPUT = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 12,
  fontSize: 14,
  color: 'var(--ink-1)',
  boxSizing: 'border-box',
}

// ─── 폼 필드 ─────────────────────────────────────────────────
function ProfField({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-1)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{hint}</div>}
      </div>
      {children}
    </div>
  )
}

// ─── 세그먼트 라디오 ──────────────────────────────────────────
function SegRadio({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={String(o.value)}
            type="button"
            className="press"
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--primary)' : 'var(--ink-3)',
              borderRadius: 6, padding: '8px 0',
              fontSize: 13, fontWeight: active ? 600 : 500,
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── 칩 태그 입력 ─────────────────────────────────────────────
function ChipsInput({ value, setValue, onSubmit, chips, onRemove, chipBg, chipFg, placeholder }) {
  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      onSubmit()
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        onKeyUp={handleKey}
        enterKeyHint="done"
        placeholder={placeholder}
        style={P_INPUT}
      />
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((c) => (
            <div
              key={c}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: chipBg, color: chipFg,
                padding: '4px 6px 4px 12px',
                borderRadius: 20, fontSize: 12, fontWeight: 500,
              }}
            >
              {c}
              <button
                type="button"
                className="press"
                onClick={() => onRemove(c)}
                aria-label={`${c} 삭제`}
                style={{
                  width: 18, height: 18, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: chipFg,
                }}
              >
                <IconClose size={12} color={chipFg} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 소셜 로그인 버튼 ─────────────────────────────────────────
function SocialLoginButton({ kind, onClick }) {
  if (kind === 'google') {
    return (
      <button
        type="button"
        className="press"
        onClick={onClick}
        style={{
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          color: 'var(--ink-1)',
          borderRadius: 8, padding: '13px 14px',
          fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>Google로 계속하기</span>
      </button>
    )
  }
  // kakao
  return (
    <button
      type="button"
      className="press"
      onClick={onClick}
      style={{
        width: '100%',
        background: '#FEE500',
        border: '1px solid #FEE500',
        color: '#191919',
        borderRadius: 8, padding: '13px 14px',
        fontSize: 14, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
        <path fill="#191919" d="M12 4C7 4 3 7.13 3 11c0 2.43 1.6 4.55 4.02 5.77-.16.55-.95 3.27-1.07 3.7 0 0-.02.18.09.25.11.06.24.01.24.01.32-.05 3.7-2.4 4.27-2.78.48.06.97.1 1.45.1 5 0 9-3.13 9-7s-4-7-9-7z"/>
      </svg>
      <span>카카오로 계속하기</span>
    </button>
  )
}

const ACTIVITY_LEVELS = ['낮음', '보통', '높음']
const _normBreedText = (value) => String(value || '').trim().toLowerCase()

const BREED_CATALOG = (Array.isArray(BREED_OPTIONS) ? BREED_OPTIONS : []).map((item) => ({
  id: item?.id || '',
  nameKo: item?.nameKo || '',
  aliases: Array.isArray(item?.aliases) ? item.aliases : [],
  sizeGroup: item?.sizeGroup || null,
  visible: item?.visible !== false,
  requiresAdultWeightEstimate: Boolean(item?.requiresAdultWeightEstimate),
}))

const FALLBACK_GUIDE_TEXT = '정확한 계산을 위해 아이의 성견 예상 체중을 입력해 주세요'

function resolveInitialAgeInputMode(profileLike) {
  const rawAgeMonths = Number(profileLike?.ageMonths)
  if (Number.isFinite(rawAgeMonths) && rawAgeMonths > 0) {
    return rawAgeMonths % 12 === 0 ? 'years' : 'months'
  }
  const rawAgeYears = Number(profileLike?.age)
  if (Number.isFinite(rawAgeYears) && rawAgeYears > 0) {
    return 'years'
  }
  return 'months'
}

function hasAgeSelection(profileLike) {
  const rawLifeStage = String(profileLike?.lifeStage ?? profileLike?.life_stage ?? '').trim().toLowerCase()
  if (rawLifeStage === 'puppy' || rawLifeStage === 'adult') return true

  const rawIsPuppy = profileLike?.isPuppy ?? profileLike?.is_puppy
  if (rawIsPuppy === true || rawIsPuppy === false) return true

  const rawAgeMonths = Number(profileLike?.ageMonths ?? profileLike?.age_months)
  if (Number.isFinite(rawAgeMonths) && rawAgeMonths > 0) return true

  const rawAgeYears = Number(profileLike?.age)
  return Number.isFinite(rawAgeYears) && rawAgeYears > 0
}

function normalizeBreedSizeGroup(value) {
  const v = String(value || '').trim().toLowerCase()
  return ['small', 'medium', 'large', 'giant'].includes(v) ? v : null
}

function sizeGroupFromWeight(weightValue) {
  const weightNum = Number(weightValue)
  if (!Number.isFinite(weightNum) || weightNum <= 0) return null
  if (weightNum < 10) return 'small'
  if (weightNum < 25) return 'medium'
  if (weightNum < 45) return 'large'
  return 'giant'
}

function puppyThresholdBySizeGroup(sizeGroup) {
  if (sizeGroup === 'small') return 12
  if (sizeGroup === 'medium') return 14
  if (sizeGroup === 'large') return 18
  if (sizeGroup === 'giant') return 24
  return 24
}

function monthMaxBySizeGroup(sizeGroup) {
  if (sizeGroup === 'small') return 12
  if (sizeGroup === 'medium') return 14
  if (sizeGroup === 'large') return 18
  if (sizeGroup === 'giant') return 24
  return 24
}

function normalizeActivityLevel(value) {
  return ACTIVITY_LEVELS.includes(value) ? value : null
}

// ─── 프로필 요약 카드 (저장 전·후 동일) ─────────────────────────
function ProfileSummaryCard({ profile, onReset }) {
  const nameTrim = profile.name?.trim() || ''
  const breedTrim = profile.breed?.trim() || ''
  const ageMonthsNum = Number(profile.ageMonths)
  const hasAge = hasAgeSelection(profile) && Number.isFinite(ageMonthsNum) && ageMonthsNum >= 0
  const hasWeight = profile.weight !== '' && profile.weight != null && String(profile.weight).trim() !== ''
  const isEmpty = !nameTrim && !breedTrim && !hasAge && !hasWeight && profile.neutered == null

  const displayName = isEmpty
    ? '반려견 프로필을 입력해주세요'
    : (nameTrim || '강아지 이름')
  const initial = isEmpty ? '?' : (nameTrim || '?').slice(0, 1)

  const ageLabel = hasAge
    ? (profile.lifeStage === 'puppy' ? `${ageMonthsNum}개월` : `${Math.max(1, Math.round(ageMonthsNum / 12))}세`)
    : null
  const metaParts = [
    breedTrim || null,
    ageLabel,
    hasWeight ? `${profile.weight}kg` : null,
  ].filter(Boolean)
  const metaLine = isEmpty
    ? '이름, 품종, 나이, 체중을 입력하면 맞춤 급여량을 계산할 수 있어요'
    : (metaParts.length > 0 ? metaParts.join(' · ') : '품종 · 나이 · 체중')

  const activityLevel = normalizeActivityLevel(profile.activity)
  const neuteredLabel =
    profile.neutered === true ? '중성화' : profile.neutered === false ? '미중성화' : null
  const statusParts = [neuteredLabel]
  if (!isEmpty && nameTrim && activityLevel) {
    statusParts.push(`활동량 ${activityLevel}`)
  }
  const statusLine = statusParts.filter(Boolean).join(' · ')

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      {onReset && (
        <button
          type="button"
          className="press"
          onClick={onReset}
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--danger-fg)',
          }}
        >
          삭제
        </button>
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingRight: onReset ? 52 : 0 }}>
        {/* 좌측 아바타 — 품종 아이콘 미리보기 or 이니셜 fallback */}
        {(() => {
          const breedIcon = getBreedIcon(breedTrim)
          return breedIcon ? (
            <div
              className="profile-summary-avatar"
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#f7f4ef',
                border: '1px solid #ecebe8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              <div className="profile-summary-avatar-inner" style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={breedIcon} alt={breedTrim} style={{ width: 52, height: 52, objectFit: 'contain' }} />
              </div>
            </div>
          ) : (
            <div
              className="profile-summary-avatar"
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#f7f4ef',
                border: '1px solid #ecebe8',
                color: 'var(--primary)',
                fontSize: 22,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
          )
        })()}

        {/* 우측 텍스트 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-1)', lineHeight: 1.3 }}>
            {displayName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.4 }}>
            {metaLine}
          </div>
          {statusLine && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>
              {statusLine}
            </div>
          )}
          {/* 건강상태 / 알러지 — 텍스트 요약, 값 없는 줄 미노출 */}
          {(() => {
            const _conds = profile.conditions ?? []
            const _alrgs = profile.allergies ?? []
            if (!_conds.length && !_alrgs.length) return null
            const renderRow = (label, items) => {
              if (!items.length) return null
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, flexShrink: 0, lineHeight: 1.5 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500, lineHeight: 1.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {items.join(' · ')}
                  </span>
                </div>
              )
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {renderRow('건강상태', _conds)}
                {renderRow('알러지', _alrgs)}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── 프로필 수정 화면 ─────────────────────────────────────────
export default function ProfileEditPage() {
  const { petId } = useParams()
  const navigate = useNavigate()
  const { state, dispatch } = useApp()
  const pets = usePets()
  const activePetId = useActivePetId()
  const isLoggedIn = useIsLoggedIn()
  const user = useUser()
  const { show: showToast } = useToast()

  // petId === 'new': 새 반려동물 등록 (빈 폼)
  // petId = actual ID: 해당 펫 수정
  const isNewPet = petId === 'new'
  const existing = isNewPet
    ? null
    : (pets.find((p) => String(p.id) === String(petId)) ?? null)

  // ── 안전 리다이렉트: 유효하지 않은 petId ────────────────────────────
  // pets가 로드되기 전(isLoggedIn + 빈 배열) 이면 아직 판단 보류
  useEffect(() => {
    if (isNewPet) return
    if (existing !== null) return
    if (isLoggedIn && pets.length === 0) return
    navigate(ROUTES.profile, { replace: true })
  }, [isNewPet, existing, isLoggedIn, pets.length, navigate])

  const [name, setName] = useState(existing?.name ?? '')
  const [breed, setBreed] = useState(existing?.breed ?? '')
  const [breedId, setBreedId] = useState(existing?.breedId ?? null)
  const [breedSizeGroup, setBreedSizeGroup] = useState(existing?.breedSizeGroup ?? null)
  const [breedMeta, setBreedMeta] = useState(existing?.breedMeta ?? null)
  const [showBreedSuggestions, setShowBreedSuggestions] = useState(false)
  const [ageInputMode, setAgeInputMode] = useState(resolveInitialAgeInputMode(existing))
  const [agePickerOpen, setAgePickerOpen] = useState(false)
  const [ageMonthsInput, setAgeMonthsInput] = useState(() => {
    if (!hasAgeSelection(existing)) return ''
    const rawAgeMonths = Number(existing?.ageMonths)
    if (Number.isFinite(rawAgeMonths) && rawAgeMonths > 0) return String(Math.round(rawAgeMonths))
    const ageYears = Number(existing?.age)
    if (Number.isFinite(ageYears) && ageYears > 0) return String(Math.round(ageYears * 12))
    return ''
  })
  const [weight, setWeight] = useState(existing?.weight != null ? String(existing.weight) : '')
  const [gender, setGender] = useState(existing?.gender ?? null)
  const [neutered, setNeutered] = useState(existing?.neutered ?? null)
  const [activity, setActivity] = useState(existing?.activity ?? '보통')
  const [conditions, setConditions] = useState(existing?.conditions ?? [])
  const [allergies, setAllergies] = useState(existing?.allergies ?? [])
  const [favorites, setFavorites] = useState(existing?.favorites ?? [])
  const [styles, setStyles] = useState(existing?.preferredStyles ?? [])
  const [allergyInput, setAllergyInput] = useState('')
  const [favInput, setFavInput] = useState('')
  const [sheet, setSheet] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const breedFieldRef = useRef(null)
  const ageOptionListRef = useRef(null)
  const selectedAgeOptionRef = useRef(null)
  const defaultScrollAgeOptionRef = useRef(null)

  // ── 기존 데이터 변경 시 폼 동기화 ──────────────────────────────────
  useEffect(() => {
    const currentBreedText = existing?.breed ?? ''
    const currentBreedId = existing?.breedId ?? null
    const matchedById = currentBreedId
      ? BREED_CATALOG.find((item) => item.id === currentBreedId) || null
      : null
    const matchedByName = !currentBreedId && currentBreedText
      ? BREED_CATALOG.find((item) => item.nameKo === currentBreedText) || null
      : null
    const matchedBreed = matchedById || matchedByName

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(existing?.name ?? '')
    setBreed(matchedBreed?.nameKo || currentBreedText)
    setBreedId(matchedById ? matchedBreed.id : currentBreedId)
    setBreedSizeGroup(matchedBreed?.sizeGroup ?? existing?.breedSizeGroup ?? null)
    setBreedMeta(
      matchedBreed
        ? {
            nameKo: matchedBreed.nameKo,
            aliases: matchedBreed.aliases,
            visible: matchedBreed.visible,
            requiresAdultWeightEstimate: matchedBreed.requiresAdultWeightEstimate,
            sizeGroup: normalizeBreedSizeGroup(matchedBreed.sizeGroup),
          }
        : (existing?.breedMeta ?? null),
    )
    setShowBreedSuggestions(false)
    setAgeInputMode(resolveInitialAgeInputMode(existing))
    if (hasAgeSelection(existing)) {
      const rawAgeMonths = Number(existing?.ageMonths)
      if (Number.isFinite(rawAgeMonths) && rawAgeMonths > 0) {
        setAgeMonthsInput(String(Math.round(rawAgeMonths)))
      } else {
        const ageYears = Number(existing?.age)
        if (Number.isFinite(ageYears) && ageYears > 0) {
          setAgeMonthsInput(String(Math.round(ageYears * 12)))
        } else {
          setAgeMonthsInput('')
        }
      }
    } else {
      setAgeMonthsInput('')
    }
    setWeight(existing?.weight != null ? String(existing.weight) : '')
    setGender(existing?.gender ?? null)
    setNeutered(existing?.neutered ?? null)
    setActivity(normalizeActivityLevel(existing?.activity) ?? '보통')
    setConditions(existing?.conditions ?? [])
    setAllergies(existing?.allergies ?? [])
    setFavorites(existing?.favorites ?? [])
    setStyles(existing?.preferredStyles ?? [])
  }, [existing])

  useEffect(() => {
    if (!showBreedSuggestions) return undefined
    const onOutside = (event) => {
      if (breedFieldRef.current && !breedFieldRef.current.contains(event.target)) {
        setShowBreedSuggestions(false)
      }
    }
    window.addEventListener('mousedown', onOutside)
    return () => window.removeEventListener('mousedown', onOutside)
  }, [showBreedSuggestions])

  const weightError = validateWeight(weight)
  const canSave = name.trim() && !weightError
  const selectedBreedRequiresEstimate = Boolean(breedMeta?.requiresAdultWeightEstimate)
  const selectedBreedGroup = normalizeBreedSizeGroup(breedMeta?.sizeGroup ?? breedSizeGroup)
  const fallbackSizeGroup = sizeGroupFromWeight(weight)
  const shouldUseWeightFallback = selectedBreedRequiresEstimate || !selectedBreedGroup
  const resolvedBreedSizeGroup = shouldUseWeightFallback
    ? (fallbackSizeGroup || selectedBreedGroup || null)
    : selectedBreedGroup
  const resolvedBreedSizeSource = shouldUseWeightFallback
    ? (fallbackSizeGroup ? 'weight_fallback' : (selectedBreedGroup ? 'breed_master' : null))
    : (selectedBreedGroup ? 'breed_master' : null)
  const hasSelectedAge = ageMonthsInput.trim() !== ''
  const ageMonthsValue = hasSelectedAge ? Math.max(1, Number.parseInt(ageMonthsInput, 10) || 1) : null
  const ageYearsSelected = ageMonthsValue == null ? 1 : Math.max(1, Math.round(ageMonthsValue / 12) || 1)
  const ageSheetSizeGroup = shouldUseWeightFallback
    ? (fallbackSizeGroup || null)
    : selectedBreedGroup
  const ageMonthMax = monthMaxBySizeGroup(ageSheetSizeGroup)
  const monthOptions = Array.from({ length: ageMonthMax }, (_, idx) => idx + 1)
  const yearOptions = Array.from({ length: 25 }, (_, idx) => idx + 1)
  const puppyThresholdMonths = resolvedBreedSizeGroup ? puppyThresholdBySizeGroup(resolvedBreedSizeGroup) : null
  const isPuppy = hasSelectedAge && ageMonthsValue !== null && puppyThresholdMonths != null
    ? ageMonthsValue <= puppyThresholdMonths
    : null
  const lifeStage = isPuppy == null ? null : (isPuppy ? 'puppy' : 'adult')
  const ageYearsValue = ageMonthsValue == null ? 0 : Number((ageMonthsValue / 12).toFixed(2))
  const showWeightEstimateGuide = shouldUseWeightFallback && !fallbackSizeGroup
  const ageDisplayLabel = hasSelectedAge
    ? (ageInputMode === 'months' ? `${ageMonthsValue}개월` : `${ageYearsSelected}살`)
    : '개월 또는 연령 선택'

  useEffect(() => {
    if (!agePickerOpen) return
    const frame = requestAnimationFrame(() => {
      if (selectedAgeOptionRef.current) {
        selectedAgeOptionRef.current.scrollIntoView({ block: 'center', behavior: 'auto' })
      } else if (defaultScrollAgeOptionRef.current) {
        defaultScrollAgeOptionRef.current.scrollIntoView({ block: 'center', behavior: 'auto' })
      } else if (ageOptionListRef.current) {
        ageOptionListRef.current.scrollTop = 0
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [agePickerOpen, ageInputMode, ageMonthsValue, ageMonthMax])

  const filteredBreedSuggestions = useMemo(() => {
    const q = _normBreedText(breed)
    const qNoSpace = q.replace(/\s+/g, '')
    if (!q) return []
    return BREED_CATALOG
      .filter((item) => {
        const haystack = [item.nameKo, ...item.aliases].map(_normBreedText)
        return haystack.some((token) => {
          const compact = token.replace(/\s+/g, '')
          return token.includes(q) || compact.includes(qNoSpace)
        })
      })
      .sort((a, b) => {
        if (a.visible !== b.visible) return a.visible ? -1 : 1
        return a.nameKo.localeCompare(b.nameKo, 'ko')
      })
      .slice(0, 8)
  }, [breed])

  const showCustomBreedInfo = Boolean(breed.trim()) && breedId === null && filteredBreedSuggestions.length === 0

  const isDirty = useMemo(() => {
    if (!existing) return Boolean(canSave)

    const sortedStr = (arr) => JSON.stringify([...(arr ?? [])].sort())

    const _curAge = ageMonthsValue ?? 0
    const _exAge = hasAgeSelection(existing)
      ? (Number(existing.ageMonths) || Math.round((Number(existing.age) || 0) * 12) || 0)
      : 0

    const _exNeutered = existing.neutered ?? existing.isNeutered ?? null
    const _exActivity = existing.activity ?? existing.activityLevel ?? '보통'
    const _exConditions = existing.conditions ?? existing.healthConditions ?? []
    const _exFavorites = existing.favorites ?? existing.favoriteIngredients ?? []
    const _exStyles = existing.preferredStyles ?? existing.preferredSnackTypes ?? []

    return (
      name.trim() !== (existing.name ?? '')
      || breed.trim() !== (existing.breed ?? '')
      || (breedId ?? null) !== (existing.breedId ?? null)
      || (Number(weight) || 0) !== (Number(existing.weight) || 0)
      || _curAge !== _exAge
      || (gender ?? null) !== (existing.gender ?? null)
      || (neutered ?? null) !== _exNeutered
      || (activity ?? '보통') !== _exActivity
      || sortedStr(conditions) !== sortedStr(_exConditions)
      || sortedStr(allergies) !== sortedStr(existing.allergies)
      || sortedStr(favorites) !== sortedStr(_exFavorites)
      || sortedStr(styles) !== sortedStr(_exStyles)
    )
  }, [existing, name, breed, breedId, weight, ageMonthsValue, gender, neutered, activity, conditions, allergies, favorites, styles, canSave])

  const buildProfile = () => {
    const _breedTrim = breed.trim()
    const _effectiveBreedMeta = breedId !== null
      ? breedMeta
      : (_breedTrim ? { customBreed: true, matched: false, requestedBreed: _breedTrim } : null)
    return {
      name: name.trim(),
      breed: _breedTrim,
      breedId,
      breedSizeGroup: resolvedBreedSizeGroup,
      breedSizeSource: resolvedBreedSizeSource,
      breedMeta: _effectiveBreedMeta,
      age: hasSelectedAge ? ageYearsValue : 0,
      ageMonths: hasSelectedAge ? ageMonthsValue : null,
      lifeStage,
      isPuppy,
      puppyThresholdMonths,
      weight: Number(weight) || 0,
      gender,
      neutered,
      activity,
      activityFactor: activity === '높음' ? 2.0 : activity === '낮음' ? 1.2 : 1.6,
      conditions,
      allergies,
      favorites,
      preferredStyles: styles,
    }
  }

  const toggle = (arr, setArr, v) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const addAllergy = () => {
    const t = allergyInput.trim()
    if (!t) return
    if (!allergies.includes(t)) setAllergies((prev) => [...prev, t])
    setAllergyInput('')
  }

  const addFav = () => {
    const t = favInput.trim()
    if (!t) return
    if (!favorites.includes(t)) setFavorites((prev) => [...prev, t])
    setFavInput('')
  }

  const handleBreedChange = (e) => {
    const val = e.target.value
    setBreed(val)
    setBreedId(null)
    setBreedSizeGroup(null)
    setBreedMeta(null)
    setShowBreedSuggestions(true)
  }

  const handleBreedKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowBreedSuggestions(false)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredBreedSuggestions.length > 0) {
        selectBreed(filteredBreedSuggestions[0])
      } else {
        setShowBreedSuggestions(false)
      }
    }
  }

  const openAgePicker = () => setAgePickerOpen(true)
  const closeAgePicker = () => setAgePickerOpen(false)

  const selectAgeMonth = (month) => {
    setAgeInputMode('months')
    setAgeMonthsInput(String(month))
    closeAgePicker()
  }

  const selectAgeYear = (year) => {
    setAgeInputMode('years')
    setAgeMonthsInput(String(year * 12))
    closeAgePicker()
  }

  const selectBreed = (item) => {
    setBreed(item.nameKo)
    setBreedId(item.id || null)
    const normalizedGroup = normalizeBreedSizeGroup(item.sizeGroup)
    const fallbackGroup = sizeGroupFromWeight(weight)
    const needsFallback = Boolean(item.requiresAdultWeightEstimate) || !normalizedGroup
    const nextGroup = needsFallback ? (fallbackGroup || normalizedGroup || null) : normalizedGroup
    setBreedSizeGroup(nextGroup)
    setBreedMeta({
      nameKo: item.nameKo,
      aliases: item.aliases,
      visible: item.visible,
      requiresAdultWeightEstimate: Boolean(item.requiresAdultWeightEstimate),
      sizeGroup: normalizeBreedSizeGroup(item.sizeGroup),
    })
    setShowBreedSuggestions(false)
  }

  const _getSessionId = () => {
    return getAnonymousSessionId()
  }

  // ── OAuth 진입 전 pending profile 보존 ──────────────────────────────
  const persistPendingProfileBeforeLogin = () => {
    const prof = buildProfile()
    if (prof.name?.trim() || Number(prof.weight) > 0) {
      try { localStorage.setItem(LS_PENDING_PROFILE, JSON.stringify(prof)) } catch { /* ignore */ }
    }
  }

  // ── 저장 ───────────────────────────────────────────────────────────
  const saveTemp = async () => {
    if (!canSave || isSaving) return
    setIsSaving(true)
    try {
      const prof = buildProfile()

      // URL petId 기준으로 저장 대상 결정
      // 'new'이면 activePetId (addPet dispatch로 생성된 ID) 사용
      const resolvedTargetId = isNewPet ? activePetId : petId

      // ── 로그인 경로: 항상 dogs 저장
      if (isLoggedIn && user?.id) {
        const currentPets = Array.isArray(pets) ? pets : []
        const targetId = resolvedTargetId

        let updatedPets
        let nextActivePetId
        let profWithId
        let saved = null

        if (currentPets.length === 0) {
          // 경우 A: 첫 프로필 — 새 pet 생성
          profWithId = { ...prof, id: targetId || generatePetId() }
          updatedPets = [profWithId]
          nextActivePetId = profWithId.id
        } else if (currentPets.some((p) => p.id === targetId)) {
          // 경우 B: targetId가 pets[] 안에 존재 — 해당 pet만 교체
          profWithId = { ...prof, id: targetId }
          updatedPets = currentPets.map((p) =>
            p.id === targetId ? { ...p, ...prof, id: p.id } : p,
          )
          nextActivePetId = targetId
        } else {
          // 경우 C: targetId stale — 첫 번째 pet에 반영
          profWithId = { ...prof, id: currentPets[0].id }
          updatedPets = [{ ...prof, id: currentPets[0].id }, ...currentPets.slice(1)]
          nextActivePetId = currentPets[0].id
        }

        if (API_ENABLED) {
          const sessionId = await resolveProfileSessionId({
            contextUserId: user.id,
            getAnonymousSessionId: _getSessionId,
          })
          saved = await apiSaveProfile(sessionId, profWithId, {
            userId: user.id,
            pets: updatedPets,
            activePetId: nextActivePetId,
          }).catch(() => null)
          if (!saved?.ok) {
            showToast('저장에 실패했어요. 잠시 후 다시 시도해주세요.')
            return
          }
        }

        if (API_ENABLED) {
          const serverPets = Array.isArray(saved?.pets) && saved.pets.length > 0 ? saved.pets : updatedPets
          const serverActivePetId = String(saved?.activePetId || '').trim() || nextActivePetId
          dispatch({ type: 'setPets', pets: serverPets, activePetId: serverActivePetId })
        } else {
          dispatch({ type: 'setPets', pets: updatedPets, activePetId: nextActivePetId })
        }
        showToast(existing ? '프로필이 수정됐어요' : '프로필이 저장됐어요')
        navigate(ROUTES.profile)
        return
      }

      // ── 비로그인 fallback
      dispatch({ type: 'setProfile', value: prof })
      showToast(existing ? '프로필이 수정됐어요' : '프로필이 저장됐어요')
      navigate(ROUTES.profile)

      if (API_ENABLED) {
        const sessionId = await resolveProfileSessionId({
          contextUserId: user?.id ?? state.user?.id,
          getAnonymousSessionId: _getSessionId,
        })
        apiSaveProfile(sessionId, prof).catch(() => null)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // ── 삭제 ───────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    const currentPets = Array.isArray(pets) ? pets : []
    // URL petId로 삭제 대상 결정 (isNewPet이면 삭제 불가)
    const targetId = isNewPet ? null : petId

    if (!targetId) {
      setSheet(null)
      return
    }

    const nextPets = currentPets.filter((p) => p.id !== targetId)
    const nextActivePetId = nextPets[0]?.id ?? null

    // ── 로그인: 서버와 동시 삭제
    if (isLoggedIn && user?.id) {
      if (API_ENABLED) {
        const nextProfile = nextPets[0] ?? null
        const sessionId = await resolveProfileSessionId({
          contextUserId: user.id,
          getAnonymousSessionId: _getSessionId,
        })
        const saved = await apiSaveProfile(sessionId, nextProfile, {
          userId: user.id,
          pets: nextPets,
          activePetId: nextActivePetId,
        }).catch(() => null)
        if (!saved?.ok) {
          showToast('삭제에 실패했어요. 잠시 후 다시 시도해주세요.')
          setSheet(null)
          return
        }
      }

      dispatch({ type: 'setPets', pets: nextPets, activePetId: nextActivePetId })
      if (nextPets.length === 0) {
        // 마지막 1마리 삭제 → LS 정리
        try { localStorage.removeItem('haru_profile') } catch { /* ignore */ }
        try { localStorage.removeItem('haru_pets') } catch { /* ignore */ }
        try { localStorage.removeItem('haru_activePetId') } catch { /* ignore */ }
        try { localStorage.removeItem(LS_PENDING_PROFILE) } catch { /* ignore */ }
      }
      setSheet(null)
      showToast('반려동물이 삭제됐어요')
      navigate(ROUTES.profile)  // 삭제 후 허브로 복귀
      return
    }

    // ── 비로그인: 로컬 state만 갱신
    dispatch({ type: 'setPets', pets: nextPets, activePetId: nextActivePetId })
    if (nextPets.length === 0) {
      try { localStorage.removeItem(LS_PENDING_PROFILE) } catch { /* ignore */ }
    }
    setSheet(null)
    showToast('반려동물이 삭제됐어요')
    navigate(ROUTES.profile)  // 삭제 후 허브로 복귀
  }

  const handleSocialLogin = async (provider) => {
    if (provider === 'kakao') {
      showToast('카카오 로그인은 준비 중이에요.')
      return
    }
    persistPendingProfileBeforeLogin()
    try {
      await signInWithGoogle()
    } catch {
      showToast('로그인에 실패했어요. 다시 시도해주세요.')
    }
    setSheet(null)
  }

  // 인라인 로그인 버튼 — pending profile 저장 후 OAuth 리디렉션
  const handleDirectLogin = async () => {
    persistPendingProfileBeforeLogin()
    try {
      await signInWithGoogle()
    } catch {
      showToast('로그인에 실패했어요. 다시 시도해주세요.')
    }
  }

  // ── 로그인 중인데 pets 아직 미로드 상태 ───────────────────────────
  if (!isNewPet && !existing && isLoggedIn && pets.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', position: 'relative' }}>

      {/* 헤더 */}
      <header
        className="page-inset-x page-title-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            className="press"
            onClick={() => navigate(ROUTES.profile)}
            aria-label="뒤로가기"
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', marginLeft: -4 }}
          >
            <IconBack size={20} color="var(--ink-2)" />
          </button>
          <div className="t-subtitle" style={{ fontWeight: 600 }}>프로필 수정</div>
        </div>
      </header>

      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 프로필 요약 카드 — 폼 입력값 실시간 반영 */}
          <ProfileSummaryCard
            profile={{
              name,
              breed,
              ageMonths: ageMonthsValue,
              lifeStage,
              weight,
              neutered,
              activity,
              conditions,
              allergies,
            }}
            onReset={existing ? () => setSheet('reset') : undefined}
          />

          {/* 이름 + 품종 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <ProfField label="이름">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 콩이" style={P_INPUT} />
            </ProfField>
            <ProfField label="품종">
              <div ref={breedFieldRef} style={{ position: 'relative' }}>
                <input
                  value={breed}
                  onChange={handleBreedChange}
                  onKeyDown={handleBreedKeyDown}
                  onFocus={() => { if (breed.trim()) setShowBreedSuggestions(true) }}
                  onBlur={() => setTimeout(() => setShowBreedSuggestions(false), 150)}
                  placeholder="예: 말티즈, 토이 푸들, 믹스견"
                  autoComplete="off"
                  style={P_INPUT}
                />
                {showBreedSuggestions && (filteredBreedSuggestions.length > 0 || showCustomBreedInfo) && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 16,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                      zIndex: 30,
                      overflow: 'hidden',
                    }}
                  >
                    {filteredBreedSuggestions.length > 0 ? (
                      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {filteredBreedSuggestions.map((item) => (
                          <button
                            key={item.id || item.nameKo}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectBreed(item)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '11px 12px',
                              fontSize: 14,
                              color: 'var(--ink-1)',
                              borderBottom: '1px solid var(--border)',
                              background: 'transparent',
                              cursor: 'pointer',
                            }}
                          >
                            {item.nameKo}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                          등록되지 않은 품종이에요.<br />
                          입력하신 이름으로 임시 저장하고, 체중 기준으로 계산할게요.
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          등록되지 않은 품종도 그대로 사용할 수 있어요 🐾
                        </div>
                        <button
                          type="button"
                          className="press"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            navigate(`${ROUTES.contact}?type=breed_request&breed=${encodeURIComponent(breed.trim())}`)
                          }}
                          style={{
                            alignSelf: 'flex-start',
                            padding: '6px 14px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: 'var(--primary-soft)',
                            color: 'var(--primary)',
                            border: '1px solid var(--primary)',
                            cursor: 'pointer',
                          }}
                        >
                          품종 추가 요청하기
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!showBreedSuggestions && showCustomBreedInfo && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', paddingTop: 2, paddingLeft: 2 }}>
                  등록되지 않은 품종이에요. 체중 기준으로 계산할게요.
                </div>
              )}
            </ProfField>
          </div>

          {/* 나이 + 체중 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <ProfField label="나이">
              <button
                type="button"
                className="press"
                onClick={openAgePicker}
                style={{
                  ...P_INPUT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: hasSelectedAge ? 'var(--ink-1)' : 'var(--ink-3)' }}>
                  {ageDisplayLabel}
                </span>
                <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>▼</span>
              </button>
            </ProfField>
            <ProfField label="체중">
              <div style={{ position: 'relative' }}>
                <input
                  value={weight}
                  onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  inputMode="decimal"
                  style={{ ...P_INPUT, paddingRight: 36, borderColor: weightError && weight ? 'var(--danger-fg)' : undefined }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--ink-3)' }}>kg</span>
              </div>
              {weightError && weight ? (
                <div style={{ fontSize: 11, color: 'var(--danger-fg)', marginTop: 4 }}>{weightError}</div>
              ) : null}
              {showWeightEstimateGuide && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                  {FALLBACK_GUIDE_TEXT}
                </div>
              )}
              {isPuppy && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                  성장기 아이는 체형과 성장 속도에 따라 필요 영양량이 달라질 수 있어요
                </div>
              )}
            </ProfField>
          </div>

          {/* 성별 + 중성화 여부 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <ProfField label="성별" hint="선택 사항">
              <SegRadio
                value={gender}
                onChange={setGender}
                options={[
                  { value: 'male', label: '남아' },
                  { value: 'female', label: '여아' },
                ]}
              />
            </ProfField>
            <ProfField label="중성화 여부">
              <SegRadio
                value={neutered}
                onChange={setNeutered}
                options={[
                  { value: true,  label: '완료' },
                  { value: false, label: '미완료' },
                ]}
              />
            </ProfField>
          </div>

          {/* 활동량 */}
          <ProfField label="활동량">
            <SegRadio
              value={activity}
              onChange={setActivity}
              options={[
                { value: '낮음', label: '낮음' },
                { value: '보통', label: '보통' },
                { value: '높음', label: '높음' },
              ]}
            />
          </ProfField>

          {/* 건강 상태 */}
          <ProfField label="건강 상태" hint="복수 선택">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {HEALTH_CONDITIONS.map((c) => {
                const active = conditions.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    className="press"
                    onClick={() => toggle(conditions, setConditions, c)}
                    style={{
                      background: active ? 'var(--primary-soft)' : 'var(--surface-2)',
                      border: `1px solid ${active ? 'var(--primary)' : 'transparent'}`,
                      color: active ? 'var(--primary)' : 'var(--ink-2)',
                      padding: '7px 14px', borderRadius: 20,
                      fontSize: 12, fontWeight: active ? 600 : 500,
                    }}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </ProfField>

          {/* 알러지 재료 */}
          <ProfField label="알러지 재료" hint="엔터로 추가">
            <ChipsInput
              value={allergyInput}
              setValue={setAllergyInput}
              onSubmit={addAllergy}
              chips={allergies}
              onRemove={(n) => setAllergies((prev) => prev.filter((x) => x !== n))}
              chipBg="var(--danger-bg)"
              chipFg="var(--danger-fg)"
              placeholder="예: 닭고기"
            />
          </ProfField>

          {/* 좋아하는 재료 */}
          <ProfField label="좋아하는 재료" hint="엔터로 추가">
            <ChipsInput
              value={favInput}
              setValue={setFavInput}
              onSubmit={addFav}
              chips={favorites}
              onRemove={(n) => setFavorites((prev) => prev.filter((x) => x !== n))}
              chipBg="var(--safe-bg)"
              chipFg="var(--safe-fg)"
              placeholder="예: 고구마"
            />
          </ProfField>

          {/* 선호 간식 스타일 */}
          <ProfField label="선호 간식 스타일" hint="복수 선택">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TREAT_TYPES.map((t) => {
                const active = styles.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    className="press"
                    onClick={() => toggle(styles, setStyles, t)}
                    style={{
                      background: active ? 'var(--primary-soft)' : 'var(--surface-2)',
                      border: `1px solid ${active ? 'var(--primary)' : 'transparent'}`,
                      color: active ? 'var(--primary)' : 'var(--ink-2)',
                      padding: '7px 14px', borderRadius: 20,
                      fontSize: 12, fontWeight: active ? 600 : 500,
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </ProfField>

          {/* 액션 버튼 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>

            {/* 비로그인: 임시로 사용하기 */}
            {!isLoggedIn && (
              <button
                type="button"
                className="press"
                disabled={!canSave || isSaving}
                onClick={saveTemp}
                style={{
                  width: '100%',
                  background: 'var(--surface-2)',
                  color: (canSave && !isSaving) ? 'var(--ink-2)' : 'var(--ink-4)',
                  borderRadius: 8, padding: 14,
                  fontSize: 14, fontWeight: 500,
                }}
              >
                {isSaving ? '저장 중...' : (existing ? '저장하기' : '임시로 사용하기')}
              </button>
            )}

            {/* 비로그인: Google 로그인 (항상 활성) */}
            {!isLoggedIn && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.6 }}>
                  로그인하면 프로필과 북마크를 기기가 바뀌어도 유지할 수 있어요.
                </p>
                <SocialLoginButton kind="google" onClick={handleDirectLogin} />
              </div>
            )}

            {/* 로그인 후: 프로필 저장 */}
            {isLoggedIn && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {!canSave && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.5 }}>
                    프로필을 입력하고 저장하세요.
                  </p>
                )}
                <button
                  type="button"
                  className="press"
                  disabled={!canSave || isSaving}
                  onClick={saveTemp}
                  style={{
                    width: '100%',
                    background: 'var(--primary)',
                    color: 'var(--surface)',
                    borderRadius: 8, padding: 14,
                    fontSize: 14, fontWeight: 700,
                    opacity: (canSave && !isSaving) ? 1 : 0.4,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  {isSaving ? '저장 중...' : (existing ? '저장하기' : '프로필 저장')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 바텀시트 — 나이 선택 */}
      <BottomSheet open={agePickerOpen} onClose={closeAgePicker}>
        <div
          style={{
            minHeight: '56vh',
            maxHeight: '56vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ position: 'relative', paddingTop: 2 }}>
            <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: 'var(--ink-1)' }}>
              나이 선택
            </div>
            <button
              type="button"
              className="press"
              onClick={closeAgePicker}
              aria-label="나이 선택 닫기"
              style={{
                position: 'absolute',
                right: 0,
                top: -6,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ink-3)',
              }}
            >
              <IconClose size={18} color="var(--ink-3)" />
            </button>
          </div>
          <SegRadio
            value={ageInputMode}
            onChange={setAgeInputMode}
            options={[
              { value: 'months', label: '개월' },
              { value: 'years', label: '연령' },
            ]}
          />
          <div
            ref={ageOptionListRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 10,
              background: 'var(--surface)',
            }}
          >
            {ageInputMode === 'months' ? (
              monthOptions.map((month) => {
                const selected = ageMonthsValue === month
                const scrollRef = selected
                  ? selectedAgeOptionRef
                  : (!hasSelectedAge && month === 3 ? defaultScrollAgeOptionRef : null)
                return (
                  <button
                    key={`month-${month}`}
                    ref={scrollRef}
                    type="button"
                    className="press"
                    onClick={() => selectAgeMonth(month)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 12px',
                      fontSize: 15,
                      color: selected ? 'var(--primary)' : 'var(--ink-1)',
                      background: selected ? 'var(--primary-soft)' : 'transparent',
                      fontWeight: selected ? 700 : 500,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {month}개월
                  </button>
                )
              })
            ) : (
              yearOptions.map((year) => {
                const selected = ageYearsSelected === year
                return (
                  <button
                    key={`year-${year}`}
                    ref={selected ? selectedAgeOptionRef : null}
                    type="button"
                    className="press"
                    onClick={() => selectAgeYear(year)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 12px',
                      fontSize: 15,
                      color: selected ? 'var(--primary)' : 'var(--ink-1)',
                      background: selected ? 'var(--primary-soft)' : 'transparent',
                      fontWeight: selected ? 700 : 500,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {year}살
                  </button>
                )
              })
            )}
          </div>
        </div>
      </BottomSheet>

      {/* 바텀시트 — 반려동물 삭제 확인 */}
      <BottomSheet open={sheet === 'reset'} onClose={() => setSheet(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>정말 이 반려동물 프로필을 삭제할까요?</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            삭제하면 저장된 프로필 정보가 사라집니다.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="press"
              onClick={() => setSheet(null)}
              style={{
                flex: 1,
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                borderRadius: 8,
                padding: 14,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              취소
            </button>
            <button
              type="button"
              className="press"
              onClick={confirmDelete}
              style={{
                flex: 1,
                background: 'var(--danger-fg)',
                color: '#fff',
                borderRadius: 8,
                padding: 14,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              삭제하기
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* 바텀시트 — 로그인 유도 */}
      <BottomSheet open={sheet === 'login'} onClose={() => setSheet(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 4px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>로그인하고 저장하기</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            로그인하면 프로필과 북마크가 기기를 바꿔도 안전하게 보관돼요.
          </div>
          <SocialLoginButton kind="google" onClick={() => handleSocialLogin('google')} />
          <SocialLoginButton kind="kakao" onClick={() => handleSocialLogin('kakao')} />
          <div style={{ fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', marginTop: 4 }}>
            * Google 계정으로 안전하게 로그인해요.
          </div>
        </div>
      </BottomSheet>

      {/* 바텀시트 — 다중 반려동물 (로그인 필요) */}
      <BottomSheet open={sheet === 'multi'} onClose={() => setSheet(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 4px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>로그인이 필요해요</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            여러 반려동물을 관리하려면 로그인이 필요해요.<br />로그인하면 프로필도 저장돼요!
          </div>
          <SocialLoginButton kind="google" onClick={() => handleSocialLogin('google')} />
          <SocialLoginButton kind="kakao" onClick={() => handleSocialLogin('kakao')} />
        </div>
      </BottomSheet>
    </div>
  )
}
