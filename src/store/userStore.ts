import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type Tier = 'free' | 'starter' | 'pro'

interface UserState {
  user: User | null
  tier: Tier
  isLoading: boolean

  setUser: (user: User | null) => void
  setTier: (tier: Tier) => void
  setIsLoading: (loading: boolean) => void
  reset: () => void
  init: () => Promise<() => void>
}

async function fetchTier(userId: string): Promise<Tier> {
  const { data } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (data?.tier === 'pro') return 'pro'
  if (data?.tier === 'starter') return 'starter'
  return 'free'
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  tier: 'free',
  isLoading: true,

  setUser: (user) => set({ user }),
  setTier: (tier) => set({ tier }),
  setIsLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, tier: 'free', isLoading: false }),

  init: async () => {
    // Restore existing session on page load
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      const tier = await fetchTier(session.user.id)
      set({ user: session.user, tier, isLoading: false })
    } else {
      set({ isLoading: false })
    }

    // Listen for future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const tier = await fetchTier(session.user.id)
        set({ user: session.user, tier })
      } else {
        set({ user: null, tier: 'free' })
      }
    })

    // Return unsubscribe function for cleanup
    return () => subscription.unsubscribe()
  },
}))
