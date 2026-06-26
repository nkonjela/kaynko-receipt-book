import { supabase } from '@/lib/supabase'

export async function createCheckoutSession(plan: 'starter' | 'pro'): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Must be signed in to upgrade')

  const response = await fetch('/api/stripe/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ plan }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as Record<string, unknown>
    throw new Error((err['message'] as string | undefined) ?? 'Failed to create checkout session')
  }

  const data = await response.json() as { url: string }
  return data.url
}
