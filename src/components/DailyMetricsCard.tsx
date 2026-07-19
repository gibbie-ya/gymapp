import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { colors, ui } from '../lib/utils'
import type { DailyMetric } from '../lib/types'

type Metric = 'calories' | 'steps'
type Period = 'days' | 'weeks' | 'months'

const METRIC_META: Record<Metric, { label: string; unit: string; color: string }> = {
  calories: { label: 'Calories', unit: 'kcal', color: '#f59e0b' },
  steps: { label: 'Steps', unit: 'steps', color: '#22c55e' },
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Weeks run Monday–Sunday: the grouping boundary is Sunday midnight
function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return localDateStr(d)
}

function shortDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })
}

interface Bucket {
  label: string
  value: number
}

function aggregate(entries: DailyMetric[], metric: Metric, period: Period): Bucket[] {
  const withValue = entries.filter(e => e[metric] != null)

  if (period === 'days') {
    return withValue.slice(-14).map(e => ({ label: shortDay(e.logged_date), value: e[metric] as number }))
  }

  const groups = new Map<string, number[]>()
  for (const e of withValue) {
    const key = period === 'weeks' ? mondayOf(e.logged_date) : e.logged_date.slice(0, 7)
    const arr = groups.get(key) ?? []
    arr.push(e[metric] as number)
    groups.set(key, arr)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, vals]) => ({
      label: period === 'weeks'
        ? shortDay(key)
        : new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' }),
      value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
    }))
}

export function DailyMetricsCard() {
  const [entries, setEntries] = useState<DailyMetric[]>([])
  const [caloriesInput, setCaloriesInput] = useState('')
  const [stepsInput, setStepsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [metric, setMetric] = useState<Metric>('calories')
  const [period, setPeriod] = useState<Period>('days')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_date', { ascending: true })
      setEntries((data ?? []) as DailyMetric[])
    }
    load()
  }, [])

  async function logMetrics() {
    const calories = caloriesInput !== '' ? Math.round(Number(caloriesInput)) : null
    const steps = stepsInput !== '' ? Math.round(Number(stepsInput)) : null
    if ((calories == null && steps == null) || saving) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const today = localDateStr(new Date())
    // Only send the fields that were filled in, so logging one metric
    // doesn't null out the other on upsert
    const row: Record<string, unknown> = { user_id: user.id, logged_date: today }
    if (calories != null) row.calories = calories
    if (steps != null) row.steps = steps

    await supabase.from('daily_metrics').upsert(row, { onConflict: 'user_id,logged_date' })

    setEntries(prev => {
      const existing = prev.find(e => e.logged_date === today)
      const merged: DailyMetric = {
        id: existing?.id ?? `local-${today}`,
        user_id: user.id,
        logged_date: today,
        calories: calories ?? existing?.calories ?? null,
        steps: steps ?? existing?.steps ?? null,
        created_at: existing?.created_at ?? new Date().toISOString(),
      }
      return [...prev.filter(e => e.logged_date !== today), merged]
        .sort((a, b) => a.logged_date.localeCompare(b.logged_date))
    })
    setCaloriesInput('')
    setStepsInput('')
    setSaving(false)
  }

  const meta = METRIC_META[metric]
  const buckets = aggregate(entries, metric, period)
  const today = localDateStr(new Date())
  const todayEntry = entries.find(e => e.logged_date === today)

  const last7 = entries.filter(e => e[metric] != null).slice(-7).map(e => e[metric] as number)
  const avg7 = last7.length > 0 ? Math.round(last7.reduce((s, v) => s + v, 0) / last7.length) : null

  // Bar chart
  let chart = null
  if (buckets.length > 0) {
    const width = 560
    const height = 130
    const pad = { top: 18, right: 12, bottom: 22, left: 44 }
    const chartW = width - pad.left - pad.right
    const chartH = height - pad.top - pad.bottom
    const max = Math.max(...buckets.map(b => b.value))
    const n = buckets.length
    const slot = chartW / n
    const barW = Math.min(slot * 0.62, 40)
    const labelEvery = Math.ceil(n / 7)

    chart = (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible', marginTop: '12px' }}>
        {[0.5, 1].map(t => (
          <line key={t}
            x1={pad.left} y1={pad.top + chartH * (1 - t)}
            x2={width - pad.right} y2={pad.top + chartH * (1 - t)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="3,4" />
        ))}
        <text x={pad.left - 6} y={pad.top + 3.5} textAnchor="end" fontSize={9.5} fontWeight={600} fill={colors.textMuted}>
          {max.toLocaleString()}
        </text>
        <text x={pad.left - 6} y={pad.top + chartH + 3.5} textAnchor="end" fontSize={9.5} fontWeight={600} fill={colors.textMuted}>
          0
        </text>
        {buckets.map((b, i) => {
          const x = pad.left + slot * (i + 0.5)
          const h = max > 0 ? (b.value / max) * chartH : 0
          const isLast = i === n - 1
          return (
            <g key={`${b.label}-${i}`}>
              <rect
                x={x - barW / 2}
                y={pad.top + chartH - h}
                width={barW}
                height={Math.max(h, 1)}
                rx={Math.min(4, barW / 3)}
                fill={meta.color}
                opacity={isLast ? 1 : 0.55}
              />
              {isLast && (
                <text x={x} y={pad.top + chartH - h - 6} textAnchor="middle"
                  fontSize={10.5} fontWeight={700} fill={meta.color}>
                  {b.value.toLocaleString()}
                </text>
              )}
              {(i % labelEvery === 0 || isLast) && (
                <text x={x} y={height - 4} textAnchor="middle" fontSize={9.5} fill={colors.textDim}>
                  {b.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    )
  }

  const pill = (active: boolean, color: string) => ({
    background: active ? `${color}1c` : 'none',
    border: `1px solid ${active ? `${color}66` : colors.border}`,
    borderRadius: '999px',
    color: active ? color : colors.textMuted,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    padding: '5px 12px',
  })

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
            Calories & Steps
          </h3>
          <div style={{ color: colors.textMuted, fontSize: '13px', marginTop: '3px' }}>
            {todayEntry && (todayEntry.calories != null || todayEntry.steps != null) ? (
              <>
                Today:
                {todayEntry.calories != null && (
                  <span style={{ color: METRIC_META.calories.color, fontWeight: 600 }}> {todayEntry.calories.toLocaleString()} kcal</span>
                )}
                {todayEntry.calories != null && todayEntry.steps != null && ' ·'}
                {todayEntry.steps != null && (
                  <span style={{ color: METRIC_META.steps.color, fontWeight: 600 }}> {todayEntry.steps.toLocaleString()} steps</span>
                )}
              </>
            ) : (
              'Nothing logged today yet.'
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number"
            placeholder="kcal"
            value={caloriesInput}
            onChange={e => setCaloriesInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') logMetrics() }}
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
          <input
            type="number"
            placeholder="steps"
            value={stepsInput}
            onChange={e => setStepsInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') logMetrics() }}
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
            onClick={logMetrics}
            disabled={saving || (caloriesInput === '' && stepsInput === '')}
            style={{
              background: caloriesInput !== '' || stepsInput !== '' ? colors.green : '#1a1a1e',
              color: caloriesInput !== '' || stepsInput !== '' ? '#04150a' : colors.textMuted,
              border: 'none',
              borderRadius: '9px',
              padding: '9px 16px',
              fontWeight: 700,
              cursor: caloriesInput !== '' || stepsInput !== '' ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              boxShadow: caloriesInput !== '' || stepsInput !== '' ? ui.glow(colors.green) : 'none',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Log'}
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(Object.keys(METRIC_META) as Metric[]).map(m => (
                <button key={m} onClick={() => setMetric(m)} style={pill(metric === m, METRIC_META[m].color)}>
                  {METRIC_META[m].label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['days', 'weeks', 'months'] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={pill(period === p, meta.color)}>
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {buckets.length === 0 ? (
            <div style={{ color: colors.textMuted, fontSize: '13px', textAlign: 'center', padding: '18px 0 6px' }}>
              No {meta.label.toLowerCase()} logged yet.
            </div>
          ) : (
            <>
              {chart}
              <div style={{ display: 'flex', gap: '24px', marginTop: '10px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: colors.textDim, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '2px' }}>
                    7-day avg
                  </div>
                  <div style={{ color: colors.textPrimary, fontSize: '15px', fontWeight: 700 }}>
                    {avg7 != null ? `${avg7.toLocaleString()} ${meta.unit}` : '—'}
                  </div>
                </div>
                {period !== 'days' && (
                  <div style={{ color: colors.textDim, fontSize: '11px', alignSelf: 'flex-end' }}>
                    {period === 'weeks' ? 'Weekly avg/day · weeks reset Sunday midnight' : 'Monthly avg/day'}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
