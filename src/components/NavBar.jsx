import { useLocation, useNavigate } from 'react-router-dom'
import { getActiveTab } from '../routes.js'
import { NAV_TABS } from './navConfig.js'

export default function NavBar({ active: activeProp, onNavigate, className = '' }) {
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
    <nav
      className={`app-bottom-nav${className ? ` ${className}` : ''}`}
      aria-label="주요 메뉴"
    >
      {NAV_TABS.map((tab) => {
        const isActive = active === tab.key
        const color = isActive ? 'var(--primary)' : 'var(--ink-3)'
        const Icon = tab.icon
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleNav(tab)}
            className="press app-bottom-nav__item"
            aria-current={isActive ? 'page' : undefined}
            style={{ color }}
          >
            <Icon filled={isActive} size={22} color={color} />
            <span className="app-bottom-nav__label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
