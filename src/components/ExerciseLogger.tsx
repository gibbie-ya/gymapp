import { useState } from 'react'
import type { SessionExercise, SetLog } from '../lib/types'
import { colors, ui } from '../lib/utils'

interface PreviousSet {
  weight_kg: number | null
  reps: number | null
}

interface ExerciseLoggerProps {
  exercise: SessionExercise
  previousSets: Record<number, PreviousSet>
  currentSets: Record<number, PreviousSet>
  bestWeight: number | null
  onChange: (sets: SetLog[]) => void
  accentColor: string
}

export function ExerciseLogger({ exercise, previousSets, currentSets, bestWeight, onChange, accentColor }: ExerciseLoggerProps) {
  const [expanded, setExpanded] = useState(true)

  // Saved data for this session wins over the previous-session pre-fill
  const initialSets: SetLog[] = Array.from({ length: exercise.target_sets }, (_, i) => {
    const initial = currentSets[i + 1] ?? previousSets[i + 1]
    return {
      exerciseName: exercise.exercise_name,
      setNumber: i + 1,
      weightKg: initial?.weight_kg ?? null,
      reps: initial?.reps ?? null,
    }
  })

  const [sets, setSets] = useState<SetLog[]>(initialSets)

  function handleChange(setNumber: number, field: 'weightKg' | 'reps', value: string) {
    const parsed = value === '' ? null : Number(value)
    const updated = sets.map(s =>
      s.setNumber === setNumber ? { ...s, [field]: parsed } : s
    )
    setSets(updated)
    onChange(updated)
  }

  const hasPrev = Object.keys(previousSets).length > 0

  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: ui.radius,
      boxShadow: ui.shadow,
      marginBottom: '12px',
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '14px 16px', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '15px' }}>
                {exercise.exercise_name}
              </span>
              {exercise.superset_group && (
                <span style={{
                  background: `${colors.amber}22`,
                  color: colors.amber,
                  fontSize: '10px',
                  padding: '2px 7px',
                  borderRadius: '3px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}>
                  SS {exercise.superset_group}
                </span>
              )}
              {exercise.is_drop_set && (
                <span style={{
                  background: '#a855f722',
                  color: '#a855f7',
                  fontSize: '10px',
                  padding: '2px 7px',
                  borderRadius: '3px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}>
                  Drop
                </span>
              )}
            </div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '3px' }}>
              {exercise.target_sets} × {exercise.target_reps}
              {exercise.notes && <span style={{ marginLeft: '8px' }}>· {exercise.notes}</span>}
            </div>
          </div>
          <span style={{
            color: colors.textDim,
            fontSize: '12px',
            marginLeft: '8px',
            display: 'inline-block',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}>
            ▼
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 1fr',
            gap: '6px',
            marginBottom: '6px',
          }}>
            <div style={{ color: colors.textDim, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>Set</div>
            <div style={{ color: colors.textDim, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>Kg</div>
            <div style={{ color: colors.textDim, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>Reps</div>
          </div>

          {sets.map(set => {
            const prev = previousSets[set.setNumber]
            const isPR = bestWeight != null && set.weightKg != null && set.weightKg > bestWeight
            return (
              <div key={set.setNumber} style={{ marginBottom: '8px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 1fr',
                  gap: '6px',
                  alignItems: 'center',
                }}>
                  <div style={{
                    color: set.weightKg != null || set.reps != null ? accentColor : colors.textMuted,
                    fontSize: '13px',
                    fontWeight: 700,
                    width: '32px',
                    height: '36px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {set.setNumber}
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="—"
                    value={set.weightKg ?? ''}
                    onChange={e => handleChange(set.setNumber, 'weightKg', e.target.value)}
                    style={{
                      background: colors.inputBg,
                      border: `1px solid ${colors.inputBorder}`,
                      borderRadius: '8px',
                      color: colors.textPrimary,
                      padding: '8px 10px',
                      fontSize: '15px',
                      fontWeight: 600,
                      textAlign: 'center',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                  <input
                    type="number"
                    placeholder="—"
                    value={set.reps ?? ''}
                    onChange={e => handleChange(set.setNumber, 'reps', e.target.value)}
                    style={{
                      background: colors.inputBg,
                      border: `1px solid ${colors.inputBorder}`,
                      borderRadius: '8px',
                      color: colors.textPrimary,
                      padding: '8px 10px',
                      fontSize: '15px',
                      fontWeight: 600,
                      textAlign: 'center',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {((hasPrev && prev) || isPR) && (
                  <div style={{
                    fontSize: '11px',
                    marginTop: '2px',
                    paddingLeft: '46px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}>
                    {hasPrev && prev && (
                      <span style={{ color: colors.textDim }}>
                        ↺ Last time: {prev.weight_kg != null ? `${prev.weight_kg}kg` : '—'} × {prev.reps != null ? prev.reps : '—'} reps
                      </span>
                    )}
                    {isPR && (
                      <span style={{
                        background: '#facc1518',
                        border: '1px solid #facc1555',
                        color: '#facc15',
                        borderRadius: '999px',
                        fontWeight: 700,
                        fontSize: '10px',
                        letterSpacing: '1px',
                        padding: '2px 8px',
                      }}>
                        🏆 PR — best: {bestWeight}kg
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
