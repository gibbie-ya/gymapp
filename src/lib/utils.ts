import { differenceInCalendarDays } from 'date-fns'
import type { Phase } from './types'

export function getCurrentWeek(startDate: string, totalWeeks: number): number {
  const days = differenceInCalendarDays(new Date(), new Date(startDate))
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), totalWeeks)
}

export function getPhaseForWeek(phases: Phase[], week: number): Phase | null {
  return phases.find(p => week >= p.weeks_start && week <= p.weeks_end) ?? null
}

export function parseWeekRange(applies_to_weeks: string): number[] {
  const weeks: number[] = []
  const parts = applies_to_weeks.split(',').map(s => s.trim())
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      for (let i = start; i <= end; i++) weeks.push(i)
    } else {
      weeks.push(Number(part))
    }
  }
  return weeks
}

// Epley formula: 1RM = w × (1 + reps/30)
export function epley1RM(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30)
}

export interface PlateResult {
  plates: number[]
  remainder: number
}

// Greedy per-side plate breakdown; remainder is the total weight that can't be loaded
export function calcPlates(targetKg: number, barKg: number, sizes: number[]): PlateResult {
  let perSide = (targetKg - barKg) / 2
  const plates: number[] = []
  if (perSide < 0) return { plates, remainder: targetKg - barKg }
  for (const s of [...sizes].sort((a, b) => b - a)) {
    while (perSide >= s - 1e-9) {
      plates.push(s)
      perSide -= s
    }
  }
  return { plates, remainder: Math.round(perSide * 2 * 100) / 100 }
}

export const colors = {
  bg: '#0a0a0b',
  card: '#131316',
  cardHover: '#17171b',
  border: '#232329',
  borderSubtle: '#1b1b20',
  textPrimary: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#68686f',
  textDim: '#4b4b53',
  inputBg: '#0c0c0e',
  inputBorder: '#2b2b33',
  green: '#22c55e',
  greenBright: '#4ade80',
  amber: '#f59e0b',
  header: 'rgba(10, 10, 11, 0.72)',
}

export const ui = {
  font: "'Inter', system-ui, sans-serif",
  radius: '12px',
  radiusSm: '8px',
  shadow: '0 1px 2px rgba(0,0,0,0.4), 0 10px 28px -14px rgba(0,0,0,0.6)',
  glow: (c: string) => `0 6px 24px -8px ${c}99`,
}
