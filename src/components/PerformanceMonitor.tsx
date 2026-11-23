import { Profiler, type ReactNode, useState, useSyncExternalStore } from 'react'

import {
  getMetrics,
  type MetricRating,
  recordRender,
  subscribeMetrics,
} from '../lib/performance'

interface ProfiledProps {
  /** Label used in the logged render metric, e.g. the component name. */
  id: string
  children: ReactNode
}

/**
 * Logs render time of everything inside it. Only profiles in dev mode —
 * in production it renders its children untouched.
 */
export function Profiled({ id, children }: ProfiledProps) {
  if (!import.meta.env.DEV) return <>{children}</>
  return (
    <Profiler id={id} onRender={(_id, phase, duration) => recordRender(id, phase, duration)}>
      {children}
    </Profiler>
  )
}

const RATING_COLOR: Record<MetricRating, string> = {
  good: '#16a34a',
  'needs-improvement': '#d97706',
  poor: '#dc2626',
}

function formatValue(name: string, value: number) {
  return name === 'CLS' ? value.toFixed(4) : `${value.toFixed(1)}ms`
}

/** Dev-only floating panel listing collected performance metrics. */
export function PerformanceMonitor() {
  const metrics = useSyncExternalStore(subscribeMetrics, getMetrics, getMetrics)
  const [open, setOpen] = useState(false)

  if (!import.meta.env.DEV) return null

  const vitals = metrics.filter((m) => m.kind !== 'render')
  const renders = metrics.filter((m) => m.kind === 'render').slice(-10).reverse()

  return (
    <div
      data-testid="performance-monitor"
      style={{
        position: 'fixed',
        bottom: 8,
        left: 8,
        zIndex: 99999,
        font: '12px/1.4 ui-monospace, monospace',
        background: 'rgba(17, 24, 39, 0.92)',
        color: '#f9fafb',
        borderRadius: 6,
        padding: open ? 10 : '4px 8px',
        maxWidth: 360,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ all: 'unset', cursor: 'pointer', fontWeight: 600 }}
      >
        Perf {open ? '▾' : '▸'}
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          {vitals.length === 0 && <div>No metrics yet…</div>}
          {vitals.map((m) => (
            <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <span>{m.name}</span>
              <span style={{ color: RATING_COLOR[m.rating] }}>{formatValue(m.name, m.value)}</span>
            </div>
          ))}
          {renders.length > 0 && <div style={{ marginTop: 6, opacity: 0.7 }}>Recent renders</div>}
          {renders.map((m) => (
            <div
              key={`${m.name}-${m.timestamp}-${m.value}`}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}
            >
              <span>{m.name.replace('render:', '')}</span>
              <span style={{ color: RATING_COLOR[m.rating] }}>{formatValue(m.name, m.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
