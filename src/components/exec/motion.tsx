"use client";

import { useEffect, useRef } from "react";
import { fmtUsd } from "./model";

const FORMATS = {
  int: (n: number) => Math.round(n).toLocaleString(),
  usd: (n: number) => fmtUsd(n),
} as const;

/** Count-up number: rAF writes textContent directly (no React re-render per frame). */
export function CountUp({
  value,
  format = "int",
  className,
}: {
  value: number;
  format?: keyof typeof FORMATS;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = FORMATS[format];
    const a = from.current;
    const b = value;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    if (reduce || a === b) {
      raf = requestAnimationFrame(() => {
        el.textContent = fmt(b);
        from.current = b;
      });
      return () => cancelAnimationFrame(raf);
    }
    const start = performance.now();
    const dur = 1500;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = k >= 1 ? 1 : 1 - Math.pow(2, -10 * k); // expo-out
      const cur = a + (b - a) * e;
      from.current = cur;
      el.textContent = fmt(cur);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, format]);
  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {FORMATS[format](0)}
    </span>
  );
}

/** Page-local motion vocabulary. transform/opacity only (one dash-draw on the sparkline). */
export const EXEC_CSS = `
.x-root { --ease-out: cubic-bezier(.16,1,.3,1); --ease-spring: cubic-bezier(.34,1.56,.64,1); }
@keyframes x-in { from { opacity: 0; transform: translate3d(0,16px,0); } to { opacity: 1; transform: none; } }
.x-enter { animation: x-in .9s var(--ease-out) both; animation-delay: calc(var(--i, 0) * 70ms); }
@keyframes x-grow-x { from { transform: scaleX(0); } }
.x-bar { transform-origin: left center; transition: transform 1s var(--ease-out);
  animation: x-grow-x 1.2s var(--ease-out) both; animation-delay: calc(250ms + var(--i, 0) * 110ms); }
@keyframes x-grow-y { from { transform: scaleY(0); } }
.x-node { transform-box: fill-box; transform-origin: center; animation: x-grow-y .8s var(--ease-out) both;
  animation-delay: calc(200ms + var(--i, 0) * 60ms); }
@keyframes x-fade { from { opacity: 0; } }
.x-fade { animation: x-fade 1s ease-out both; animation-delay: calc(400ms + var(--i, 0) * 70ms); }
@keyframes x-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
.x-draw { stroke-dasharray: 1; stroke-dashoffset: 0; animation: x-draw 1.8s var(--ease-out) both .3s; }
@keyframes x-pop { from { transform: scale(0); opacity: 0; } }
.x-pop { transform-box: fill-box; transform-origin: center; animation: x-pop .7s var(--ease-spring) both;
  animation-delay: calc(500ms + var(--i, 0) * 90ms); }
@keyframes x-slide { from { opacity: 0; transform: translate3d(0,-20px,0) scale(.98); } }
.x-feed-item { animation: x-slide .8s var(--ease-out) both; animation-delay: calc(var(--i, 0) * 60ms); }
@keyframes x-flash { from { opacity: .55; } to { opacity: 0; } }
.x-flash { animation: x-flash 1.4s ease-out both; }
@keyframes x-ring { from { transform: scale(1); opacity: .7; } to { transform: scale(2.6); opacity: 0; } }
.x-ring { animation: x-ring 1.8s ease-out infinite; }
@keyframes x-breathe { 0%,100% { transform: scale(.94); opacity: .25; } 50% { transform: scale(1.04); opacity: .7; } }
.x-breathe { animation: x-breathe 5s ease-in-out infinite; animation-delay: calc(var(--i, 0) * -1.1s); }
@keyframes x-drift { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(4vw,-3vh,0) scale(1.08); } }
.x-bloom { animation: x-drift 22s ease-in-out infinite; will-change: transform; }
@keyframes x-glow { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
.x-glow { animation: x-glow 3.2s ease-in-out infinite; }
@keyframes x-scan { from { transform: translate3d(-100%,0,0); } to { transform: translate3d(100%,0,0); } }
.x-scan { animation: x-scan 2.4s cubic-bezier(.45,0,.55,1) infinite; }
@media (prefers-reduced-motion: reduce) {
  .x-root *, .x-root *::before, .x-root *::after { animation: none !important; transition: none !important; }
  .x-motion-only { display: none !important; }
}
`;
