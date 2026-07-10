import { supabase } from './supabase.js'

/**
 * 현재 세션의 Supabase access_token 반환.
 * 비로그인 또는 세션 없을 때 null.
 */
export async function getAccessToken() {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}
