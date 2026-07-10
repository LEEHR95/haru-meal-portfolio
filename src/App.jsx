import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import AnalyticsTracker from './components/AnalyticsTracker.jsx'
import AppLayout from './components/AppLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import SafetyPage from './pages/SafetyPage.jsx'
import FeedPage from './pages/FeedPage.jsx'
import FeedAllPage from './pages/FeedAllPage.jsx'
import DetailPage from './pages/DetailPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import ProfileEditPage from './pages/ProfileEditPage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import DeleteRequestPage from './pages/DeleteRequestPage.jsx'
import OfflinePage from './pages/OfflinePage.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import DietLogPage from './pages/DietLogPage.jsx'
import { ROUTES } from './routes.js'

function OfflineRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    const handleOffline = () => navigate(ROUTES.offline, { replace: true })
    const handleOnline = () => navigate(ROUTES.home, { replace: true })
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [navigate])
  return null
}

export default function App() {
  return (
    <>
      <OfflineRedirect />
      <AnalyticsTracker />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path="/safety/:ingredient" element={<SafetyPage />} />
          <Route path={ROUTES.feed} element={<FeedPage />} />
          {/* /feed/all 은 /feed/:id 보다 먼저 선언해야 "all"이 id로 매칭되지 않음 */}
          <Route path={ROUTES.feedAll} element={<FeedAllPage />} />
          <Route path="/feed/:id" element={<DetailPage />} />
          <Route path={ROUTES.register} element={<RegisterPage />} />
          <Route path={ROUTES.chat} element={<ChatPage />} />
          <Route path="/profile/edit/:petId" element={<ProfileEditPage />} />
          <Route path={ROUTES.profile} element={<ProfilePage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
          <Route path={ROUTES.contact} element={<ContactPage />} />
          <Route path={ROUTES.privacy} element={<PrivacyPage />} />
          <Route path={ROUTES.terms} element={<TermsPage />} />
          <Route path={ROUTES.delete} element={<DeleteRequestPage />} />
          <Route path={ROUTES.dietLog} element={<DietLogPage />} />
          <Route path={ROUTES.offline} element={<OfflinePage />} />
          <Route path={ROUTES.authCallback} element={<AuthCallback />} />
          <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
        </Route>
      </Routes>
    </>
  )
}
