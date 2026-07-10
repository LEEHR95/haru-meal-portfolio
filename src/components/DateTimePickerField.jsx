import { useEffect, useState } from 'react'

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토']

function pad(n) { return String(n).padStart(2, '0') }

/** Date → "YYYY-MM-DD" */
export function toDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** ISO string → "YYYY-MM-DD" (기존 fedAt 역직렬화용) */
export function isoToDateValue(isoStr) {
  if (!isoStr) return toDateValue(new Date())
  return toDateValue(new Date(isoStr))
}

/** "YYYY-MM-DD" → ISO string (정오 로컬 타임 — 정렬 안정성) */
export function dateValueToISO(dateStr) {
  if (!dateStr) return new Date().toISOString()
  const [year, month, day] = dateStr.split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return new Date().toISOString()
  return new Date(year, month - 1, day, 12, 0, 0).toISOString()
}

function formatDateLabel(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return dateStr
  const d = new Date(year, month - 1, day)
  return `${year}.${pad(month)}.${pad(day)} (${WEEK_DAYS[d.getDay()]})`
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function buildCalendarCells(visibleMonth) {
  const monthStart = getMonthStart(visibleMonth)
  const firstVisibleDate = new Date(monthStart)
  firstVisibleDate.setDate(1 - monthStart.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(firstVisibleDate)
    cellDate.setDate(firstVisibleDate.getDate() + index)
    return {
      key: `${cellDate.getFullYear()}-${cellDate.getMonth()}-${cellDate.getDate()}`,
      date: cellDate,
      inMonth: cellDate.getMonth() === visibleMonth.getMonth(),
    }
  })
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// ─── DateTimePickerField ─────────────────────────────────────────
// value: "YYYY-MM-DD" / onChange: (dateStr: string) => void
export default function DateTimePickerField({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('calendar')   // 'calendar' | 'year'
  const [yearRangeStart, setYearRangeStart] = useState(0)

  // "YYYY-MM-DD" → Date (달력 내부 표시용)
  const parsedDate = (() => {
    if (!value) return new Date()
    const [y, m, d] = value.split('-').map(Number)
    if (![y, m, d].every(Number.isFinite)) return new Date()
    return new Date(y, m - 1, d)
  })()

  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(parsedDate))
  const today = new Date()
  const calendarCells = buildCalendarCells(visibleMonth)

  // 피커가 열릴 때 달력 모드로 리셋
  useEffect(() => {
    if (!open) return
    setMode('calendar')
    setVisibleMonth(getMonthStart(parsedDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 연도 선택 모드 진입
  function enterYearMode() {
    setYearRangeStart(visibleMonth.getFullYear() - 5)
    setMode('year')
  }

  // 화살표: 달력 모드 = 월 이동 / 연도 모드 = 연도 범위 이동
  function handlePrev() {
    if (mode === 'year') setYearRangeStart((s) => s - 12)
    else setVisibleMonth((prev) => addMonths(prev, -1))
  }

  function handleNext() {
    if (mode === 'year') setYearRangeStart((s) => s + 12)
    else setVisibleMonth((prev) => addMonths(prev, 1))
  }

  function handleDateSelect(date) {
    onChange(toDateValue(date))
    setOpen(false)
  }

  function handleToday() {
    onChange(toDateValue(new Date()))
    setOpen(false)
  }

  function handleYearSelect(year) {
    setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1))
    setMode('calendar')
  }

  const yearRange = Array.from({ length: 12 }, (_, i) => yearRangeStart + i)

  const arrowLabel = mode === 'year'
    ? { prev: '이전 연도 범위', next: '다음 연도 범위' }
    : { prev: '이전 달', next: '다음 달' }

  const ARROW_BTN = {
    width: 34, height: 34, borderRadius: 999,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--ink-2)', fontSize: 18, cursor: 'pointer',
  }

  return (
    <>
      {/* 날짜 표시 버튼 */}
      <button
        type="button"
        className="press"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '12px 14px',
          fontSize: 14,
          color: 'var(--ink-1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          textAlign: 'left',
          boxSizing: 'border-box',
        }}
      >
        <span>{formatDateLabel(value)}</span>
        <span style={{ color: 'var(--ink-3)', fontSize: 13, flexShrink: 0 }}>날짜 변경</span>
      </button>

      {open && (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 320,
            background: 'rgba(20, 16, 12, 0.16)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(100%, 340px)',
              background: '#FFFFFF',
              borderRadius: 20,
              boxShadow: '0 12px 28px rgba(0,0,0,0.10)',
              padding: 18,
              boxSizing: 'border-box',
            }}
          >
            {/* 헤더: 좌우 화살표 + 중앙 연월/연도범위 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <button
                type="button"
                className="press"
                aria-label={arrowLabel.prev}
                onClick={handlePrev}
                style={ARROW_BTN}
              >‹</button>

              {mode === 'calendar' ? (
                <button
                  type="button"
                  aria-label={`${visibleMonth.getFullYear()}년 ${visibleMonth.getMonth() + 1}월, 연도 선택`}
                  onClick={enterYearMode}
                  style={{
                    fontSize: 16, fontWeight: 700, color: 'var(--ink-1)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px 8px', borderRadius: 8,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>▾</span>
                </button>
              ) : (
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>
                  {yearRangeStart} – {yearRangeStart + 11}
                </span>
              )}

              <button
                type="button"
                className="press"
                aria-label={arrowLabel.next}
                onClick={handleNext}
                style={ARROW_BTN}
              >›</button>
            </div>

            {/* 본문: 달력 or 연도 선택 */}
            <div style={{ minHeight: 220 }}>
              {mode === 'year' ? (
                /* 연도 선택 그리드: 3열 × 4행 = 12개 */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {yearRange.map((year) => {
                    const isSelected = year === visibleMonth.getFullYear()
                    const isCurrent = year === today.getFullYear()
                    return (
                      <button
                        key={year}
                        type="button"
                        className="press"
                        aria-label={`${year}년 선택`}
                        onClick={() => handleYearSelect(year)}
                        style={{
                          minHeight: 44,
                          borderRadius: 10,
                          border: isSelected ? 'none' : '1px solid transparent',
                          background: isSelected
                            ? 'var(--primary)'
                            : isCurrent
                              ? 'color-mix(in srgb, var(--primary) 9%, white)'
                              : '#FFFFFF',
                          color: isSelected ? '#FFFFFF' : 'var(--ink-1)',
                          fontSize: 14,
                          fontWeight: isSelected || isCurrent ? 700 : 500,
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 4px 10px rgba(0,0,0,0.10)' : 'none',
                        }}
                      >
                        {year}
                      </button>
                    )
                  })}
                </div>
              ) : (
                /* 달력 그리드 */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {WEEK_DAYS.map((day) => (
                    <div key={day} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', paddingBottom: 4 }}>
                      {day}
                    </div>
                  ))}
                  {calendarCells.map((cell) => {
                    const selected = isSameDay(cell.date, parsedDate)
                    const isToday = isSameDay(cell.date, today)
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        className="press"
                        aria-label={`${cell.date.getFullYear()}년 ${cell.date.getMonth() + 1}월 ${cell.date.getDate()}일`}
                        onClick={() => handleDateSelect(cell.date)}
                        style={{
                          aspectRatio: '1 / 1', minHeight: 38, borderRadius: 14,
                          border: selected ? 'none' : '1px solid transparent',
                          background: selected
                            ? 'var(--primary)'
                            : isToday
                              ? 'color-mix(in srgb, var(--primary) 9%, white)'
                              : '#FFFFFF',
                          color: selected ? '#FFFFFF' : cell.inMonth ? 'var(--ink-1)' : 'var(--ink-4)',
                          fontSize: 13, fontWeight: selected || isToday ? 700 : 500,
                          opacity: cell.inMonth ? 1 : 0.45,
                          boxShadow: selected ? '0 6px 14px rgba(0,0,0,0.10)' : 'none',
                        }}
                      >
                        {cell.date.getDate()}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 하단: 오늘 버튼 + 현재 선택 날짜 (달력 모드만) */}
            {mode === 'calendar' && (
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="press"
                  onClick={handleToday}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontSize: 13, fontWeight: 700 }}
                >
                  오늘
                </button>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{formatDateLabel(value)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
