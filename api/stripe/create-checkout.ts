import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge', maxDuration: 10 }

const PLAN_PRICES: Record<string, string> = {
  starter: process.env['STRIPE_PRICE_STARTER'] ?? '',
  pro: process.env['STRIPE_PRICE_PRO'] ?? '',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
  }
  const token = authHeader.slice(7)

  const supabase = createClient(
    process.env['VITE_SUPABASE_URL'] ?? '',
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
  }

  const body = await req.json() as { plan?: string }
  const plan = body.plan
  if (!plan || !PLAN_PRICES[plan]) {
    return new Response(JSON.stringify({ message: 'Invalid plan' }), { status: 400 })
  }

  const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '')

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: PLAN_PRICES[plan], quantity: 1 }],
    success_url: `${process.env['VITE_APP_URL'] ?? ''}/dashboard?upgraded=1`,
    cancel_url: `${process.env['VITE_APP_URL'] ?? ''}/pricing`,
    metadata: { user_id: user.id, plan },
    customer_email: user.email,
  })

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
