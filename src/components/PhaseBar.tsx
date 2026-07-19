import type { Phase } from '../lib/types'
import { colors, ui } from '../lib/utils'

interface PhaseBarProps {
  phase: Phase | null
  currentWeek: number
  totalWeeks: number
}

export function PhaseBar({ phase, currentWeek, totalWeeks }: PhaseBarProps) {
  if (!phase) return null
  const accentColor = phase.accent_color
  const progress = Math.min(Math.max(currentWeek / totalWeeks, 0), 1)

  return (
    <div style={{
      background: `linear-gradient(135deg, ${accentColor}10, ${colors.card} 55%)`,
      border: `1px solid ${colors.border}`,
      borderRadius: ui.radius,
      boxShadow: ui.shadow,
      padding: '14px 18px',
      marginBottom: '18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '5px' }}>
            <span style={{
              background: `${accentColor}1c`,
              border: `1px solid ${accentColor}44`,
              color: accentColor,
              fontSize: '10px',
              padding: '3px 9px',
              borderRadius: '999px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
            }}>
              {phase.name}
            </span>
            <span style={{ color: colors.textMuted, fontSize: '12px' }}>
              Weeks {phase.weeks_start}–{phase.weeks_end}
            </span>
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '13px' }}>{phase.description}</div>
        </div>
        <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
          {[
            { label: 'RPE', value: phase.rpe },
            { label: 'Rest', value: phase.rest },
            { label: 'Tempo', value: phase.tempo },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ color: colors.textDim, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
              <div style={{ color: colors.textPrimary, fontSize: '13px', fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Programme progress track */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
        <div style={{
          flex: 1,
          height: '4px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${accentColor}88, ${accentColor})`,
            borderRadius: '999px',
            boxShadow: `0 0 8px ${accentColor}88`,
          }} />
        </div>
        <span style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
          W{currentWeek} / {totalWeeks}
        </span>
      </div>
    </div>
  )
}
