import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { PhaseBar } from '../components/PhaseBar'
import type { Programme, UserProgramme, ProgrammeSession } from '../lib/types'
import { getCurrentWeek, getPhaseForWeek, colors, ui } from '../lib/utils'

export function WeekViewPage() {
  const { week: weekParam } = useParams<{ week?: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [userProgramme, setUserProgramme] = useState<UserProgramme | null>(null)
  const [programme, setProgramme] = useState<Programme | null>(null)
  const [sessions, setSessions] = useState<ProgrammeSession[]>([])
  const [loggedSessions, setLoggedSessions] = useState<Set<string>>(new Set())
  const [sessionVolumes, setSessionVolumes] = useState<Record<string, number>>({})
  const [selectedWeek, setSelectedWeek] = useState<number>(1)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: up } = await supabase
        .from('user_programmes')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()

      if (!up) {
        navigate('/select')
        return
      }

      setUserProgramme(up as UserProgramme)

      const { data: prog } = await supabase
        .from('programmes')
        .select('*')
        .eq('id', up.programme_id)
        .single()

      if (!prog) return
      setProgramme(prog as Programme)

      const currentWeek = getCurrentWeek(up.start_date, prog.total_weeks)
      const displayWeek = weekParam ? parseInt(weekParam) : currentWeek
      setSelectedWeek(displayWeek)

      const { data: sess } = await supabase
        .from('programme_sessions')
        .select('*')
        .eq('programme_id', prog.id)
        .eq('week_number', displayWeek)
        .order('session_number')

      setSessions((sess ?? []) as ProgrammeSession[])

      // Check which sessions have logs
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('week_number, session_number, weight_kg, reps')
        .eq('user_programme_id', up.id)
        .eq('week_number', displayWeek)

      const logged = new Set<string>()
      const volumes: Record<string, number> = {}
      for (const log of logs ?? []) {
        const key = `${log.week_number}-${log.session_number}`
        logged.add(key)
        if (log.weight_kg != null && log.reps != null) {
          volumes[key] = (volumes[key] ?? 0) + log.weight_kg * log.reps
        }
      }
      setLoggedSessions(logged)
      setSessionVolumes(volumes)
      setLoading(false)
    }
    load()
  }, [weekParam, navigate])

  if (loading) {
    return (
      <Layout>
        <div style={{ color: colors.textMuted, fontSize: '14px' }}>Loading...</div>
      </Layout>
    )
  }

  if (!programme || !userProgramme) {
    return (
      <Layout>
        <div style={{ color: colors.textMuted }}>No active programme.</div>
      </Layout>
    )
  }

  const currentWeek = getCurrentWeek(userProgramme.start_date, programme.total_weeks)
  const phase = getPhaseForWeek(programme.phases, selectedWeek)
  const accentColor = phase?.accent_color ?? colors.green

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ color: colors.textPrimary, fontWeight: 800, fontSize: '22px', letterSpacing: '-0.4px', margin: 0 }}>
            {programme.name}
          </h2>
          <div style={{ color: colors.textMuted, fontSize: '13px', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Week {selectedWeek} of {programme.total_weeks}
            {selectedWeek === currentWeek && (
              <span style={{
                background: `${colors.green}1c`,
                border: `1px solid ${colors.green}44`,
                color: colors.greenBright,
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '999px',
                fontWeight: 700,
                letterSpacing: '1px',
              }}>
                CURRENT
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/select')}
          style={{
            background: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: '999px',
            color: colors.textMuted,
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            padding: '6px 14px',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = colors.textPrimary; e.currentTarget.style.borderColor = '#3a3a42' }}
          onMouseLeave={e => { e.currentTarget.style.color = colors.textMuted; e.currentTarget.style.borderColor = colors.border }}
        >
          Change programme
        </button>
      </div>

      {/* Week strip */}
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        paddingBottom: '8px',
        marginBottom: '16px',
        scrollbarWidth: 'none',
      }}>
        {Array.from({ length: programme.total_weeks }, (_, i) => i + 1).map(w => {
          const wPhase = getPhaseForWeek(programme.phases, w)
          const isSelected = w === selectedWeek
          const isCurrent = w === currentWeek
          return (
            <button
              key={w}
              onClick={() => navigate(w === currentWeek ? '/train' : `/train/week/${w}`)}
              style={{
                flex: '0 0 auto',
                background: isSelected ? (wPhase?.accent_color ?? colors.green) : colors.card,
                border: `1px solid ${isCurrent && !isSelected ? (wPhase?.accent_color ?? colors.green) : (isSelected ? 'transparent' : colors.border)}`,
                borderRadius: '999px',
                color: isSelected ? '#04150a' : isCurrent ? (wPhase?.accent_color ?? colors.green) : colors.textMuted,
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: isSelected || isCurrent ? 700 : 500,
                padding: '6px 13px',
                minWidth: '44px',
                boxShadow: isSelected ? `0 0 16px ${(wPhase?.accent_color ?? colors.green)}66` : 'none',
              }}
            >
              W{w}
            </button>
          )
        })}
      </div>

      <PhaseBar phase={phase} currentWeek={selectedWeek} totalWeeks={programme.total_weeks} />

      {/* Session cards */}
      {sessions.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: '14px' }}>
          No sessions defined for Week {selectedWeek}.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {sessions.map(session => {
            const isLogged = loggedSessions.has(`${session.week_number}-${session.session_number}`)
            return (
              <div
                key={session.id}
                className="hover-card"
                onClick={() => navigate(`/train/week/${selectedWeek}/session/${session.session_number}`)}
                style={{
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: ui.radius,
                  boxShadow: ui.shadow,
                  padding: '16px 18px',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = colors.cardHover
                  e.currentTarget.style.borderColor = `${accentColor}55`
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = colors.card
                  e.currentTarget.style.borderColor = colors.border
                  e.currentTarget.style.transform = 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '11px',
                      background: `${accentColor}14`,
                      border: `1px solid ${accentColor}33`,
                      color: accentColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '16px',
                      flexShrink: 0,
                    }}>
                      {session.session_number}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '15px' }}>
                        {session.label ?? `Session ${session.session_number}`}
                      </div>
                      {session.notes && (
                        <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
                          {session.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    {isLogged && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                        <span style={{
                          background: `${colors.green}1c`,
                          border: `1px solid ${colors.green}44`,
                          color: colors.greenBright,
                          fontSize: '10px',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          fontWeight: 700,
                          letterSpacing: '1px',
                        }}>
                          ✓ LOGGED
                        </span>
                        {(sessionVolumes[`${session.week_number}-${session.session_number}`] ?? 0) > 0 && (
                          <span style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 600 }}>
                            {Math.round(sessionVolumes[`${session.week_number}-${session.session_number}`]).toLocaleString()} kg
                          </span>
                        )}
                      </div>
                    )}
                    <span style={{ color: colors.textDim, fontSize: '18px' }}>›</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
