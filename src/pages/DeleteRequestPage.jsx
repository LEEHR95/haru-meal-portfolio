import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../routes.js'

// /delete 경로는 /contact?type=account_delete_request 로 리다이렉트
// 실제 삭제 처리는 ContactPage account_delete_request 흐름에서 수행
export default function DeleteRequestPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate(`${ROUTES.contact}?type=account_delete_request`, { replace: true })
  }, [navigate])

  return null
}
