import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'nodejs', maxDuration: 10 }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return new Response('Missing stripe-signature', { status: 400 })
  }

  const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '')
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'] ?? ''

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret)
  } catch {
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  const supabase = createClient(
    process.env['VITE_SUPABASE_URL'] ?? '',
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
  )

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.['user_id']
    const plan = session.metadata?.['plan'] as 'starter' | 'pro' | undefined
    const customerId = typeof session.customer === 'string' ? session.customer : null
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null

    if (userId && plan) {
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        tier: plan,
        status: 'active',
        current_period_end: null,
      }, { onConflict: 'user_id' })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = typeof sub.customer === 'string' ? sub.customer : null

    if (customerId) {
      await supabase
        .from('subscriptions')
        .update({ tier: 'free', status: 'canceled' })
        .eq('stripe_customer_id', customerId)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
