import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { INGREDIENTS, TREAT_TAGS, TREAT_TYPE_DESC, TREAT_TYPES } from '../data/index.js'
import { useApp, useProfile, useToast, useUser } from '../store/useApp.js'
import { isIngredientAllergic } from '../utils/allergyMatch.js'
import { IngredientSafetyBadges } from '../components/IngredientSafetyBadges.jsx'
import SafetyBadge from '../components/SafetyBadge.jsx'
import HelpTooltip from '../components/HelpTooltip.jsx'
import { validateRecipeName, RECIPE_NAME_MAX } from '../utils/validate.js'
import {
  IconAlert,
  IconCamera,
  IconClose,
  IconSearch,
} from '../components/icons/index.jsx'
import { fetchIngredients } from '../api/ingredients.js'
import { createRecipe, fetchRecipe, updateRecipe } from '../api/recipes.js'
import { API_ENABLED } from '../api/client.js'
import { ROUTES } from '../routes.js'
import { ERROR_MSG } from '../utils/errorMessages.js'
import { validateImageFile, pickImage, compressImage, uploadImage, createPreviewUrl } from '../utils/imageUtils.js'

const POPULAR_INGREDIENTS = [
  '고구마', '당근', '닭가슴살', '연어', '블루베리',
  '단호박', '사과', '계란', '코티지치즈', '귀리',
]

const FIELD_INPUT_STYLE = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 12,
  fontSize: 14,
  color: 'var(--ink-1)',
  boxSizing: 'border-box',
}

// ─── 초성 검색 헬퍼 ────────────────────────────────────────────
const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
function getChosung(str) {
  let out = ''
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code >= 0xAC00 && code <= 0xD7A3) {
      out += CHOSUNG[Math.floor((code - 0xAC00) / 588)]
    } else {
      out += str[i]
    }
  }
  return out
}
function isAllChosung(s) {
  if (!s) return false
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (!(c >= 0x3131 && c <= 0x314E)) return false
  }
  return true
}
function matchScore(name, query) {
  if (!query) return 0
  const q = query.trim()
  if (isAllChosung(q)) {
    const c = getChosung(name)
    if (c.startsWith(q)) return 3
    if (c.includes(q)) return 2
    return 0
  }
  if (name.startsWith(q)) return 3
  if (name.includes(q)) return 2
  const c = getChosung(name), cq = getChosung(q)
  if (c.startsWith(cq)) return 1
  return 0
}

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

// ─── 폼 필드 래퍼 ─────────────────────────────────────────────
function Field({ label, required, hint, right, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-1)' }}>{label}</div>
          {required && <span style={{ color: 'var(--primary)', fontSize: 12 }}>*</span>}
          {hint && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{hint}</span>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

// ─── 레시피 등록 화면 ─────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const isEditMode = Boolean(editId)

  const { dispatch } = useApp()
  const { show: showToast } = useToast()
  const user = useUser()
  const profile = useProfile()

  const [name, setName] = useState('')
  const [treatType, setTreatType] = useState(null)
  const [ingredients, setIngredients] = useState([])  // [{name, amount, level}]
  const [howTo, setHowTo] = useState('')
  // photo: { previewUrl: string, file: File, uploadedUrl: string|null }
  const [photo, setPhoto] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [tags, setTags] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [focused, setFocused] = useState(false)
  const [searchMsg, setSearchMsg] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingRecipe, setLoadingRecipe] = useState(isEditMode)
  const [editRecipeRaw, setEditRecipeRaw] = useState(null)

  const fileInputRef = useRef(null)
  const fetchedRecipeIdRef = useRef(null)

  // 언마운트 시 objectURL 해제
  useEffect(() => {
    return () => {
      if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl)
    }
  }, [photo?.previewUrl])

  // ─ 농사로 재료 목록 (실패 시 mock INGREDIENTS 폴백) ─
  const [apiIngredientMap, setApiIngredientMap] = useState(null)
  useEffect(() => {
    fetchIngredients({ lite: true }).then((res) => {
      if (!res?.items?.length) return
      const map = {}
      for (const item of res.items) {
        map[item.name] = { level: item.level, kcal: item.kcal_per_100g }
      }
      setApiIngredientMap(map)
    }).catch(() => null)
  }, [])
  const ingredientMap = useMemo(() => {
    if (!apiIngredientMap) return INGREDIENTS
    const merged = { ...INGREDIENTS }
    for (const [n, meta] of Object.entries(apiIngredientMap)) {
      if (!merged[n]) merged[n] = { level: meta.level }
      else merged[n] = { ...merged[n], level: pickKnownLevel(meta.level, merged[n].level) ?? 'unknown' }
    }
    return merged
  }, [apiIngredientMap])

  // ─ 수정 모드: 레시피 로드 (deps: editId만 — showToast/navigate 제외) ─
  useEffect(() => {
    if (!editId) {
      fetchedRecipeIdRef.current = null
      setLoadingRecipe(false)
      return undefined
    }
    if (!API_ENABLED) {
      setLoadingRecipe(false)
      showToast('API 연결이 필요해요.')
      return undefined
    }
    if (fetchedRecipeIdRef.current === editId) return undefined

    fetchedRecipeIdRef.current = editId
    let cancelled = false

    async function loadEditRecipe() {
      setLoadingRecipe(true)
      try {
        const recipe = await fetchRecipe(editId)
        if (cancelled) return
        if (!recipe) {
          showToast(ERROR_MSG.register)
          navigate(-1)
          return
        }
        setEditRecipeRaw(recipe)
      } finally {
        if (!cancelled) setLoadingRecipe(false)
      }
    }

    loadEditRecipe()

    return () => {
      cancelled = true
      if (fetchedRecipeIdRef.current === editId) {
        fetchedRecipeIdRef.current = null
      }
    }
  }, [editId])

  useEffect(() => {
    if (!editRecipeRaw) return
    setName(editRecipeRaw.name || '')
    setTreatType(editRecipeRaw.type || null)
    setTags(editRecipeRaw.tags || [])
    setHowTo((editRecipeRaw.steps || []).join('\n'))
    if (editRecipeRaw.imageUrl) {
      setPhoto({ previewUrl: editRecipeRaw.imageUrl, file: null, uploadedUrl: editRecipeRaw.imageUrl })
    }
    setIngredients((editRecipeRaw.ingredients || []).map((i) => ({
      name: i.name,
      amount: i.amount || '',
      level: ingredientMap[i.name]?.level ?? 'caution',
    })))
  }, [editRecipeRaw, ingredientMap])

  const searchBoxRef = useRef(null)

  const nameError = validateRecipeName(name)
  const valid = !nameError && treatType && ingredients.length > 0 && howTo.trim()
  const submitEnabled = valid && !submitting && !loadingRecipe
  const hasDangerous = ingredients.some((i) => i.level === 'danger')

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!focused) return undefined
    const close = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [focused])

  // ─ 자동완성 (초성 + 부분일치, 최대 8개) ─
  const suggestions = useMemo(() => {
    const q = searchTerm.trim()
    if (!q) return []
    return Object.keys(ingredientMap)
      .filter((n) => !ingredients.find((i) => i.name === n))
      .map((n) => ({ name: n, score: matchScore(n, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 8)
  }, [searchTerm, ingredients, ingredientMap])

  const showDropdown = focused && searchTerm.trim().length > 0

  // ─ 재료 관리 ─
  const addIngredient = useCallback((n) => {
    if (!n) return
    if (ingredients.find((i) => i.name === n)) return
    const meta = ingredientMap[n]
    setIngredients((prev) => [...prev, { name: n, amount: '', level: meta?.level ?? 'caution' }])
  }, [ingredients, ingredientMap])

  const removeIngredient = useCallback((n) => {
    setIngredients((prev) => prev.filter((i) => i.name !== n))
  }, [])

  const updateAmount = useCallback((n, amount) => {
    setIngredients((prev) => prev.map((i) => i.name === n ? { ...i, amount } : i))
  }, [])

  const handleEnter = () => {
    const q = searchTerm.trim()
    if (!q) return
    if (suggestions.length > 0) {
      addIngredient(suggestions[0].name)
      setSearchTerm('')
      setSearchMsg(null)
    } else if (ingredientMap[q]) {
      addIngredient(q)
      setSearchTerm('')
      setSearchMsg(null)
    } else {
      setSearchMsg(`'${q}'는 아직 DB에 없어요.`)
    }
  }

  const toggleTag = (t) => setTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])

  // ─ 이미지 선택 & 압축 & 업로드 ─
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''   // 같은 파일 재선택 허용

    const { ok, error } = validateImageFile(file)
    if (!ok) { showToast(error); return }

    // 로컬 미리보기 즉시 표시
    const previewUrl = createPreviewUrl(file)
    setPhoto({ previewUrl, file, uploadedUrl: null })

    // 백그라운드 압축 + 업로드
    setPhotoUploading(true)
    try {
      const compressed = await compressImage(file)
      const uploadedUrl = await uploadImage(compressed, user?.id)
      setPhoto((prev) => prev ? { ...prev, uploadedUrl } : null)
    } catch (err) {
      showToast(`이미지 업로드 실패: ${err.message ?? '다시 시도해주세요.'}`)
      // 미리보기는 유지, uploadedUrl만 null
    } finally {
      setPhotoUploading(false)
    }
  }, [user?.id, showToast])

  const removePhoto = useCallback(() => {
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl)
    setPhoto(null)
  }, [photo])

  const handleSubmit = async () => {
    if (!valid || submitting) return
    setSubmitting(true)

    const ingredientList = ingredients.map((i) =>
      i.amount ? `${i.name} ${i.amount}` : i.name,
    )

    // "1. 두부는..." "1) 두부는..." "1 두부는..." 처럼 앞에 붙는 숫자 번호 제거
    const cleanedInstructions = howTo
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean)
      .join('\n')

    if (API_ENABLED) {
      const payload = {
        title: name.trim(),
        ingredients: ingredientList,
        instructions: cleanedInstructions,
        snackType: treatType,
        tags,
        imageUrl: photo?.uploadedUrl ?? null,
        allergies: profile?.allergies || [],
        healthConditions: profile?.conditions || [],
        authorId: user?.id || null,
      }
      const res = isEditMode
        ? await updateRecipe(editId, payload, user?.id)
        : await createRecipe(payload)
      setSubmitting(false)
      if (!res) {
        showToast(ERROR_MSG.register)
        return
      }
    } else {
      setSubmitting(false)
    }

    if (isEditMode) {
      showToast('레시피가 수정되었어요 🍲')
      navigate(`${ROUTES.feed}?mode=bookmark&tab=mine`)
      return
    }

    dispatch({ type: 'toast', value: '레시피가 등록되었어요' })
    navigate(-1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* 상단 바 */}
      <header style={{
        flexShrink: 0,
        padding: '8px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--divider)',
        background: 'var(--bg)',
      }}>
        <button
          type="button"
          className="press"
          onClick={() => navigate(-1)}
          aria-label="닫기"
          style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-1)' }}
        >
          <IconClose size={22} />
        </button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{isEditMode ? '레시피 수정' : '레시피 등록'}</div>
        <button
          type="button"
          className="press"
          onClick={handleSubmit}
          disabled={!submitEnabled}
          style={{
            padding: '8px 14px', borderRadius: 8,
            background: submitEnabled ? 'var(--primary)' : 'var(--surface-2)',
            color: submitEnabled ? '#fff' : 'var(--ink-4)',
            fontSize: 14, fontWeight: 600,
          }}
        >
          {isEditMode ? '수정 완료' : '등록'}
        </button>
      </header>

      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {loadingRecipe ? (
          <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>
            레시피 불러오는 중...
          </div>
        ) : (
        <div className="register-form-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 레시피 이름 */}
          <Field label="레시피 이름" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 연어 고구마 츄"
              maxLength={RECIPE_NAME_MAX}
              style={FIELD_INPUT_STYLE}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {name.trim() && nameError ? (
                <span style={{ fontSize: 11, color: 'var(--danger-fg)' }}>{nameError}</span>
              ) : <span />}
              <span style={{ fontSize: 11, color: name.length > RECIPE_NAME_MAX * 0.8 ? 'var(--caution-fg)' : 'var(--ink-4)' }}>
                {name.length}/{RECIPE_NAME_MAX}
              </span>
            </div>
          </Field>

          {/* 간식 타입 */}
          <Field
            label="간식 타입"
            required
            right={
              <HelpTooltip
                content={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 2 }}>
                      간식 타입 안내
                    </div>
                    {TREAT_TYPES.map((t) => (
                      <div key={t} style={{ fontSize: 12, lineHeight: 1.5 }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{t}</span>
                        <span style={{ color: 'var(--ink-3)' }}> · </span>
                        <span style={{ color: 'var(--ink-2)' }}>{TREAT_TYPE_DESC[t]}</span>
                      </div>
                    ))}
                  </div>
                }
              />
            }
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TREAT_TYPES.map((t) => {
                const active = treatType === t
                return (
                  <button
                    key={t}
                    type="button"
                    className="press"
                    onClick={() => setTreatType(t)}
                    style={{
                      background: active ? 'var(--primary-soft)' : 'var(--surface-2)',
                      border: `1px solid ${active ? 'var(--primary)' : 'transparent'}`,
                      color: active ? 'var(--primary)' : 'var(--ink-2)',
                      padding: '6px 14px', borderRadius: 20,
                      fontSize: 12, fontWeight: active ? 600 : 500,
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* 재료 검색 */}
          <Field label="재료" required hint="초성 검색 가능">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* 검색 인풋 + 자동완성 */}
              <div ref={searchBoxRef} style={{ position: 'relative' }}>
                <div style={{
                  background: 'var(--surface)',
                  border: `1px solid ${showDropdown && suggestions.length ? 'var(--primary)' : (focused ? 'var(--primary)' : 'var(--border)')}`,
                  borderRadius: showDropdown && suggestions.length ? '12px 12px 0 0' : 12,
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'border-color 0.15s ease',
                }}>
                  <IconSearch size={18} color={focused ? 'var(--primary)' : 'var(--ink-3)'} />
                  <input
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setSearchMsg(null) }}
                    onFocus={() => setFocused(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleEnter() }
                      else if (e.key === 'Escape') { setSearchTerm(''); setFocused(false) }
                    }}
                    placeholder="재료명 검색 (예: 당근, ㄷㄱ…)"
                    aria-label="재료 검색"
                    style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 14, minWidth: 0, color: 'var(--ink-1)' }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      className="press"
                      onClick={() => { setSearchTerm(''); setSearchMsg(null) }}
                      aria-label="검색어 지우기"
                      style={{
                        width: 22, height: 22, borderRadius: 999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--ink-3)',
                      }}
                    >
                      <IconClose size={12} color="var(--ink-3)" />
                    </button>
                  )}
                </div>

                {/* 자동완성 드롭다운 */}
                {showDropdown && (
                  <div
                    className="fade-in"
                    role="listbox"
                    style={{
                      position: 'absolute', left: 0, right: 0, top: '100%',
                      background: 'var(--surface)',
                      border: '1px solid var(--primary)',
                      borderTop: 'none',
                      borderRadius: '0 0 12px 12px',
                      padding: 4,
                      maxHeight: 240, overflowY: 'auto',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
                      zIndex: 40,
                    }}
                  >
                    {suggestions.length === 0 ? (
                      <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
                        일치하는 재료가 없어요
                      </div>
                    ) : suggestions.map(({ name: n }) => {
                      const meta = ingredientMap[n]
                      const q = searchTerm.trim()
                      const idx = isAllChosung(q) ? -1 : n.indexOf(q)
                      return (
                        <button
                          key={n}
                          type="button"
                          role="option"
                          className="press"
                          onClick={() => {
                            addIngredient(n)
                            setSearchTerm('')
                            setSearchMsg(null)
                          }}
                          style={{
                            width: '100%', textAlign: 'left',
                            background: 'transparent',
                            padding: '10px 12px', borderRadius: 6,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 13, color: 'var(--ink-1)' }}>
                            {idx >= 0 ? (
                              <>
                                {n.slice(0, idx)}
                                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                                  {n.slice(idx, idx + q.length)}
                                </span>
                                {n.slice(idx + q.length)}
                              </>
                            ) : (
                              <>
                                {n}
                                <span style={{ color: 'var(--ink-3)', fontSize: 11, marginLeft: 6 }}>
                                  {getChosung(n)}
                                </span>
                              </>
                            )}
                          </span>
                          {meta && <SafetyBadge level={meta.level} size="s" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 검색 오류 메시지 */}
              {searchMsg && !showDropdown && (
                <div style={{ fontSize: 11, color: 'var(--caution-fg)' }}>{searchMsg}</div>
              )}

              {/* 자주 쓰는 재료 칩 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>
                    보호자들이 자주 쓰는 재료
                  </div>
                  <HelpTooltip
                    trigger="bulb"
                    content={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>
                          보호자들이 자주 찾는 재료
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                          고구마, 당근, 닭고기 등 보호자들이 등록 시 가장 많이 선택한 재료 10가지예요. 칩을 누르면 바로 추가돼요.
                        </div>
                      </div>
                    }
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {POPULAR_INGREDIENTS.map((n) => {
                    const meta = ingredientMap[n]
                    const already = !!ingredients.find((i) => i.name === n)
                    return (
                      <button
                        key={n}
                        type="button"
                        className="press"
                        disabled={already}
                        onClick={() => addIngredient(n)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: already ? 'var(--primary-soft)' : 'var(--surface)',
                          border: `1px solid ${already ? 'var(--primary)' : 'var(--border)'}`,
                          color: already ? 'var(--primary)' : 'var(--ink-1)',
                          padding: '6px 12px', borderRadius: 20,
                          fontSize: 12, fontWeight: already ? 600 : 500,
                          opacity: already ? 0.7 : 1,
                          cursor: already ? 'default' : 'pointer',
                        }}
                      >
                        {n}
                        {meta?.level === 'danger' && (
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--danger-fg)' }} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 선택된 재료 목록 */}
              {ingredients.length === 0 ? (
                <div style={{
                  marginTop: 4, padding: '20px 0',
                  textAlign: 'center',
                  background: 'var(--surface-2)', borderRadius: 8,
                  fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6,
                }}>
                  검색하거나 위 칩을 눌러<br />재료를 추가해주세요
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>
                    선택된 재료 {ingredients.length}
                  </div>
                  {ingredients.map((ing) => {
                    const meta = ingredientMap[ing.name]
                    const allergic = isIngredientAllergic(ing.name, profile?.allergies)
                    return (
                    <div
                      key={ing.name}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '8px 10px',
                      }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--ink-1)', flexShrink: 0 }}>{ing.name}</span>
                      <IngredientSafetyBadges
                        level={ing.level}
                        note={meta?.note}
                        isAllergic={allergic}
                      />
                      <div style={{ flex: 1 }} />
                      <input
                        value={ing.amount}
                        onChange={(e) => updateAmount(ing.name, e.target.value)}
                        placeholder="분량"
                        aria-label={`${ing.name} 분량`}
                        style={{
                          width: 78,
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '6px 10px',
                          fontSize: 12,
                          color: 'var(--ink-1)',
                          textAlign: 'right',
                        }}
                      />
                      <button
                        type="button"
                        className="press"
                        onClick={() => removeIngredient(ing.name)}
                        aria-label={`${ing.name} 삭제`}
                        style={{
                          width: 24, height: 24, borderRadius: 999,
                          background: 'var(--surface-2)',
                          color: 'var(--ink-3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconClose size={12} color="var(--ink-3)" />
                      </button>
                    </div>
                    )
                  })}
                </div>
              )}

              {/* 위험 재료 경고 배너 */}
              {hasDangerous && (
                <div style={{
                  display: 'flex', gap: 8, padding: '10px 12px',
                  background: 'var(--danger-bg)', borderRadius: 8,
                  alignItems: 'flex-start',
                }}>
                  <IconAlert size={16} color="var(--danger-fg)" />
                  <div style={{ fontSize: 12, color: 'var(--danger-fg)', lineHeight: 1.5 }}>
                    위험 재료가 포함되어 있어요. 등록 시 노출이 제한될 수 있어요.
                  </div>
                </div>
              )}
            </div>
          </Field>

          {/* 만드는 방법 */}
          <Field label="만드는 방법" required>
            <textarea
              value={howTo}
              onChange={(e) => setHowTo(e.target.value)}
              placeholder="단계별로 설명해주세요."
              style={{ ...FIELD_INPUT_STYLE, minHeight: 120, resize: 'none', lineHeight: 1.5 }}
            />
          </Field>

          {/* 대표 사진 */}
          <Field label="대표 사진">
            {/* 숨겨진 file input — pickImage()로 트리거 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              aria-label="사진 선택"
            />

            {photo ? (
              /* 미리보기 영역 */
              <div style={{ position: 'relative', aspectRatio: 1.6, borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)' }}>
                <img
                  src={photo.previewUrl}
                  alt="미리보기"
                  className="fade-in"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />

                {/* 업로드 중 오버레이 */}
                {photoUploading && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{
                      width: 28, height: 28,
                      border: '3px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>업로드 중…</span>
                  </div>
                )}

                {/* 삭제 + 재선택 */}
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="press"
                    onClick={() => pickImage(fileInputRef.current)}
                    aria-label="사진 다시 선택"
                    style={{
                      padding: '4px 10px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.9)',
                      fontSize: 11, fontWeight: 600, color: 'var(--ink-1)',
                    }}
                  >
                    다시 선택
                  </button>
                  <button
                    type="button"
                    className="press"
                    onClick={removePhoto}
                    aria-label="사진 삭제"
                    style={{
                      width: 28, height: 28, borderRadius: 999,
                      background: 'rgba(0,0,0,0.55)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <IconClose size={14} color="#fff" />
                  </button>
                </div>
              </div>
            ) : (
              /* 업로드 전 — 버튼 2개 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="press"
                  onClick={() => pickImage(fileInputRef.current)}
                  style={{
                    width: '100%',
                    border: '1.5px dashed var(--border-strong)',
                    borderRadius: 8,
                    padding: '28px 16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    background: 'var(--surface)', color: 'var(--ink-3)',
                  }}
                >
                  <IconCamera size={28} color="var(--ink-3)" />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>간식 사진 올리기</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>JPG · PNG · WEBP · 최대 5MB</span>
                </button>
              </div>
            )}
          </Field>

          {/* 급여 태그 */}
          <Field label="급여 태그">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TREAT_TAGS.map((t) => {
                const active = tags.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    className="press"
                    onClick={() => toggleTag(t)}
                    style={{
                      background: active ? 'var(--primary-soft)' : 'var(--surface-2)',
                      color: active ? 'var(--primary)' : 'var(--ink-2)',
                      padding: '6px 12px', borderRadius: 20,
                      fontSize: 12, fontWeight: active ? 600 : 500,
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* 필수 항목 안내 */}
          {!valid && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', padding: '8px 0' }}>
              레시피 이름, 간식 타입, 재료, 만드는 방법은 필수예요.
            </div>
          )}

          {/* sticky CTA 여백 */}
          <div style={{ height: 72 }} aria-hidden="true" />
        </div>
        )}
      </div>

      {/* 하단 sticky 등록 CTA */}
      <div
        className="register-cta-wrapper"
        style={{
          flexShrink: 0,
          background: 'var(--bg)',
          borderTop: '1px solid var(--border)',
          padding: '12px 20px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <button
          type="button"
          className="press"
          onClick={handleSubmit}
          disabled={!submitEnabled}
          aria-label={isEditMode ? '레시피 수정하기' : '레시피 등록하기'}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 8,
            background: submitEnabled ? 'var(--primary)' : 'var(--surface-2)',
            color: submitEnabled ? '#fff' : 'var(--ink-4)',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {isEditMode ? '레시피 수정하기' : '레시피 등록하기'}
        </button>
      </div>
    </div>
  )
}
