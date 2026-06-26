import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useUserStore } from '@/store/userStore'

interface Props {
  children: ReactNode
}

export default function ProtectedRoute({ children }: Props) {
  const user = useUserStore((s) => s.user)
  const isLoading = useUserStore((s) => s.isLoading)

  if (isLoading) {
    return (
      <main className="min-h-screen bg-krb-bg flex items-center justify-center">
        <div className="text-krb-ink3 text-sm">Loading…</div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />
  }

  return <>{children}</>
}
