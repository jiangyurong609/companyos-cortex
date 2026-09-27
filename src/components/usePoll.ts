"use client";
import { useEffect, useState } from "react";

/** 1-second polling (docs: reliability beats WebSockets for the demo). */
export function usePoll<T>(url: string | null, intervalMs = 1000): T | null {
  const [state, setState] = useState<{ url: string; data: T } | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (alive && r.ok) {
          const data = (await r.json()) as T;
          if (alive) setState({ url, data });
        }
      } catch {
        /* transient — next tick retries */
      }
    };
    void tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [url, intervalMs]);
  // Never return data fetched for a different URL.
  return state && state.url === url ? state.data : null;
}
