/**
 * Lightweight performance monitoring.
 *
 * Collects the Core Web Vitals (LCP, CLS, INP, FCP, TTFB) plus page load time
 * through the browser's PerformanceObserver API (the same primitives the
 * `web-vitals` library wraps), and records React component render durations
 * reported by <Profiler>. Everything is logged to the console and kept in a
 * small in-memory store so a dev-mode overlay can display it.
 */

export type MetricRating = 'good' | 'needs-improvement' | 'poor'

export type MetricKind = 'web-vital' | 'load' | 'render'

export interface PerfMetric {
  /** Metric name, e.g. "LCP" or "render:App". */
  name: string
  kind: MetricKind
  /** Milliseconds (unitless for CLS). */
  value: number
  rating: MetricRating
  timestamp: number
}

/**
 * Baseline thresholds: [good upper bound, poor lower bound].
 * Web Vitals values follow the published thresholds from web.dev; PAGE_LOAD
 * and RENDER are project baselines (a render over one frame budget is flagged).
 */
export const PERFORMANCE_BASELINE: Record<string, readonly [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
  PAGE_LOAD: [3000, 6000],
  RENDER: [16, 50],
}

const MAX_STORED_METRICS = 200

let metrics: PerfMetric[] = []
const listeners = new Set<() => void>()
let started = false
let consoleLogging = true

export function rate(baselineKey: string, value: number): MetricRating {
  const threshold = PERFORMANCE_BASELINE[baselineKey]
  if (!threshold) return 'good'
  if (value <= threshold[0]) return 'good'
  if (value <= threshold[1]) return 'needs-improvement'
  return 'poor'
}

function emit() {
  listeners.forEach((l) => l())
}

function log(metric: PerfMetric) {
  if (!consoleLogging) return
  const value =
    metric.name === 'CLS' ? metric.value.toFixed(4) : `${metric.value.toFixed(1)}ms`
  console.log(`[perf] ${metric.name}: ${value} (${metric.rating})`)
}

export function recordMetric(
  name: string,
  kind: MetricKind,
  value: number,
  baselineKey: string = name,
): PerfMetric {
  const metric: PerfMetric = {
    name,
    kind,
    value,
    rating: rate(baselineKey, value),
    timestamp: Date.now(),
  }
  // Metrics such as LCP/CLS/INP update over time: keep only the latest per name.
  // Render metrics are a running log, so they are appended.
  metrics =
    kind === 'render'
      ? [...metrics, metric]
      : [...metrics.filter((m) => m.name !== name), metric]
  if (metrics.length > MAX_STORED_METRICS) {
    metrics = metrics.slice(metrics.length - MAX_STORED_METRICS)
  }
  log(metric)
  emit()
  return metric
}

/** Record how long a component took to render, in milliseconds. */
export function recordRender(componentId: string, phase: string, actualDuration: number) {
  return recordMetric(`render:${componentId} (${phase})`, 'render', actualDuration, 'RENDER')
}

export function getMetrics(): readonly PerfMetric[] {
  return metrics
}

export function subscribeMetrics(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function clearMetrics() {
  metrics = []
  emit()
}

export function setPerformanceLogging(enabled: boolean) {
  consoleLogging = enabled
}

function observe(type: string, cb: (entries: PerformanceEntryList) => void, extra?: object) {
  if (typeof PerformanceObserver === 'undefined') return
  if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return
  try {
    const po = new PerformanceObserver((list) => cb(list.getEntries()))
    po.observe({ type, buffered: true, ...extra } as PerformanceObserverInit)
  } catch {
    // Entry type not observable in this browser — skip silently.
  }
}

/**
 * Start collecting page-level metrics. Safe to call more than once and a no-op
 * outside the browser.
 */
export function initPerformanceMonitoring() {
  if (started || typeof window === 'undefined') return
  started = true

  observe('paint', (entries) => {
    for (const e of entries) {
      if (e.name === 'first-contentful-paint') recordMetric('FCP', 'web-vital', e.startTime)
    }
  })

  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1]
    if (last) recordMetric('LCP', 'web-vital', last.startTime)
  })

  let clsValue = 0
  observe('layout-shift', (entries) => {
    for (const e of entries as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
      if (!e.hadRecentInput) clsValue += e.value
    }
    recordMetric('CLS', 'web-vital', clsValue)
  })

  // Approximation of INP: the slowest interaction seen so far.
  let worstInteraction = 0
  observe(
    'event',
    (entries) => {
      for (const e of entries) {
        if (e.duration > worstInteraction) {
          worstInteraction = e.duration
          recordMetric('INP', 'web-vital', worstInteraction)
        }
      }
    },
    { durationThreshold: 40 },
  )

  const reportNavigation = () => {
    const nav = performance.getEntriesByType?.('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    if (!nav) return
    recordMetric('TTFB', 'web-vital', nav.responseStart)
    recordMetric('Page load', 'load', nav.loadEventEnd || nav.duration, 'PAGE_LOAD')
  }

  if (document.readyState === 'complete') {
    // loadEventEnd is only populated after the load handlers return.
    setTimeout(reportNavigation, 0)
  } else {
    window.addEventListener('load', () => setTimeout(reportNavigation, 0), { once: true })
  }
}

/** Test helper: reset module state. */
export function resetPerformanceMonitoring() {
  metrics = []
  started = false
  consoleLogging = true
  listeners.clear()
}
