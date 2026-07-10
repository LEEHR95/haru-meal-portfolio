import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useIsLoggedIn, useToast } from '../store/useApp.js'
import { ROUTES } from '../routes.js'
import { signOut } from '../lib/auth.js'
import BottomSheet from '../components/BottomSheet.jsx'
import { IconBack, IconChevron } from '../components/icons/index.jsx'

const APP_VERSION = '0.9.0-beta'

// ─── 메뉴 행 ─────────────────────────────────────────────────────
function MenuRow({ label, value, onClick, divider = true, danger = false, readonly = false }) {
  const rowStyle = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '14px 16px',
    background: 'transparent',
    textAlign: 'left',
  }
  const labelStyle = {
    flex: 1,
    fontSize: 14,
    fontWeight: 500,
    color: danger ? 'var(--danger-fg)' : 'var(--ink-1)',
  }
  const inner = (
    <>
      <span style={labelStyle}>{label}</span>
      {value && (
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{value}</span>
      )}
      {!value && !readonly && (
        <IconChevron dir="right" size={14} color="var(--ink-3)" />
      )}
    </>
  )

  return (
    <>
      {readonly
        ? <div style={rowStyle}>{inner}</div>
        : (
          <button type="button" className="press" onClick={onClick} style={rowStyle}>
            {inner}
          </button>
        )}
      {divider && <div style={{ height: 1, background: 'var(--divider)', marginLeft: 16 }} />}
    </>
  )
}

// ─── 섹션 헤더 ────────────────────────────────────────────────────
function SectionHeader({ label }) {
  return (
    <div className="font-heading" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', paddingLeft: 4 }}>
      {label}
    </div>
  )
}

// ─── 시스템 설정 페이지 ───────────────────────────────────────────
export default function SettingsPage() {
  const navigate = useNavigate()
  const { dispatch } = useApp()
  const isLoggedIn = useIsLoggedIn()
  const { show: showToast } = useToast()
  const [deleteSheet, setDeleteSheet] = useState(false)

  const handleLogout = async () => {
    try {
      await signOut()
    } catch {
      dispatch({ type: 'logout' })
    }
    showToast('로그아웃됐어요.')
    navigate(ROUTES.profile, { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* 헤더 */}
      <header
        className="page-inset-x page-title-header settings-content-body"
        style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 27 }}
      >
        <button
          type="button"
          className="press"
          onClick={() => navigate(ROUTES.profile)}
          aria-label="뒤로가기"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, flexShrink: 0, color: 'var(--ink-2)',
          }}
        >
          <IconBack size={20} color="var(--ink-2)" />
        </button>
        <div className="font-heading" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-1)' }}>시스템 설정</div>
      </header>

      <div className="app-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="settings-content-body" style={{ padding: '8px 16px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── 정보 섹션 ────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionHeader label="정보" />
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              <MenuRow
                label="버전 정보"
                value={`v${APP_VERSION}`}
                readonly
              />
              <MenuRow
                label="이용약관"
                onClick={() => navigate(ROUTES.terms)}
              />
              <MenuRow
                label="개인정보처리방침"
                divider={false}
                onClick={() => navigate(ROUTES.privacy)}
              />
            </div>
          </div>

          {/* ── 계정 섹션 — 로그인 시만 표시 ───────────────────── */}
          {isLoggedIn && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SectionHeader label="계정" />
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                <MenuRow
                  label="로그아웃"
                  onClick={handleLogout}
                />
                <MenuRow
                  label="회원탈퇴"
                  danger
                  divider={false}
                  onClick={() => setDeleteSheet(true)}
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 바텀시트 — 회원탈퇴 안내 */}
      <BottomSheet open={deleteSheet} onClose={() => setDeleteSheet(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 4px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>회원탈퇴</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7 }}>
            현재 회원탈퇴는 문의하기를 통해 처리됩니다.<br />
            문의하기로 이동하시겠습니까?
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="press"
              onClick={() => setDeleteSheet(false)}
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
              onClick={() => {
                setDeleteSheet(false)
                navigate(`${ROUTES.contact}?type=account_delete_request`)
              }}
              style={{
                flex: 1,
                background: 'var(--primary)',
                color: '#fff',
                borderRadius: 8,
                padding: 14,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              문의하기
            </button>
          </div>
        </div>
      </BottomSheet>

    </div>
  )
}
