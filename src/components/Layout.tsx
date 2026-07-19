import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { colors, ui } from '../lib/utils'

interface LayoutProps {
  children: ReactNode
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: `${Math.round(size * 0.3)}px`,
      background: 'linear-gradient(135deg, #4ade80, #16a34a)',
      boxShadow: '0 0 16px rgba(34, 197, 94, 0.35)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none"
        stroke="#052e16" strokeWidth="2.8" strokeLinecap="round">
        <path d="M6 7v10M2.5 9.5v5M18 7v10M21.5 9.5v5M6 12h12" />
      </svg>
    </span>
  )
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItem = (path: string, label: string) => {
    const active = location.pathname === path || location.pathname.startsWith(path + '/')
    return (
      <button
        onClick={() => navigate(path)}
        style={{
          background: active ? 'rgba(34, 197, 94, 0.12)' : 'none',
          border: 'none',
          borderRadius: '999px',
          color: active ? colors.greenBright : colors.textMuted,
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: active ? 600 : 500,
          padding: '6px 13px',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.color = colors.textPrimary }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.color = colors.textMuted }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: ui.font }}>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: colors.header,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${colors.borderSubtle}`,
        padding: '0 20px',
      }}>
        <div style={{
          maxWidth: '860px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '56px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              onClick={() => navigate('/')}
              style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', marginRight: '16px' }}
            >
              <Logo size={24} />
              <span className="logo-text" style={{ color: colors.textPrimary, fontWeight: 800, fontSize: '15px', letterSpacing: '-0.3px' }}>
                Gym<span style={{ color: colors.greenBright }}>Tracker</span>
              </span>
            </span>
            {navItem('/train', 'Train')}
            {navItem('/progress', 'Progress')}
            {navItem('/import', 'Import')}
          </div>
          <button
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: `1px solid ${colors.border}`,
              borderRadius: '999px',
              color: colors.textMuted,
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              padding: '5px 13px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = colors.textPrimary
              e.currentTarget.style.borderColor = '#3a3a42'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = colors.textMuted
              e.currentTarget.style.borderColor = colors.border
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="fade-up" style={{ maxWidth: '860px', margin: '0 auto', padding: '26px 20px 80px' }}>
        {children}
      </main>
    </div>
  )
}
