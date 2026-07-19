import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import type { Programme } from '../lib/types'
import { colors, ui } from '../lib/utils'

export function ProgrammeSelectPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('programmes').select('*').order('created_at', { ascending: false })
      setProgrammes((data ?? []) as Programme[])
      setLoading(false)
    }
    load()
  }, [])

  async function startProgramme(programme: Programme) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Deactivate any existing active programmes
    await supabase
      .from('user_programmes')
      .update({ active: false })
      .eq('user_id', user.id)
      .eq('active', true)

    await supabase.from('user_programmes').insert({
      user_id: user.id,
      programme_id: programme.id,
      start_date: startDate,
      active: true,
    })

    setSaving(false)
    navigate('/train')
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ color: colors.textMuted, fontSize: '14px' }}>Loading programmes...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <h2 style={{ color: colors.textPrimary, fontWeight: 800, fontSize: '22px', letterSpacing: '-0.4px', marginBottom: '6px' }}>
        Choose a Programme
      </h2>
      <p style={{ color: colors.textMuted, fontSize: '13px', marginBottom: '24px' }}>
        Select a programme to begin tracking your workouts.
      </p>

      {programmes.length === 0 && (
        <div style={{ color: colors.textMuted, fontSize: '14px' }}>
          No programmes found. Import one via the Import page.
        </div>
      )}

      {programmes.map(programme => (
        <div
          key={programme.id}
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: ui.radius,
            boxShadow: ui.shadow,
            padding: '18px 20px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '16px' }}>
                {programme.name}
              </div>
              {programme.description && (
                <div style={{ color: colors.textSecondary, fontSize: '13px', marginTop: '4px' }}>
                  {programme.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <span style={{ color: colors.textMuted, fontSize: '12px' }}>
                  {programme.total_weeks} weeks
                </span>
                <span style={{ color: colors.textMuted, fontSize: '12px' }}>
                  {programme.sessions_per_week} sessions/week
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelecting(programme.id)}
              style={{
                background: colors.green,
                color: '#04150a',
                border: 'none',
                borderRadius: '9px',
                padding: '9px 18px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '13px',
                whiteSpace: 'nowrap',
                boxShadow: ui.glow(colors.green),
              }}
            >
              Start Programme
            </button>
          </div>

          {selecting === programme.id && (
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: `1px solid ${colors.border}`,
            }}>
              <div style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: '8px' }}>
                Start date (Week 1 begins on this day):
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{
                    background: colors.inputBg,
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: '8px',
                    color: colors.textPrimary,
                    padding: '8px 12px',
                    fontSize: '14px',
                  }}
                />
                <button
                  onClick={() => startProgramme(programme)}
                  disabled={saving}
                  style={{
                    background: colors.green,
                    color: '#04150a',
                    border: 'none',
                    borderRadius: '9px',
                    padding: '9px 18px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '13px',
                    boxShadow: ui.glow(colors.green),
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Starting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setSelecting(null)}
                  style={{
                    background: 'none',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '999px',
                    color: colors.textMuted,
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    padding: '8px 15px',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </Layout>
  )
}
