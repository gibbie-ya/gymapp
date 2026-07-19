import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { ProgressChart } from '../components/ProgressChart'
import { BodyweightCard } from '../components/BodyweightCard'
import type { Programme, UserProgramme, WorkoutLog } from '../lib/types'
import { getPhaseForWeek, getCurrentWeek, colors, ui } from '../lib/utils'

export function ProgressPage() {
  const [loading, setLoading] = useState(true)
  const [userProgramme, setUserProgramme] = useState<UserProgramme | null>(null)
  const [programme, setProgramme] = useState<Programme | null>(null)
  const [exerciseNames, setExerciseNames] = useState<string[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [allLogs, setAllLogs] = useState<WorkoutLog[]>([])

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

      if (!up) { setLoading(false); return }
      setUserProgramme(up as UserProgramme)

      const { data: prog } = await supabase
        .from('programmes')
        .select('*')
        .eq('id', up.programme_id)
        .single()

      if (prog) setProgramme(prog as Programme)

      const { data: logData } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_programme_id', up.id)
        .order('logged_at', { ascending: false })

      const allLogData = (logData ?? []) as WorkoutLog[]
      setAllLogs(allLogData)

      const names = [...new Set(allLogData.map(l => l.exercise_name))].sort()
      setExerciseNames(names)
      if (names.length > 0) setSelectedExercise(names[0])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedExercise) return
    setLogs(allLogs.filter(l => l.exercise_name === selectedExercise))
  }, [selectedExercise, allLogs])

  if (loading) {
    return (
      <Layout>
        <div style={{ color: colors.textMuted, fontSize: '14px' }}>Loading...</div>
      </Layout>
    )
  }

  if (!userProgramme) {
    return (
      <Layout>
        <div style={{ color: colors.textMuted }}>No active programme. Start one to see progress.</div>
        <BodyweightCard />
      </Layout>
    )
  }

  const currentWeek = userProgramme ? getCurrentWeek(userProgramme.start_date, programme?.total_weeks ?? 1) : 1
  const phase = programme ? getPhaseForWeek(programme.phases, currentWeek) : null
  const accentColor = phase?.accent_color ?? colors.green

  // Group logs for selected exercise into table rows
  const selectedLogs = logs.slice().sort((a, b) =>
    b.logged_at.localeCompare(a.logged_at)
  )

  return (
    <Layout>
      <h2 style={{ color: colors.textPrimary, fontWeight: 800, fontSize: '22px', letterSpacing: '-0.4px', marginBottom: '16px' }}>
        Progress
      </h2>

      {exerciseNames.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: '14px' }}>
          No workout logs yet. Start logging sessions to see your progress.
        </div>
      ) : (
        <>
          {/* Exercise selector */}
          <div style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            marginBottom: '20px',
          }}>
            {exerciseNames.map(name => (
              <button
                key={name}
                onClick={() => setSelectedExercise(name)}
                style={{
                  background: selectedExercise === name ? accentColor : colors.card,
                  border: `1px solid ${selectedExercise === name ? accentColor : colors.border}`,
                  borderRadius: '999px',
                  color: selectedExercise === name ? '#04150a' : colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: selectedExercise === name ? 700 : 500,
                  padding: '6px 13px',
                  boxShadow: selectedExercise === name ? `0 0 14px ${accentColor}55` : 'none',
                }}
              >
                {name}
              </button>
            ))}
          </div>

          {selectedExercise && (
            <div>
              <div style={{
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderLeft: `3px solid ${accentColor}`,
                borderRadius: ui.radius,
                boxShadow: ui.shadow,
                padding: '18px',
                marginBottom: '16px',
              }}>
                <h3 style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '16px', margin: '0 0 14px' }}>
                  {selectedExercise}
                </h3>
                <ProgressChart
                  logs={logs}
                  exerciseName={selectedExercise}
                  totalWeeks={programme?.total_weeks ?? 12}
                  accentColor={accentColor}
                />
              </div>

              {/* Log table */}
              <div style={{
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: ui.radius,
                boxShadow: ui.shadow,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}` }}>
                  <span style={{ color: colors.textSecondary, fontSize: '13px', fontWeight: 600 }}>
                    All Sets — {selectedExercise}
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                        {['Week', 'Session', 'Set', 'Weight (kg)', 'Reps', 'Date'].map(h => (
                          <th key={h} style={{
                            color: colors.textMuted,
                            fontSize: '10px',
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                            textAlign: 'left',
                            padding: '8px 12px',
                            fontWeight: 600,
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLogs.map(log => (
                        <tr key={log.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                          <td style={{ padding: '8px 12px', color: colors.textSecondary }}>{log.week_number}</td>
                          <td style={{ padding: '8px 12px', color: colors.textSecondary }}>{log.session_number}</td>
                          <td style={{ padding: '8px 12px', color: colors.textSecondary }}>{log.set_number}</td>
                          <td style={{ padding: '8px 12px', color: colors.textPrimary, fontWeight: 600 }}>
                            {log.weight_kg ?? '—'}
                          </td>
                          <td style={{ padding: '8px 12px', color: colors.textPrimary }}>
                            {log.reps ?? '—'}
                          </td>
                          <td style={{ padding: '8px 12px', color: colors.textMuted }}>
                            {new Date(log.logged_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <BodyweightCard />
    </Layout>
  )
}
