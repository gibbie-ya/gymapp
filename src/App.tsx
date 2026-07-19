import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { ProgrammeSelectPage } from './pages/ProgrammeSelectPage'
import { WeekViewPage } from './pages/WeekViewPage'
import { SessionLoggerPage } from './pages/SessionLoggerPage'
import { ProgressPage } from './pages/ProgressPage'
import { ImportPage } from './pages/ImportPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session && location.pathname !== '/login') {
        navigate('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate, location.pathname])

  if (session === undefined) {
    return (
      <div className="pulse" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#68686f',
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: '14px',
      }}>
        Loading...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RootRedirect() {
  const [redirectTo, setRedirectTo] = useState<string | null>(null)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setRedirectTo('/select'); return }

      const { data } = await supabase
        .from('user_programmes')
        .select('id')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()

      setRedirectTo(data ? '/train' : '/select')
    }
    check()
  }, [])

  if (!redirectTo) return null
  return <Navigate to={redirectTo} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <RootRedirect />
            </AuthGuard>
          }
        />
        <Route
          path="/select"
          element={
            <AuthGuard>
              <ProgrammeSelectPage />
            </AuthGuard>
          }
        />
        <Route
          path="/train"
          element={
            <AuthGuard>
              <WeekViewPage />
            </AuthGuard>
          }
        />
        <Route
          path="/train/week/:week"
          element={
            <AuthGuard>
              <WeekViewPage />
            </AuthGuard>
          }
        />
        <Route
          path="/train/week/:week/session/:session"
          element={
            <AuthGuard>
              <SessionLoggerPage />
            </AuthGuard>
          }
        />
        <Route
          path="/progress"
          element={
            <AuthGuard>
              <ProgressPage />
            </AuthGuard>
          }
        />
        <Route
          path="/import"
          element={
            <AuthGuard>
              <ImportPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
