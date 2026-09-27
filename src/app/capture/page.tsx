"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { usePoll } from "@/components/usePoll";
import type { EventRecord } from "@/lib/schemas";

const PEOPLE = [
  { name: "Sarah", role: "Account Executive" },
  { name: "Priya", role: "Customer Success" },
  { name: "Leo", role: "Engineering" },
];

const NOTES =
  "Call notes, Acme QBR. Their security team won't approve us without SAML; Sarah says it's blocking the $120K deal and they need an answer Friday. Also they mentioned Stytch pitched them last week with SSO included. Separately their data team hit rate limits twice this month and wants a higher tier.";

const DEMO =
  "I just finished the Acme call. Their security team won't approve us without SAML. Sarah says it's blocking the $120K deal, and they need an answer Friday.";

type SpeechRec = { start(): void; stop(): void; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null };

const noopSubscribe = () => () => {};
function speechCtor(): (new () => SpeechRec) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export default function CapturePage() {
  const [text, setText] = useState("");
  const [actor, setActor] = useState("Sarah");
  const [sentId, setSentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiced, setVoiced] = useState(false);
  const canVoice = useSyncExternalStore(noopSubscribe, () => speechCtor() !== undefined, () => false);
  const recRef = useRef<SpeechRec | null>(null);
  const list = usePoll<{ events: EventRecord[] }>(sentId ? "/api/events" : null);
  const signals = (list?.events ?? []).filter((e) => e.observation.id === sentId).sort((a, b) => a.id.localeCompare(b.id));
  const rec = signals[0];

  const recognizer = () => {
    const Ctor = speechCtor();
    if (!recRef.current && Ctor) {
      const r = new Ctor();
      r.interimResults = true;
      r.continuous = true;
      r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
      r.onend = () => setListening(false);
      recRef.current = r;
    }
    return recRef.current;
  };

  const toggleVoice = () => {
    const r = recognizer();
    if (!r) return;
    if (listening) r.stop();
    else {
      setText("");
      setVoiced(true);
      r.start();
    }
    setListening(!listening);
  };

  const send = async (body = text) => {
    setError(null);
    if (listening) recRef.current?.stop();
    const r = await fetch("/api/observations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modality: voiced ? "voice" : "text", text: body, actor }),
    });
    const j = await r.json();
    if (!r.ok) return setError("Couldn't send — say a little more.");
    setSentId(j.observationId);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),16px)]">
      <header className="flex items-center justify-between py-2 font-mono text-xs tracking-widest text-muted">
        <span>COMPANYOS</span>
        <span className="flex items-center gap-2 text-observed">
          <span className="h-2 w-2 rounded-full bg-observed" /> LIVE
        </span>
      </header>

      {!sentId ? (
        <>
          <div className="mt-6 flex gap-2">
            {PEOPLE.map((p) => (
              <button
                key={p.name}
                onClick={() => setActor(p.name)}
                className={`flex-1 rounded-xl border px-2 py-2 text-left text-xs ${actor === p.name ? "border-observed text-fg" : "border-line text-muted"}`}
              >
                <span className="block text-sm font-medium">{p.name}</span>
                {p.role}
              </button>
            ))}
          </div>
          <h1 className="mt-8 text-3xl font-semibold tracking-tight">What just happened?</h1>
          <p className="mt-2 text-sm text-muted">Say it, or paste call notes or a thread. No status report needed — Cortex routes it to whoever needs to know.</p>

          {canVoice && (
            <button
              onClick={toggleVoice}
              aria-pressed={listening}
              className={`mx-auto mt-10 grid h-28 w-28 place-items-center rounded-full border border-line bg-panel transition ${listening ? "pulse border-observed" : ""}`}
            >
              <span className={`h-8 w-8 rounded-full ${listening ? "bg-danger" : "bg-observed"}`} />
              <span className="sr-only">{listening ? "Stop" : "Talk"}</span>
            </button>
          )}
          {canVoice && <p className="mt-3 text-center font-mono text-xs text-muted">{listening ? "listening… tap to stop" : "tap to talk"}</p>}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="I just finished the call with… (or paste notes)"
            className="mt-8 w-full resize-none rounded-2xl border border-line bg-panel p-4 text-base leading-relaxed outline-none placeholder:text-muted/60 focus:border-observed"
          />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}

          <div className="mt-auto flex items-center gap-3 pt-6">
            <div className="relative">
              <button onClick={() => setMenu(!menu)} aria-label="More" className="h-12 w-12 rounded-full border border-line text-muted">
                ⋯
              </button>
              {menu && (
                <div className="absolute bottom-14 left-0 w-56 rounded-xl border border-line bg-panel p-1 text-sm shadow-xl">
                  <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-line" onClick={() => { setText(DEMO); setVoiced(false); setMenu(false); }}>
                    Use demo sentence
                  </button>
                  <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-line" onClick={() => { setText(NOTES); setVoiced(false); setMenu(false); }}>
                    Paste demo call notes
                  </button>
                  <label className="flex items-center gap-2 px-3 py-2 text-muted">
                    as
                    <input value={actor} onChange={(e) => setActor(e.target.value)} className="w-full bg-transparent text-fg outline-none" />
                  </label>
                </div>
              )}
            </div>
            <button
              onClick={() => send()}
              disabled={text.trim().length < 3}
              className="h-12 flex-1 rounded-full bg-fg font-medium text-bg disabled:opacity-30"
            >
              Send to Cortex
            </button>
          </div>
        </>
      ) : (
        <section className="mt-16">
          <p className="font-mono text-xs tracking-widest text-observed">REALITY EVENT CAPTURED</p>
          <h1 className="mt-3 text-2xl font-semibold">
            {signals.some((r) => r.event) ? `${signals.length} signal${signals.length > 1 ? "s" : ""} extracted` : "Understanding…"}
          </h1>
          <ul className="mt-6 space-y-3">
            {signals
              .filter((r) => r.event)
              .map((r, i) => (
                <li key={r.id} className="rise rounded-xl border border-line bg-panel p-3" style={{ animationDelay: `${i * 120}ms` }}>
                  <p className="text-sm">{r.event!.summary}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    {[r.event!.organization, r.event!.requirement, r.event!.opportunity_value_usd && `$${Math.round(r.event!.opportunity_value_usd / 1000)}K`, r.event!.deadline_text]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className={`mt-1 font-mono text-[11px] ${r.triage ? (r.triage.route === "ceo" ? "text-derived" : "text-recalled") : "text-observed"}`}>
                    {r.triage ? `→ routed to ${r.triage.route === "ceo" ? "CEO" : `${r.reporter?.reportsTo ?? "manager"} (manager)`}` : "grounding in company memory…"}
                  </p>
                </li>
              ))}
          </ul>
          {rec && (
            <p className="mt-10 text-sm text-muted">
              {rec.stage === "FAILED"
                ? `Failed at ${rec.error?.stage}: ${rec.error?.message}`
                : signals.every((r) => r.triage)
                  ? "Done. You wrote zero status reports."
                  : "Updating company understanding…"}
            </p>
          )}
          <button
            onClick={() => { setSentId(null); setText(""); setVoiced(false); }}
            className="mt-12 h-12 w-full rounded-full border border-line text-sm text-muted"
          >
            Capture another
          </button>
        </section>
      )}
    </main>
  );
}
