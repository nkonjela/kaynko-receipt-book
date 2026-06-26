import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function Callback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorDesc = params.get('error_description') ?? params.get('error')
    const code = params.get('code')

    if (errorDesc) {
      setError(decodeURIComponent(errorDesc))
      return
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(window.location.href).then(({ error: err }) => {
        if (err) {
          setError(err.message)
        } else {
          navigate('/dashboard', { replace: true })
        }
      })
      return
    }

    // Magic link / hash-based session — Supabase handles it via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        subscription.unsubscribe()
        navigate('/dashboard', { replace: true })
      }
    })
    // Timeout fallback
    const t = setTimeout(() => {
      setError('Sign-in timed out. Please try again.')
    }, 10000)
    return () => { subscription.unsubscribe(); clearTimeout(t) }
  }, [navigate])

  if (error) {
    return (
      <main className="min-h-screen bg-krb-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <a href="/auth/login" className="text-krb-navy underline text-sm">Back to sign in</a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-krb-bg flex items-center justify-center">
      <p className="text-krb-ink3">Signing you in…</p>
    </main>
  )
}
