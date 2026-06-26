import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function Callback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.exchangeCodeForSession(window.location.search).then(({ error: err }) => {
      if (err) {
        setError(err.message)
      } else {
        navigate('/dashboard', { replace: true })
      }
    })
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
