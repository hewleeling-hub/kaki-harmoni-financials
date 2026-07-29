// Server-rendered SVG charts — no client JS, fast, responsive. Identity is never
// colour-alone: every chart carries a legend and/or direct labels.
import { rm } from "@/lib/format";

const INK = "#1F2937";
const MUTED = "#9CA3AF";
const GRID = "#EEF2F7";
const BRAND = "#5E8F45";

// ── Area / line: revenue trend over months ───────────────────────────────────
export function AreaChart({
  data,
  color = BRAND,
  height = 220,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const W = 760;
  const H = height;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const area = n
    ? `${line} L${pts[n - 1][0]},${padT + plotH} L${pts[0][0]},${padT + plotH} Z`
    : "";
  const gridVals = [0, 0.5, 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {gridVals.map((g) => (
        <line
          key={g}
          x1={padL}
          x2={W - padR}
          y1={padT + plotH - g * plotH}
          y2={padT + plotH - g * plotH}
          stroke={GRID}
          strokeWidth="1"
        />
      ))}
      {area && <path d={area} fill="url(#areaFill)" />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="3.5" fill="#fff" stroke={color} strokeWidth="2">
            <title>{`${data[i].label}: ${rm(data[i].value)}`}</title>
          </circle>
        </g>
      ))}
      {/* last-point direct label */}
      {n > 0 && (
        <text
          x={pts[n - 1][0]}
          y={Math.max(padT + 10, pts[n - 1][1] - 10)}
          textAnchor="end"
          fontSize="12"
          fontWeight="700"
          fill={INK}
        >
          {rm(data[n - 1].value)}
        </text>
      )}
      {data.map((d, i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 8}
          textAnchor="middle"
          fontSize="11"
          fill={MUTED}
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}

// ── Grouped bars: inflow vs cash-out per month ────────────────────────────────
export function GroupedBars({
  data,
  colorA = BRAND,
  colorB = "#DC2626",
  height = 220,
}: {
  data: { label: string; a: number; b: number }[];
  colorA?: string;
  colorB?: string;
  height?: number;
}) {
  const W = 760;
  const H = height;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  const n = Math.max(1, data.length);
  const groupW = plotW / n;
  const barW = Math.min(26, (groupW - 8) / 2 - 2);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      {[0, 0.5, 1].map((g) => (
        <line
          key={g}
          x1={padL}
          x2={W - padR}
          y1={padT + plotH - g * plotH}
          y2={padT + plotH - g * plotH}
          stroke={GRID}
          strokeWidth="1"
        />
      ))}
      {data.map((d, i) => {
        const cx = padL + i * groupW + groupW / 2;
        const x1 = cx - barW - 2;
        const x2 = cx + 2;
        return (
          <g key={i}>
            <rect
              x={x1}
              y={y(d.a)}
              width={barW}
              height={padT + plotH - y(d.a)}
              rx="4"
              fill={colorA}
            >
              <title>{`${d.label} · Inflow: ${rm(d.a)}`}</title>
            </rect>
            <rect
              x={x2}
              y={y(d.b)}
              width={barW}
              height={padT + plotH - y(d.b)}
              rx="4"
              fill={colorB}
            >
              <title>{`${d.label} · Cash Out: ${rm(d.b)}`}</title>
            </rect>
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill={MUTED}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Donut: revenue mix ────────────────────────────────────────────────────────
export function Donut({
  segments,
  centerTop,
  centerValue,
  size = 200,
}: {
  segments: { label: string; value: number; color: string }[];
  centerTop?: string;
  centerValue?: string;
  size?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 70;
  const cx = 100;
  const cy = 100;
  const C = 2 * Math.PI * r;
  const gap = 3; // px gap between segments
  let offset = 0;

  return (
    <svg
      viewBox="0 0 200 200"
      style={{ width: size, height: size }}
      className="mx-auto"
      role="img"
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={GRID} strokeWidth="26" />
      {segments.map((s, i) => {
        const frac = s.value / total;
        const len = Math.max(0, frac * C - gap);
        const dash = `${len} ${C - len}`;
        const el = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="26"
            strokeDasharray={dash}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          >
            <title>{`${s.label}: ${rm(s.value)} (${Math.round(frac * 100)}%)`}</title>
          </circle>
        );
        offset += frac * C;
        return el;
      })}
      {centerValue && (
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="800" fill={INK}>
          {centerValue}
        </text>
      )}
      {centerTop && (
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fill={MUTED}>
          {centerTop}
        </text>
      )}
    </svg>
  );
}

// ── Break-even line: cumulative cash (can go negative), with a zero baseline ──
export function BreakEvenChart({
  data,
  breakEvenIndex,
  height = 240,
}: {
  data: { label: string; value: number }[];
  breakEvenIndex?: number | null; // fractional month index where it crosses 0
  height?: number;
}) {
  const W = 760;
  const H = height;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const vals = data.map((d) => d.value);
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals, 1);
  const range = max - min || 1;
  const n = data.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + ((max - v) / range) * plotH;
  const zeroY = y(0);
  const line = data
    .map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`)
    .join(" ");
  const beX = breakEvenIndex != null ? x(breakEvenIndex) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      {/* zero baseline */}
      <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" />
      {beX != null && (
        <>
          <line x1={beX} x2={beX} y1={padT} y2={padT + plotH} stroke="#2563EB" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx={beX} cy={zeroY} r="4.5" fill="#2563EB" />
        </>
      )}
      {line && <path d={line} fill="none" stroke={BRAND} strokeWidth="2.5" strokeLinejoin="round" />}
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r="2.5" fill={BRAND}>
          <title>{`${d.label}: ${rm(d.value)}`}</title>
        </circle>
      ))}
      {data.map((d, i) =>
        i % Math.ceil(n / 8) === 0 || i === n - 1 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={MUTED}>
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

// ── Horizontal progress meter (utilization / margin) ──────────────────────────
export function Meter({ pct, color = BRAND }: { pct: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
      <div
        className="h-full rounded-full"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
