import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { colors, ui } from '../lib/utils'
import type { BodyWeightLog } from '../lib/types'

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

    const today = new Date().toISOString().split('T')[0]
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

  const latest = entries[entries.length - 1]
  const first = entries[0]
  const change = latest && first && entries.length > 1
    ? Math.round((latest.weight_kg - first.weight_kg) * 10) / 10
    : null

  // Trend line: x scaled over actual dates, not entry index
  let chart = null
  if (entries.length > 1) {
    const width = 560
    const height = 110
    const pad = { top: 14, right: 20, bottom: 20, left: 40 }
    const chartW = width - pad.left - pad.right
    const chartH = height - pad.top - pad.bottom

    const t0 = new Date(first.logged_date).getTime()
    const t1 = new Date(latest.logged_date).getTime()
    const span = t1 - t0 || 1
    const weights = entries.map(e => e.weight_kg)
    const rawMin = Math.min(...weights)
    const rawMax = Math.max(...weights)
    const flat = rawMax === rawMin
    const min = flat ? rawMin - 2 : rawMin
    const max = flat ? rawMax + 2 : rawMax

    const x = (d: string) => pad.left + ((new Date(d).getTime() - t0) / span) * chartW
    const y = (w: number) => pad.top + chartH - ((w - min) / (max - min)) * chartH

    const pathD = entries
      .map((e, i) => `${i === 0 ? 'M' : 'L'}${x(e.logged_date).toFixed(1)},${y(e.weight_kg).toFixed(1)}`)
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
        {entries.map(e => (
          <circle key={e.logged_date} cx={x(e.logged_date)} cy={y(e.weight_kg)}
            r={e === latest ? 4.5 : 3} fill={e === latest ? colors.green : colors.card}
            stroke={colors.green} strokeWidth={2} />
        ))}
        <text x={pad.left} y={height - 2} fontSize={9.5} fill={colors.textDim}>
          {new Date(first.logged_date).toLocaleDateString()}
        </text>
        <text x={width - pad.right} y={height - 2} textAnchor="end" fontSize={9.5} fill={colors.textDim}>
          {new Date(latest.logged_date).toLocaleDateString()}
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
          {latest ? (
            <div style={{ color: colors.textMuted, fontSize: '13px', marginTop: '3px' }}>
              <span style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '15px' }}>{latest.weight_kg}kg</span>
              {' '}on {new Date(latest.logged_date).toLocaleDateString()}
              {change !== null && (
                <span style={{
                  marginLeft: '8px',
                  color: change < 0 ? colors.greenBright : change > 0 ? colors.amber : colors.textMuted,
                  fontWeight: 600,
                }}>
                  {change > 0 ? '▲' : change < 0 ? '▼' : ''} {Math.abs(change)}kg since start
                </span>
              )}
            </div>
          ) : (
            <div style={{ color: colors.textMuted, fontSize: '13px', marginTop: '3px' }}>
              Log a weekly weigh-in to see your trend.
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
            {saving ? 'Saving...' : 'Log'}
          </button>
        </div>
      </div>
      {chart}
    </div>
  )
}
