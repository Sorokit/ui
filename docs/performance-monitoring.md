# Performance monitoring

Dev-mode monitoring lives in `src/lib/performance.ts` (collection) and
`src/components/PerformanceMonitor.tsx` (`<Profiled>` + `<PerformanceMonitor>` overlay).

## What is tracked

| Metric | Source |
| --- | --- |
| FCP, LCP, CLS, INP (slowest interaction), TTFB | `PerformanceObserver` (Web Vitals primitives) |
| Page load time | Navigation Timing `loadEventEnd` |
| Component render time | React `<Profiler>` via `<Profiled id="...">` |

Every metric is logged to the console as `[perf] NAME: value (rating)` and shown in the
"Perf" panel (bottom-left) when running `npm run dev`. Nothing runs in production builds.

## Baseline

Ratings are computed against `PERFORMANCE_BASELINE` in `src/lib/performance.ts`:

| Metric | Good | Poor |
| --- | --- | --- |
| LCP | ≤ 2500ms | > 4000ms |
| CLS | ≤ 0.1 | > 0.25 |
| INP | ≤ 200ms | > 500ms |
| FCP | ≤ 1800ms | > 3000ms |
| TTFB | ≤ 800ms | > 1800ms |
| Page load | ≤ 3000ms | > 6000ms |
| Component render | ≤ 16ms | > 50ms |

A regression is any metric whose rating drops below `good` against this baseline.

## Profiling a component

```tsx
<Profiled id="SorobanPanel">
  <SorobanPanel />
</Profiled>
```
