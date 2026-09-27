"use client";

import Link from "next/link";
import { useState } from "react";
import { usePoll } from "@/components/usePoll";
import type { EventRecord } from "@/lib/schemas";

const fmtUsd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`);
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

const stakes = (r: EventRecord) => r.derivedTotalUsd ?? r.event?.opportunity_value_usd ?? 0;
const relatedRows = (r: EventRecord) => r.diff.filter((d) => d.id.startsWith("recalled-"));
const proposals = (r: EventRecord) => r.diff.filter((d) => d.kind === "proposed");
const digesting = (r: EventRecord) => ["CAPTURED", "COMPILED", "RESOLVING_MEMORY"].includes(r.stage);

/** One sentence a CEO can act on, built only from grounded fields. */
function headline(r: EventRecord): { title: string; sub: string } {
  const ev = r.event!;
  const org = ev.organization ?? "A customer";
  const req = ev.requirement ?? "a missing capability";
  const n = relatedRows(r).length;
  if (r.derivedTotalUsd && n > 0)
    return {
      title: `${req} is now blocking ${fmtUsd(r.derivedTotalUsd)} across ${n + 1} customers.`,
      sub: `${n + 1} separate conversations — nobody had connected them until ${ev.owner ?? r.observation.actor ?? "someone"}'s note today.`,
    };
  return {
    title: `${org} is blocked by ${req}${ev.opportunity_value_usd ? ` — ${fmtUsd(ev.opportunity_value_usd)} at stake` : ""}.`,
    sub: "No related history in company memory yet — this is the first time the company has heard it.",
  };
}

export default function BriefPage() {
  const list = usePoll<{ events: EventRecord[] }>("/api/events");
  const events = list?.events ?? [];
  const inFlight = events.filter(digesting);
  const needsYou = events
    .filter((r) => r.event && (r.stage === "DIFF_READY" || r.stage === "ACCEPTED") && !r.decision && proposals(r).length > 0)
    .sort((a, b) => stakes(b) - stakes(a));
  const decided = events.filter((r) => r.decision);
  const since = events.length ? events[events.length - 1].observation.createdAt : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-muted">CORTEX · CEO BRIEFING</p>
          <p className="mt-1 text-lg font-medium">
            Northstar API <span className="text-muted">· {since ? `since ${fmtTime(since)}` : "today"}</span>
          </p>
        </div>
        <Link href="/command" className="font-mono text-xs text-muted hover:text-fg">
          evidence view →
        </Link>
      </header>

      {events.length === 0 && (
        <section className="grid min-h-[55vh] place-items-center text-center">
          <div>
            <p className="text-4xl font-semibold tracking-tight">Nothing new.</p>
            <p className="mt-4 text-lg text-muted">Right now, your company knows less than your people do.</p>
          </div>
        </section>
      )}

      {inFlight.length > 0 && (
        <p className="rise mt-6 flex items-center gap-3 font-mono text-sm text-observed">
          <span className="h-2 w-2 rounded-full bg-observed pulse" />
          Digesting {inFlight.length} observation{inFlight.length > 1 ? "s" : ""} from{" "}
          {[...new Set(inFlight.map((r) => r.observation.actor ?? "the field"))].join(", ")} — grounding against company memory in QM…
        </p>
      )}

      {needsYou.length > 0 && (
        <section className="mt-10">
          <p className="font-mono text-xs tracking-[0.3em] text-derived">
            {needsYou.length} THING{needsYou.length > 1 ? "S" : ""} NEED{needsYou.length > 1 ? "" : "S"} YOUR DECISION
          </p>
          <div className="mt-4 space-y-5">
            {needsYou.map((r, i) => (
              <DecisionCard key={r.id} rec={r} hero={i === 0} />
            ))}
          </div>
        </section>
      )}

      {decided.length > 0 && (
        <section className="mt-10 space-y-3">
          <p className="font-mono text-xs tracking-[0.3em] text-proposed">DECIDED · THE COMPANY NOW KNOWS WHY</p>
          {decided.map((r) => (
            <div key={r.id} className="rise rounded-xl border border-proposed/40 bg-proposed/5 px-5 py-4">
              <p className="text-lg">✓ {r.decision!.text}</p>
              <p className="mt-1 font-mono text-xs text-muted">
                {r.decision!.via === "qm" ? "QM → GBrain" : "GBrain"} · {r.decision!.ref} · linked to {r.write?.ref}
              </p>
            </div>
          ))}
        </section>
      )}

      {events.length > 0 && (
        <section className="mt-12">
          <p className="font-mono text-xs tracking-[0.3em] text-muted">WHAT YOUR PEOPLE SAW</p>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {events.map((r) => (
              <li key={r.id} className="flex items-baseline gap-4 py-3 text-sm">
                <span className="w-12 shrink-0 font-mono text-xs text-muted">{fmtTime(r.observation.createdAt)}</span>
                <span className="w-20 shrink-0 truncate text-muted">{r.observation.actor ?? "—"}</span>
                <span className="min-w-0 flex-1 truncate">
                  {r.event
                    ? [r.event.organization, r.event.requirement, r.event.opportunity_value_usd && fmtUsd(r.event.opportunity_value_usd)].filter(Boolean).join(" · ")
                    : `“${r.observation.text}”`}
                </span>
                <StatusChip rec={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function StatusChip({ rec }: { rec: EventRecord }) {
  const [label, tone] = rec.decision
    ? ["decided", "text-proposed"]
    : rec.stage === "FAILED"
      ? ["failed", "text-danger"]
      : digesting(rec)
        ? ["digesting", "text-observed"]
        : rec.stage === "ACCEPTED"
          ? ["in memory", "text-recalled"]
          : rec.stage === "REJECTED"
            ? ["rejected", "text-muted"]
            : ["needs you", "text-derived"];
  return <span className={`shrink-0 font-mono text-xs ${tone}`}>{label}</span>;
}

function DecisionCard({ rec, hero }: { rec: EventRecord; hero: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { title, sub } = headline(rec);
  const ev = rec.event!;
  // The CEO decides strategy (priority/roadmap); operational follow-ups stay with the team.
  const decision =
    proposals(rec).find((p) => /priorit|roadmap/i.test(p.title)) ?? proposals(rec).find((p) => p.op !== "action") ?? proposals(rec)[0];
  const sources = [
    `${ev.owner ?? rec.observation.actor ?? "field"} · today`,
    ...relatedRows(rec).flatMap((r) => r.evidenceRefs),
  ];

  const act = async (label: string, url: string, body: object) => {
    setBusy(label);
    setErr(null);
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) setErr((await r.json()).error);
    setBusy(null);
  };

  return (
    <article className={`rise rounded-2xl border border-line bg-panel ${hero ? "p-7" : "p-5"}`}>
      <h2 className={`${hero ? "text-3xl" : "text-xl"} font-semibold leading-tight tracking-tight`}>{title}</h2>
      <p className="mt-2 text-muted">{sub}</p>
      <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs">
        {ev.deadline_text && <span className="rounded-md border border-derived/50 px-2 py-1 text-derived">answer needed {ev.deadline_text}</span>}
        {sources.map((s) => (
          <span key={s} className="rounded-md border border-line px-2 py-1 text-recalled">
            {s}
          </span>
        ))}
        {rec.rejected?.length ? <span className="rounded-md border border-danger/50 px-2 py-1 text-danger">{rec.rejected.length} unsourced claim(s) rejected</span> : null}
      </div>

      {decision && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            disabled={!!busy}
            onClick={() => act("decide", `/api/events/${rec.id}/decide`, { proposal: decision.title })}
            className="h-11 rounded-full bg-fg px-5 text-sm font-medium text-bg disabled:opacity-50"
          >
            {busy === "decide" ? "Writing decision to company memory…" : `Approve: ${decision.title}`}
          </button>
          {rec.stage === "DIFF_READY" && (
            <button
              disabled={!!busy}
              onClick={() => act("merge", `/api/events/${rec.id}/accept`, {})}
              className="h-11 rounded-full border border-line px-5 text-sm disabled:opacity-50"
            >
              {busy === "merge" ? "Merging…" : "Merge facts only"}
            </button>
          )}
          {rec.stage === "ACCEPTED" && <span className="font-mono text-xs text-recalled">✓ facts in company memory</span>}
          <Link href="/command" className="ml-auto font-mono text-xs text-muted hover:text-fg">
            see evidence →
          </Link>
        </div>
      )}
      {err && <p className="mt-3 font-mono text-xs text-danger">{err}</p>}
    </article>
  );
}
