import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { colors, calcPlates } from '../lib/utils'

const REST_PRESETS = [60, 90, 120]
const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]

function loadPlateSizes(): number[] {
  try {
    const raw = localStorage.getItem('gym_plates')
    if (raw) {
      const arr = raw.split(',').map(s => Number(s.trim())).filter(n => n > 0)
      if (arr.length) return arr
    }
  } catch { /* localStorage unavailable */ }
  return DEFAULT_PLATES
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface SessionToolsProps {
  accentColor: string
}

export function SessionTools({ accentColor }: SessionToolsProps) {
  // --- Rest timer ---
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [duration, setDuration] = useState(90)
  const [now, setNow] = useState(Date.now())
  const [flash, setFlash] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0
  const running = endsAt !== null && remaining > 0

  useEffect(() => {
    if (!endsAt) return
    const iv = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(iv)
  }, [endsAt])

  // Keep the screen awake while the timer runs. The lock auto-releases when
  // the tab is hidden, so re-request it when the user comes back.
  useEffect(() => {
    if (!endsAt) return

    let cancelled = false
    async function acquire() {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          const lock = await navigator.wakeLock.request('screen')
          if (cancelled) lock.release().catch(() => {})
          else wakeLockRef.current = lock
        }
      } catch { /* low battery or unsupported — timer still works, screen may sleep */ }
    }

    acquire()
    const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [endsAt])

  useEffect(() => {
    if (endsAt && remaining === 0) {
      setEndsAt(null)
      setFlash(true)
      setTimeout(() => setFlash(false), 1500)
      navigator.vibrate?.([200, 100, 200, 100, 400])
      const ctx = audioCtxRef.current
      if (ctx) {
        for (const t of [0, 0.35, 0.7]) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = 880
          osc.connect(gain)
          gain.connect(ctx.destination)
          gain.gain.setValueAtTime(0.001, ctx.currentTime + t)
          gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.28)
          osc.start(ctx.currentTime + t)
          osc.stop(ctx.currentTime + t + 0.3)
        }
      }
    }
  }, [endsAt, remaining])

  function startTimer(seconds: number) {
    // AudioContext must be created/resumed inside a user gesture or the
    // completion beep gets blocked by autoplay policy
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new AudioContext() } catch { /* no audio */ }
    }
    audioCtxRef.current?.resume()
    setDuration(seconds)
    setNow(Date.now())
    setEndsAt(Date.now() + seconds * 1000)
  }

  // --- Plate calculator ---
  const [platesOpen, setPlatesOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [bar, setBar] = useState(() => Number(localStorage.getItem('gym_bar')) || 20)
  const [sizesText, setSizesText] = useState(() => loadPlateSizes().join(', '))
  const [editingSizes, setEditingSizes] = useState(false)

  const sizes = sizesText.split(',').map(s => Number(s.trim())).filter(n => n > 0)
  const targetNum = Number(target)
  const result = target !== '' && targetNum > 0 ? calcPlates(targetNum, bar, sizes) : null

  function saveBar(b: number) {
    setBar(b)
    try { localStorage.setItem('gym_bar', String(b)) } catch { /* ignore */ }
  }

  function saveSizes(text: string) {
    setSizesText(text)
    try { localStorage.setItem('gym_plates', text) } catch { /* ignore */ }
  }

  const progress = running ? remaining / duration : 0

  return (
    <>
      {/* Spacer so page content isn't hidden behind the fixed bar */}
      <div style={{ height: platesOpen ? '210px' : '74px' }} />

      {/* Portalled to <body>: an animated ancestor's transform would otherwise
          become the containing block and break position: fixed */}
      {createPortal(
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90 }}>
        {/* Plate calculator panel */}
        {platesOpen && (
          <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 20px' }}>
            <div className="fade-up" style={{
              background: '#1a1a1f',
              border: `1px solid ${colors.border}`,
              borderRadius: '14px 14px 0 0',
              borderBottom: 'none',
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  step="0.5"
                  placeholder="Target kg"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  autoFocus
                  style={{
                    background: colors.inputBg,
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: '8px',
                    color: colors.textPrimary,
                    padding: '8px 10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    width: '110px',
                    textAlign: 'center',
                  }}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[20, 15, 10].map(b => (
                    <button
                      key={b}
                      onClick={() => saveBar(b)}
                      style={{
                        background: bar === b ? `${accentColor}1c` : 'none',
                        border: `1px solid ${bar === b ? `${accentColor}66` : colors.border}`,
                        borderRadius: '999px',
                        color: bar === b ? accentColor : colors.textMuted,
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '5px 10px',
                      }}
                    >
                      {b}kg bar
                    </button>
                  ))}
                </div>
              </div>

              {result && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: colors.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Per side:
                  </span>
                  {result.plates.length === 0 ? (
                    <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
                      {targetNum <= bar ? 'Just the bar' : 'Nothing loadable'}
                    </span>
                  ) : (
                    result.plates.map((p, i) => (
                      <span key={i} style={{
                        background: `${accentColor}1c`,
                        border: `1px solid ${accentColor}55`,
                        color: accentColor,
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 700,
                        padding: '4px 9px',
                      }}>
                        {p}
                      </span>
                    ))
                  )}
                  {result.remainder > 0 && (
                    <span style={{ color: colors.amber, fontSize: '12px' }}>
                      ({result.remainder}kg short — no plates for it)
                    </span>
                  )}
                </div>
              )}

              <div style={{ marginTop: '10px' }}>
                {editingSizes ? (
                  <input
                    value={sizesText}
                    onChange={e => saveSizes(e.target.value)}
                    onBlur={() => setEditingSizes(false)}
                    style={{
                      background: colors.inputBg,
                      border: `1px solid ${colors.inputBorder}`,
                      borderRadius: '8px',
                      color: colors.textPrimary,
                      padding: '6px 10px',
                      fontSize: '12px',
                      width: '100%',
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingSizes(true)}
                    style={{ background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: '11px', padding: 0 }}
                  >
                    Plates: {sizesText} — edit
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={{
          background: flash ? `${colors.green}22` : 'rgba(12, 12, 14, 0.85)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderTop: `1px solid ${flash ? colors.green : colors.borderSubtle}`,
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}>
          {/* Countdown progress line */}
          <div style={{ height: '2px', background: 'transparent' }}>
            {running && (
              <div style={{
                height: '100%',
                width: `${progress * 100}%`,
                background: accentColor,
                boxShadow: `0 0 8px ${accentColor}`,
                transition: 'width 0.25s linear',
              }} />
            )}
          </div>
          <div style={{
            maxWidth: '860px',
            margin: '0 auto',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: colors.textDim, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginRight: '2px' }}>
                Rest
              </span>
              {running ? (
                <>
                  <span style={{
                    color: remaining <= 5 ? colors.amber : accentColor,
                    fontWeight: 800,
                    fontSize: '20px',
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: '58px',
                  }}>
                    {formatClock(remaining)}
                  </span>
                  <button
                    onClick={() => setEndsAt(e => (e ? e + 15000 : e))}
                    style={{
                      background: 'none',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '999px',
                      color: colors.textSecondary,
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '5px 11px',
                    }}
                  >
                    +15s
                  </button>
                  <button
                    onClick={() => setEndsAt(null)}
                    style={{
                      background: 'none',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '999px',
                      color: colors.textMuted,
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '5px 11px',
                    }}
                  >
                    ✕
                  </button>
                </>
              ) : (
                REST_PRESETS.map(s => (
                  <button
                    key={s}
                    onClick={() => startTimer(s)}
                    style={{
                      background: `${accentColor}14`,
                      border: `1px solid ${accentColor}44`,
                      borderRadius: '999px',
                      color: accentColor,
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 700,
                      padding: '6px 13px',
                    }}
                  >
                    {formatClock(s)}
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setPlatesOpen(o => !o)}
              style={{
                background: platesOpen ? `${accentColor}1c` : 'none',
                border: `1px solid ${platesOpen ? `${accentColor}66` : colors.border}`,
                borderRadius: '999px',
                color: platesOpen ? accentColor : colors.textMuted,
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 13px',
                whiteSpace: 'nowrap',
              }}
            >
              ⚖ Plates
            </button>
          </div>
        </div>
      </div>,
      document.body
      )}
    </>
  )
}
