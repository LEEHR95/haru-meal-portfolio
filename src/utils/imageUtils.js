/**
 * 이미지 선택·압축·업로드 유틸리티
 *
 * 브라우저 input 기반 구현.
 * 추후 Capacitor Camera API로 전환 시 pickImage() 내부만 교체하면 됩니다.
 *
 * 권장 플로우:
 *   pickImage() → compressImage() → uploadImage() → saveRecipe()
 */

import imageCompression from 'browser-image-compression'
import { uploadImageToStorage } from '../lib/storage.js'

/** 지원 이미지 MIME 타입 */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/** 원본 파일 최대 크기 (bytes) — 초과 시 에러 */
const MAX_RAW_BYTES = 5 * 1024 * 1024  // 5MB

/**
 * 파일 유효성 검사
 * @param {File} file
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateImageFile(file) {
  if (!file) return { ok: false, error: '파일을 선택해주세요.' }
  // HEIC는 type이 비어있는 경우가 있어 확장자도 허용
  const isHeic = file.name?.toLowerCase().endsWith('.heic') || file.name?.toLowerCase().endsWith('.heif')
  if (!ALLOWED_TYPES.includes(file.type) && !isHeic) {
    return { ok: false, error: 'JPG, PNG, WEBP 이미지만 업로드할 수 있어요.' }
  }
  if (file.size > MAX_RAW_BYTES) {
    return { ok: false, error: '5MB 이하의 이미지만 업로드할 수 있어요.' }
  }
  return { ok: true }
}

/**
 * 이미지 선택 — 브라우저 file input 트리거
 * 추후 Capacitor: `Camera.getPhoto(...)` 로 교체
 *
 * @param {HTMLInputElement} inputEl - ref.current
 */
export function pickImage(inputEl) {
  if (inputEl) inputEl.click()
}

/**
 * 이미지 압축
 * @param {File} file
 * @returns {Promise<File>} 압축된 파일
 */
export async function compressImage(file) {
  return imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
  })
}

/**
 * Supabase Storage에 이미지 업로드 → public URL 반환
 * @param {File} file - 압축된 파일
 * @param {string} [userId]
 * @returns {Promise<string>} public URL
 */
export async function uploadImage(file, userId) {
  return uploadImageToStorage(file, userId)
}

/**
 * 파일 → 브라우저 로컬 미리보기 URL (objectURL)
 * 컴포넌트 언마운트 시 URL.revokeObjectURL() 호출 필요
 * @param {File} file
 * @returns {string}
 */
export function createPreviewUrl(file) {
  return URL.createObjectURL(file)
}
