"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { usePoll } from "@/components/usePoll";
import type { EventRecord } from "@/lib/schemas";
import { KindsBreakdown, Legend, RoutingFlow, StakeBars, Timeline } from "./charts";
import { type DigestResponse, type Model, type StatusResponse, buildModel } from "./model";
import { CountUp, EXEC_CSS } from "./motion";
import { RealityStream } from "./RealityStream";

const vi = (i: number) => ({ "--i": i }) as CSSProperties;

export function ExecDashboard() {
  const ev = usePoll<{ events: EventRecord[] }>("/api/events", 1000);
  const dg = usePoll<DigestResponse>("/api/digest", 2000);
  const st = usePoll<StatusResponse>("/api/status", 5000);
  const model = ev ? buildModel(ev.events) : null;

  return (
    <div className="x-root relative min-h-screen overflow-x-hidden bg-bg text-fg">
      <style>{EXEC_CSS}</style>
      <Atmosphere />
      <div className="relative z-10 mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-8">
        <Header status={st} />
        {!model ? (
          <Connecting />
        ) : model.signals === 0 ? (
          <EmptyState />
        ) : (
          <Pulse model={model} digest={dg} />
        )}
      </div>
    </div>
  );
}

function Atmosphere() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="x-bloom absolute -left-[10vw] -top-[20vh] h-[70vh] w-[60vw] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--observed) 28%, transparent), transparent)" }}
      />
      <div
        className="x-bloom absolute -right-[15vw] top-[30vh] h-[70vh] w-[55vw] rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(closest-side, color-mix(in srgb, var(--recalled) 26%, transparent), transparent)",
          animationDelay: "-9s",
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, color-mix(in srgb, var(--bg) 85%, transparent))" }}
      />
    </div>
  );
}

function Header({ status }: { status: StatusResponse | null }) {
  const pills: [string, string | undefined][] = [
    ["GBrain", status?.gbrain?.mode],
    ["QM", status?.qm?.mode],
    ["River", status?.compiler?.mode],
  ];
  return (
    <header className="x-enter flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line pb-5" style={vi(0)}>
      <div className="flex items-center gap-3">
        <span className="relative inline-flex h-2.5 w-2.5">
          <span className="x-ring absolute inset-0 rounded-full bg-proposed" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-proposed" />
        </span>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">CompanyOS Cortex</p>
          <h1 className="text-xl font-semibold tracking-tight">Company pulse</h1>
        </div>
      </div>
      <div className="flex items-center gap-2 font-mono text-[10px]">
        {pills.map(([name, mode]) => (
          <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-muted">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: mode === "live" || mode === "river" || mode === "llm" ? "var(--proposed)" : mode ? "var(--derived)" : "var(--line)" }}
            />
            {name} {mode ?? "…"}
          </span>
        ))}
      </div>
      <nav className="ml-auto flex items-center gap-4 text-sm">
        <StartDay />
        <Link href="/capture" className="text-muted transition-colors hover:text-fg">Capture</Link>
        <Link href="/command" className="text-muted transition-colors hover:text-fg">Evidence</Link>
        <Link href="/team/sales" className="text-muted transition-colors hover:text-fg">Managers</Link>
        <Link href="/brief" className="rounded-full bg-fg px-3.5 py-1.5 font-medium text-bg transition-transform hover:scale-[1.03]">
          CEO brief →
        </Link>
      </nav>
    </header>
  );
}

function Panel({ title, sub, i, className = "", children }: { title: string; sub?: ReactNode; i: number; className?: string; children: ReactNode }) {
  return (
    <section className={`x-enter rounded-2xl border border-line bg-panel/80 p-5 backdrop-blur-sm ${className}`} style={vi(i)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {sub && <span className="text-[11px] text-muted">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, i, children, sub, accent }: { label: string; i: number; children: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="x-enter relative overflow-hidden rounded-2xl border border-line bg-panel/80 p-4 backdrop-blur-sm" style={vi(i)}>
      {accent && <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: accent }} />}
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <div className="mt-2 text-3xl font-semibold tracking-tight lg:text-[2.5rem] lg:leading-none">{children}</div>
      {sub && <p className="mt-2 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Pulse({ model: m, digest }: { model: Model; digest: DigestResponse | null }) {
  return (
    <>
      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Signals captured today" i={1} accent="var(--observed)" sub={`${m.captures.length} captures · ${m.people} ${m.people === 1 ? "person" : "people"}`}>
          <CountUp value={m.signals} />
        </Kpi>
        <Kpi label="$ at stake" i={2} accent="var(--derived)" sub={`grounded, ${m.stake.length} distinct need${m.stake.length === 1 ? "" : "s"}`}>
          <CountUp value={m.stakeTotal} format="usd" className="text-derived" />
        </Kpi>
        <Kpi label="Routed" i={3} accent="linear-gradient(90deg, var(--derived), var(--observed))" sub="to CEO · handled by managers">
          <span className="text-derived"><CountUp value={m.ceo} /></span>
          <span className="mx-1.5 text-muted">/</span>
          <span className="text-observed"><CountUp value={m.manager} /></span>
        </Kpi>
        <Kpi label="Facts written to memory" i={4} accent="var(--recalled)" sub="accepted into GBrain">
          <CountUp value={m.written} className="text-recalled" />
        </Kpi>
        <Kpi label="Unsourced claims blocked" i={5} accent="var(--danger)" sub="failed provenance check">
          <CountUp value={m.blocked} className={m.blocked > 0 ? "text-danger" : ""} />
        </Kpi>
        <div
          className="x-enter relative col-span-2 overflow-hidden rounded-2xl border p-4 md:col-span-1"
          style={{ ...vi(6), borderColor: "color-mix(in srgb, var(--proposed) 45%, var(--line))", background: "color-mix(in srgb, var(--proposed) 7%, var(--panel))" }}
        >
          <div
            aria-hidden
            className="x-glow pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl"
            style={{ background: "color-mix(in srgb, var(--proposed) 35%, transparent)" }}
          />
          <p className="relative text-[11px] uppercase tracking-[0.12em] text-proposed">Status reports written</p>
          <p className="relative mt-1 text-5xl font-semibold leading-none tracking-tight text-proposed lg:text-6xl">0</p>
          <p className="relative mt-2 text-xs text-fg/80">Reporting is now a byproduct of work.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <div className="grid gap-4 xl:col-span-8 xl:grid-cols-2">
          <Panel title="$ at stake by capability" sub="one row per need, counted once" i={7}>
            <StakeBars rows={m.stake} />
          </Panel>
          <Panel
            title="Where signals went"
            sub={
              <span className="inline-flex gap-3">
                <Legend color="var(--derived)" label="CEO" />
                <Legend color="var(--observed)" label="Managers" />
              </span>
            }
            i={8}
          >
            <p className="-mt-2 mb-2 text-[11px] text-muted">people → team → decision owner</p>
            <RoutingFlow events={m.events} />
          </Panel>
          <Panel title="Reality captured today" sub="cumulative signals · dot = one capture" i={9}>
            <Timeline captures={m.captures} />
          </Panel>
          <Panel title="What the company learned" sub="Company Diff rows by kind" i={10}>
            <KindsBreakdown kinds={m.kinds} types={m.types} />
          </Panel>
        </div>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <DigestPanel digest={digest} awaiting={m.ceoAwaiting} ceo={m.ceo} />
          <Panel
            title="Reality stream"
            sub={
              <span className="inline-flex items-center gap-1.5">
                <span className="x-glow h-1.5 w-1.5 rounded-full bg-observed" /> live
              </span>
            }
            i={12}
          >
            <RealityStream events={m.events} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function DigestPanel({ digest, awaiting, ceo }: { digest: DigestResponse | null; awaiting: number; ceo: number }) {
  const d = digest?.digest;
  return (
    <section
      className="x-enter relative overflow-hidden rounded-2xl border p-5"
      style={{ ...vi(11), borderColor: "color-mix(in srgb, var(--derived) 35%, var(--line))", background: "color-mix(in srgb, var(--derived) 5%, var(--panel))" }}
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-derived">Today&apos;s brief</p>
        {digest?.generating && (
          <span className="relative overflow-hidden rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">
            <span className="x-scan absolute inset-0" style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--derived) 25%, transparent), transparent)" }} />
            <span className="relative">QM is rewriting…</span>
          </span>
        )}
      </div>
      {d ? (
        <div key={d.headline} className="x-enter">
          <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight">{d.headline}</h2>
          <div className="mt-3 space-y-2.5">
            {d.sentences.map((s, i) => (
              <p key={i} className="text-sm leading-relaxed text-fg/85">
                {s.text}{" "}
                {s.cites.map((c) => (
                  <span key={c} className="mr-1 inline-block rounded border border-line bg-bg/60 px-1.5 py-px align-middle font-mono text-[10px] text-recalled">
                    {c}
                  </span>
                ))}
              </p>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted">Based on {d.basedOn} grounded signals · every sentence cites its source</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">{digest?.generating ? "Composing the brief from grounded signals…" : "The brief appears once signals are grounded."}</p>
      )}
      <Link
        href="/brief"
        className="group mt-5 flex items-center justify-between rounded-xl bg-derived px-4 py-3 font-medium text-bg transition-transform hover:scale-[1.015]"
      >
        <span>
          {awaiting > 0 ? `${awaiting} decision${awaiting > 1 ? "s" : ""} waiting for you` : ceo > 0 ? "Review CEO decisions" : "Open the CEO brief"}
        </span>
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </Link>
    </section>
  );
}

function Connecting() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <p className="x-glow font-mono text-xs uppercase tracking-[0.3em] text-muted">Listening to the company…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative flex min-h-[72vh] flex-col items-center justify-center text-center">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="x-breathe absolute left-1/2 top-1/2 rounded-full border"
            style={{
              ...vi(i),
              width: 220 + i * 150,
              height: 220 + i * 150,
              marginLeft: -(110 + i * 75),
              marginTop: -(110 + i * 75),
              borderColor: `color-mix(in srgb, var(--observed) ${28 - i * 6}%, transparent)`,
            }}
          />
        ))}
      </div>
      <p className="x-enter relative font-mono text-[11px] uppercase tracking-[0.3em] text-muted" style={vi(1)}>
        Company pulse · listening
      </p>
      <h2 className="x-enter relative mt-5 text-5xl font-semibold tracking-tight sm:text-7xl" style={vi(2)}>
        Nothing new.
      </h2>
      <p className="x-enter relative mt-5 max-w-xl text-lg text-muted sm:text-xl" style={vi(3)}>
        Right now, your company knows less than your people do.
      </p>
      <div className="x-enter relative mt-10 flex flex-wrap items-center justify-center gap-3" style={vi(4)}>
        <Link href="/capture" className="rounded-full bg-fg px-5 py-2.5 font-medium text-bg transition-transform hover:scale-[1.03]">
          Capture the first signal →
        </Link>
        <span className="rounded-full border border-proposed/40 px-4 py-2.5 text-sm text-proposed">Status reports written: 0</span>
      </div>
    </div>
  );
}

function StartDay() {
  const [state, setState] = useState<"idle" | "running">("idle");
  const start = async () => {
    setState("running");
    await fetch("/api/scenario", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    setTimeout(() => setState("idle"), 50_000);
  };
  return (
    <button
      onClick={start}
      disabled={state === "running"}
      title="Replay today's activity from call recordings, Slack, support tickets, GitHub and email"
      className="rounded-full border border-observed/50 px-3.5 py-1.5 font-medium text-observed transition-transform hover:scale-[1.03] disabled:opacity-50"
    >
      {state === "running" ? "Workday in progress…" : "▶ Start the workday"}
    </button>
  );
}
