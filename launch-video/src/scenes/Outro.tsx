import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, MONO, SANS, alpha, beat} from '../theme';
import {Backdrop, Kicker, Words} from '../ui';
import {LogoMark, Wordmark} from './Intro';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ------------------------------------------------------------------ 9. STACK

const PARTS = [
  {name: 'River', role: 'Understands & routes', sub: "the company's own model", color: C.observed},
  {name: 'QM', role: 'The hands', sub: 'agents that ground, write and act', color: C.proposed},
  {name: 'GBrain', role: 'The memory', sub: 'every fact, decision and plan — with its source', color: C.recalled},
];

const CW = 520;
const GAP = 70;
const LEFT = (1920 - (CW * 3 + GAP * 2)) / 2;
const TOP = 330;
const CH = 470;

export const Stack: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const flowAt = beat(4);
  return (
    <AbsoluteFill>
      <Backdrop glow={C.observed} glow2={C.recalled} />
      <div style={{position: 'absolute', left: LEFT, top: 110}}>
        <Kicker color={C.muted}>The stack</Kicker>
        <div style={{marginTop: 22}}>
          <Words text="Three parts, one loop." size={72} align="left" delay={2} stagger={3} />
        </div>
      </div>
      {/* flow between the columns */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {[0, 1].map((i) => {
          const x1 = LEFT + CW * (i + 1) + GAP * i;
          const x2 = x1 + GAP;
          const y = TOP + CH / 2;
          const d = interpolate(frame, [flowAt + i * 6, flowAt + 14 + i * 6], [0, 1], clamp);
          const t = ((frame - flowAt) % 30) / 30;
          return (
            <g key={i} opacity={d}>
              <line x1={x1} y1={y} x2={x1 + (x2 - x1) * d} y2={y} stroke={C.line} strokeWidth={3} />
              {frame > flowAt && <circle cx={x1 + (x2 - x1) * t} cy={y} r={6} fill={PARTS[i + 1].color} style={{filter: `drop-shadow(0 0 8px ${PARTS[i + 1].color})`}} />}
            </g>
          );
        })}
      </svg>
      {PARTS.map((p, i) => {
        const k = spring({frame: frame - beat(0.5 + i), fps, config: {damping: 16, stiffness: 130}});
        return (
          <div
            key={p.name}
            style={{
              position: 'absolute',
              left: LEFT + i * (CW + GAP),
              top: TOP,
              width: CW,
              height: CH,
              transform: `translateY(${(1 - k) * 120}px)`,
              opacity: Math.min(1, k * 1.4),
              background: `linear-gradient(180deg, ${alpha(p.color, 0.1)}, ${C.panel} 45%)`,
              border: `1.5px solid ${alpha(p.color, 0.4)}`,
              borderRadius: 26,
              padding: '44px 44px',
              boxShadow: `0 40px 100px ${alpha('#000000', 0.6)}, 0 0 60px ${alpha(p.color, 0.12)}`,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{width: 18, height: 18, borderRadius: 99, background: p.color, boxShadow: `0 0 20px ${p.color}`}} />
            <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 96, letterSpacing: '-0.045em', color: C.fg, marginTop: 34}}>
              {p.name}
            </div>
            <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 42, color: p.color, marginTop: 18, letterSpacing: '-0.02em'}}>
              {p.role}
            </div>
            <div style={{fontFamily: SANS, fontSize: 32, color: C.muted, marginTop: 14, lineHeight: 1.3}}>{p.sub}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 10. CLOSE

export const Close: React.FC<{frames: number}> = ({frames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const brandAt = beat(7);
  const lift = spring({frame: frame - brandAt, fps, config: {damping: 20, stiffness: 110}});
  const end = interpolate(frame, [frames - 22, frames - 2], [1, 0], {...clamp, easing: Easing.in(Easing.quad)});
  return (
    <AbsoluteFill style={{opacity: end}}>
      <Backdrop glow={C.observed} glow2={C.proposed} />
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          transform: `translateY(${-lift * 260}px) scale(${1 - lift * 0.35})`,
          opacity: 1 - lift * 0.35,
        }}
      >
        <Words text="AI tools made each person faster." size={76} weight={500} color={C.muted} delay={2} stagger={3} />
        {frame >= beat(3) && (
          <Words
            text="Cortex makes the company itself faster."
            size={96}
            delay={beat(3)}
            stagger={3}
            highlight={{company: C.observed, itself: C.observed}}
          />
        )}
      </AbsoluteFill>
      {frame >= brandAt && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingTop: 300, gap: 10}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={{transform: 'scale(0.6)', margin: '-40px -30px'}}>
              <LogoMark size={100} delay={brandAt} />
            </div>
            <Wordmark size={110} delay={brandAt + 8} />
          </div>
        </AbsoluteFill>
      )}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 42,
          textAlign: 'center',
          fontFamily: MONO,
          fontSize: 20,
          color: alpha(C.muted, 0.9),
          opacity: interpolate(frame, [brandAt + 10, brandAt + 30], [0, 1], clamp),
        }}
      >
        Music: “Voxel Revolution” by Kevin MacLeod (incompetech.com) · Licensed under CC BY 4.0
      </div>
    </AbsoluteFill>
  );
};
