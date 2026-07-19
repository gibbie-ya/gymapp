import { supabase } from '../lib/supabase'
import { colors, ui } from '../lib/utils'
import { Logo } from '../components/Layout'

export function LoginPage() {
  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: ui.font,
      position: 'relative',
      overflow: 'hidden',
      padding: '20px',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        top: '-30%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '700px',
        height: '700px',
        background: 'radial-gradient(circle, rgba(34, 197, 94, 0.14), transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div className="fade-up" style={{
        background: 'linear-gradient(180deg, #17171b, #121215)',
        border: `1px solid ${colors.border}`,
        borderRadius: '18px',
        boxShadow: ui.shadow,
        padding: '44px 38px 36px',
        textAlign: 'center',
        maxWidth: '380px',
        width: '100%',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
          <Logo size={52} />
        </div>
        <div style={{ color: colors.textPrimary, fontWeight: 800, fontSize: '26px', letterSpacing: '-0.6px' }}>
          Gym<span style={{ color: colors.greenBright }}>Tracker</span>
        </div>
        <div style={{ color: colors.textMuted, fontSize: '14px', marginTop: '8px', marginBottom: '34px', lineHeight: 1.5 }}>
          Track your training.<br />Progress every week.
        </div>
        <button
          onClick={handleSignIn}
          style={{
            background: '#f4f4f5',
            color: '#18181b',
            border: 'none',
            borderRadius: '10px',
            padding: '13px 24px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.boxShadow = '0 4px 24px -6px rgba(255,255,255,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C36.9 40.2 44 35 44 24c0-1.3-.1-2.7-.4-3.9z" />
          </svg>
          Continue with Google
        </button>
        <div style={{ color: colors.textDim, fontSize: '11px', marginTop: '22px' }}>
          Your data stays in your own Supabase project.
        </div>
      </div>
    </div>
  )
}
