"use client";

import type { CSSProperties } from "react";
import type { EventRecord } from "@/lib/schemas";
import {
  type Capture,
  type Model,
  type Route,
  type StakeRow,
  KIND_COLOR,
  ROUTE_COLOR,
  ROUTE_LABEL,
  TYPE_LABEL,
  fmtTime,
  fmtUsd,
  personOf,
  routeOf,
  teamOf,
} from "./model";

const vi = (i: number) => ({ "--i": i }) as CSSProperties;

/* ---------------- (a) $ at stake by requirement ---------------- */

export function StakeBars({ rows }: { rows: StakeRow[] }) {
  if (rows.length === 0)
    return <p className="py-8 text-sm text-muted">No dollar value attached to a signal yet.</p>;
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="space-y-5">
      {rows.slice(0, 5).map((r, i) => (
        <div
          key={r.key}
          title={`${r.label}: ${fmtUsd(r.reported)} reported today + ${fmtUsd(r.recalled)} recalled from memory`}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium text-fg">{r.label}</span>
            <span className="font-mono text-lg tabular-nums text-fg">{fmtUsd(r.total)}</span>
          </div>
          <div className="relative h-3">
            <div
              className="x-bar absolute inset-0 flex gap-[2px]"
              style={{ ...vi(i), transform: `scaleX(${r.total / max})` }}
            >
              {r.reported > 0 && (
                <div className="h-full rounded-[4px] bg-observed" style={{ flex: r.reported }} />
              )}
              {r.recalled > 0 && (
                <div className="h-full rounded-[4px] bg-recalled" style={{ flex: r.recalled }} />
              )}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {r.reportedOrgs.length > 0 && (
              <>
                <span className="text-fg/80">{r.reportedOrgs.join(", ")}</span> reported {fmtUsd(r.reported)}
              </>
            )}
            {r.recalledOrgs.length > 0 && (
              <>
                {" · "}memory connected <span className="text-fg/80">{r.recalledOrgs.join(", ")}</span> +
                {fmtUsd(r.recalled)}
              </>
            )}
          </p>
        </div>
      ))}
      <div className="flex gap-4 pt-1 text-[11px] text-muted">
        <Legend color="var(--observed)" label="Reported today" />
        <Legend color="var(--recalled)" label="Recalled from company memory" />
      </div>
    </div>
  );
}

export function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}

/* ---------------- (b) routing flow: people -> team -> route ---------------- */

type FNode = { id: string; label: string; col: number; value: number; y: number; h: number; color: string };
type FLink = { s: FNode; t: FNode; value: number; color: string; sy: number; ty: number; h: number };

export function RoutingFlow({ events }: { events: EventRecord[] }) {
  const W = 560;
  const H = 230;
  const X = [128, 300, 452];
  const NW = 10;
  const GAP = 12;
  if (events.length === 0) return null;

  const nodes = new Map<string, FNode>();
  const links = new Map<string, { s: string; t: string; value: number; color: string }>();
  const addNode = (col: number, label: string, color: string) => {
    const id = `${col}:${label}`;
    const n = nodes.get(id) ?? { id, label, col, value: 0, y: 0, h: 0, color };
    n.value += 1;
    nodes.set(id, n);
    return id;
  };
  const addLink = (s: string, t: string, color: string) => {
    const k = `${s}>${t}`;
    const l = links.get(k) ?? { s, t, value: 0, color };
    l.value += 1;
    links.set(k, l);
  };
  for (const r of events) {
    const route: Route = routeOf(r);
    const p = addNode(0, personOf(r), "var(--fg)");
    const tm = addNode(1, teamOf(r), "var(--recalled)");
    const rt = addNode(2, ROUTE_LABEL[route], ROUTE_COLOR[route]);
    addLink(p, tm, "var(--fg)");
    addLink(tm, rt, ROUTE_COLOR[route]);
  }
  const total = events.length;
  const cols = [0, 1, 2].map((c) =>
    [...nodes.values()]
      .filter((n) => n.col === c)
      .sort((a, b) => (c === 2 ? (a.label === "CEO" ? -1 : 1) : b.value - a.value)),
  );
  const scale = Math.min(...cols.map((c) => (H - GAP * (c.length - 1)) / total));
  for (const c of cols) {
    const used = total * scale + GAP * (c.length - 1);
    let y = (H - used) / 2;
    for (const n of c) {
      n.y = y;
      n.h = Math.max(n.value * scale, 2);
      y += n.h + GAP;
    }
  }
  const outOff = new Map<string, number>();
  const inOff = new Map<string, number>();
  const flinks: FLink[] = [...links.values()]
    .map((l) => ({ ...l, S: nodes.get(l.s)!, T: nodes.get(l.t)! }))
    .sort((a, b) => a.S.y - b.S.y || a.T.y - b.T.y)
    .map((l) => {
      const h = l.value * scale;
      const sy = l.S.y + (outOff.get(l.s) ?? 0);
      const ty = l.T.y + (inOff.get(l.t) ?? 0);
      outOff.set(l.s, (outOff.get(l.s) ?? 0) + h);
      inOff.set(l.t, (inOff.get(l.t) ?? 0) + h);
      return { s: l.S, t: l.T, value: l.value, color: l.color, sy, ty, h };
    });

  const band = (l: FLink) => {
    const x0 = X[l.s.col] + NW;
    const x1 = X[l.t.col];
    const xm = (x0 + x1) / 2;
    return `M${x0},${l.sy} C${xm},${l.sy} ${xm},${l.ty} ${x1},${l.ty} L${x1},${l.ty + l.h} C${xm},${l.ty + l.h} ${xm},${l.sy + l.h} ${x0},${l.sy + l.h} Z`;
  };
  const mid = (l: FLink) => {
    const x0 = X[l.s.col] + NW;
    const x1 = X[l.t.col];
    const xm = (x0 + x1) / 2;
    const a = l.sy + l.h / 2;
    const b = l.ty + l.h / 2;
    return `M${x0},${a} C${xm},${a} ${xm},${b} ${x1},${b}`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" role="img" aria-label="Signal routing from people to teams to CEO or managers">
      <g transform="translate(0,10)">
        {flinks.map((l, i) => (
          <path
            key={`${l.s.id}>${l.t.id}`}
            d={band(l)}
            className="x-fade"
            style={{ ...vi(i), fill: l.color, fillOpacity: l.t.col === 2 ? 0.28 : 0.1 }}
          >
            <title>{`${l.s.label} → ${l.t.label}: ${l.value} signal${l.value > 1 ? "s" : ""}`}</title>
          </path>
        ))}
        <g className="x-motion-only">
          {flinks
            .filter((l) => l.t.col === 2)
            .map((l, i) => (
              <circle key={`p${l.t.id}${l.s.id}`} r={2.6} fill={l.color}>
                <animateMotion dur={`${2.6 + i * 0.4}s`} begin="0s" repeatCount="indefinite" path={mid(l)} />
              </circle>
            ))}
          {flinks
            .filter((l) => l.t.col === 1)
            .map((l, i) => (
              <circle key={`q${l.t.id}${l.s.id}`} r={2} fill="var(--fg)" opacity={0.7}>
                <animateMotion dur={`${2.8 + i * 0.35}s`} begin="0s" repeatCount="indefinite" path={mid(l)} />
              </circle>
            ))}
        </g>
        {[...nodes.values()].map((n, i) => (
          <g key={n.id}>
            <rect
              x={X[n.col]}
              y={n.y}
              width={NW}
              height={n.h}
              rx={3}
              className="x-node"
              style={{ ...vi(i), fill: n.color }}
            >
              <title>{`${n.label}: ${n.value}`}</title>
            </rect>
            <text
              x={n.col === 0 ? X[0] - 8 : X[n.col] + NW + 8}
              y={n.y + n.h / 2}
              dominantBaseline="middle"
              textAnchor={n.col === 0 ? "end" : "start"}
              className="x-fade"
              style={{
                ...vi(i),
                fill: n.col === 2 ? "var(--fg)" : "var(--muted)",
                fontSize: n.col === 2 ? 13 : 11,
                fontWeight: n.col === 2 ? 600 : 400,
                paintOrder: "stroke",
                stroke: "var(--panel)",
                strokeWidth: 4,
              }}
            >
              {n.label}
              {n.col === 2 ? ` · ${n.value}` : ""}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------------- (c) signals over time ---------------- */

export function Timeline({ captures }: { captures: Capture[] }) {
  const W = 520;
  const H = 150;
  const P = { l: 30, r: 16, t: 14, b: 24 };
  if (captures.length === 0) return null;
  let t0 = captures[0].t;
  let t1 = captures[captures.length - 1].t;
  if (t1 - t0 < 30 * 60_000) t0 = t1 - 30 * 60_000;
  const pad = (t1 - t0) * 0.08;
  t0 -= pad;
  t1 += pad;
  const total = captures.reduce((s, c) => s + c.count, 0);
  const x = (t: number) => P.l + ((t - t0) / (t1 - t0)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / Math.max(total, 1)) * (H - P.t - P.b);
  const pts: (Capture & { cx: number; cy: number })[] = [];
  const segs: string[] = [`M${x(t0)},${y(0)}`];
  let cum = 0;
  for (const c of captures) {
    segs.push(`H${x(c.t)}`);
    cum += c.count;
    segs.push(`V${y(cum)}`);
    pts.push({ ...c, cx: x(c.t), cy: y(cum) });
  }
  segs.push(`H${x(t1)}`);
  const d = segs.join(" ");
  const area = `${d} V${y(0)} H${x(t0)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative signals captured over time">
      <defs>
        <linearGradient id="x-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--observed)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--observed)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={P.l} x2={W - P.r} y1={y(total * f)} y2={y(total * f)} stroke="var(--line)" strokeWidth={1} />
      ))}
      <text x={P.l - 6} y={y(total)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--muted)">
        {total}
      </text>
      <text x={P.l - 6} y={y(0)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--muted)">
        0
      </text>
      <path d={area} fill="url(#x-area)" className="x-fade" />
      <path d={d} pathLength={1} fill="none" stroke="var(--observed)" strokeWidth={2} strokeLinejoin="round" className="x-draw" />
      {pts.map((p, i) => (
        <circle
          key={p.id}
          cx={p.cx}
          cy={p.cy}
          r={4 + Math.min(p.count, 4)}
          stroke="var(--panel)"
          strokeWidth={2}
          className="x-pop"
          style={{ ...vi(i), fill: p.ceo ? "var(--derived)" : "var(--observed)" }}
        >
          <title>{`${fmtTime(p.t)} · ${p.person} · ${p.count} signal${p.count > 1 ? "s" : ""}${p.ceo ? " · routed to CEO" : ""}`}</title>
        </circle>
      ))}
      <text x={P.l} y={H - 6} fontSize={10} fill="var(--muted)" fontFamily="var(--font-geist-mono)">
        {fmtTime(t0)}
      </text>
      <text x={W - P.r} y={H - 6} textAnchor="end" fontSize={10} fill="var(--muted)" fontFamily="var(--font-geist-mono)">
        {fmtTime(t1)}
      </text>
    </svg>
  );
}

/* ---------------- (d) knowledge kinds + signal types ---------------- */

export function KindsBreakdown({ kinds, types }: { kinds: Model["kinds"]; types: Model["types"] }) {
  const total = kinds.reduce((s, k) => s + k.n, 0);
  const maxType = Math.max(...types.map((t) => t.n), 1);
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-[4px]">
        {kinds
          .filter((k) => k.n > 0)
          .map((k, i) => (
            <div
              key={k.kind}
              title={`${k.kind}: ${k.n}`}
              className="x-bar h-full"
              style={{ ...vi(i), flex: k.n, background: KIND_COLOR[k.kind] }}
            />
          ))}
        {total === 0 && <div className="h-full flex-1 bg-line" />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {kinds.map((k) => (
          <div key={k.kind} className="flex items-center justify-between">
            <Legend color={KIND_COLOR[k.kind]} label={k.kind} />
            <span className="font-mono tabular-nums text-fg">{k.n}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2">
        {types.map((t, i) => (
          <div key={t.type} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-muted">{TYPE_LABEL[t.type] ?? t.type}</span>
            <span className="font-mono tabular-nums text-fg">{t.n}</span>
            <div className="col-span-2 h-1 rounded-full bg-line">
              <div
                className="x-bar h-full rounded-full bg-fg/60"
                style={{ ...vi(i + 2), transform: `scaleX(${t.n / maxType})` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
