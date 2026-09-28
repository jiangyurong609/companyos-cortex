#!/usr/bin/env node
// Scans <publicDir>/clips for the contracted clips, probes them with ffprobe,
// merges <publicDir>/clips/markers.json, and writes src/clips-manifest.json.
// The composition imports that JSON synchronously, so a missing clip becomes a
// placeholder panel instead of a render crash.
//
// Usage: node scripts/clips-manifest.mjs [publicDir=public]
import {existsSync, readFileSync, writeFileSync, statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.resolve(root, process.argv[2] ?? 'public');
const clipsDir = path.join(publicDir, 'clips');
const CLIPS = [
  'phone-capture',
  'exec-workday',
  'brief-digest',
  'brief-approve',
  'team',
  'evidence',
];

const probe = (file) => {
  try {
    const out = execFileSync(
      'ffprobe',
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height:format=duration',
        '-of', 'json',
        file,
      ],
      {encoding: 'utf8'}
    );
    const j = JSON.parse(out);
    const s = j.streams?.[0] ?? {};
    const d = Number(j.format?.duration);
    return {width: s.width ?? null, height: s.height ?? null, durationSec: Number.isFinite(d) ? d : null};
  } catch {
    return null;
  }
};

let markers = {};
const markersFile = path.join(clipsDir, 'markers.json');
if (existsSync(markersFile)) {
  try {
    markers = JSON.parse(readFileSync(markersFile, 'utf8'));
  } catch (e) {
    console.warn(`! markers.json is not valid JSON, ignoring: ${e.message}`);
  }
}

// Local, hand-measured corrections (checked in) layered over the recorder's markers.
const overridesFile = path.join(root, 'clip-overrides.json');
let overrides = {};
if (existsSync(overridesFile)) {
  try {
    overrides = JSON.parse(readFileSync(overridesFile, 'utf8'));
  } catch (e) {
    console.warn(`! clip-overrides.json is not valid JSON, ignoring: ${e.message}`);
  }
}

const clips = {};
for (const name of CLIPS) {
  const file = path.join(clipsDir, `${name}.mp4`);
  const base = markers[name] ?? {};
  const o = overrides[name] ?? {};
  // "<something>XY": [x, y] keys from the recorder become points (approveXY → approve_click).
  const xyPoints = {};
  for (const [k, v] of Object.entries(base)) {
    if (k.endsWith('XY') && Array.isArray(v)) xyPoints[k === 'approveXY' ? 'approve_click' : k.slice(0, -2)] = v;
  }
  const m = {
    ...base,
    marks: {...(base.marks ?? {}), ...(o.marks ?? {})},
    points: {...xyPoints, ...(base.points ?? {}), ...(o.points ?? {})},
  };
  let entry = {exists: false, durationSec: null, width: null, height: null};
  if (existsSync(file) && statSync(file).size > 0) {
    const p = probe(file);
    // A clip still being written (no moov atom yet) fails ffprobe: treat as missing.
    if (p && p.durationSec && p.durationSec > 0.5) entry = {exists: true, ...p};
    else console.warn(`! ${name}.mp4 exists but could not be probed (still recording?) — using placeholder`);
  }
  clips[name] = {
    ...entry,
    // ffprobe duration wins; markers' durationSec is the fallback.
    durationSec: entry.durationSec ?? (typeof m.durationSec === 'number' ? m.durationSec : null),
    marks: m.marks && typeof m.marks === 'object' ? m.marks : {},
    points: m.points && typeof m.points === 'object' ? m.points : {},
  };
}

const outFile = path.join(root, 'src', 'clips-manifest.json');
writeFileSync(outFile, JSON.stringify({generatedAt: new Date().toISOString(), publicDir: path.relative(root, publicDir) || '.', clips}, null, 2) + '\n');
for (const [k, v] of Object.entries(clips)) {
  const marks = Object.entries(v.marks).map(([n, s]) => `${n}@${s}s`).join(' ');
  console.log(`${v.exists ? '✓' : '·'} ${k.padEnd(14)} ${v.exists ? `${v.width}x${v.height} ${v.durationSec?.toFixed(1)}s` : 'placeholder'}${marks ? '  ' + marks : ''}`);
}
console.log(`→ ${path.relative(root, outFile)}`);
