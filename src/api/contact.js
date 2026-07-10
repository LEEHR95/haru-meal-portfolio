/**
 * POST /api/contact — 문의하기
 * multipart/form-data (텍스트 + 선택적 이미지 파일)
 */
import { API_ENABLED, API_URL } from './client.js'

/**
 * 문의 접수 API
 *
 * @param {{
 *   type: string,
 *   content: string,
 *   email?: string,
 *   userId?: string,
 *   files?: File[]
 * }} params
 * @returns {Promise<{ ok: boolean, id?: string, error?: string } | null>}
 */
export async function submitContact({ type, content, email, userId, files = [] }) {
  if (!API_ENABLED) return null

  // FormData 구성 — Content-Type 헤더를 직접 설정하면 안 됨
  // (브라우저가 multipart boundary 포함 Content-Type 을 자동 설정)
  const formData = new FormData()
  formData.append('type', type)
  formData.append('content', content.trim())
  if (email?.trim()) formData.append('email', email.trim())
  if (userId) formData.append('user_id', userId)
  files.forEach((file) => formData.append('images', file))

  try {
    const res = await fetch(`${API_URL}/api/contact`, {
      method: 'POST',
      body: formData,
      // Content-Type 미설정 — fetch 가 자동으로 multipart/form-data; boundary=... 추가
    })

    if (!res.ok) {
      let detail = '문의 접수에 실패했어요. 잠시 후 다시 시도해주세요.'
      try {
        const err = await res.json()
        if (err?.detail && typeof err.detail === 'string') detail = err.detail
      } catch { /* ignore parse error */ }
      return { ok: false, error: detail }
    }

    return await res.json()
  } catch {
    return null
  }
}
