"use client";

import { useState } from "react";
import { usePoll } from "@/components/usePoll";
import type { DiffRow, EventRecord, IntegrationStatus, KnowledgeKind, MemoryHit } from "@/lib/schemas";

const KIND: Record<KnowledgeKind, { label: string; color: string; border: string }> = {
  observed: { label: "OBSERVED", color: "text-observed", border: "border-observed" },
  recalled: { label: "RECALLED FROM GBRAIN", color: "text-recalled", border: "border-recalled" },
  derived: { label: "DERIVED", color: "text-derived", border: "border-derived" },
  proposed: { label: "PROPOSED", color: "text-proposed", border: "border-proposed" },
};
const SYMBOL: Record<DiffRow["op"], string> = { add: "+", update: "~", conflict: "!", action: "→" };

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

function Badge({ name, mode, detail }: { name: string; mode: string; detail: string }) {
  const tone = mode === "live" || mode === "llm" || mode === "river" ? "bg-proposed" : mode === "unavailable" ? "bg-danger" : "bg-derived";
  return (
    <span title={detail} className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      {name} <span className="text-muted">{mode}</span>
    </span>
  );
}

export default function CommandPage() {
  const status = usePoll<IntegrationStatus>("/api/status", 5000);
  const list = usePoll<{ events: EventRecord[] }>("/api/events");
  const [pinned, setPinned] = useState<string | null>(null);
  const current = list?.events.find((e) => e.id === pinned) ?? list?.events[0];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-muted">COMPANYOS / CORTEX</p>
          <p className="mt-1 text-lg font-medium">Northstar API</p>
        </div>
        <div className="flex flex-wrap items-center gap-5 font-mono text-xs">
          {status && (
            <>
              <Badge name="QM" mode={status.qm.mode} detail={status.qm.detail} />
              <Badge name="GBrain" mode={status.gbrain.mode} detail={status.gbrain.detail} />
              <Badge name="Compiler" mode={status.compiler.mode} detail={status.compiler.detail} />
            </>
          )}
          <span className="flex items-center gap-2 text-observed">
            <span className="h-2 w-2 rounded-full bg-observed pulse" /> LIVE
          </span>
        </div>
      </header>

      {status && (status.qm.mode !== "live" || status.gbrain.mode !== "live") && (
        <p className="mt-3 rounded-lg border border-derived/40 bg-derived/5 px-3 py-2 font-mono text-xs text-derived">
          {status.qm.mode !== "live" && "QM not connected — turns run directly from CompanyOS. "}
          {status.gbrain.mode !== "live" && "GBrain not connected — using local fixture memory, not company memory."}
        </p>
      )}

      {list && list.events.length > 1 && (
        <nav className="mt-4 flex gap-2 overflow-x-auto font-mono text-xs">
          {list.events.map((e) => (
            <button
              key={e.id}
              onClick={() => setPinned(e.id)}
              className={`shrink-0 rounded-full border px-3 py-1 ${e.id === current?.id ? "border-fg text-fg" : "border-line text-muted"}`}
            >
              {fmtTime(e.observation.createdAt)} · {e.event?.organization ?? e.stage.toLowerCase()}
            </button>
          ))}
        </nav>
      )}

      {!current ? <Empty /> : <EventView key={current.id} rec={current} />}
    </main>
  );
}

function Empty() {
  return (
    <section className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="font-mono text-xs tracking-[0.3em] text-muted">AWAITING REALITY</p>
        <p className="mt-3 text-2xl">Capture an observation on your phone.</p>
        <p className="mt-2 font-mono text-sm text-muted">open /capture</p>
      </div>
    </section>
  );
}

function EventView({ rec }: { rec: EventRecord }) {
  const ev = rec.event;
  const byKind = (k: KnowledgeKind) => rec.diff.filter((r) => r.kind === k);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        {/* Reality stream */}
        <section className="rise">
          <p className="font-mono text-xs tracking-widest text-muted">
            {fmtTime(rec.observation.createdAt)} · {rec.observation.modality.toUpperCase()} · {(rec.observation.actor ?? "unknown").toUpperCase()}
          </p>
          <blockquote className="mt-3 border-l-2 border-observed pl-4 text-xl leading-relaxed">“{rec.observation.text}”</blockquote>
          <Stage rec={rec} />
          {ev && (
            <div className="rise mt-5 flex flex-wrap items-center gap-2 font-mono text-sm">
              <Chip>{ev.organization ?? "?"}</Chip>
              <span className="text-muted">──{ev.type === "customer.blocker" ? "blocked by" : "requests"}──▶</span>
              <Chip>{ev.requirement ?? "?"}</Chip>
              {ev.opportunity_value_usd && (
                <>
                  <span className="text-muted">── opportunity ──▶</span>
                  <Chip>${Math.round(ev.opportunity_value_usd / 1000)}K</Chip>
                </>
              )}
              {ev.deadline_text && <span className="text-muted">· due {ev.deadline_text}</span>}
              <span className="ml-auto text-xs text-muted">compiler: {ev.compiler}</span>
            </div>
          )}
        </section>

        {/* Company Diff — the hero surface */}
        {rec.diff.length > 0 && (
          <section className="mt-10">
            <h2 className="font-mono text-sm tracking-[0.3em]">COMPANY DIFF</h2>
            <div className="mt-4 space-y-6">
              {(["observed", "recalled", "derived", "proposed"] as const).map(
                (k) =>
                  byKind(k).length > 0 && (
                    <div key={k}>
                      <p className={`font-mono text-xs tracking-widest ${KIND[k].color}`}>
                        {KIND[k].label}
                        {k === "recalled" && rec.resolvedVia === "direct" && <span className="text-muted"> (direct, not via QM)</span>}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {byKind(k).map((row, i) => (
                          <DiffLine key={row.id} row={row} delay={i * 100} />
                        ))}
                      </ul>
                    </div>
                  ),
              )}
            </div>
            {rec.rejected && rec.rejected.length > 0 && (
              <div className="mt-6 rounded-lg border border-danger/40 px-4 py-3 font-mono text-xs">
                <p className="text-danger">! PROVENANCE CHECK REJECTED {rec.rejected.length} — not shown above</p>
                {rec.rejected.map((r, i) => (
                  <p key={i} className="mt-1 text-muted">
                    {r.ref}: “{r.statement}” — {r.reason}
                  </p>
                ))}
              </div>
            )}
            {rec.stage === "DIFF_READY" && (
              <p className="mt-4 font-mono text-[11px] text-muted">
                ✓ provenance: every recalled fact above was re-fetched from its GBrain page and its quote verified{rec.rejected?.length ? "" : " · 0 rejected"}
              </p>
            )}
            <Approval rec={rec} />
          </section>
        )}
      </div>

      <aside className="space-y-6">
        <ContextPanel hits={rec.hits} via={rec.resolvedVia} />
        <Trace rec={rec} />
      </aside>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-line bg-panel px-2 py-1">{children}</span>;
}

function Stage({ rec }: { rec: EventRecord }) {
  const msg: Record<string, string> = {
    CAPTURED: "↓ compiling reality event…",
    COMPILED: "↓ compiled",
    RESOLVING_MEMORY: rec.trace.some((t) => t.via === "qm") ? "↓ running in QM project cortex-demo · grounding against GBrain…" : "↓ grounding against memory…",
    WRITING: "↓ writing to company memory…",
  };
  if (rec.stage === "FAILED")
    return (
      <p className="mt-4 font-mono text-sm text-danger">
        ! failed at {rec.error?.stage}: {rec.error?.message}
      </p>
    );
  return msg[rec.stage] ? <p className="mt-4 animate-pulse font-mono text-sm text-muted">{msg[rec.stage]}</p> : null;
}

function DiffLine({ row, delay }: { row: DiffRow; delay: number }) {
  const [open, setOpen] = useState(false);
  const k = KIND[row.kind];
  const symbol = row.kind === "proposed" ? "◇" : SYMBOL[row.op];
  return (
    <li className={`rise rounded-lg border-l-2 ${k.border} bg-panel ${row.kind === "proposed" ? "border-dashed" : ""}`} style={{ animationDelay: `${delay}ms` }}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-baseline gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className={`font-mono text-lg ${k.color}`}>{symbol}</span>
        <span className="flex-1">
          <span className="text-base">{row.title}</span>
          {row.detail && <span className="mt-0.5 block text-sm text-muted">{row.detail}</span>}
        </span>
        <span className="font-mono text-xs text-muted">
          {row.domain} · {row.evidenceRefs.length} ref{row.evidenceRefs.length === 1 ? "" : "s"} {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-line px-4 py-3">
          {row.evidence.length === 0 && <p className="font-mono text-xs text-muted">No direct evidence — this is a recommendation built from: {row.evidenceRefs.join(", ")}</p>}
          {row.evidence.map((e) => (
            <div key={e.ref} className="text-sm">
              <p className="font-mono text-xs text-recalled">{e.ref}</p>
              <p className="text-muted">“{e.quote}”</p>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function Approval({ rec }: { rec: EventRecord }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(rec.memoryNote ?? "");
  const [err, setErr] = useState<string | null>(null);

  const post = async (action: "accept" | "reject") => {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/events/${rec.id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editing ? { note } : {}),
    });
    if (!r.ok) setErr((await r.json()).error);
    setBusy(false);
    setEditing(false);
  };

  if (rec.stage === "ACCEPTED") return <Persisted rec={rec} />;
  if (rec.stage === "REJECTED") return <p className="mt-8 font-mono text-sm text-muted">Rejected. Nothing was written to company memory.</p>;

  const writeFailed = rec.stage === "FAILED" && rec.error?.stage === "write";
  return (
    <div className="mt-8 rounded-xl border border-line p-4">
      <p className="font-mono text-xs tracking-widest text-muted">PROPOSED MEMORY WRITE · observed facts only</p>
      {editing ? (
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={10} className="mt-3 w-full rounded-lg border border-line bg-panel p-3 font-mono text-xs outline-none focus:border-observed" />
      ) : (
        <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted">{rec.memoryNote}</pre>
      )}
      {writeFailed && <p className="mt-3 font-mono text-xs text-danger">! write failed — nothing was saved: {rec.error?.message}</p>}
      {err && <p className="mt-3 font-mono text-xs text-danger">{err}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => post("reject")} className="h-10 rounded-full border border-line px-5 text-sm text-muted disabled:opacity-40">
          Reject
        </button>
        <button disabled={busy} onClick={() => setEditing(!editing)} className="h-10 rounded-full border border-line px-5 text-sm disabled:opacity-40">
          {editing ? "Cancel edit" : "Edit"}
        </button>
        <button
          disabled={busy || (rec.stage !== "DIFF_READY" && !writeFailed)}
          onClick={() => post("accept")}
          className="h-10 rounded-full bg-fg px-5 text-sm font-medium text-bg disabled:opacity-40"
        >
          {busy || rec.stage === "WRITING" ? "Writing…" : writeFailed ? "Retry write" : "Accept into company memory"}
        </button>
      </div>
    </div>
  );
}

function Persisted({ rec }: { rec: EventRecord }) {
  const w = rec.write!;
  return (
    <section className="rise mt-10 rounded-2xl border border-proposed/40 bg-proposed/5 p-6">
      <p className="font-mono text-xs tracking-[0.3em] text-proposed">WRITTEN TO COMPANY MEMORY</p>
      <p className="mt-3 text-2xl font-semibold">
        {rec.event?.organization} {rec.event?.requirement} blocker is now durable.
      </p>
      <p className="mt-3 font-mono text-sm">
        {w.via === "qm" ? "QM → GBrain remember" : "remember"} ✓ <span className="text-muted">{w.ref}</span>
        {w.deduplicated && <span className="text-derived"> · repeat accept deduplicated</span>}
      </p>
      {rec.proof && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="font-mono text-xs text-muted">
            independent GBrain recall (not via the writing agent): “{rec.proof.query}” →{" "}
            <span className={rec.proof.found ? "text-proposed" : "text-derived"}>{rec.proof.found ? "new note returned" : "not returned yet"}</span>
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {rec.proof.hits.slice(0, 4).map((h) => (
              <li key={h.id} className="truncate">
                <span className="font-mono text-xs text-recalled">{h.id}</span> <span className="text-muted">{h.snippet.slice(0, 110)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-6 font-mono text-xs tracking-[0.25em] text-muted">OBSERVE → UNDERSTAND → ACT → LEARN</p>
    </section>
  );
}

function ContextPanel({ hits, via }: { hits: MemoryHit[]; via?: "qm" | "direct" }) {
  if (hits.length === 0) return null;
  return (
    <section className="rise rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-xs tracking-widest text-recalled">
        GBRAIN LINKED {hits.length} MEMOR{hits.length === 1 ? "Y" : "IES"}
      </p>
      {via && <p className="mt-1 font-mono text-[11px] text-muted">{via === "qm" ? "via QM project cortex-demo" : "direct query (QM bypassed)"}</p>}
      <ul className="mt-3 space-y-3">
        {hits.map((h, i) => (
          <li key={h.id} className="rise text-sm" style={{ animationDelay: `${i * 100}ms` }}>
            <p className="font-mono text-xs text-recalled">{h.id}</p>
            <p className="text-muted">{h.snippet}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Trace({ rec }: { rec: EventRecord }) {
  return (
    <section className="rounded-xl border border-line p-4">
      <p className="font-mono text-xs tracking-widest text-muted">TRACE</p>
      <ol className="mt-3 space-y-1.5 font-mono text-[11px] leading-snug">
        {rec.trace.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted">{fmtTime(t.at)}</span>
            <span className={t.via === "qm" ? "text-observed" : t.via === "gbrain" ? "text-recalled" : t.stage === "FAILED" ? "text-danger" : ""}>{t.message}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
