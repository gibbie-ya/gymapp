import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { PhaseBar } from '../components/PhaseBar'
import { ExerciseLogger } from '../components/ExerciseLogger'
import { SessionTools } from '../components/SessionTools'
import type { Programme, UserProgramme, ProgrammeSession, SessionExercise, SetLog } from '../lib/types'
import { getPhaseForWeek, colors, ui } from '../lib/utils'

export function SessionLoggerPage() {
  const { week, session } = useParams<{ week: string; session: string }>()
  const weekNum = parseInt(week ?? '1')
  const sessionNum = parseInt(session ?? '1')
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [userProgramme, setUserProgramme] = useState<UserProgramme | null>(null)
  const [programme, setProgramme] = useState<Programme | null>(null)
  const [sessionDef, setSessionDef] = useState<ProgrammeSession | null>(null)
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [previousSets, setPreviousSets] = useState<Record<string, Record<number, { weight_kg: number | null; reps: number | null }>>>({})
  const [currentSets, setCurrentSets] = useState<Record<string, Record<number, { weight_kg: number | null; reps: number | null }>>>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bestWeights, setBestWeights] = useState<Record<string, number>>({})
  const [volume, setVolume] = useState(0)
  const [completed, setCompleted] = useState<{ minutes: number; volume: number } | null>(null)

  // Accumulate all set data from child components
  const allSetsRef = useRef<Record<string, SetLog[]>>({})
  const startedAtRef = useRef(Date.now())

  function computeVolume(): number {
    let total = 0
    for (const sets of Object.values(allSetsRef.current)) {
      for (const s of sets) {
        if (s.weightKg != null && s.reps != null) total += s.weightKg * s.reps
      }
    }
    return Math.round(total)
  }

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

      if (!up) { navigate('/select'); return }
      setUserProgramme(up as UserProgramme)

      const { data: prog } = await supabase
        .from('programmes')
        .select('*')
        .eq('id', up.programme_id)
        .single()

      if (!prog) return
      setProgramme(prog as Programme)

      const { data: sess } = await supabase
        .from('programme_sessions')
        .select('*')
        .eq('programme_id', prog.id)
        .eq('week_number', weekNum)
        .eq('session_number', sessionNum)
        .single()

      if (sess) setSessionDef(sess as ProgrammeSession)

      const { data: exs } = await supabase
        .from('session_exercises')
        .select('*')
        .eq('programme_session_id', sess?.id ?? '')
        .order('order_index')

      const exerciseList = (exs ?? []) as SessionExercise[]
      setExercises(exerciseList)

      // Logs already saved for this exact week+session (re-editing a logged session)
      const { data: currentLogs } = await supabase
        .from('workout_logs')
        .select('exercise_name, set_number, weight_kg, reps')
        .eq('user_programme_id', up.id)
        .eq('week_number', weekNum)
        .eq('session_number', sessionNum)

      const currentSetsMap: Record<string, Record<number, { weight_kg: number | null; reps: number | null }>> = {}
      for (const log of currentLogs ?? []) {
        if (!currentSetsMap[log.exercise_name]) currentSetsMap[log.exercise_name] = {}
        currentSetsMap[log.exercise_name][log.set_number] = { weight_kg: log.weight_kg, reps: log.reps }
      }
      setCurrentSets(currentSetsMap)

      // Fetch previous logs for each exercise in parallel
      const prevSetsMap: Record<string, Record<number, { weight_kg: number | null; reps: number | null }>> = {}
      const bestMap: Record<string, number> = {}

      await Promise.all(exerciseList.map(async ex => {
        // Best-ever weight for PR detection, excluding this session's own logs
        const { data: bestLog } = await supabase
          .from('workout_logs')
          .select('weight_kg')
          .eq('user_id', user.id)
          .eq('exercise_name', ex.exercise_name)
          .not('weight_kg', 'is', null)
          .or(`user_programme_id.neq.${up.id},week_number.neq.${weekNum},session_number.neq.${sessionNum}`)
          .order('weight_kg', { ascending: false })
          .limit(1)

        if (bestLog?.[0]?.weight_kg != null) bestMap[ex.exercise_name] = bestLog[0].weight_kg

        const { data: logs } = await supabase
          .from('workout_logs')
          .select('set_number, weight_kg, reps, week_number, session_number, logged_at')
          .eq('user_programme_id', up.id)
          .eq('exercise_name', ex.exercise_name)
          .order('logged_at', { ascending: false })
          .limit(50)

        if (!logs || logs.length === 0) return

        // Find the most recent session that isn't current week+session
        const grouped: Record<string, typeof logs> = {}
        for (const log of logs) {
          const key = `${log.week_number}-${log.session_number}`
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(log)
        }

        const otherSessions = Object.entries(grouped).filter(
          ([key]) => key !== `${weekNum}-${sessionNum}`
        )

        if (otherSessions.length === 0) return

        // Most recent is first since ordered by logged_at DESC
        const mostRecentKey = otherSessions[0][0]
        const mostRecentLogs = grouped[mostRecentKey]

        const setMap: Record<number, { weight_kg: number | null; reps: number | null }> = {}
        for (const log of mostRecentLogs) {
          setMap[log.set_number] = { weight_kg: log.weight_kg, reps: log.reps }
        }
        prevSetsMap[ex.exercise_name] = setMap
      }))

      setPreviousSets(prevSetsMap)
      setBestWeights(bestMap)

      // Seed the save buffer with the initial input values so saving without
      // touching an exercise never drops its data
      for (const ex of exerciseList) {
        allSetsRef.current[ex.exercise_name] = Array.from({ length: ex.target_sets }, (_, i) => {
          const setNumber = i + 1
          const initial = currentSetsMap[ex.exercise_name]?.[setNumber]
            ?? prevSetsMap[ex.exercise_name]?.[setNumber]
          return {
            exerciseName: ex.exercise_name,
            setNumber,
            weightKg: initial?.weight_kg ?? null,
            reps: initial?.reps ?? null,
          }
        })
      }

      setVolume(computeVolume())
      setLoading(false)
    }
    load()
  }, [weekNum, sessionNum, navigate])

  function handleExerciseChange(exerciseName: string, sets: SetLog[]) {
    allSetsRef.current[exerciseName] = sets
    setVolume(computeVolume())
  }

  async function saveSession() {
    if (!userProgramme || saving) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Delete existing logs for this week+session
    await supabase
      .from('workout_logs')
      .delete()
      .eq('user_programme_id', userProgramme.id)
      .eq('week_number', weekNum)
      .eq('session_number', sessionNum)

    // Collect all sets
    const allSets: SetLog[] = []
    for (const exName of exercises.map(e => e.exercise_name)) {
      const sets = allSetsRef.current[exName]
      if (sets) allSets.push(...sets)
    }

    // Filter out sets with no data
    const toInsert = allSets.filter(s => s.weightKg != null || s.reps != null)

    if (toInsert.length > 0) {
      await supabase.from('workout_logs').insert(
        toInsert.map(s => ({
          user_id: user.id,
          user_programme_id: userProgramme.id,
          week_number: weekNum,
          session_number: sessionNum,
          exercise_name: s.exerciseName,
          set_number: s.setNumber,
          weight_kg: s.weightKg ?? null,
          reps: s.reps ?? null,
          logged_at: new Date().toISOString(),
        }))
      )
    }

    setSaving(false)
    setSaved(true)
    setCompleted({
      minutes: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000)),
      volume: computeVolume(),
    })
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ color: colors.textMuted, fontSize: '14px' }}>Loading session...</div>
      </Layout>
    )
  }

  if (!programme || !userProgramme) {
    return <Layout><div style={{ color: colors.textMuted }}>No active programme.</div></Layout>
  }

  const phase = getPhaseForWeek(programme.phases, weekNum)
  const accentColor = phase?.accent_color ?? colors.green

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <button
            onClick={() => navigate(`/train/week/${weekNum}`)}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              fontSize: '13px',
              padding: '0',
              marginBottom: '8px',
              display: 'block',
            }}
          >
            ← Week {weekNum}
          </button>
          <h2 style={{ color: colors.textPrimary, fontWeight: 800, fontSize: '20px', letterSpacing: '-0.4px', margin: 0 }}>
            {sessionDef?.label ?? `Session ${sessionNum}`}
          </h2>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '2px' }}>
            Week {weekNum} · Session {sessionNum}
            {volume > 0 && (
              <span style={{ color: colors.textSecondary, fontWeight: 600 }}>
                {' '}· {volume.toLocaleString()} kg
              </span>
            )}
          </div>
        </div>
        <button
          onClick={saveSession}
          disabled={saving}
          style={{
            background: saved ? colors.green : accentColor,
            color: '#04150a',
            border: 'none',
            borderRadius: '9px',
            padding: '10px 20px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '14px',
            boxShadow: ui.glow(saved ? colors.green : accentColor),
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save Session'}
        </button>
      </div>

      {completed && (
        <div className="fade-up" style={{
          background: `${colors.green}12`,
          border: `1px solid ${colors.green}55`,
          borderRadius: '10px',
          color: colors.greenBright,
          fontSize: '13px',
          fontWeight: 600,
          padding: '11px 15px',
          marginBottom: '14px',
        }}>
          ✓ Workout completed in {completed.minutes} min · {completed.volume.toLocaleString()} kg total volume
        </div>
      )}

      <PhaseBar phase={phase} currentWeek={weekNum} totalWeeks={programme.total_weeks} />

      {exercises.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: '14px' }}>
          No exercises found for this session.
        </div>
      ) : (
        exercises.map(ex => (
          <ExerciseLogger
            key={ex.id}
            exercise={ex}
            previousSets={previousSets[ex.exercise_name] ?? {}}
            currentSets={currentSets[ex.exercise_name] ?? {}}
            bestWeight={bestWeights[ex.exercise_name] ?? null}
            onChange={sets => handleExerciseChange(ex.exercise_name, sets)}
            accentColor={accentColor}
          />
        ))
      )}

      {/* Session reminders */}
      {phase && (
        <div style={{
          marginTop: '24px',
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: ui.radius,
          boxShadow: ui.shadow,
          padding: '16px 18px',
        }}>
          <div style={{
            color: colors.textMuted,
            fontSize: '10px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}>
            Session Reminders
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Tempo', value: phase.tempo },
              { label: 'Rest', value: phase.rest },
              { label: 'Target RPE', value: phase.rpe },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ color: colors.textDim, fontSize: '11px', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ color: colors.textSecondary, fontSize: '13px', fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '10px' }}>
            Progressive overload: aim to add weight or reps when you hit the top of the rep range on all sets.
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <button
          onClick={saveSession}
          disabled={saving}
          style={{
            background: saved ? colors.green : accentColor,
            color: '#04150a',
            border: 'none',
            borderRadius: '10px',
            padding: '14px 24px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '15px',
            width: '100%',
            boxShadow: ui.glow(saved ? colors.green : accentColor),
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save Session'}
        </button>
      </div>

      <SessionTools accentColor={accentColor} />
    </Layout>
  )
}
