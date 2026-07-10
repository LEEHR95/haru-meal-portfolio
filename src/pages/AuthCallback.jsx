import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../routes.js'
import { supabase } from '../lib/supabase.js'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuth = async () => {
      const { data } = await supabase.auth.getSession()

      window.history.replaceState({}, document.title, ROUTES.profile)

      navigate(ROUTES.profile, { replace: true })
    }
    handleAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: 'var(--ink-3)',
      fontSize: 14,
    }}>
      로그인 처리 중...
    </div>
  )
}
