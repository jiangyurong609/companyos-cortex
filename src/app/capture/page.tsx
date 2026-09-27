"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { usePoll } from "@/components/usePoll";
import type { EventRecord } from "@/lib/schemas";

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
  const [actor, setActor] = useState("Yurong");
  const [sentId, setSentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiced, setVoiced] = useState(false);
  const canVoice = useSyncExternalStore(noopSubscribe, () => speechCtor() !== undefined, () => false);
  const recRef = useRef<SpeechRec | null>(null);
  const rec = usePoll<EventRecord>(sentId ? `/api/events/${sentId}` : null);

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

  const ev = rec?.event;
  const checks: [string, boolean][] = ev
    ? [
        [ev.organization ?? "customer unknown", Boolean(ev.organization)],
        [ev.requirement ?? "no requirement", Boolean(ev.requirement)],
        [ev.opportunity_value_usd ? `$${Math.round(ev.opportunity_value_usd / 1000)}K opportunity` : "no value stated", Boolean(ev.opportunity_value_usd)],
        [ev.deadline_text ? `deadline: ${ev.deadline_text}` : "no deadline", Boolean(ev.deadline_text)],
      ]
    : [];

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
          <h1 className="mt-10 text-3xl font-semibold tracking-tight">What just happened?</h1>
          <p className="mt-2 text-sm text-muted">Say it the way you&apos;d tell a teammate. Cortex does the rest.</p>

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
            placeholder="I just finished the call with…"
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
                    Use demo transcript
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
          <h1 className="mt-3 text-2xl font-semibold">{ev ? "Compiled." : "Compiling reality…"}</h1>
          <ul className="mt-8 space-y-3 font-mono text-lg">
            {checks.map(([label, ok], i) => (
              <li key={label} className="rise flex gap-3" style={{ animationDelay: `${i * 120}ms` }}>
                <span className={ok ? "text-proposed" : "text-muted"}>{ok ? "✓" : "–"}</span>
                <span className={ok ? "" : "text-muted"}>{label}</span>
              </li>
            ))}
          </ul>
          {rec && (
            <p className="mt-10 text-sm text-muted">
              {rec.stage === "FAILED"
                ? `Failed at ${rec.error?.stage}: ${rec.error?.message}`
                : rec.stage === "DIFF_READY" || rec.stage === "ACCEPTED"
                  ? "Company understanding updated — review on Command."
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
