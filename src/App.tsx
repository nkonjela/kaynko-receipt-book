import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useUserStore } from '@/store/userStore'
import ProtectedRoute from '@/components/ProtectedRoute'
import Dashboard from '@/pages/Dashboard'
import Editor from '@/pages/Editor'
import Templates from '@/pages/Templates'
import Pricing from '@/pages/Pricing'
import Login from '@/pages/auth/Login'
import Callback from '@/pages/auth/Callback'

export default function App() {
  const init = useUserStore((s) => s.init)

  useEffect(() => {
    let cleanup: (() => void) | undefined
    init().then((fn) => { cleanup = fn })
    return () => { cleanup?.() }
  }, [init])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/editor/:designId?" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/callback" element={<Callback />} />
      </Routes>
    </BrowserRouter>
  )
}
