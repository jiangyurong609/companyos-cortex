"use client";

import Link from "next/link";
import { use, useState } from "react";
import { usePoll } from "@/components/usePoll";
import type { EventRecord } from "@/lib/schemas";
import { teamSlug } from "@/lib/slug";

const fmtUsd = (n: number) => `$${Math.round(n / 1000)}K`;
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/** Manager view: the team's signals, already grounded and routed — nobody assembled an update. */
export default function TeamPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = use(params);
  const list = usePoll<{ events: EventRecord[] }>("/api/events");
  const mine = (list?.events ?? []).filter((r) => r.reporter && teamSlug(r.reporter.team) === team);
  const teamName = mine[0]?.reporter?.team ?? team;
  const manager = mine[0]?.reporter?.reportsTo;
  const people = [...new Set(mine.map((r) => r.reporter!.name))];

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-muted">CORTEX · MANAGER VIEW</p>
          <p className="mt-1 text-lg font-medium">
            {teamName} {manager && <span className="text-muted">· {manager}</span>}
          </p>
        </div>
        <Link href="/brief" className="font-mono text-xs text-muted hover:text-fg">
          CEO briefing →
        </Link>
      </header>

      <p className="mt-6 text-muted">
        {mine.length
          ? `${mine.length} signal${mine.length > 1 ? "s" : ""} from ${people.join(", ")} today · 0 status reports written · 0 update meetings`
          : "Nothing from your team yet."}
      </p>

      <ul className="mt-6 space-y-4">
        {mine.map((r) => (
          <TeamItem key={r.id} rec={r} />
        ))}
      </ul>
    </main>
  );
}

function TeamItem({ rec }: { rec: EventRecord }) {
  const [busy, setBusy] = useState(false);
  const ev = rec.event;
  const post = async (action: "accept" | "reject") => {
    setBusy(true);
    await fetch(`/api/events/${rec.id}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    setBusy(false);
  };
  const escalated = rec.triage?.route === "ceo";
  return (
    <li className="rise rounded-2xl border border-line bg-panel p-5">
      <p className="font-mono text-xs text-muted">
        {fmtTime(rec.observation.createdAt)} · {rec.reporter?.name} · {rec.reporter?.role}
      </p>
      <p className="mt-2 text-lg">{ev?.summary ?? `“${rec.observation.text}”`}</p>
      {ev && (
        <p className="mt-1 font-mono text-xs text-muted">
          {[ev.organization, ev.requirement, ev.opportunity_value_usd && fmtUsd(ev.opportunity_value_usd), ev.deadline_text].filter(Boolean).join(" · ")}
          {rec.derivedTotalUsd ? ` · ${fmtUsd(rec.derivedTotalUsd)} related across customers` : ""}
        </p>
      )}
      {rec.triage ? (
        <p className={`mt-3 text-sm ${escalated ? "text-derived" : "text-recalled"}`}>
          {escalated ? "↑ Escalated to the CEO" : "● Yours to handle"} <span className="text-muted">— {rec.triage.why}</span>
        </p>
      ) : (
        <p className="mt-3 font-mono text-xs text-observed">grounding in company memory…</p>
      )}
      {!escalated && rec.stage === "DIFF_READY" && (
        <div className="mt-4 flex gap-3">
          <button disabled={busy} onClick={() => post("accept")} className="h-9 rounded-full bg-fg px-4 text-sm font-medium text-bg disabled:opacity-50">
            {busy ? "Saving…" : "Merge into company memory"}
          </button>
          <button disabled={busy} onClick={() => post("reject")} className="h-9 rounded-full border border-line px-4 text-sm text-muted disabled:opacity-50">
            Not accurate
          </button>
        </div>
      )}
      {rec.stage === "ACCEPTED" && <p className="mt-3 font-mono text-xs text-recalled">✓ in company memory · {rec.write?.ref}</p>}
      {rec.stage === "REJECTED" && <p className="mt-3 font-mono text-xs text-muted">marked not accurate — nothing written</p>}
    </li>
  );
}
