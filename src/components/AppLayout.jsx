import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useToast } from '../store/useApp.js'
import { ROUTES, shouldShowNav } from '../routes.js'
import { ERROR_MSG } from '../utils/errorMessages.js'
import AppTopBar from './AppTopBar.jsx'
import NavBar from './NavBar.jsx'
import Toast from './Toast.jsx'

export default function AppLayout() {
  const { pathname } = useLocation()
  const { toast, clear, show } = useToast()
  const showNav = shouldShowNav(pathname)
  const isStandaloneRoute = pathname === ROUTES.chat

  useEffect(() => {
    const onOffline = () => show(ERROR_MSG.offline)
    window.addEventListener('offline', onOffline)
    return () => window.removeEventListener('offline', onOffline)
  }, [show])

  return (
    <div
      className={[
        'app-shell',
        showNav ? 'app-shell--has-bottom-nav' : '',
        isStandaloneRoute ? 'app-shell--standalone' : '',
      ].filter(Boolean).join(' ')}
    >
      {showNav && <AppTopBar />}
      <main className={`app-main${isStandaloneRoute ? ' app-main--standalone' : ' app-scroll'}`}>
        <Outlet />
      </main>
      {showNav && <NavBar />}
      <Toast msg={toast} onDone={clear} />
    </div>
  )
}
