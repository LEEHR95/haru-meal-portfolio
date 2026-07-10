// 아주 가벼운 메모리 TTL 캐시 (인프라 0, 유지비 0).
// SPA 내비게이션 동안 유지되어 재방문 시 네트워크를 줄인다(전체 새로고침 시 초기화 → 항상
// fresh 가능). 사용자별/민감 데이터는 캐시하지 않는다(레시피 목록·반응 집계 등 공개·읽기성만).
const store = new Map() // key -> { value, expires }

export function getCached(key) {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expires) {
    store.delete(key)
    return undefined
  }
  return entry.value
}

export function setCached(key, value, ttlMs = 60000) {
  store.set(key, { value, expires: Date.now() + ttlMs })
}

/** prefix 로 시작하는 키 무효화. prefix 없으면 전체 비움. (쓰기/변경 후 호출) */
export function clearCached(prefix) {
  if (!prefix) {
    store.clear()
    return
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
