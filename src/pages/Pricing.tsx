import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '@/store/userStore'
import { createCheckoutSession } from '@/lib/stripe'

const plans = [
  {
    key: 'free' as const,
    name: 'Free',
    price: '$0',
    per: '',
    desc: 'Try it, trust it',
    features: [
      '3 designs / month',
      'Up to 10 pages per book',
      '5 starter templates',
      'PDF export (with watermark)',
      '3 AI generations / month',
    ],
    cta: 'Get started',
    highlight: false,
  },
  {
    key: 'starter' as const,
    name: 'Starter',
    price: '$3',
    per: '/mo',
    desc: 'Best for small businesses',
    features: [
      'Unlimited designs',
      'Up to 100 pages per book',
      'All templates',
      'PDF export — no watermark',
      'CMYK export',
      'Unlimited AI generations',
    ],
    cta: 'Upgrade to Starter',
    highlight: true,
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: '$9',
    per: '/mo',
    desc: 'Print shops & power users',
    features: [
      'Everything in Starter',
      'Unlimited pages per book',
      'Custom paper sizes',
      'Multi-up layout (3-up on A4)',
      'Imposed / booklet PDF',
      'Team sharing',
    ],
    cta: 'Upgrade to Pro',
    highlight: false,
  },
]

export default function Pricing() {
  const user = useUserStore((s) => s.user)
  const tier = useUserStore((s) => s.tier)
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleUpgrade(plan: 'starter' | 'pro') {
    if (!user) {
      navigate('/auth/login')
      return
    }
    setLoading(plan)
    setError('')
    try {
      const url = await createCheckoutSession(plan)
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-krb-bg py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-krb-navy text-center mb-2">Simple pricing</h1>
        <p className="text-krb-ink3 text-center mb-12">
          Start free, upgrade when you're ready to print professionally.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-8 text-center">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = tier === plan.key
            const isUpgradeable = plan.key !== 'free' && !isCurrent

            return (
              <div
                key={plan.key}
                className={`bg-white rounded-xl border p-6 flex flex-col ${
                  plan.highlight
                    ? 'border-krb-orange shadow-md'
                    : 'border-krb-rule'
                }`}
              >
                {plan.highlight && (
                  <div className="text-xs font-bold text-krb-orange uppercase tracking-widest mb-3">
                    Most popular
                  </div>
                )}
                <div className="text-sm text-krb-ink3 uppercase tracking-wider">{plan.name}</div>
                <div className="mt-1 mb-1">
                  <span className="text-4xl font-bold text-krb-navy">{plan.price}</span>
                  <span className="text-krb-ink3 text-sm">{plan.per}</span>
                </div>
                <div className="text-krb-ink3 text-sm mb-6">{plan.desc}</div>

                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-krb-ink">
                      <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full rounded-lg py-2 text-sm font-semibold text-center border border-krb-rule text-krb-ink3">
                    Current plan
                  </div>
                ) : isUpgradeable ? (
                  <button
                    type="button"
                    disabled={loading === plan.key}
                    onClick={() => handleUpgrade(plan.key as 'starter' | 'pro')}
                    className={`w-full rounded-lg py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 ${
                      plan.highlight ? 'bg-krb-orange' : 'bg-krb-navy'
                    }`}
                  >
                    {loading === plan.key ? 'Redirecting…' : plan.cta}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(user ? '/dashboard' : '/auth/login')}
                    className="w-full rounded-lg py-2 text-sm font-semibold border border-krb-navy text-krb-navy hover:bg-krb-navy hover:text-white"
                  >
                    {plan.cta}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
