import manifest from './clips-manifest.json';
import {FPS} from './theme';

export type ClipName =
  | 'phone-capture'
  | 'exec-workday'
  | 'brief-digest'
  | 'brief-approve'
  | 'team'
  | 'evidence'
  | 'learn';

type Entry = {
  exists: boolean;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  marks: Record<string, number>;
  points: Record<string, [number, number]>;
};

// Fallback durations (the contract's typical lengths) used only to drive the
// placeholder timecode before a clip exists.
const DEFAULT_DURATION: Record<ClipName, number> = {
  'phone-capture': 20,
  'exec-workday': 240,
  'brief-digest': 20,
  'brief-approve': 120,
  team: 10,
  evidence: 12,
  learn: 19,
};

// Where things are on screen, as fractions of the 1920×1080 recording. Derived from
// the app's layout (exec: max-w 1440 centered, 6-col KPI row; brief: max-w-4xl
// centered). markers.json may override any of these with "points": {name: [x, y]}.
const DEFAULT_POINTS: Record<ClipName, Record<string, [number, number]>> = {
  'exec-workday': {
    kpis: [0.5, 0.2],
    stake: [0.32, 0.2],
    routing: [0.52, 0.47],
    status_reports: [0.8, 0.2],
  },
  'brief-digest': {headline: [0.42, 0.24]},
  'brief-approve': {approve_click: [0.5, 0.62], plan_ready: [0.45, 0.5]},
  'phone-capture': {},
  team: {},
  evidence: {expand: [0.5, 0.45]},
  learn: {proposal: [0.5, 0.3], river: [0.62, 0.8]},
};

export const clip = (name: ClipName) => {
  const e = ((manifest as unknown as {clips: Record<string, Entry>}).clips[name] ?? {
    exists: false,
    durationSec: null,
    width: null,
    height: null,
    marks: {},
    points: {},
  }) as Entry;
  const duration = e.durationSec ?? DEFAULT_DURATION[name];
  const mark = (k: string, fallback: number) => {
    const v = e.marks?.[k];
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(0, v), duration) : fallback;
  };
  const point = (k: string): [number, number] => {
    const p = e.points?.[k];
    if (Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number')) {
      // Accept either fractions or pixels of a 1920×1080 frame.
      return p[0] > 1 || p[1] > 1 ? [p[0] / 1920, p[1] / 1080] : [p[0], p[1]];
    }
    return DEFAULT_POINTS[name]?.[k] ?? [0.5, 0.5];
  };
  return {name, exists: e.exists, duration, mark, point, src: `clips/${name}.mp4`};
};

export type Clip = ReturnType<typeof clip>;

// A segment plays source [fromSec, toSec] across `frames` composition frames.
export type Segment = {start: number; frames: number; fromSec: number; rate: number};

/**
 * Build a piecewise time map. Each part either spans [from, to] in source seconds
 * (rate derived) or plays at `rate` starting at `from`. Everything is clamped to the
 * clip's real duration so a shorter-than-expected recording never runs off the end.
 */
export const plan = (
  c: Clip,
  parts: {frames: number; from: number; to?: number; rate?: number}[]
): Segment[] => {
  const maxT = Math.max(0, c.duration - 0.15);
  let start = 0;
  return parts.map((p) => {
    const secs = p.frames / FPS;
    const from = Math.min(Math.max(0, p.from), maxT);
    let rate = p.rate ?? (p.to !== undefined ? (p.to - p.from) / secs : 1);
    if (from + rate * secs > maxT) rate = (maxT - from) / secs;
    rate = Math.max(0.05, rate);
    const seg = {start, frames: p.frames, fromSec: from, rate};
    start += p.frames;
    return seg;
  });
};

/** Source time (seconds) shown at local frame f of a plan. */
export const sourceTimeAt = (segs: Segment[], f: number) => {
  const s = segs.find((x) => f >= x.start && f < x.start + x.frames) ?? segs[segs.length - 1];
  const local = Math.min(Math.max(0, f - s.start), s.frames);
  return s.fromSec + (local / FPS) * s.rate;
};

export const rateAt = (segs: Segment[], f: number) =>
  (segs.find((x) => f >= x.start && f < x.start + x.frames) ?? segs[segs.length - 1]).rate;

export const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
