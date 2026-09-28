import {loadFont as loadGeist} from '@remotion/google-fonts/Geist';
import {loadFont as loadGeistMono} from '@remotion/google-fonts/GeistMono';

const geist = loadGeist('normal', {weights: ['400', '500', '600', '700'], subsets: ['latin']});
const geistMono = loadGeistMono('normal', {weights: ['400', '500'], subsets: ['latin']});

export const SANS = geist.fontFamily;
export const MONO = geistMono.fontFamily;

export const FPS = 30;
export const W = 1920;
export const H = 1080;

// Product palette (instrument panel).
export const C = {
  bg: '#07080a',
  panel: '#0e1013',
  line: '#1d2127',
  fg: '#e8eaed',
  muted: '#7d8590',
  observed: '#5cc8ff',
  recalled: '#b49cff',
  derived: '#ffc452',
  proposed: '#7ee2a8',
  danger: '#ff6b6b',
} as const;

export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// "Voxel Revolution" (Kevin MacLeod) runs at ~112 BPM. One beat = 1800/112 ≈ 16.07
// frames at 30fps. Beats are rounded per-index (not 16 × n) so a 90s edit doesn't
// drift ~12 frames off the grid by the end.
export const BPM = 112;
export const beat = (n: number) => Math.round((n * 60 * FPS) / BPM);

// Sections, in beats. Every cut lands on the grid.
export const SECTIONS = [
  ['quote', 8],
  ['relay', 16],
  ['gone', 6],
  ['promise', 16],
  ['capture', 18],
  ['digest', 28],
  ['connected', 20],
  ['decide', 22],
  ['trust', 10],
  ['stack', 10],
  ['close', 14],
] as const;

export type SectionId = (typeof SECTIONS)[number][0];

export const TIMELINE = (() => {
  const out = {} as Record<SectionId, {from: number; frames: number; beats: number}>;
  let b = 0;
  for (const [id, n] of SECTIONS) {
    const from = beat(b);
    out[id] = {from, frames: beat(b + n) - from, beats: n};
    b += n;
  }
  return {sections: out, totalFrames: beat(b)};
})();

export const DURATION = TIMELINE.totalFrames;
