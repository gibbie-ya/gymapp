import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { colors, ui, localDateStr, mondayOf } from '../lib/utils'
import type { BodyWeightLog } from '../lib/types'

interface WeekAvg {
  weekStart: string
  avg: number
  count: number
}

function weeklyAverages(entries: BodyWeightLog[]): WeekAvg[] {
  const groups = new Map<string, number[]>()
  for (const e of entries) {
    const key = mondayOf(e.logged_date)
    const arr = groups.get(key) ?? []
    arr.push(e.weight_kg)
    groups.set(key, arr)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, vals]) => ({
      weekStart,
      avg: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
      count: vals.length,
    }))
}

export function BodyweightCard() {
  const [entries, setEntries] = useState<BodyWeightLog[]>([])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('body_weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_date', { ascending: true })
      setEntries((data ?? []) as BodyWeightLog[])
    }
    load()
  }, [])

  async function logWeight() {
    const weight = Number(input)
    if (!weight || weight <= 0 || saving) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const today = localDateStr(new Date())
    await supabase
      .from('body_weight_logs')
      .upsert(
        { user_id: user.id, logged_date: today, weight_kg: weight },
        { onConflict: 'user_id,logged_date' }
      )

    setEntries(prev => {
      const rest = prev.filter(e => e.logged_date !== today)
      const entry: BodyWeightLog = {
        id: `local-${today}`,
        user_id: user.id,
        logged_date: today,
        weight_kg: weight,
        created_at: new Date().toISOString(),
      }
      return [...rest, entry].sort((a, b) => a.logged_date.localeCompare(b.logged_date))
    })
    setInput('')
    setSaving(false)
  }

  const today = localDateStr(new Date())
  const todayEntry = entries.find(e => e.logged_date === today)
  const weeks = weeklyAverages(entries)
  const thisWeekStart = mondayOf(today)
  const thisWeek = weeks.find(w => w.weekStart === thisWeekStart)
  const latestWeek = weeks[weeks.length - 1]
  const firstWeek = weeks[0]
  const change = weeks.length > 1
    ? Math.round((latestWeek.avg - firstWeek.avg) * 10) / 10
    : null

  // Weekly-average trend line, x scaled over actual week dates
  let chart = null
  if (weeks.length > 1) {
    const width = 560
    const height = 110
    const pad = { top: 14, right: 20, bottom: 20, left: 40 }
    const chartW = width - pad.left - pad.right
    const chartH = height - pad.top - pad.bottom

    const t0 = new Date(`${firstWeek.weekStart}T00:00:00`).getTime()
    const t1 = new Date(`${latestWeek.weekStart}T00:00:00`).getTime()
    const span = t1 - t0 || 1
    const avgs = weeks.map(w => w.avg)
    const rawMin = Math.min(...avgs)
    const rawMax = Math.max(...avgs)
    const flat = rawMax === rawMin
    const min = flat ? rawMin - 2 : rawMin
    const max = flat ? rawMax + 2 : rawMax

    const x = (weekStart: string) => pad.left + ((new Date(`${weekStart}T00:00:00`).getTime() - t0) / span) * chartW
    const y = (w: number) => pad.top + chartH - ((w - min) / (max - min)) * chartH

    const pathD = weeks
      .map((w, i) => `${i === 0 ? 'M' : 'L'}${x(w.weekStart).toFixed(1)},${y(w.avg).toFixed(1)}`)
      .join(' ')

    chart = (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible', marginTop: '10px' }}>
        {[0, 1].map(t => {
          const gy = pad.top + chartH * t
          return (
            <line key={t} x1={pad.left} y1={gy} x2={width - pad.right} y2={gy}
              stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="3,4" />
          )
        })}
        {[...new Set([rawMin, rawMax])].map(val => (
          <text key={val} x={pad.left - 6} y={y(val) + 3.5} textAnchor="end"
            fontSize={9.5} fontWeight={600} fill={colors.textMuted}>
            {val}
          </text>
        ))}
        <path d={pathD} fill="none" stroke={colors.green} strokeWidth={2.5}
          strokeLinejoin="round" strokeLinecap="round" />
        {weeks.map(w => (
          <circle key={w.weekStart} cx={x(w.weekStart)} cy={y(w.avg)}
            r={w === latestWeek ? 4.5 : 3} fill={w === latestWeek ? colors.green : colors.card}
            stroke={colors.green} strokeWidth={2} />
        ))}
        <text
          x={x(latestWeek.weekStart)}
          y={y(latestWeek.avg) - 10}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={700}
          fill={colors.green}
        >
          {latestWeek.avg}kg
        </text>
        <text x={pad.left} y={height - 2} fontSize={9.5} fill={colors.textDim}>
          {new Date(`${firstWeek.weekStart}T00:00:00`).toLocaleDateString()}
        </text>
        <text x={width - pad.right} y={height - 2} textAnchor="end" fontSize={9.5} fill={colors.textDim}>
          {new Date(`${latestWeek.weekStart}T00:00:00`).toLocaleDateString()}
        </text>
      </svg>
    )
  }

  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: ui.radius,
      boxShadow: ui.shadow,
      padding: '18px',
      marginTop: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '16px', margin: 0 }}>
            Bodyweight
          </h3>
          {thisWeek ? (
            <div style={{ color: colors.textMuted, fontSize: '13px', marginTop: '3px' }}>
              This week:{' '}
              <span style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '15px' }}>
                {thisWeek.avg}kg
              </span>
              {' '}avg of {thisWeek.count} weigh-in{thisWeek.count === 1 ? '' : 's'}
              {change !== null && (
                <span style={{
                  marginLeft: '8px',
                  color: change < 0 ? colors.greenBright : change > 0 ? colors.amber : colors.textMuted,
                  fontWeight: 600,
                }}>
                  {change > 0 ? '▲' : change < 0 ? '▼' : ''} {Math.abs(change)}kg vs first week
                </span>
              )}
            </div>
          ) : (
            <div style={{ color: colors.textMuted, fontSize: '13px', marginTop: '3px' }}>
              Weigh in daily — progress tracks the weekly average, so day-to-day noise washes out.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="number"
            step="0.1"
            placeholder="kg"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') logWeight() }}
            style={{
              background: colors.inputBg,
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: '8px',
              color: colors.textPrimary,
              padding: '8px 10px',
              fontSize: '15px',
              fontWeight: 600,
              width: '90px',
              textAlign: 'center',
            }}
          />
          <button
            onClick={logWeight}
            disabled={saving || !Number(input)}
            style={{
              background: Number(input) ? colors.green : '#1a1a1e',
              color: Number(input) ? '#04150a' : colors.textMuted,
              border: 'none',
              borderRadius: '9px',
              padding: '9px 16px',
              fontWeight: 700,
              cursor: Number(input) ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              boxShadow: Number(input) ? ui.glow(colors.green) : 'none',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : todayEntry ? 'Update' : 'Log'}
          </button>
        </div>
      </div>

      {todayEntry && (
        <div style={{ color: colors.textDim, fontSize: '11px', marginTop: '6px' }}>
          Today: {todayEntry.weight_kg}kg logged
        </div>
      )}

      {chart ?? (weeks.length === 1 && (
        <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '12px' }}>
          Trend appears once you've logged across two or more weeks — each point is a Monday–Sunday weekly average.
        </div>
      ))}
    </div>
  )
}
