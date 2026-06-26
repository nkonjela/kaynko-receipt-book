import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'

export default function Login() {
  const user = useUserStore((s) => s.user)
  const isLoading = useUserStore((s) => s.isLoading)

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isLoading && user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <main className="min-h-screen bg-krb-bg flex items-center justify-center">
      <div className="bg-white border border-krb-rule rounded-xl p-8 w-full max-w-sm shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-krb-orange rounded-lg flex items-center justify-center text-white font-black text-sm">
            KRB
          </div>
          <div>
            <div className="font-bold text-krb-navy">Kaynko</div>
            <div className="text-xs text-krb-ink3 uppercase tracking-widest">Receipt Book</div>
          </div>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-2xl mb-3">📬</div>
            <h2 className="text-lg font-bold text-krb-navy mb-2">Check your inbox</h2>
            <p className="text-krb-ink3 text-sm">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-krb-navy mb-1">Sign in</h1>
            <p className="text-krb-ink3 text-sm mb-6">No password needed — we'll email you a link.</p>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy"
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-krb-navy text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send magic link'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-krb-rule" />
              <span className="text-xs text-krb-ink3">or</span>
              <div className="flex-1 h-px bg-krb-rule" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="w-full border border-krb-rule rounded-lg py-2 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </>
        )}
      </div>
    </main>
  )
}
