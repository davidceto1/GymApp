import { useState } from 'react';
import { formatDate } from './format';

export interface ChartPoint {
  t: number;
  value: number;
  /** Rendered hollow and called out in the tooltip. */
  failed?: boolean;
  detail?: string;
}

interface LineChartProps {
  points: ChartPoint[];
  unit: string;
  label: string;
}

const W = 340;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** Single-series line chart with crosshair tooltip and a table fallback. */
export function LineChart({ points, unit, label }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  if (points.length === 0) {
    return <p className="muted empty-chart">No data yet — finish a workout to see your progress.</p>;
  }

  const values = points.map(p => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= 5;
    hi += 5;
  }
  const padY = (hi - lo) * 0.1;
  lo = Math.max(0, lo - padY);
  hi += padY;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const x = (t: number) =>
    t1 === t0 ? PAD.left + (W - PAD.left - PAD.right) / 2 : PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.t) - px) < Math.abs(x(points[best].t) - px)) best = i;
    });
    setHover(best);
  };

  const h = hover != null ? points[hover] : null;

  return (
    <figure className="chart">
      <div className="chart-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${label} chart, ${points.length} points`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {niceTicks(lo, hi).map(v => (
            <g key={v}>
              <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
              <text className="chart-axis" x={PAD.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle">{v}</text>
            </g>
          ))}
          <text className="chart-axis" x={PAD.left} y={H - 8} textAnchor="start">{formatDate(t0, { month: 'short', day: 'numeric' })}</text>
          {t1 !== t0 && (
            <text className="chart-axis" x={W - PAD.right} y={H - 8} textAnchor="end">{formatDate(t1, { month: 'short', day: 'numeric' })}</text>
          )}
          <path className="chart-line" d={path} />
          {h && <line className="chart-crosshair" x1={x(h.t)} x2={x(h.t)} y1={PAD.top} y2={H - PAD.bottom} />}
          {points.map((p, i) => (
            <circle
              key={i}
              className={`chart-dot ${p.failed ? 'failed' : ''} ${hover === i ? 'active' : ''}`}
              cx={x(p.t)}
              cy={y(p.value)}
              r={hover === i ? 6 : 4}
            />
          ))}
        </svg>
        {h && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(x(h.t) / W) * 100}%`,
              top: `${(y(h.value) / H) * 100}%`,
              // Keep the tooltip inside the plot near the edges.
              ['--tx' as string]: x(h.t) / W > 0.7 ? 'calc(-100% + 12px)' : x(h.t) / W < 0.3 ? '-12px' : '-50%',
              ['--ty' as string]: y(h.value) / H < 0.45 ? '14px' : undefined,
            }}
          >
            <strong>{h.value} {unit}</strong>
            <span>{formatDate(h.t, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {h.detail && <span>{h.detail}</span>}
            {h.failed && <span className="tag failed">Missed reps</span>}
          </div>
        )}
      </div>
      <figcaption className="chart-legend">
        {points.some(p => p.failed) && (
          <>
            <span><i className="legend-dot" /> Completed</span>
            <span><i className="legend-dot failed" /> Missed reps</span>
          </>
        )}
        <button className="link-btn" onClick={() => setTable(t => !t)}>{table ? 'Hide table' : 'Show table'}</button>
      </figcaption>
      {table && (
        <table className="data-table">
          <thead><tr><th>Date</th><th>{label} ({unit})</th><th>Result</th></tr></thead>
          <tbody>
            {[...points].reverse().map((p, i) => (
              <tr key={i}>
                <td>{formatDate(p.t, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td>{p.value}</td>
                <td>{p.detail ?? (p.failed ? 'Missed reps' : 'Completed')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}
