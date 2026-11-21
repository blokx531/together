import { useId, useState } from 'react';
import { formatLocalDate, type LocalDate } from '@/shared/lib/localDate';
import type { ProjectionPoint, WeighIn } from '../domain/projection';
import { daysBetween } from '@/shared/lib/localDate';

interface WeightChartProps {
  measured: readonly WeighIn[];
  estimated: readonly ProjectionPoint[];
  targetKg: number | null;
}

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 32, left: 44 };
const kg = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

/**
 * Measured weigh-ins (solid line + dots) against the intake-based estimate (dashed) and the target
 * (dotted). Hand-drawn SVG: a full charting library is not worth its size for one line chart.
 */
export function WeightChart({ measured, estimated, targetKg }: WeightChartProps) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const dates = [...measured.map((p) => p.date), ...estimated.map((p) => p.date)].sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return null;

  const values = [
    ...measured.map((p) => p.kg),
    ...estimated.map((p) => p.kg),
    ...(targetKg === null ? [] : [targetKg]),
  ];
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  const spanDays = Math.max(1, daysBetween(first, last));
  const x = (date: LocalDate) =>
    PAD.left + (daysBetween(first, date) / spanDays) * (WIDTH - PAD.left - PAD.right);
  const y = (value: number) =>
    PAD.top + ((max - value) / (max - min)) * (HEIGHT - PAD.top - PAD.bottom);
  const path = (points: readonly { date: LocalDate; kg: number }[]) =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`)
      .join(' ');
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          Weight chart: {measured.length} measured weigh-ins
          {estimated.length > 1 ? ' and an estimated trend from logged calories' : ''}
          {targetKg === null ? '' : `, target ${kg.format(targetKg)} kg`}
        </title>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-line"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-ink-muted text-[12px]"
            >
              {kg.format(tick)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 8} className="fill-ink-muted text-[12px]">
          {formatLocalDate(first, 'day-month')}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 8}
          textAnchor="end"
          className="fill-ink-muted text-[12px]"
        >
          {formatLocalDate(last, 'day-month')}
        </text>
        {targetKg !== null ? (
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(targetKg)}
            y2={y(targetKg)}
            className="stroke-positive"
            strokeWidth="2"
            strokeDasharray="2 6"
          />
        ) : null}
        {estimated.length > 1 ? (
          <path
            d={path(estimated)}
            fill="none"
            className="stroke-ink-subtle"
            strokeWidth="2"
            strokeDasharray="6 6"
          />
        ) : null}
        {measured.length > 1 ? (
          <path d={path(measured)} fill="none" className="stroke-accent" strokeWidth="2.5" />
        ) : null}
        {measured.map((point) => (
          <circle
            key={point.date}
            cx={x(point.date)}
            cy={y(point.kg)}
            r="4.5"
            className="fill-surface stroke-accent"
            strokeWidth="2.5"
          />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span>
          <span aria-hidden className="text-accent">
            ●━
          </span>{' '}
          Measured
        </span>
        {estimated.length > 1 ? (
          <span>
            <span aria-hidden>┅</span> Estimated from logged calories (approximate)
          </span>
        ) : null}
        {targetKg !== null ? (
          <span>
            <span aria-hidden className="text-positive">
              ┈
            </span>{' '}
            Target
          </span>
        ) : null}
        <button
          type="button"
          className="ml-auto font-medium text-accent"
          aria-expanded={showTable}
          onClick={() => {
            setShowTable((v) => !v);
          }}
        >
          {showTable ? 'Hide table' : 'Show as table'}
        </button>
      </figcaption>
      {showTable ? (
        <table className="w-full text-sm">
          <caption className="sr-only">Measured weigh-ins</caption>
          <thead>
            <tr className="text-left text-ink-muted">
              <th scope="col" className="font-medium">
                Date
              </th>
              <th scope="col" className="text-right font-medium">
                Weight
              </th>
            </tr>
          </thead>
          <tbody>
            {measured.map((point) => (
              <tr key={point.date} className="border-t border-line">
                <td className="py-1">{formatLocalDate(point.date, 'day-month-year')}</td>
                <td className="py-1 text-right tabular-nums">{kg.format(point.kg)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </figure>
  );
}
