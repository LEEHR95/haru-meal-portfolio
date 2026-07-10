import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useActivePetId, useApp, useAuthReady, useBookmarks, useIsLoggedIn, usePets, useProfile, useToast, useUser } from '../store/useApp.js'
import { LS_PENDING_ADD_PET } from '../store/initialState.js'
import { ROUTES } from '../routes.js'
import BottomSheet from '../components/BottomSheet.jsx'
import { IconClose, IconChevron } from '../components/icons/index.jsx'
import { signInWithGoogle, signOut } from '../lib/auth.js'
import pawIconImg from '../components/icons/paw-icon-02.png'
import { getBreedIcon } from '../constants/breedIcons.js'
import { getLogs } from '../utils/dietLog.js'

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

// ─── hydrate 로딩 화면 ──────────────────────────────────────────────
function ProfileHydrateLoading() {
  return (
    <div className="profile-hydrate-loading">
      <div className="hydrate-spinner-stage">
        <svg
          className="hydrate-text-ring"
          viewBox="0 0 220 220"
          width="220"
          height="220"
          aria-hidden="true"
        >
          <defs>
            <path
              id="hydrateCircle"
              d="M 110,110 m -78,0 a 78,78 0 1,1 156,0 a 78,78 0 1,1 -156,0"
            />
          </defs>
          <text
            fontSize="22"
            fontWeight="600"
            fill="#E79C82"
            fontFamily="Pretendard, sans-serif"
            letterSpacing="2"
          >
            <textPath href="#hydrateCircle">
              {/* eslint-disable-next-line no-irregular-whitespace */}
              하루한끼　　하루한끼　　하루한끼　　하루한끼
            </textPath>
          </text>
        </svg>
        <div className="hydrate-logo-circle">
          <img
            src="/icons/하루한끼_문구없.png"
            alt="하루한끼"
            className="hydrate-logo-img"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>
      </div>
      <p className="hydrate-text">우리 아이 정보를 불러오고 있어요</p>
    </div>
  )
}

// ─── 약관/개인정보/문의 링크 ────────────────────────────────────────
function ProfileAuthLoading() {
  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="page-inset-x" style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 24, paddingBottom: 24 }}>
          <div style={{ width: '100%', maxWidth: 320, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 20px', textAlign: 'center' }}>
            <div className="profile-loading-spinner" aria-hidden="true" style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>로그인 상태를 확인하고 있어요</p>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>세션이 복원되면 프로필을 바로 이어서 보여드릴게요.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function LegalLinks({ style }) {
  return (
    <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.9, ...style }}>
      <Link to={ROUTES.contact} style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline' }}>
        문의하기
      </Link>
      {' · '}
      <Link to={ROUTES.terms} style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline' }}>
        이용약관
      </Link>
      {' · '}
      <Link to={ROUTES.privacy} style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline' }}>
        개인정보처리방침
      </Link>
    </p>
  )
}

// ─── 프로필 온보딩 화면 ─────────────────────────────────────────────
function ProfileOnboarding({ onStart, onLogin, onClose }) {
  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', position: 'relative' }}>

      {/* 헤더 */}
      <header
        className="page-inset-x page-title-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div className="t-subtitle" style={{ fontWeight: 600 }}>마이페이지</div>
        <button
          type="button"
          className="press"
          onClick={onClose}
          aria-label="닫기"
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}
        >
          <IconClose size={20} color="var(--ink-3)" />
        </button>
      </header>

      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="page-inset-x" style={{ paddingTop: 12, paddingBottom: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 타이틀 */}
          <div style={{ padding: '0 0 8px' }}>
            <div className="font-heading" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-1)', lineHeight: 1.35, marginBottom: 10 }}>
              하루한끼, 어떻게 시작해볼까요? 🐾
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7 }}>
              지금은 가볍게 시작해도 괜찮아요<br />
              언제든 이어서 사용할 수 있어요
            </div>
          </div>

          {/* 카드 1 — 가볍게 시작하기 */}
          <div
            className="onboarding-card-1"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span style={{
              display: 'inline-block',
              background: 'var(--surface-2)',
              color: 'var(--ink-3)',
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              alignSelf: 'flex-start',
            }}>
              바로 시작
            </span>
            <div>
              <div className="font-heading" style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 6 }}>가볍게 시작하기</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                지금 바로, 가입 없이 사용할 수 있어요<br />
                정보는 임시로 저장돼요
              </div>
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 4px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['반려동물 1마리 등록', '기본 급여 가이드 사용', '냉장고 파먹기 바로 사용'].map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
                  <span style={{ color: 'var(--ink-3)', fontSize: 16, lineHeight: 1 }}>•</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="press"
              onClick={onStart}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                background: 'transparent',
                border: '1.5px solid var(--primary)',
                color: 'var(--primary)',
                fontSize: 15,
                fontWeight: 700,
                marginTop: 4,
              }}
            >
              가볍게 시작하기 →
            </button>
          </div>

          {/* 카드 2 — 로그인하고 함께하기 */}
          <div
            className="onboarding-card-2"
            style={{
              background: 'var(--primary-soft)',
              border: '2px solid var(--primary)',
              borderRadius: 16,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span style={{
              display: 'inline-block',
              background: 'var(--primary)',
              color: 'white',
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              alignSelf: 'flex-start',
            }}>
              추천
            </span>
            <div>
              <div className="font-heading" style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 6 }}>로그인하고 함께하기</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                우리 아이 정보를 안전하게 보관하고<br />
                언제든 이어서 사용할 수 있어요
              </div>
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 4px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['반려동물 최대 2마리 등록', '기기 바꿔도 프로필 그대로', '급여 반응 기록 저장'].map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
                  <span style={{ color: 'var(--primary)', fontSize: 14, lineHeight: 1 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="press"
              onClick={onLogin}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                background: 'var(--primary)',
                border: 'none',
                color: 'white',
                fontSize: 15,
                fontWeight: 700,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
                <path fill="rgba(255,255,255,0.9)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="rgba(255,255,255,0.85)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="rgba(255,255,255,0.8)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="rgba(255,255,255,0.9)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 로그인하기 →
            </button>
          </div>

          {/* 하단 안내 */}
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.75 }}>
            이미 우리 아이 정보를 입력하셨나요?<br />
            로그인하면 이어서 사용할 수 있어요
          </p>

          <LegalLinks />

        </div>
      </div>
    </div>
  )
}

// ─── 활성 펫 Hero 카드 (읽기 전용) ─────────────────────────────────
function PetHubCard({ pet, onEdit }) {
  const ageMonthsRaw = pet.ageMonths ?? (pet.age ? Math.round(pet.age * 12) : null)
  const ageLabel = ageMonthsRaw
    ? (pet.lifeStage === 'puppy'
        ? `${Math.round(ageMonthsRaw)}개월`
        : `${Math.max(1, Math.round(ageMonthsRaw / 12))}세`)
    : null

  const genderSymbol = pet.gender === 'male' ? '♂' : pet.gender === 'female' ? '♀' : null
  const genderColor  = pet.gender === 'male' ? '#4A90D9' : '#E879A0'
  const conditions = Array.isArray(pet.conditions) ? pet.conditions : []
  const allergies  = Array.isArray(pet.allergies)  ? pet.allergies  : []

  // 메타 정보 — null 제외, 한 줄 표시
  const metaParts = [
    pet.breed?.trim() || null,
    ageLabel,
    pet.weight ? `${pet.weight}kg` : null,
  ].filter(Boolean)

  const hasConditions = conditions.length > 0
  const hasAllergies  = allergies.length > 0
  const hasSubInfo = metaParts.length > 0 || hasConditions || hasAllergies

  // 텍스트 요약 행 렌더 (칩 없이 라벨 + 값)
  const renderInfoRow = (label, items) => {
    if (!items.length) return null
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
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
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '16px',
    }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

        {/* 아바타 — 72px 원형 (품종 아이콘 or 이름 첫 글자 fallback) */}
        {(() => {
          const breedIcon = getBreedIcon(pet.breed)
          return breedIcon ? (
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#f7f4ef', border: '1px solid #ecebe8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              overflow: 'hidden',
            }}>
              {/* inner icon area: 60px — 모든 아이콘 동일 크기로 정규화 */}
              <div style={{ width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={breedIcon} alt={pet.breed || ''} style={{ width: 60, height: 60, objectFit: 'contain' }} />
              </div>
            </div>
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#f7f4ef', border: '1px solid #ecebe8',
              color: 'var(--primary)',
              fontSize: 26, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {(pet.name?.trim() || '?').slice(0, 1)}
            </div>
          )
        })()}

        {/* 정보 열 */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* 이름 행 + 편집 버튼 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: hasSubInfo ? 5 : 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              <span className="font-heading" style={{
                fontSize: 20, fontWeight: 800, color: 'var(--ink-1)', lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {pet.name?.trim() || '이름 없음'}
              </span>
              {genderSymbol && (
                <span style={{ fontSize: 15, fontWeight: 700, color: genderColor, lineHeight: 1, flexShrink: 0 }}>
                  {genderSymbol}
                </span>
              )}
            </div>
            <button
              type="button"
              className="press"
              onClick={onEdit}
              style={{
                fontSize: 12, fontWeight: 600, color: 'var(--primary)',
                padding: '6px 12px',
                background: 'var(--primary-soft)',
                border: '1px solid var(--primary)',
                borderRadius: 20,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}
            >
              프로필 편집
            </button>
          </div>

          {/* 메타 정보 한 줄 */}
          {metaParts.length > 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.5 }}>
              {metaParts.join(' · ')}
            </div>
          )}

          {/* 건강상태 / 알러지 — 텍스트 요약, 값 없는 줄 미노출 */}
          {(hasConditions || hasAllergies) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 3 }}>
              {renderInfoRow('건강상태', conditions)}
              {renderInfoRow('알러지', allergies)}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── 메뉴 행 ────────────────────────────────────────────────────
function MenuRow({ label, sub, onClick, divider = true }) {
  return (
    <>
      <button
        type="button"
        className="press"
        onClick={onClick}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '14px 16px',
          background: 'transparent',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1 }}>
          <span style={{ fontSize: 14, color: 'var(--ink-1)', fontWeight: 500 }}>{label}</span>
          {sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', fontWeight: 400, marginTop: 2 }}>{sub}</span>}
        </span>
        <IconChevron dir="right" size={14} color="var(--ink-3)" />
      </button>
      {divider && <div style={{ height: 1, background: 'var(--divider)', marginLeft: 16 }} />}
    </>
  )
}

// ─── 식생활 기록 허브 카드 ───────────────────────────────────────
function DietLogHubCard({ petId, petName, onClick }) {
  const logs = petId ? getLogs(petId) : []
  const sorted = [...logs].sort((a, b) => new Date(b.fedAt) - new Date(a.fedAt))
  const latest = sorted[0] || null

  const totalCount = logs.length
  const recentIngredients = (latest?.ingredients || []).slice(0, 3)
  const recentReaction = latest?.reaction || null
  const recentDate = latest?.fedAt?.slice(0, 10) || null

  const dateLabel = recentDate
    ? (() => {
        const d = new Date(recentDate)
        return `${d.getMonth() + 1}/${d.getDate()}`
      })()
    : null

  const reactionColor =
    recentReaction === '잘 먹음'
      ? 'var(--primary)'
      : recentReaction === '민감 반응'
        ? '#E55555'
        : 'var(--ink-2)'

  return (
    <button
      type="button"
      className="press"
      onClick={onClick}
      style={{
        width: '100%',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '14px 16px',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>
            {petName ? `${petName} 최근 기록` : '식생활 기록'}
          </span>
          {dateLabel && (
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>
              {dateLabel}
            </span>
          )}
        </div>
        <IconChevron dir="right" size={14} color="var(--ink-3)" />
      </div>

      {totalCount === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          아직 식생활 기록이 없어요
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {recentIngredients.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, flexShrink: 0 }}>최근 재료</span>
              <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>
                {recentIngredients.join(' · ')}
              </span>
            </div>
          )}
          {recentReaction && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, flexShrink: 0 }}>최근 반응</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: reactionColor }}>
                {recentReaction}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, flexShrink: 0 }}>총 기록</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>{totalCount}건</span>
          </div>
        </div>
      )}
    </button>
  )
}

// ─── 마이페이지 허브 ─────────────────────────────────────────────
export default function ProfilePage() {
  const navigate = useNavigate()
  const { dispatch } = useApp()
  const existing = useProfile()
  const pets = usePets()
  const activePetId = useActivePetId()
  const authReady = useAuthReady()
  const isLoggedIn = useIsLoggedIn()
  const user = useUser()
  const { bookmarks } = useBookmarks()
  const { show: showToast } = useToast()

  const [sheet, setSheet] = useState(
    () => (bookmarks.length >= 5 && !isLoggedIn ? 'bookmarks' : null),
  )

  // ── hydrate 로딩 추적 ───────────────────────────────────────────
  const prevIsLoggedInRef = useRef(isLoggedIn)
  const hydrateStartRef = useRef(null)
  const [isHydrating, setIsHydrating] = useState(false)

  // ── PWA 설치 CTA ─────────────────────────────────────────────────
  const installPromptRef = useRef(null)
  const [canInstall, setCanInstall] = useState(false)

  // Effect 1: 로그인 상태 변화 감지 → hydrate 시작
  useEffect(() => {
    const wasLoggedIn = prevIsLoggedInRef.current
    prevIsLoggedInRef.current = isLoggedIn

    if (!isLoggedIn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsHydrating(false)
      hydrateStartRef.current = null
      return
    }

    const noData = !existing && pets.length === 0
    if (noData && !wasLoggedIn) {
      if (!hydrateStartRef.current) hydrateStartRef.current = Date.now()
      setIsHydrating(true)
    } else if (noData && !hydrateStartRef.current) {
      hydrateStartRef.current = Date.now()
      setIsHydrating(true)
    }
  }, [isLoggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 2: 데이터 도착 감지 → 최소 400ms + 5s fallback
  useEffect(() => {
    if (!isHydrating) return undefined

    const fallback = setTimeout(() => setIsHydrating(false), 5000)

    if (existing !== null || pets.length > 0) {
      clearTimeout(fallback)
      const elapsed = Date.now() - (hydrateStartRef.current ?? Date.now())
      const t = setTimeout(() => setIsHydrating(false), Math.max(0, 400 - elapsed))
      return () => clearTimeout(t)
    }

    return () => clearTimeout(fallback)
  }, [existing, pets, isHydrating])

  // Effect 3: PWA 설치 가능 여부 감지
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return
    const onPrompt = (e) => {
      e.preventDefault()
      installPromptRef.current = e
      setCanInstall(true)
    }
    const onInstalled = () => {
      installPromptRef.current = null
      setCanInstall(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // ── 다견 전환 ────────────────────────────────────────────────────
  const handlePetChipClick = (id) => {
    if (id === activePetId) return
    dispatch({ type: 'setActivePetId', id })
  }

  // ── 반려동물 추가 ─────────────────────────────────────────────────
  const handleAddPetLogin = () => {
    try { localStorage.setItem(LS_PENDING_ADD_PET, 'true') } catch { /* ignore */ }
    setSheet('multi')
  }

  const handleAddPet = () => {
    if (!isLoggedIn) {
      handleAddPetLogin()
      return
    }
    if (pets.length >= 2) return  // max 2마리 제한 (reducer와 동일)
    dispatch({ type: 'addPet', value: {} })
    navigate(ROUTES.profileEdit('new'))
  }

  // ── 소셜 로그인 ──────────────────────────────────────────────────
  const handleSocialLogin = async (provider) => {
    if (provider === 'kakao') {
      showToast('카카오 로그인은 준비 중이에요.')
      return
    }
    try {
      await signInWithGoogle()
    } catch {
      showToast('로그인에 실패했어요. 다시 시도해주세요.')
    }
    setSheet(null)
  }

  const handleOnboardingLogin = async () => {
    try {
      await signInWithGoogle()
    } catch {
      showToast('로그인에 실패했어요. 다시 시도해주세요.')
    }
  }

  // ── 로그아웃 ─────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await signOut()
    } catch {
      dispatch({ type: 'logout' })
    }
    showToast('로그아웃됐어요.')
  }

  // ── PWA 설치 ─────────────────────────────────────────────────────
  const handleInstall = async () => {
    if (!installPromptRef.current) return
    installPromptRef.current.prompt()
    const { outcome } = await installPromptRef.current.userChoice
    if (outcome === 'accepted') {
      installPromptRef.current = null
      setCanInstall(false)
    }
  }

  // ── hydrate 로딩 ─────────────────────────────────────────────────
  if (!authReady) {
    return <ProfileAuthLoading />
  }

  if (isLoggedIn && isHydrating) {
    return <ProfileHydrateLoading />
  }

  // ── 온보딩 (비로그인 신규 사용자) ───────────────────────────────────
  const showOnboarding = authReady && !isLoggedIn && !existing && pets.length === 0
  if (showOnboarding) {
    return (
      <ProfileOnboarding
        onStart={() => navigate(ROUTES.profileEdit('new'))}
        onLogin={handleOnboardingLogin}
        onClose={() => navigate(ROUTES.home)}
      />
    )
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* 헤더 — 타이틀 + 인사(로그인 시) + 로그아웃 */}
      <header
        className="page-inset-x page-title-header page-title-header--profile"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div className="page-h1">마이페이지</div>
        {isLoggedIn && user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--ink-2)' }}>
              <span>안녕하세요,&nbsp;<strong style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{user.name}</strong>님</span>
              <img src={pawIconImg} alt="" aria-hidden="true" style={{ width: 18, height: 18, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
            </div>
            <button
              type="button"
              className="press"
              onClick={handleLogout}
              style={{
                fontSize: 12, fontWeight: 500,
                color: 'var(--ink-3)',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
                padding: '4px 0',
                whiteSpace: 'nowrap',
              }}
            >
              로그아웃
            </button>
          </div>
        ) : null}
      </header>

      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="page-inset-x" style={{ paddingTop: 8, paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 반려견 전환 칩 */}
          {pets.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {pets.map((p) => {
                  const isActive = p.id === activePetId
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="press"
                      onClick={() => handlePetChipClick(p.id)}
                      style={{
                        padding: '7px 16px',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        background: isActive ? 'var(--primary)' : 'var(--surface-2)',
                        color: isActive ? 'var(--surface)' : 'var(--ink-2)',
                        border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                        transition: 'background 0.15s ease, color 0.15s ease',
                      }}
                    >
                      {p.name?.trim() || '이름 없음'}
                    </button>
                  )
                })}

                {/* + 추가 — 2마리 미만이면 항상 표시 */}
                {pets.length < 2 && (
                  <button
                    type="button"
                    className="press"
                    onClick={isLoggedIn ? handleAddPet : handleAddPetLogin}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 500,
                      background: 'var(--surface)',
                      color: 'var(--primary)',
                      border: '1px solid var(--primary)',
                    }}
                  >
                    + 추가
                  </button>
                )}
              </div>

              {/* 펫 관리 중 안내 */}
              {isLoggedIn && pets.length >= 2 && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  총 {pets.length}마리의 반려동물을 관리 중이에요
                </p>
              )}
            </div>
          )}

          {/* 활성 펫 카드 또는 등록 유도 */}
          {existing ? (
            <PetHubCard
              pet={existing}
              onEdit={() => navigate(ROUTES.profileEdit(activePetId))}
            />
          ) : (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>아직 등록된 반려동물이 없어요</div>
              <button
                type="button"
                className="press"
                onClick={isLoggedIn ? handleAddPet : () => navigate(ROUTES.profileEdit('new'))}
                style={{
                  padding: '9px 20px', borderRadius: 20,
                  fontSize: 13, fontWeight: 600,
                  background: 'var(--primary)', color: 'white', border: 'none',
                }}
              >
                반려동물 등록하기
              </button>
            </div>
          )}

          {/* 비로그인: 로그인 유도 */}
          {authReady && !isLoggedIn && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.6 }}>
                로그인하면 프로필과 북마크를 기기가 바뀌어도 유지할 수 있어요.
              </p>
              <SocialLoginButton kind="google" onClick={() => handleSocialLogin('google')} />
            </div>
          )}

          {/* ── 보관함 메뉴 ───────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="font-heading" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', paddingLeft: 4 }}>보관함</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <MenuRow
                label="저장한 레시피"
                onClick={() => navigate(`${ROUTES.feed}?mode=bookmark`)}
              />
              <MenuRow
                label="내가 만든 레시피"
                divider={false}
                onClick={() => navigate(`${ROUTES.feed}?mode=bookmark&tab=mine`)}
              />
            </div>
          </div>

          {/* ── 기록 메뉴 ────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="font-heading" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', paddingLeft: 4 }}>기록</div>
            <DietLogHubCard
              petId={activePetId}
              petName={existing?.name}
              onClick={() => navigate(ROUTES.dietLog)}
            />
          </div>

          {/* ── 고객지원 메뉴 ─────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="font-heading" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', paddingLeft: 4 }}>고객지원</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {canInstall && (
                <MenuRow
                  label="앱 설치하기"
                  onClick={handleInstall}
                />
              )}
              <MenuRow
                label="문의하기"
                onClick={() => navigate(ROUTES.contact)}
              />
              <MenuRow
                label="제품·재료 추가 요청"
                divider={false}
                onClick={() => navigate(`${ROUTES.contact}?type=ingredient_request`)}
              />
            </div>
          </div>

          {/* ── 설정 메뉴 ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="font-heading" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', paddingLeft: 4 }}>설정</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <MenuRow
                label="시스템 설정"
                divider={false}
                onClick={() => navigate(ROUTES.settings)}
              />
            </div>
          </div>

        </div>
      </div>

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

      {/* 바텀시트 — 북마크 누적 로그인 유도 */}
      <BottomSheet open={sheet === 'bookmarks'} onClose={() => setSheet(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 4px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>북마크가 쌓이고 있어요</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            기기를 변경해도 북마크를 안전하게 보관할 수 있어요.
          </div>
          <SocialLoginButton kind="google" onClick={() => handleSocialLogin('google')} />
          <button
            type="button"
            className="press"
            onClick={() => setSheet(null)}
            style={{ color: 'var(--ink-3)', padding: 10, fontSize: 13 }}
          >
            나중에
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
