import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { AppProvider } from './store/AppContext.jsx'
import App from './App.jsx'
import './styles/global.css'

const _sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (_sentryDsn) {
  Sentry.init({
    dsn: _sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    // 성능 트레이스 10%만 샘플링(무료 티어 트랜잭션 쿼터 절약). 에러는 100% 수집.
    tracesSampleRate: 0.1,
  })
}

// DSN 없을 때도 ErrorBoundary는 안전하게 동작 (Sentry 미초기화 시 no-op)
const AppTree = (
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <Sentry.ErrorBoundary>
          <App />
        </Sentry.ErrorBoundary>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
)

createRoot(document.getElementById('root')).render(AppTree)
