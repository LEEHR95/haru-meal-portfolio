import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast, useUser } from '../store/useApp.js'
import { submitContact } from '../api/contact.js'
import { trackContactSubmit } from '../lib/analytics.js'
import { API_ENABLED } from '../api/client.js'
import { ROUTES } from '../routes.js'
import { IconBack, IconClose } from '../components/icons/index.jsx'
import BottomSheet from '../components/BottomSheet.jsx'

const CONTACT_TYPES = [
  { value: 'account_delete_request', label: '회원탈퇴' },
  { value: 'feature_request', label: '기능 제안' },
  { value: 'other', label: '기타 문의' },
  { value: 'error_report', label: '오류 제보' },
  { value: 'ingredient_request', label: '재료 추가 요청' },
  { value: 'breed_request', label: '품종 추가 요청' },
]

const ALLOWED_TYPE_VALUES = new Set(CONTACT_TYPES.map((t) => t.value))

const INPUT_STYLE = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 12,
  fontSize: 14,
  color: 'var(--ink-1)',
  boxSizing: 'border-box',
}

const MAX_FILES = 3
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function ContactSubpageHeader({ onBack }) {
  return (
    <header
      className="page-inset-x page-title-header contact-form-body"
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <button
        type="button"
        className="press"
        onClick={onBack}
        aria-label="뒤로가기"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          flexShrink: 0,
          color: 'var(--ink-2)',
        }}
      >
        <IconBack size={20} color="var(--ink-2)" />
      </button>
      <div className="t-subtitle" style={{ fontWeight: 600 }}>문의하기</div>
    </header>
  )
}

function SuccessView({ onBack, onProfile }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <ContactSubpageHeader onBack={onBack} />

      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div
          className="page-inset-x contact-form-body"
          style={{
            padding: '48px 16px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 52, lineHeight: 1 }}>접수</div>

          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 8 }}>
              문의가 접수되었어요
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7 }}>
              소중한 의견 감사합니다.<br />
              확인 후 빠르게 반영할게요.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
            <button
              type="button"
              className="press"
              onClick={onBack}
              style={{
                width: '100%',
                background: 'var(--primary)',
                color: 'var(--surface)',
                borderRadius: 8,
                padding: 14,
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              이전 페이지로
            </button>
            <button
              type="button"
              className="press"
              onClick={onProfile}
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--ink-2)',
                borderRadius: 8,
                padding: 14,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              마이페이지로 이동
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ContactPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = useUser()
  const { show: showToast } = useToast()

  const queryType = searchParams.get('type') || ''
  const queryBreed = searchParams.get('breed') || ''
  const queryIngredient = searchParams.get('ingredient') || ''

  const initType = ALLOWED_TYPE_VALUES.has(queryType) ? queryType : 'other'
  const initContent = queryBreed
    || (queryIngredient
      ? `재료 정보 요청\n\n재료명: ${queryIngredient}\n\n안전성 정보 확인 요청`
      : '')
    || ''

  const [type, setType] = useState(initType)
  const [typeSheetOpen, setTypeSheetOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [content, setContent] = useState(initContent)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [inlineError, setInlineError] = useState('')

  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [files])

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || [])
    e.target.value = ''

    const available = MAX_FILES - files.length
    if (available <= 0) {
      showToast(`최대 ${MAX_FILES}개까지 첨부할 수 있어요.`)
      return
    }

    let firstError = ''
    const valid = []

    for (const file of selected) {
      if (!ALLOWED_MIME.has(file.type)) {
        firstError = firstError || 'jpg, png, webp 파일만 첨부할 수 있어요.'
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        firstError = firstError || '파일 크기는 5MB 이하여야 해요.'
        continue
      }

      if (valid.length >= available) {
        firstError = firstError || `최대 ${MAX_FILES}개까지 첨부할 수 있어요.`
        break
      }

      valid.push(file)
    }

    if (firstError) showToast(firstError)
    if (valid.length > 0) setFiles((prev) => [...prev, ...valid])
  }

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const emailTrimmed = email.trim()
  const emailError = emailTrimmed.length > 0 && !isValidEmail(emailTrimmed)
  const contentTooShort = content.trim().length > 0 && content.trim().length < 2
  const canSubmit = content.trim().length >= 2 && !emailError && !isSubmitting

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    setInlineError('')

    try {
      if (API_ENABLED) {
        const result = await submitContact({
          type,
          content,
          email: emailTrimmed || undefined,
          userId: user?.id || undefined,
          files,
        })

        if (!result?.ok) {
          setInlineError(result?.error || '문의 접수에 실패했어요. 잠시 후 다시 시도해 주세요.')
          return
        }
      }

      trackContactSubmit()
      setSubmitted(true)
    } catch {
      setInlineError('문의 접수에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <SuccessView
        onBack={() => navigate(-1)}
        onProfile={() => navigate(ROUTES.profile)}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <ContactSubpageHeader onBack={() => navigate(-1)} />

      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <form
          onSubmit={handleSubmit}
          className="page-inset-x contact-form-body"
          style={{ padding: '8px 16px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-1)' }}>
              문의 유형 <span style={{ color: 'var(--primary)' }}>*</span>
            </div>
            <button
              type="button"
              className="press"
              onClick={() => setTypeSheetOpen(true)}
              style={{
                ...INPUT_STYLE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: 'var(--ink-1)' }}>
                {CONTACT_TYPES.find((t) => t.value === type)?.label ?? '유형 선택'}
              </span>
              <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>▼</span>
            </button>
          </div>

          {type === 'account_delete_request' && (
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                color: 'var(--ink-3)',
                lineHeight: 1.7,
              }}
            >
              회원탈퇴 및 데이터 삭제 요청은 문의 접수 후 운영자가 확인하여 처리합니다.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label
              htmlFor="contact-email"
              style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-1)' }}
            >
              이메일
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-3)', marginLeft: 6 }}>
                (선택, 답변이 필요할 때 입력)
              </span>
            </label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              autoComplete="email"
              style={INPUT_STYLE}
            />
            {emailError && (
              <span style={{ fontSize: 11, color: 'var(--danger-fg)' }}>
                올바른 이메일 형식을 입력해 주세요.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label
              htmlFor="contact-content"
              style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-1)' }}
            >
              내용 <span style={{ color: 'var(--primary)' }}>*</span>
            </label>
            <textarea
              id="contact-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="문의 내용을 입력해 주세요. (2자 이상)"
              rows={6}
              style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.6, minHeight: 140 }}
            />
            {contentTooShort && (
              <span style={{ fontSize: 11, color: 'var(--danger-fg)' }}>
                2자 이상 입력해 주세요.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-1)' }}>
                사진 첨부
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                선택, 최대 {MAX_FILES}개, jpg/png/webp, 5MB 이하
              </span>
            </div>

            {previews.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {previews.map((url, i) => (
                  <div
                    key={i}
                    style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}
                  >
                    <img
                      src={url}
                      alt={`첨부 사진 ${i + 1}`}
                      style={{
                        width: 76,
                        height: 76,
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        display: 'block',
                      }}
                    />
                    <button
                      type="button"
                      className="press"
                      onClick={() => removeFile(i)}
                      aria-label={`${i + 1}번 사진 제거`}
                      style={{
                        position: 'absolute',
                        top: -7,
                        right: -7,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        background: 'var(--ink-2)',
                        color: 'var(--surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                      }}
                    >
                      <IconClose size={12} color="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {files.length < MAX_FILES && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  aria-label="사진 선택"
                />
                <button
                  type="button"
                  className="press"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '9px 14px',
                    fontSize: 13,
                    color: 'var(--ink-2)',
                    cursor: 'pointer',
                  }}
                >
                  사진 추가 ({files.length}/{MAX_FILES})
                </button>
              </>
            )}
          </div>

          {inlineError && (
            <div
              style={{
                background: 'var(--danger-soft, #fef2f2)',
                border: '1px solid var(--danger-border, #fca5a5)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--danger-fg, #dc2626)',
                lineHeight: 1.5,
              }}
            >
              {inlineError}
            </div>
          )}

          <button
            type="submit"
            className="press"
            disabled={!canSubmit}
            style={{
              width: '100%',
              background: canSubmit ? 'var(--primary)' : 'var(--surface-2)',
              color: canSubmit ? 'var(--surface)' : 'var(--ink-4)',
              borderRadius: 8,
              padding: 14,
              fontSize: 14,
              fontWeight: 700,
              opacity: isSubmitting ? 0.6 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {isSubmitting ? '문의 접수 중...' : '문의 제출'}
          </button>
        </form>
      </div>

      <BottomSheet open={typeSheetOpen} onClose={() => setTypeSheetOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 16 }}>
            문의 유형
          </div>
          {CONTACT_TYPES.map((t) => {
            const active = type === t.value
            return (
              <button
                key={t.value}
                type="button"
                className="press"
                onClick={() => { setType(t.value); setTypeSheetOpen(false) }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '15px 4px',
                  fontSize: 15,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--primary)' : 'var(--ink-1)',
                  background: 'transparent',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </BottomSheet>
    </div>
  )
}
