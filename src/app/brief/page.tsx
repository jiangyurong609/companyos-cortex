"use client";

import Link from "next/link";
import { useState } from "react";
import { usePoll } from "@/components/usePoll";
import { buildClusters, strategicProposal, type Cluster } from "@/lib/clusters";
import type { Digest } from "@/lib/digest";
import { teamSlug } from "@/lib/slug";
import type { EventRecord } from "@/lib/schemas";

const fmtUsd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`);
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

const relatedRows = (r: EventRecord) => r.diff.filter((d) => d.id.startsWith("recalled-"));
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
  const dg = usePoll<{ digest: Digest | null; generating: boolean; error?: string }>("/api/digest", 2000);
  const events = list?.events ?? [];
  const inFlight = events.filter(digesting);
  const clusters = buildClusters(events);
  const needsYou = clusters.filter((c) => !c.lead.decision && (c.lead.stage === "DIFF_READY" || c.lead.stage === "ACCEPTED"));
  const clustered = new Set(clusters.flatMap((c) => c.items.map((r) => r.id)));
  const decided = events.filter((r) => r.decision);
  const managed = events.filter((r) => r.triage?.route === "manager" && !r.decision && !clustered.has(r.id));
  const teams = [...new Set(managed.map((r) => r.reporter?.team).filter((t): t is string => !!t))];
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

      {(dg?.digest || dg?.generating) && events.some((r) => r.triage) && (
        <section className="rise mt-8 rounded-2xl border border-line p-6">
          <p className="font-mono text-xs tracking-[0.3em] text-muted">
            TODAY, DIGESTED {dg.generating && <span className="text-observed">· updating…</span>}
          </p>
          {dg.digest && (
            <>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">{dg.digest.headline}</h2>
              <ul className="mt-4 space-y-3">
                {dg.digest.sentences.map((s, i) => (
                  <li key={i} className="leading-relaxed">
                    {s.text}{" "}
                    {s.cites.map((c) => (
                      <span key={c} className="ml-1 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-recalled">
                        {c}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-mono text-[11px] text-muted">
                {dg.digest.basedOn} grounded signals · composed only from verified facts · every sentence cites its sources
              </p>
            </>
          )}
        </section>
      )}

      {managed.length > 0 && (
        <p className="mt-6 font-mono text-xs text-muted">
          {managed.length} item{managed.length > 1 ? "s" : ""} routed to managers — no escalation needed:{" "}
          {teams.map((t) => (
            <Link key={t} href={`/team/${teamSlug(t)}`} className="ml-2 text-recalled underline-offset-2 hover:underline">
              {t} →
            </Link>
          ))}
        </p>
      )}

      {needsYou.length > 0 && (
        <section className="mt-10">
          <p className="font-mono text-xs tracking-[0.3em] text-derived">
            {needsYou.length} THING{needsYou.length > 1 ? "S" : ""} NEED{needsYou.length > 1 ? "" : "S"} YOUR DECISION
          </p>
          <div className="mt-4 space-y-5">
            {needsYou.map((c, i) => (
              <DecisionCard key={c.key} rec={c.lead} cluster={c} hero={i === 0} />
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
              {r.action?.status === "drafting" && (
                <p className="mt-3 flex items-center gap-2 font-mono text-xs text-observed">
                  <span className="h-2 w-2 rounded-full bg-observed pulse" /> The company is reacting — QM is finding an owner and drafting the plan…
                </p>
              )}
              {r.action?.status === "ready" && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-sm">
                    <span className="text-muted">Owner:</span> {r.action.owner} <span className="font-mono text-xs text-muted">· {r.action.ref}</span>
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
                    {r.action.steps?.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </div>
              )}
              {r.action?.status === "failed" && <p className="mt-2 font-mono text-xs text-danger">plan failed: {r.action.error}</p>}
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

const SOURCE: Record<string, string> = { phone: "phone", call: "call", slack: "Slack", ticket: "ticket", github: "GitHub", email: "email" };

function DecisionCard({ rec, cluster, hero }: { rec: EventRecord; cluster: Cluster; hero: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const many = cluster.contributors.length > 1;
  const { title, sub } = many
    ? {
        title: `${cluster.label} came up ${cluster.contributors.length} times today, from ${cluster.teams.length} teams — ${fmtUsd(cluster.totalUsd)} at stake.`,
        sub: `${cluster.contributors.map((c) => c.name).join(", ")} each saw one piece. Nobody wrote a report, and nobody had connected them.`,
      }
    : headline(rec);
  const ev = rec.event!;
  // The CEO decides strategy (priority/roadmap); operational follow-ups stay with the team.
  const decision = strategicProposal(rec);
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
      {many ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {cluster.contributors.map((c) => (
            <span key={c.eventId} title={c.summary} className="rounded-full border border-observed/40 px-2.5 py-1 text-xs">
              {c.name} <span className="text-muted">· {c.team} · {SOURCE[c.source] ?? c.source}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-2 font-mono text-xs text-muted">
          from {rec.reporter ? `${rec.reporter.name} · ${rec.reporter.role}, ${rec.reporter.team}` : rec.observation.actor ?? "the field"} · no report written
        </p>
      )}
      <h2 className={`${hero ? "text-3xl" : "text-xl"} font-semibold leading-tight tracking-tight`}>{title}</h2>
      <p className="mt-2 text-muted">{sub}</p>
      <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs">
        {ev.deadline_text && <span className="rounded-md border border-derived/50 px-2 py-1 text-derived">answer needed {ev.deadline_text}</span>}
        {sources.map((s) => (
          <span key={s} className="rounded-md border border-line px-2 py-1 text-recalled">
            {s}
          </span>
        ))}
        {rec.triage && (
          <span className="rounded-md border border-derived/40 px-2 py-1 text-derived" title={rec.triage.why}>
            routed to you by {rec.triage.by === "river" ? `River (learned from ${rec.triage.learnedFrom} decisions)` : rec.triage.by}
          </span>
        )}
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
