"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import type { EventRecord } from "@/lib/schemas";
import { ROUTE_COLOR, ROUTE_LABEL, TYPE_LABEL, fmtTime, fmtUsd, personOf, routeOf } from "./model";

const SOURCE: Record<string, string> = { phone: "phone", call: "call recording", slack: "Slack", ticket: "support ticket", github: "GitHub", email: "email" };


const STAGE: Record<string, { label: string; color: string; live?: boolean }> = {
  CAPTURED: { label: "Captured", color: "var(--observed)", live: true },
  COMPILED: { label: "Extracting", color: "var(--observed)", live: true },
  RESOLVING_MEMORY: { label: "Grounding", color: "var(--recalled)", live: true },
  DIFF_READY: { label: "Diff ready", color: "var(--derived)" },
  WRITING: { label: "Writing", color: "var(--recalled)", live: true },
  ACCEPTED: { label: "In memory", color: "var(--proposed)" },
  REJECTED: { label: "Rejected", color: "var(--danger)" },
  FAILED: { label: "Failed", color: "var(--danger)" },
};

export function RealityStream({ events }: { events: EventRecord[] }) {
  const items = [...events]
    .sort(
      (a, b) =>
        b.observation.createdAt.localeCompare(a.observation.createdAt) ||
        (a.signal?.index ?? 0) - (b.signal?.index ?? 0),
    )
    .slice(0, 8);
  const els = useRef(new Map<string, HTMLLIElement>());
  const tops = useRef(new Map<string, number>());

  // FLIP: existing rows glide to their new slot when a new signal lands on top.
  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    els.current.forEach((el, id) => {
      const top = el.offsetTop;
      next.set(id, top);
      const prev = tops.current.get(id);
      if (!reduce && prev !== undefined && prev !== top) {
        el.animate([{ transform: `translate3d(0,${prev - top}px,0)` }, { transform: "none" }], {
          duration: 700,
          easing: "cubic-bezier(.16,1,.3,1)",
        });
      }
    });
    tops.current = next;
  });

  return (
    <ol className="relative space-y-2">
      {items.map((r, i) => {
        const st = STAGE[r.stage] ?? { label: r.stage, color: "var(--muted)" };
        const route = routeOf(r);
        const usd = Math.max(r.derivedTotalUsd ?? 0, r.event?.opportunity_value_usd ?? 0);
        return (
          <li
            key={r.id}
            ref={(el) => {
              if (el) els.current.set(r.id, el);
              else els.current.delete(r.id);
            }}
            className="x-feed-item relative overflow-hidden rounded-lg border border-line bg-bg/60 p-3"
            style={{ "--i": i } as CSSProperties}
          >
            {/* stage-change flash: remounts whenever the stage changes */}
            <span
              key={r.stage}
              aria-hidden
              className="x-flash pointer-events-none absolute inset-0"
              style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${st.color} 22%, transparent), transparent 70%)` }}
            />
            <div className="relative flex items-center gap-2 text-[11px]">
              <span className="font-mono text-muted">{fmtTime(r.observation.createdAt)}</span>
              <span className="text-fg/90">{personOf(r)}</span>
              {r.reporter?.team && <span className="text-muted">· {r.reporter.team}</span>}
              <span className="rounded border border-line px-1 font-mono text-[10px] text-muted">{SOURCE[r.observation.source ?? "phone"] ?? r.observation.source}</span>
              <span key={`b${r.stage}`} className="ml-auto inline-flex items-center gap-1.5 font-mono" style={{ color: st.color }}>
                <span className="relative inline-flex h-1.5 w-1.5">
                  {st.live && <span className="x-ring absolute inset-0 rounded-full" style={{ background: st.color }} />}
                  <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                </span>
                {st.label}
              </span>
            </div>
            <p className="relative mt-1.5 line-clamp-2 text-sm leading-snug text-fg">
              {r.event?.summary ?? r.observation.text}
            </p>
            <div className="relative mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
              {r.event && (
                <span className="rounded border border-line px-1.5 py-0.5 text-muted">
                  {TYPE_LABEL[r.event.type] ?? r.event.type}
                </span>
              )}
              {usd > 0 && (
                <span className="rounded border border-line px-1.5 py-0.5 font-mono text-derived">{fmtUsd(usd)}</span>
              )}
              {r.triage && (
                <span className="rounded px-1.5 py-0.5 font-mono" style={{ color: ROUTE_COLOR[route], background: `color-mix(in srgb, ${ROUTE_COLOR[route]} 12%, transparent)` }}>
                  → {route === "ceo" ? "CEO" : `${r.reporter?.reportsTo ?? ROUTE_LABEL[route]}`}
                </span>
              )}
              {(r.rejected?.length ?? 0) > 0 && (
                <span className="rounded px-1.5 py-0.5 font-mono text-danger">{r.rejected!.length} unsourced blocked</span>
              )}
              {r.signal && r.signal.count > 1 && (
                <span className="ml-auto font-mono text-muted">
                  signal {r.signal.index}/{r.signal.count}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
