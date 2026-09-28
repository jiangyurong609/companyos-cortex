"use client";

import Link from "next/link";
import { useState } from "react";
import { usePoll } from "@/components/usePoll";

type Route = "ceo" | "manager";
interface Rule { id: string; route: Route; why: string }
interface PolicyVersion { version: number; rules: Rule[]; mergedAt: string; mergedBy: string; evidence?: string; ref?: string }
interface Proposal {
  id: string;
  rule: Rule;
  description: string;
  train: { before: number; after: number; n: number };
  test: { before: number; after: number; n: number };
  fixes: { eventId: string; summary: string; from: Route; to: Route; synthetic: boolean }[];
  breaks: number;
}
interface LearnState {
  stats: { decisions: number; live: number; synthetic: number; labeled: number; overrides: number; outcomes: { worked: number; didnt: number }; agreement: number };
  policy: PolicyVersion;
  history: PolicyVersion[];
  proposal: Proposal | null;
  river: { base_model: string; steps: number; losses: number[]; train: number; heldout: { n: number; base: number; tuned: number }; minutes: number; at: string } | null;
  recentLive: { eventId: string; summary: string; predicted: { route: Route; by: string }; label?: { route: Route; action: string; by: string }; outcome?: { result: string } }[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const who = (r: Route) => (r === "ceo" ? "CEO" : "manager");

export default function LearnPage() {
  const s = usePoll<LearnState>("/api/learn", 2000);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const post = async (url: string, body: object, label: string) => {
    setBusy(label);
    setMsg(null);
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    setMsg(r.ok ? (label === "export" ? `Exported ${j.examples} labeled decisions → ${j.file}` : `Policy v${j.version} is live${j.ref ? ` · written to GBrain ${j.ref}` : ""}`) : j.error);
    setBusy(null);
  };

  if (!s) return <main className="p-8 font-mono text-sm text-muted">loading…</main>;
  const { stats, policy, history, proposal } = s;
  const loop: [string, string, string][] = [
    ["Observe", `${stats.decisions}`, "signals routed"],
    ["Decide", `${stats.labeled}`, "human decisions"],
    ["Correct", `${stats.overrides}`, "overrides (labels)"],
    ["Outcome", `${stats.outcomes.worked}/${stats.outcomes.worked + stats.outcomes.didnt}`, "worked"],
    ["Learn", proposal ? "1" : "0", "proposed change"],
    ["Merge", `v${policy.version}`, "policy live"],
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-muted">CORTEX · COMPANY LEARNING</p>
          <p className="mt-1 text-lg font-medium">
            The company improves how it runs <span className="text-muted">· routing policy v{policy.version}</span>
          </p>
        </div>
        <nav className="flex gap-4 font-mono text-xs text-muted">
          <Link href="/exec" className="hover:text-fg">dashboard</Link>
          <Link href="/brief" className="hover:text-fg">CEO brief →</Link>
        </nav>
      </header>

      <section className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {loop.map(([k, v, sub], i) => (
          <div key={k} className="rise relative rounded-xl border border-line bg-panel p-4" style={{ animationDelay: `${i * 80}ms` }}>
            <p className="font-mono text-[10px] tracking-widest text-muted">{k.toUpperCase()}</p>
            <p className="mt-2 text-2xl font-semibold">{v}</p>
            <p className="mt-1 text-[11px] text-muted">{sub}</p>
            {i < loop.length - 1 && <span className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-muted sm:block">→</span>}
          </div>
        ))}
      </section>
      <p className="mt-3 font-mono text-[11px] text-muted">
        Ledger: {stats.live} live decisions + {stats.synthetic} synthetic historical decisions (clearly marked; seeded so the demo has enough history). Current policy agrees with human decisions {pct(stats.agreement)} of the time.
      </p>

      <section className="mt-10">
        <p className="font-mono text-xs tracking-[0.3em] text-derived">PROPOSED CHANGE TO HOW THE COMPANY RUNS</p>
        {!proposal ? (
          <p className="mt-4 text-muted">No change beats the current policy on held-out decisions yet. Keep deciding — every override is a lesson.</p>
        ) : (
          <article className="rise mt-4 rounded-2xl border border-derived/40 bg-panel p-6">
            <p className="font-mono text-xs text-muted">learned from {proposal.train.n} past human decisions · verified on {proposal.test.n} it never saw</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">~ {proposal.description}</h2>
            <p className="mt-2 text-muted">Managers and the CEO kept overriding these. Cortex proposes making their judgment the rule.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {(["test", "train"] as const).map((k) => (
                <div key={k}>
                  <p className="font-mono text-[11px] text-muted">{k === "test" ? "HELD-OUT decisions (the real test)" : "decisions it learned from"}</p>
                  {(["before", "after"] as const).map((w) => (
                    <div key={w} className="mt-2 flex items-center gap-3">
                      <span className="w-12 font-mono text-[11px] text-muted">{w}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-line">
                        <div
                          className={`h-full rounded-full ${w === "after" ? "bg-proposed" : "bg-muted"}`}
                          style={{ width: pct(proposal[k][w]), transition: "width 900ms cubic-bezier(.2,.8,.2,1)" }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono text-sm">{pct(proposal[k][w])}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-6">
              <p className="font-mono text-[11px] text-muted">
                DECISIONS IT WOULD HAVE GOTTEN RIGHT {proposal.breaks > 0 && <span className="text-danger">· {proposal.breaks} it would now get wrong</span>}
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {proposal.fixes.map((f) => (
                  <li key={f.eventId} className="flex gap-3">
                    <span className="font-mono text-xs text-muted">{who(f.from)} → <span className="text-proposed">{who(f.to)}</span></span>
                    <span>{f.summary}</span>
                    {f.synthetic ? <span className="font-mono text-[10px] text-muted">history</span> : <span className="font-mono text-[10px] text-observed">live</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                disabled={!!busy}
                onClick={() => post("/api/learn/merge", { proposalId: proposal.id }, "merge")}
                className="h-11 rounded-full bg-fg px-5 text-sm font-medium text-bg disabled:opacity-50"
              >
                {busy === "merge" ? "Merging into company policy…" : "Merge into company policy"}
              </button>
              <span className="font-mono text-[11px] text-muted">A human merges every change. Versioned in GBrain · one-click rollback.</span>
            </div>
          </article>
        )}
        {msg && <p className="mt-3 font-mono text-xs text-recalled">{msg}</p>}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-muted">POLICY VERSIONS</p>
          <ol className="mt-3 space-y-2">
            {[...history].reverse().map((v) => (
              <li key={v.version + v.mergedAt} className={`rounded-lg border px-4 py-3 text-sm ${v.version === policy.version ? "border-proposed/50" : "border-line"}`}>
                <p className="font-mono text-xs">
                  v{v.version} <span className="text-muted">· {new Date(v.mergedAt).toLocaleString()} · {v.mergedBy}</span>
                </p>
                <ul className="mt-1 list-disc pl-5 text-muted">
                  {v.rules.map((r) => <li key={r.id}>{r.why}</li>)}
                </ul>
                {v.evidence && <p className="mt-1 font-mono text-[11px] text-proposed">{v.evidence}</p>}
                {v.ref && <p className="font-mono text-[11px] text-recalled">GBrain {v.ref}</p>}
              </li>
            ))}
          </ol>
          {history.length > 1 && (
            <button disabled={!!busy} onClick={() => post("/api/learn/rollback", {}, "rollback")} className="mt-3 font-mono text-xs text-muted underline-offset-2 hover:underline">
              roll back to previous version
            </button>
          )}
        </div>
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-muted">THE COMPANY&apos;S OWN MODEL (RIVER)</p>
          <p className="mt-3 text-sm text-muted">
            Every labeled decision is also training data for a routing model the company owns — fine-tuned on River with LoRA, evaluated on held-out decisions before it can replace the current router.
          </p>
          <button disabled={!!busy} onClick={() => post("/api/learn/export", {}, "export")} className="mt-4 h-10 rounded-full border border-line px-4 text-sm disabled:opacity-50">
            Export training set
          </button>
          <p className="mt-2 font-mono text-[11px] text-muted">then: uv run river/train_router.py</p>
          {s.river && (
            <div className="rise mt-4 rounded-xl border border-observed/40 p-4">
              <p className="font-mono text-[11px] text-observed">
                RIVER LoRA · {s.river.base_model} · {s.river.train} decisions · {s.river.steps} steps · {s.river.minutes} min
              </p>
              <div className="mt-3 flex items-end gap-1" aria-label="training loss">
                {s.river.losses.map((l, i) => (
                  <span key={i} className="w-3 rounded-sm bg-observed/70" style={{ height: `${Math.max(4, (l / Math.max(...s.river!.losses)) * 60)}px` }} title={`step ${i + 1}: ${l}`} />
                ))}
                <span className="ml-2 font-mono text-[10px] text-muted">loss</span>
              </div>
              <p className="mt-3 text-sm">
                Held-out routing accuracy: base <b>{pct(s.river.heldout.base)}</b> → company model <b className="text-proposed">{pct(s.river.heldout.tuned)}</b>{" "}
                <span className="font-mono text-[11px] text-muted">(n={s.river.heldout.n})</span>
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted">
                {s.river.heldout.tuned > s.river.heldout.base ? "Candidate beats base — promotion is a human decision." : "Did not beat base — not promoted."}
              </p>
            </div>
          )}
          <p className="mt-6 font-mono text-xs tracking-[0.3em] text-muted">RECENT LIVE DECISIONS</p>
          <ul className="mt-2 space-y-1 text-sm">
            {s.recentLive.length === 0 && <li className="text-muted">None yet — approve or re-route items on the CEO brief.</li>}
            {s.recentLive.map((e) => (
              <li key={e.eventId} className="flex gap-2">
                <span className="font-mono text-xs text-muted">{who(e.predicted.route)}</span>
                <span className="truncate">{e.summary}</span>
                <span className={`ml-auto shrink-0 font-mono text-xs ${e.label ? (e.label.action === "override" ? "text-derived" : "text-proposed") : "text-muted"}`}>
                  {e.label ? `${e.label.action}${e.outcome ? ` · ${e.outcome.result}` : ""}` : "pending"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
