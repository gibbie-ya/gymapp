import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { parseWeekRange, colors, ui } from '../lib/utils'

interface ImportJSON {
  name: string
  description?: string
  total_weeks: number
  sessions_per_week: number
  phases?: unknown[]
  week_groups: WeekGroup[]
}

interface WeekGroup {
  applies_to_weeks: string
  sessions: SessionJSON[]
}

interface SessionJSON {
  session_number: number
  label?: string
  notes?: string
  exercises: ExerciseJSON[]
}

interface ExerciseJSON {
  name: string
  sets: number
  reps: string
  notes?: string
  superset_group?: string | null
  is_drop_set?: boolean
}

interface Preview {
  name: string
  totalWeeks: number
  sessionsPerWeek: number
  totalExercises: number
  totalSessions: number
}

export function ImportPage() {
  const [json, setJson] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  function handlePreview() {
    setParseError(null)
    setPreview(null)
    setImportResult(null)
    setImportError(null)

    try {
      const data = JSON.parse(json) as ImportJSON
      if (!data.name || !data.total_weeks || !data.week_groups) {
        throw new Error('Missing required fields: name, total_weeks, week_groups')
      }

      let totalExercises = 0
      let totalSessions = 0

      for (const group of data.week_groups) {
        const weeks = parseWeekRange(group.applies_to_weeks)
        totalSessions += weeks.length * group.sessions.length
        for (const sess of group.sessions) {
          totalExercises += weeks.length * sess.exercises.length
        }
      }

      setPreview({
        name: data.name,
        totalWeeks: data.total_weeks,
        sessionsPerWeek: data.sessions_per_week,
        totalExercises,
        totalSessions,
      })
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  async function handleImport() {
    if (!preview) return
    setImporting(true)
    setImportError(null)
    setImportResult(null)

    try {
      const data = JSON.parse(json) as ImportJSON

      // Check if programme already exists
      const { data: existing } = await supabase
        .from('programmes')
        .select('id, name')
        .eq('name', data.name)
        .single()

      if (existing) {
        const confirmed = window.confirm(
          `A programme named "${data.name}" already exists. Delete and re-import?`
        )
        if (!confirmed) { setImporting(false); return }

        // Delete old programme (cascades to sessions + exercises via FK)
        await supabase.from('programmes').delete().eq('id', existing.id)
      }

      // Insert programme
      const { data: prog, error: progError } = await supabase
        .from('programmes')
        .insert({
          name: data.name,
          description: data.description ?? null,
          total_weeks: data.total_weeks,
          sessions_per_week: data.sessions_per_week,
          phases: data.phases ?? [],
        })
        .select()
        .single()

      if (progError || !prog) throw new Error(progError?.message ?? 'Failed to insert programme')

      // Expand week groups
      for (const group of data.week_groups) {
        const weeks = parseWeekRange(group.applies_to_weeks)

        for (const week of weeks) {
          for (const sess of group.sessions) {
            const { data: sessionRow, error: sessError } = await supabase
              .from('programme_sessions')
              .insert({
                programme_id: prog.id,
                week_number: week,
                session_number: sess.session_number,
                label: sess.label ?? null,
                notes: sess.notes ?? null,
              })
              .select()
              .single()

            if (sessError || !sessionRow) throw new Error(sessError?.message ?? 'Failed to insert session')

            // Insert exercises
            const exerciseRows = sess.exercises.map((ex, idx) => ({
              programme_session_id: sessionRow.id,
              exercise_name: ex.name,
              order_index: idx,
              target_sets: ex.sets,
              target_reps: ex.reps,
              notes: ex.notes ?? null,
              superset_group: ex.superset_group ?? null,
              is_drop_set: ex.is_drop_set ?? false,
            }))

            const { error: exError } = await supabase
              .from('session_exercises')
              .insert(exerciseRows)

            if (exError) throw new Error(exError.message)
          }
        }
      }

      // Register any new exercise names in exercise_definitions
      const uniqueNames = [...new Set(
        data.week_groups.flatMap(g => g.sessions.flatMap(s => s.exercises.map(e => e.name)))
      )]
      await supabase
        .from('exercise_definitions')
        .upsert(uniqueNames.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true })

      setImportResult(`Successfully imported "${data.name}" — ${preview.totalSessions} sessions, ${preview.totalExercises} exercises.`)
      setJson('')
      setPreview(null)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Layout>
      <h2 style={{ color: colors.textPrimary, fontWeight: 800, fontSize: '22px', letterSpacing: '-0.4px', marginBottom: '6px' }}>
        Import Programme
      </h2>
      <p style={{ color: colors.textMuted, fontSize: '13px', marginBottom: '20px' }}>
        Paste a JSON programme definition below. Preview it before importing.
      </p>

      <textarea
        value={json}
        onChange={e => setJson(e.target.value)}
        placeholder='Paste JSON here...'
        rows={14}
        style={{
          width: '100%',
          background: colors.inputBg,
          border: `1px solid ${colors.inputBorder}`,
          borderRadius: '10px',
          color: colors.textPrimary,
          fontSize: '12.5px',
          fontFamily: "'SF Mono', 'Fira Code', Menlo, monospace",
          lineHeight: 1.55,
          padding: '14px',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />

      {parseError && (
        <div style={{
          background: '#3b0a0a',
          border: '1px solid #7f1d1d',
          borderRadius: '6px',
          color: '#fca5a5',
          fontSize: '13px',
          padding: '10px 14px',
          marginTop: '10px',
        }}>
          {parseError}
        </div>
      )}

      {importError && (
        <div style={{
          background: '#3b0a0a',
          border: '1px solid #7f1d1d',
          borderRadius: '6px',
          color: '#fca5a5',
          fontSize: '13px',
          padding: '10px 14px',
          marginTop: '10px',
        }}>
          Import error: {importError}
        </div>
      )}

      {importResult && (
        <div style={{
          background: `${colors.green}15`,
          border: `1px solid ${colors.green}`,
          borderRadius: '6px',
          color: colors.green,
          fontSize: '13px',
          padding: '10px 14px',
          marginTop: '10px',
        }}>
          {importResult}
        </div>
      )}

      {preview && (
        <div style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: ui.radius,
          boxShadow: ui.shadow,
          padding: '16px 18px',
          marginTop: '14px',
        }}>
          <div style={{ color: colors.textMuted, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>
            Preview
          </div>
          <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>
            {preview.name}
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Weeks', value: preview.totalWeeks },
              { label: 'Sessions/week', value: preview.sessionsPerWeek },
              { label: 'Total sessions', value: preview.totalSessions },
              { label: 'Total exercises', value: preview.totalExercises },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ color: colors.textMuted, fontSize: '11px', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ color: colors.textPrimary, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
        <button
          onClick={handlePreview}
          style={{
            background: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: '9px',
            color: colors.textSecondary,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            padding: '10px 20px',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = colors.textPrimary; e.currentTarget.style.borderColor = '#3a3a42' }}
          onMouseLeave={e => { e.currentTarget.style.color = colors.textSecondary; e.currentTarget.style.borderColor = colors.border }}
        >
          Preview
        </button>
        <button
          onClick={handleImport}
          disabled={!preview || importing}
          style={{
            background: preview && !importing ? colors.green : '#1a1a1e',
            color: preview && !importing ? '#04150a' : colors.textMuted,
            border: 'none',
            borderRadius: '9px',
            cursor: preview && !importing ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 700,
            padding: '10px 20px',
            boxShadow: preview && !importing ? ui.glow(colors.green) : 'none',
          }}
        >
          {importing ? 'Importing...' : 'Import'}
        </button>
      </div>
    </Layout>
  )
}
