import { useLocation, useNavigate } from 'react-router-dom'
import { getActiveTab } from '../routes.js'
import { NAV_TABS } from './navConfig.js'

export default function AppTopBar({ active: activeProp, onNavigate }) {
  const location = useLocation()
  const navigate = useNavigate()
  const active = activeProp ?? getActiveTab(location.pathname, location.search)

  const handleNav = (tab) => {
    if (onNavigate) {
      onNavigate(tab.key)
      return
    }
    navigate(tab.path)
  }

  return (
    <header className="app-topbar" aria-label="주요 메뉴">
      {/* PC에서 본문 feed-reco-box 좌우 기준선에 맞춰 정렬하는 내부 래퍼 */}
      <div className="app-topbar__inner">
      <div className="app-topbar__brand">harumeal</div>
      <nav className="app-topbar__nav">
        {NAV_TABS.map((tab) => {
          const isActive = active === tab.key
          const color = isActive ? 'var(--primary)' : 'var(--ink-3)'
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleNav(tab)}
              className="press app-topbar__item"
              aria-current={isActive ? 'page' : undefined}
              style={{ color }}
            >
              <Icon filled={isActive} size={18} color={color} />
              <span className="app-topbar__label">{tab.label}</span>
            </button>
          )
        })}
      </nav>
      </div>{/* /app-topbar__inner */}
    </header>
  )
}
