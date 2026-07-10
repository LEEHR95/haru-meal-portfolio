import { useReducer, useEffect, useRef, useMemo } from 'react'
import { AppContext } from './appContext.js'
import { buildInitialState, writeLS, LS_PENDING_PROFILE, LS_PENDING_ADD_PET, LS_BOOKMARKS, generatePetId } from './initialState.js'
import { appReducer } from './reducer.js'
import { API_ENABLED } from '../api/client.js'
import { fetchProfile, saveProfile, normalizeProfileFromApi } from '../api/profile.js'
import { fetchBookmarks, migrateBookmarks } from '../api/bookmarks.js'

const _LS_PROFILE = 'haru_profile'
const _LS_PETS = 'haru_pets'
const _LS_ACTIVE_PET_ID = 'haru_activePetId'
let _hydrateInFlightUserId = null
let _hydratedUserId = null

function logHydrate(scope, payload = {}) {
  console.info(`[haru][hydrate] ${scope}`, payload)
}

// Supabase is only loaded when env vars are present.
let supabase = null
try {
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const mod = await import('../lib/supabase.js')
    supabase = mod.supabase
  }
} catch {
  // Ignore auth bootstrap failures when env is missing.
}

function usePersist(state) {
  const prevIsLoggedIn = useRef(state.isLoggedIn)

  useEffect(() => {
    writeLS('recentSearches', state.recentSearches)
  }, [state.recentSearches])

  useEffect(() => {
    if (!state.isLoggedIn) {
      writeLS('bookmarks', state.bookmarks)
    }
  }, [state.bookmarks, state.isLoggedIn])

  useEffect(() => {
    if (!state.isLoggedIn) {
      if (state.profile === null) {
        try { localStorage.removeItem(_LS_PROFILE) } catch { /* ignore */ }
        return
      }
      writeLS('profile', state.profile)
    }
  }, [state.profile, state.isLoggedIn])

  useEffect(() => {
    if (!Array.isArray(state.pets) || state.pets.length === 0) {
      try { localStorage.removeItem(_LS_PETS) } catch { /* ignore */ }
      return
    }
    writeLS('pets', state.pets)
  }, [state.pets])

  useEffect(() => {
    if (!state.activePetId) {
      try { localStorage.removeItem(_LS_ACTIVE_PET_ID) } catch { /* ignore */ }
      return
    }
    writeLS('activePetId', state.activePetId)
  }, [state.activePetId])

  useEffect(() => {
    if (!state.isLoggedIn && prevIsLoggedIn.current) {
      try { localStorage.removeItem(_LS_PROFILE) } catch { /* ignore */ }
      try { localStorage.removeItem(_LS_PETS) } catch { /* ignore */ }
      try { localStorage.removeItem(_LS_ACTIVE_PET_ID) } catch { /* ignore */ }
      try { localStorage.removeItem(LS_PENDING_PROFILE) } catch { /* ignore */ }
      try { localStorage.removeItem(LS_PENDING_ADD_PET) } catch { /* ignore */ }
    }
    prevIsLoggedIn.current = state.isLoggedIn
  }, [state.isLoggedIn])
}

function toUserPayload(supabaseUser) {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: supabaseUser.user_metadata?.full_name
      || supabaseUser.email?.split('@')[0]
      || '사용자',
    avatar: supabaseUser.user_metadata?.avatar_url ?? null,
  }
}

function readLocalProfileRaw() {
  try {
    const raw = localStorage.getItem(_LS_PROFILE)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function clearLocalProfileStorage() {
  try { localStorage.removeItem(_LS_PROFILE) } catch { /* ignore */ }
}

function readPendingProfileRaw() {
  try {
    const raw = localStorage.getItem(LS_PENDING_PROFILE)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function clearPendingProfileStorage() {
  try { localStorage.removeItem(LS_PENDING_PROFILE) } catch { /* ignore */ }
}

function readPendingAddPetRaw() {
  try { return localStorage.getItem(LS_PENDING_ADD_PET) === 'true' } catch { return false }
}

function clearPendingAddPetStorage() {
  try { localStorage.removeItem(LS_PENDING_ADD_PET) } catch { /* ignore */ }
}

function readLocalPetsRaw() {
  try {
    const raw = localStorage.getItem(_LS_PETS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readLocalActivePetIdRaw() {
  try {
    const raw = localStorage.getItem(_LS_ACTIVE_PET_ID)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function readLocalBookmarksRaw() {
  try {
    const raw = localStorage.getItem(LS_BOOKMARKS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((id) => String(id || '').trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

function clearLocalBookmarksStorage() {
  try { localStorage.removeItem(LS_BOOKMARKS) } catch { /* ignore */ }
}

async function hydrateBookmarksForUser(userId, dispatch) {
  logHydrate('bookmarks:hydrate-start', { userId, apiEnabled: API_ENABLED, hasUserId: Boolean(userId) })
  if (!API_ENABLED || !userId) {
    logHydrate('bookmarks:hydrate-skip', { apiEnabled: API_ENABLED, userId })
    return
  }

  const localBookmarks = Array.from(new Set(readLocalBookmarksRaw()))
  const remote = await fetchBookmarks(userId)
  logHydrate('bookmarks:fetch', {
    userId,
    localCount: localBookmarks.length,
    remoteCount: Array.isArray(remote) ? remote.length : null,
    remoteType: Array.isArray(remote) ? 'array' : typeof remote,
  })

  if (!Array.isArray(remote)) {
    if (localBookmarks.length > 0) {
      logHydrate('bookmarks:fallback-local', { userId, count: localBookmarks.length })
      dispatch({ type: 'setBookmarks', value: localBookmarks })
    }
    dispatch({
      type: 'toast',
      value: '북마크를 서버에서 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    })
    return
  }

  let nextBookmarks = remote

  if (localBookmarks.length > 0) {
    const migrated = await migrateBookmarks(localBookmarks, userId)
    logHydrate('bookmarks:migrate', {
      userId,
      localCount: localBookmarks.length,
      migratedCount: Array.isArray(migrated) ? migrated.length : null,
    })
    if (Array.isArray(migrated)) {
      nextBookmarks = migrated
      clearLocalBookmarksStorage()
    } else {
      nextBookmarks = Array.from(new Set([...remote, ...localBookmarks]))
      dispatch({
        type: 'toast',
        value: '기기 북마크를 계정에 옮기지 못했어요. 로그인 상태에서 다시 시도해 주세요.',
      })
    }
  }

  logHydrate('bookmarks:dispatch', { userId, count: nextBookmarks.length })
  dispatch({ type: 'setBookmarks', value: nextBookmarks })
}

function toHydratePet(profileLike) {
  const normalized = normalizeProfileFromApi(profileLike) ?? profileLike
  if (!normalized || typeof normalized !== 'object') return null
  const petFields = { ...normalized }
  delete petFields.pets
  delete petFields.activePetId
  const rawId = String(profileLike?.id || '').trim()
  return {
    ...petFields,
    id: rawId || generatePetId(),
  }
}

function toHydratePets(rawPets) {
  return (Array.isArray(rawPets) ? rawPets : [])
    .map((pet) => toHydratePet(pet))
    .filter(Boolean)
}

function resolveHydrateActivePetId(pets, requestedId) {
  const reqId = String(requestedId || '').trim()
  if (reqId && pets.some((pet) => pet.id === reqId)) {
    return reqId
  }
  return pets[0]?.id ?? null
}

function mergePendingIntoPets(basePets, requestedId, pendingRaw) {
  const pets = toHydratePets(basePets)
  const pendingPet = toHydratePet(pendingRaw)

  if (!pendingPet) {
    return {
      pets,
      activePetId: resolveHydrateActivePetId(pets, requestedId),
      applied: false,
    }
  }

  if (pets.length === 0) {
    return {
      pets: [pendingPet],
      activePetId: pendingPet.id,
      applied: true,
    }
  }

  const targetId = resolveHydrateActivePetId(pets, requestedId)
  const targetPet = pets.find((pet) => pet.id === targetId) ?? null
  const normalizedTargetName = String(targetPet?.name || '').trim().toLowerCase()
  const normalizedPendingName = String(pendingPet.name || '').trim().toLowerCase()
  const isSamePet = !!targetPet && (
    targetPet.id === pendingPet.id
    || (normalizedTargetName && normalizedTargetName === normalizedPendingName)
  )

  if (isSamePet) {
    return {
      pets,
      activePetId: targetId,
      applied: false,
    }
  }

  return {
    pets: pets.map((pet) =>
      pet.id === targetId ? { ...pet, ...pendingPet, id: targetId } : pet,
    ),
    activePetId: targetId,
    applied: true,
  }
}

/**
 * Hydrate dogs for a logged-in user.
 *
 * Priority:
 * 1. Server dogs pets[] -> setPets
 * 2. localStorage haru_pets[] -> upload all -> setPets
 * 3. legacy flat profile (pending/local/server) -> convert to one pet -> setPets
 * 4. otherwise keep empty state
 */
async function hydrateProfileForUser(userId, dispatch) {
  if (!API_ENABLED || !userId) return

  // +추가 → 로그인 경로: 로그인 후 새 pet 자동 생성 신호
  const pendingAddPet = readPendingAddPetRaw()

  try {
    const res = await fetchProfile(null, userId)
    const dbProfile = res?.profile ?? null
    const pendingRaw = readPendingProfileRaw()
    const localRaw = readLocalProfileRaw()
    const serverPets = toHydratePets(dbProfile?.pets)
    const serverActivePetId = resolveHydrateActivePetId(serverPets, dbProfile?.activePetId)
    logHydrate('profile:fetch', {
      userId,
      hasProfile: Boolean(dbProfile),
      serverPets: serverPets.length,
      serverActivePetId,
      hasPendingProfile: Boolean(pendingRaw),
      hasLocalProfile: Boolean(localRaw),
    })

    if (serverPets.length > 0) {
      // 1) pending을 서버 pets에 병합 (pending = 로그인하고 저장하기 경유 임시값)
      const mergedServer = mergePendingIntoPets(serverPets, serverActivePetId, pendingRaw)

      // 2) 비로그인 local pets 병합 — 서버에 없는 것만 빈 슬롯(최대 2마리)에 추가
      //    같은 id 또는 같은 name이면 중복으로 간주하여 건너뜀
      const localPets = toHydratePets(readLocalPetsRaw())
      let finalPets = mergedServer.pets
      let localMergeCount = 0
      const baseIds = new Set(mergedServer.pets.map((p) => p.id))
      const baseNames = new Set(
        mergedServer.pets.map((p) => (p.name || '').trim().toLowerCase()).filter(Boolean),
      )
      const allLocalPetsDuplicate = (
        localPets.length > 0
        && localPets.every((pet) => (
          baseIds.has(pet.id)
          || (!!pet.name && baseNames.has((pet.name || '').trim().toLowerCase()))
        ))
      )
      if (localPets.length > 0 && finalPets.length < 2) {
        const existingIds = new Set(finalPets.map((p) => p.id))
        const existingNames = new Set(
          finalPets.map((p) => (p.name || '').trim().toLowerCase()).filter(Boolean),
        )
        for (const lp of localPets) {
          if (finalPets.length >= 2) break
          if (existingIds.has(lp.id)) continue
          if (lp.name && existingNames.has((lp.name || '').trim().toLowerCase())) continue
          finalPets = [...finalPets, lp]
          localMergeCount++
        }
      }

      // 3) pending 적용 또는 local 병합이 있을 때만 서버 저장
      const shouldSave = mergedServer.applied || localMergeCount > 0
      let nextPets = finalPets
      let nextActivePetId = mergedServer.activePetId
      if (shouldSave) {
        const candidateActivePetId = mergedServer.activePetId
        const activePet = finalPets.find((p) => p.id === candidateActivePetId) ?? finalPets[0]
        const saved = await saveProfile(null, activePet, {
          userId,
          pets: finalPets,
          activePetId: candidateActivePetId,
        })
        const savedPets = toHydratePets(saved?.pets || saved?.profile?.pets || [])
        nextPets = saved?.ok && savedPets.length > 0 ? savedPets : finalPets
        nextActivePetId = resolveHydrateActivePetId(
          nextPets,
          saved?.ok
            ? (saved?.activePetId || saved?.profile?.activePetId || candidateActivePetId)
            : candidateActivePetId,
        )
        if (saved?.ok) {
          clearPendingProfileStorage()
          if (localMergeCount > 0) {
            // 로컬 pets가 서버에 병합됐으므로 로컬 저장소 정리
            try { localStorage.removeItem(_LS_PETS) } catch { /* ignore */ }
            try { localStorage.removeItem(_LS_ACTIVE_PET_ID) } catch { /* ignore */ }
          }
        } else {
          console.warn('[haru] server merge save failed — local state retained, will retry on next login')
          dispatch({
            type: 'toast',
            value: '기기에는 임시 저장됐지만 서버 동기화에 실패했어요. 다시 로그인하거나 저장을 눌러주세요.',
          })
        }
      } else if (allLocalPetsDuplicate && !mergedServer.applied) {
        // 서버에 이미 같은 pets가 있으므로 중복 로컬 임시 저장만 정리
        try { localStorage.removeItem(_LS_PETS) } catch { /* ignore */ }
        try { localStorage.removeItem(_LS_ACTIVE_PET_ID) } catch { /* ignore */ }
      }

      logHydrate('profile:dispatch-server-pets', {
        userId,
        count: nextPets.length,
        activePetId: nextActivePetId,
        mergedPending: mergedServer.applied,
        mergedLocalCount: localMergeCount,
      })
      dispatch({ type: 'setPets', pets: nextPets, activePetId: nextActivePetId })
      // +추가 → 로그인: 새 빈 pet 생성 + 활성화
      if (pendingAddPet) {
        if (nextPets.length < 2) dispatch({ type: 'addPet', value: {} })
        clearPendingAddPetStorage()
      }
      clearLocalProfileStorage()
      return
    }

    const localPets = toHydratePets(readLocalPetsRaw())
    const localActivePetId = resolveHydrateActivePetId(localPets, readLocalActivePetIdRaw())
    if (localPets.length > 0) {
      const mergedLocal = mergePendingIntoPets(localPets, localActivePetId, pendingRaw)
      const localActivePet = mergedLocal.pets.find((pet) => pet.id === mergedLocal.activePetId) ?? mergedLocal.pets[0]
      const saved = await saveProfile(null, localActivePet, {
        userId,
        pets: mergedLocal.pets,
        activePetId: mergedLocal.activePetId,
      })
      const savedPets = toHydratePets(saved?.pets)
      const nextPets = saved?.ok && savedPets.length > 0 ? savedPets : mergedLocal.pets
      const nextActivePetId = saved?.ok
        ? resolveHydrateActivePetId(nextPets, saved?.activePetId || mergedLocal.activePetId)
        : mergedLocal.activePetId
      // Keep local multi-pet state even if upload fails to avoid data loss.
      if (!saved?.ok) {
        console.warn('[haru] local pets upload failed — data saved locally but not synced to server')
        dispatch({
          type: 'toast',
          value: '기기에는 임시 저장됐지만 서버 동기화에 실패했어요. 다시 저장해 주세요.',
        })
      }
      logHydrate('profile:dispatch-local-pets', {
        userId,
        count: nextPets.length,
        activePetId: nextActivePetId,
        uploadOk: Boolean(saved?.ok),
      })
      dispatch({ type: 'setPets', pets: nextPets, activePetId: nextActivePetId })
      // +추가 → 로그인: 새 빈 pet 생성 + 활성화
      if (pendingAddPet) {
        if (nextPets.length < 2) dispatch({ type: 'addPet', value: {} })
        clearPendingAddPetStorage()
      }
      clearLocalProfileStorage()
      if (saved?.ok || !mergedLocal.applied) {
        clearPendingProfileStorage()
      }
      return
    }

    const legacySource = pendingRaw ?? localRaw ?? dbProfile
    const legacyPet = toHydratePet(legacySource)

    if (legacyPet) {
      const legacyPets = [legacyPet]
      const saved = await saveProfile(null, legacyPet, {
        userId,
        pets: legacyPets,
        activePetId: legacyPet.id,
      })
      logHydrate('profile:dispatch-legacy-pet', {
        userId,
        count: legacyPets.length,
        activePetId: legacyPet.id,
        uploadOk: Boolean(saved?.ok),
      })
      dispatch({ type: 'setPets', pets: legacyPets, activePetId: legacyPet.id })
      // +추가 → 로그인: 새 빈 pet 생성 + 활성화
      if (pendingAddPet) {
        if (legacyPets.length < 2) dispatch({ type: 'addPet', value: {} })
        clearPendingAddPetStorage()
      }
      if (saved?.ok) {
        clearPendingProfileStorage()
        clearLocalProfileStorage()
      }
    }
    // fallthrough: 어떤 경로도 실행되지 않은 경우 (신규 빈 유저) — stale LS_PENDING_ADD_PET 정리
    if (pendingAddPet) clearPendingAddPetStorage()
  } catch {
    logHydrate('profile:error', { userId })
    // Ignore hydrate failure and keep the app usable.
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, buildInitialState)
  usePersist(state)
  const value = useMemo(() => ({ state, dispatch }), [state])
  const hydrateInFlightRef = useRef(null)
  const hydratedUserIdRef = useRef(null)
  const dietSyncKeyRef = useRef(null)

  useEffect(() => {
    if (!supabase) {
      dispatch({ type: 'setAuthReady', value: true })
      return
    }

    const onUserSession = async (user) => {
      const userPayload = toUserPayload(user)
      dispatch({ type: 'login', value: userPayload })
      const userId = String(user?.id || '').trim()
      if (!userId) return
      if (hydrateInFlightRef.current === userId) {
        logHydrate('session:skip-in-flight-ref', { userId })
        return
      }
      if (hydratedUserIdRef.current === userId) {
        logHydrate('session:skip-hydrated-ref', { userId })
        return
      }
      if (_hydrateInFlightUserId === userId) {
        logHydrate('session:skip-global-in-flight', { userId })
        return
      }
      if (_hydratedUserId === userId) {
        logHydrate('session:skip-global-hydrated', { userId })
        return
      }

      hydrateInFlightRef.current = userId
      _hydrateInFlightUserId = userId
      logHydrate('session:start', { userId })
      try {
        // 계정 전환 시 이전 계정의 pets/profile/bookmarks가 신규 계정에 보이지 않도록 즉시 초기화.
        // 같은 사용자 재진입은 skip-hydrated-ref 가드에서 이미 return되므로 여기까지 오지 않음.
        dispatch({ type: 'setPets', pets: [], activePetId: null })
        dispatch({ type: 'setBookmarks', value: [] })
        await hydrateProfileForUser(userId, dispatch)
        hydratedUserIdRef.current = userId
        _hydratedUserId = userId
        logHydrate('session:profile-complete', { userId })
      } finally {
        if (hydrateInFlightRef.current === userId) {
          hydrateInFlightRef.current = null
        }
        if (_hydrateInFlightUserId === userId) {
          _hydrateInFlightUserId = null
        }
        logHydrate('session:end', { userId })
      }
    }

    let didMarkAuthReady = false
    const markAuthReady = () => {
      if (didMarkAuthReady) return
      didMarkAuthReady = true
      dispatch({ type: 'setAuthReady', value: true })
    }

    supabase.auth.getSession()
      .then(({ data }) => {
        if (data.session?.user) {
          void onUserSession(data.session.user)
        }
      })
      .finally(() => {
        markAuthReady()
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') {
          markAuthReady()
        }

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          void onUserSession(session.user)
        }

        if (event === 'SIGNED_OUT') {
          hydrateInFlightRef.current = null
          hydratedUserIdRef.current = null
          dietSyncKeyRef.current = null
          _hydrateInFlightUserId = null
          _hydratedUserId = null
          try { localStorage.removeItem(_LS_PROFILE) } catch { /* ignore */ }
          try { localStorage.removeItem(_LS_PETS) } catch { /* ignore */ }
          try { localStorage.removeItem(_LS_ACTIVE_PET_ID) } catch { /* ignore */ }
          try { localStorage.removeItem(LS_PENDING_PROFILE) } catch { /* ignore */ }
          try { localStorage.removeItem(LS_PENDING_ADD_PET) } catch { /* ignore */ }
          dispatch({ type: 'logout', bookmarks: readLocalBookmarksRaw() })
          markAuthReady()
        }
      },
    )

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    logHydrate('bookmarks:effect-check', {
      isLoggedIn: state.isLoggedIn,
      userId: state.user?.id ?? null,
      apiEnabled: API_ENABLED,
    })
    if (!state.isLoggedIn || !state.user?.id || !API_ENABLED) {
      logHydrate('bookmarks:effect-early-return', {
        isLoggedIn: state.isLoggedIn,
        hasUserId: Boolean(state.user?.id),
        apiEnabled: API_ENABLED,
      })
      return undefined
    }

    let cancelled = false
    const userId = String(state.user.id || '').trim()
    if (!userId) {
      logHydrate('bookmarks:effect-empty-userid', {})
      return undefined
    }

    const safeDispatch = (action) => {
      if (!cancelled) dispatch(action)
    }

    ;(async () => {
      await hydrateBookmarksForUser(userId, safeDispatch)
    })()

    return () => {
      cancelled = true
    }
  }, [state.isLoggedIn, state.user?.id, dispatch])

  // 식생활 기록 Supabase 동기화 (백업·복원·다기기 — 전략 B).
  // GET /list 복원 + LS 기록 push(서버가 owned/dog_id_map 으로 해소·격리).
  // pets 가 채워진 뒤 실행되도록 key 에 포함(서버 dog_id_map 은 프로필 저장 시 기록됨).
  // LS 가 주 저장소이므로 실패해도 기능에 영향 없음.
  useEffect(() => {
    if (!state.isLoggedIn || !state.user?.id || !API_ENABLED) return undefined
    const userId = String(state.user.id || '').trim()
    if (!userId) return undefined
    const ownedIds = (state.pets || []).map((p) => p?.id).filter(Boolean)
    const key = `${userId}|${[...ownedIds].sort().join(',')}`
    if (dietSyncKeyRef.current === key) return undefined
    dietSyncKeyRef.current = key

    let cancelled = false
    ;(async () => {
      try {
        const { syncDietLogsOnLogin } = await import('../utils/dietLog.js')
        if (!cancelled) await syncDietLogsOnLogin()
      } catch { /* ignore */ }
    })()

    return () => {
      cancelled = true
    }
  }, [state.isLoggedIn, state.user?.id, state.pets])

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}
