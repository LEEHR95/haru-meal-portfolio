/**
 * Supabase Storage 업로드 헬퍼
 *
 * 버킷: recipe-images (Supabase 대시보드에서 생성 필요, Public 설정)
 * 경로: recipe-images/{userId}/{timestamp}.jpg
 *
 * 추후 Capacitor 전환 시 이 파일만 교체하면 됩니다.
 */

let supabase = null
try {
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const mod = await import('./supabase.js')
    supabase = mod.supabase
  }
} catch {
  // Supabase env 미설정 — Storage 비활성
}

const BUCKET = 'recipe-images'

/**
 * 이미지 파일을 Supabase Storage에 업로드하고 public URL 반환
 * @param {File} file - 압축된 이미지 파일
 * @param {string} [userId] - 로그인 사용자 ID (없으면 anonymous 폴더 사용)
 * @returns {Promise<string>} public URL
 * @throws {Error} 업로드 실패 시
 */
export async function uploadImageToStorage(file, userId) {
  if (!supabase) {
    throw new Error('Supabase가 설정되지 않았어요. 환경변수를 확인해주세요.')
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const folder = userId ?? 'anonymous'
  const path = `${folder}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw new Error(`이미지 업로드 실패: ${error.message}`)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
