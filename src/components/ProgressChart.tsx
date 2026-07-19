import type { WorkoutLog } from '../lib/types'
import { colors, epley1RM } from '../lib/utils'

interface ProgressChartProps {
  logs: WorkoutLog[]
  exerciseName: string
  totalWeeks: number
  accentColor: string
}

export function ProgressChart({ logs, exerciseName, totalWeeks, accentColor }: ProgressChartProps) {
  if (logs.length === 0) {
    return (
      <div style={{ color: colors.textMuted, fontSize: '13px', textAlign: 'center', padding: '20px' }}>
        No logs for {exerciseName} yet.
      </div>
    )
  }

  // Group by week, max weight per week
  const weekMap: Record<number, number> = {}
  for (const log of logs) {
    if (log.weight_kg != null) {
      if (weekMap[log.week_number] == null || log.weight_kg > weekMap[log.week_number]) {
        weekMap[log.week_number] = log.weight_kg
      }
    }
  }

  const points = Object.entries(weekMap)
    .map(([week, weight]) => ({ week: Number(week), weight }))
    .sort((a, b) => a.week - b.week)

  if (points.length === 0) {
    return (
      <div style={{ color: colors.textMuted, fontSize: '13px', textAlign: 'center', padding: '20px' }}>
        No weight data yet.
      </div>
    )
  }

  const rawMax = Math.max(...points.map(p => p.weight))
  const rawMin = Math.min(...points.map(p => p.weight))
  // Pad a flat series so a lone point sits mid-chart instead of on the baseline
  const flat = rawMax === rawMin
  const minWeight = flat ? rawMin - 5 : rawMin
  const maxWeight = flat ? rawMax + 5 : rawMax
  const range = maxWeight - minWeight
  const width = 560
  const height = 130
  const pad = { top: 12, right: 20, bottom: 24, left: 36 }
  const chartW = width - pad.left - pad.right
  const chartH = height - pad.top - pad.bottom

  const xScale = (week: number) => ((week - 1) / (totalWeeks - 1 || 1)) * chartW + pad.left
  const yScale = (w: number) => pad.top + chartH - ((w - minWeight) / range) * chartH

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.week).toFixed(1)},${yScale(p.weight).toFixed(1)}`)
    .join(' ')

  const baseline = pad.top + chartH
  const areaD = points.length > 1
    ? `${pathD} L${xScale(points[points.length - 1].week).toFixed(1)},${baseline} L${xScale(points[0].week).toFixed(1)},${baseline} Z`
    : null

  const gradId = `grad-${exerciseName.replace(/[^a-zA-Z0-9]/g, '')}`
  const lastPoint = points[points.length - 1]

  const firstLog = logs.reduce((a, b) => a.logged_at < b.logged_at ? a : b)
  const bestSet = logs.reduce((a, b) => (b.weight_kg ?? 0) > (a.weight_kg ?? 0) ? b : a)
  const weeksLogged = Object.keys(weekMap).length

  const complete = logs.filter(l => l.weight_kg != null && l.reps != null && l.reps > 0)
  const best1RM = complete.length > 0
    ? Math.max(...complete.map(l => epley1RM(l.weight_kg as number, l.reps as number)))
    : null
  const totalVolume = Math.round(complete.reduce((sum, l) => sum + (l.weight_kg as number) * (l.reps as number), 0))

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.5, 1].map(t => {
          const y = pad.top + chartH * (1 - t)
          return (
            <line key={t} x1={pad.left} y1={y} x2={width - pad.right} y2={y}
              stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="3,4" />
          )
        })}
        {/* Y axis labels */}
        {[...new Set([rawMin, rawMax])].map(val => (
          <text
            key={val}
            x={pad.left - 6}
            y={yScale(val) + 3.5}
            textAnchor="end"
            fontSize={9.5}
            fontWeight={600}
            fill={colors.textMuted}
          >
            {val}
          </text>
        ))}
        {/* X axis labels */}
        {points.map(p => (
          <text
            key={p.week}
            x={xScale(p.week)}
            y={height - 4}
            textAnchor="middle"
            fontSize={9.5}
            fill={colors.textDim}
          >
            W{p.week}
          </text>
        ))}
        {/* Area fill */}
        {areaD && <path d={areaD} fill={`url(#${gradId})`} />}
        {/* Line */}
        <path d={pathD} fill="none" stroke={accentColor} strokeWidth={2.5}
          strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {points.map(p => (
          <circle
            key={p.week}
            cx={xScale(p.week)}
            cy={yScale(p.weight)}
            r={p.week === lastPoint.week ? 4.5 : 3.5}
            fill={p.week === lastPoint.week ? accentColor : colors.card}
            stroke={accentColor}
            strokeWidth={2}
          />
        ))}
        {/* Latest value label */}
        <text
          x={xScale(lastPoint.week)}
          y={yScale(lastPoint.weight) - 10}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={700}
          fill={accentColor}
        >
          {lastPoint.weight}kg
        </text>
      </svg>

      <div style={{ display: 'flex', gap: '24px', marginTop: '14px', flexWrap: 'wrap' }}>
        {[
          { label: 'Best set', value: bestSet.weight_kg != null ? `${bestSet.weight_kg}kg × ${bestSet.reps}` : '—' },
          { label: 'Est. 1RM', value: best1RM != null ? `${Math.round(best1RM)}kg` : '—' },
          { label: 'Total volume', value: totalVolume > 0 ? `${totalVolume.toLocaleString()}kg` : '—' },
          { label: 'Weeks logged', value: String(weeksLogged) },
          { label: 'First logged', value: new Date(firstLog.logged_at).toLocaleDateString() },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ color: colors.textDim, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '2px' }}>{label}</div>
            <div style={{ color: colors.textPrimary, fontSize: '15px', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
