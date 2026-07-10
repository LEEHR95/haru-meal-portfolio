import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_ENABLED } from '../api/client.js'
import { fetchReactionStatsBulk } from '../api/profile.js'

export default function useRecipeReactionSummaries(recipeIds, options = {}) {
  const enabled = options.enabled ?? true
  const normalizedIds = useMemo(
    () => [...new Set((recipeIds ?? []).map((id) => String(id || '').trim()).filter(Boolean))],
    [recipeIds],
  )
  const [statusMap, setStatusMap] = useState({})
  const statusRef = useRef({})          // statusMap 미러 — fetch effect 의존성에서 statusMap 제거용
  const inFlightRef = useRef(new Set())
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const applyStatus = useCallback((patch) => {
    statusRef.current = { ...statusRef.current, ...patch }
    setStatusMap((prev) => ({ ...prev, ...patch }))
  }, [])

  // 배치(N→1)로 미해결 recipe_id 의 반응통계를 가져온다.
  // ⚠️ 취소(cancel) 게이팅을 두지 않는다: 과거엔 statusMap 을 의존성에 넣어 리렌더마다
  // effect 가 재실행되며 진행 중 fetch 를 취소했고, 취소되면 결과 미반영 + 재요청도 안 돼
  // "데이터는 200으로 왔는데 스켈레톤이 안 풀리는" 영구 pending 이 생겼다(보관함 무한로딩).
  // → 결과는 언마운트가 아니면 항상 반영하고, 의존성에서 statusMap 을 뺀다(statusRef 로 필터).
  useEffect(() => {
    if (!enabled || !API_ENABLED || normalizedIds.length === 0) return undefined
    const newIds = normalizedIds.filter(
      (id) => !statusRef.current[id]?.done && !inFlightRef.current.has(id),
    )
    if (!newIds.length) return undefined
    newIds.forEach((id) => inFlightRef.current.add(id))

    fetchReactionStatsBulk(newIds)
      .then((map) => {
        const safe = map && typeof map === 'object' ? map : {}
        const patch = {}
        newIds.forEach((id) => { patch[id] = { done: true, stats: safe[id] ?? null } })
        newIds.forEach((id) => inFlightRef.current.delete(id))
        if (mountedRef.current) applyStatus(patch)
      })
      .catch(() => {
        const patch = {}
        newIds.forEach((id) => { patch[id] = { done: true, stats: null } })
        newIds.forEach((id) => inFlightRef.current.delete(id))
        if (mountedRef.current) applyStatus(patch)
      })

    return undefined
  }, [enabled, normalizedIds, applyStatus])

  // 단건 반응 변경 이벤트 → 해당 recipe 갱신
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleReactionUpdate = (event) => {
      const recipeId = String(event?.detail?.recipeId || '').trim()
      if (!recipeId) return
      applyStatus({ [recipeId]: { done: true, stats: event?.detail?.stats ?? null } })
    }
    window.addEventListener('haru:reaction-updated', handleReactionUpdate)
    return () => window.removeEventListener('haru:reaction-updated', handleReactionUpdate)
  }, [applyStatus])

  const reactionMap = useMemo(() => {
    const next = {}
    Object.entries(statusMap).forEach(([recipeId, entry]) => {
      if (entry?.stats) next[recipeId] = entry.stats
    })
    return next
  }, [statusMap])

  const isResolved = useCallback((recipeId) => {
    if (!enabled || !API_ENABLED) return true
    const key = String(recipeId || '').trim()
    if (!key) return true
    return Boolean(statusMap[key]?.done)
  }, [enabled, statusMap])

  const areAllResolved = useMemo(
    () => normalizedIds.every((id) => isResolved(id)),
    [isResolved, normalizedIds],
  )

  return {
    reactionMap,
    statusMap,
    isResolved,
    areAllResolved,
  }
}
