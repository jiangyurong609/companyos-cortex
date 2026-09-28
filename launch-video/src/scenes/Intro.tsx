import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, MONO, SANS, alpha, beat} from '../theme';
import {Backdrop, Chip, Words} from '../ui';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const QUOTE = '“We can’t approve Northstar without SAML.”';

// ------------------------------------------------------------------ 1. QUOTE

export const Quote: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cardAt = beat(2);
  const k = spring({frame: frame - cardAt, fps, config: {damping: 18, stiffness: 120}});
  const breathe = 1 + Math.sin(frame / 20) * 0.004;
  return (
    <AbsoluteFill>
      <Backdrop glow={C.observed} glow2={C.observed} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 70}}>
        <Words text="A customer says something important." size={76} delay={2} stagger={3} highlight={{important: C.observed}} />
        <div
          style={{
            opacity: Math.min(1, k * 1.4),
            transform: `translateY(${(1 - k) * 60}px) scale(${(0.94 + 0.06 * k) * breathe})`,
            filter: `blur(${(1 - k) * 12}px)`,
            background: `linear-gradient(180deg, ${alpha(C.observed, 0.1)}, ${C.panel} 60%)`,
            border: `1.5px solid ${alpha(C.observed, 0.55)}`,
            borderRadius: 28,
            padding: '48px 64px 44px',
            boxShadow: `0 50px 120px ${alpha('#000000', 0.7)}, 0 0 120px ${alpha(C.observed, 0.22)}`,
          }}
        >
          <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 80, letterSpacing: '-0.035em', color: C.fg, whiteSpace: 'nowrap'}}>
            {QUOTE}
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 22, marginTop: 30}}>
            <div style={{fontFamily: MONO, fontSize: 28, color: C.muted}}>— Acme security lead</div>
            <Chip label="on a call with Sarah" color={C.observed} size={24} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 2. RELAY

const RUNGS = [
  {role: 'Account Exec', text: 'Acme: no SAML, no approval. $120K deal. Answer by Friday.', size: 46},
  {role: 'Sales Manager', text: 'Acme needs SAML — blocking $120K', size: 44},
  {role: 'VP Sales', text: 'Acme wants SSO', size: 42},
  {role: 'Weekly update', text: 'Some enterprise feature asks', size: 40},
  {role: 'Exec deck', text: 'Pipeline healthy', size: 38},
  {role: 'CEO', text: '', size: 38},
];
const RY = [945, 815, 685, 555, 425, 295];
const HOP0 = 44;
const HOPGAP = 40;
const HOPLEN = 16;
const CARD_X = 520;
const CARD_W = 1000;

export const Relay: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // Which rung the card is on / moving to.
  const pos = RUNGS.reduce((acc, _, i) => {
    if (i === 0) return 0;
    const a = HOP0 + (i - 1) * HOPGAP;
    return acc + interpolate(frame, [a, a + HOPLEN], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  }, 0);
  const level = Math.round(pos);
  const lo = Math.floor(pos);
  const y = RY[lo] + (RY[Math.min(5, lo + 1)] - RY[lo]) * (pos - lo);
  const decay = pos / 5; // 0 → 1
  const count = Math.min(5, Math.floor(pos + 0.5));
  const rung = RUNGS[level];
  const arrivedAt = level === 0 ? 0 : HOP0 + (level - 1) * HOPGAP + HOPLEN / 2;
  const swap = spring({frame: frame - arrivedAt, fps, config: {damping: 20, stiffness: 180}});
  const countPop = spring({frame: frame - arrivedAt, fps, config: {damping: 10, stiffness: 220}});
  return (
    <AbsoluteFill>
      <Backdrop glow={C.derived} glow2={C.danger} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 70}}>
        <Words text="It gets summarized five times before it reaches the CEO." size={64} delay={2} stagger={2} highlight={{five: C.derived, times: C.derived}} />
      </div>
      {/* ladder */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <line x1={CARD_X - 60} y1={RY[5]} x2={CARD_X - 60} y2={RY[0]} stroke={C.line} strokeWidth={2} />
        {RY.map((ry, i) => (
          <circle key={i} cx={CARD_X - 60} cy={ry} r={i <= level ? 8 : 6} fill={i <= level ? (i === 0 ? C.observed : C.derived) : C.line} />
        ))}
      </svg>
      {RUNGS.map((r, i) => (
        <div
          key={r.role}
          style={{
            position: 'absolute',
            right: 1920 - CARD_X + 90,
            top: RY[i] - 18,
            fontFamily: MONO,
            fontSize: 26,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: i === level ? C.fg : C.muted,
            opacity: i <= level ? 1 : 0.45,
            whiteSpace: 'nowrap',
          }}
        >
          {r.role}
        </div>
      ))}
      {/* ghosts of what each level said */}
      {RUNGS.map((r, i) =>
        i < level && r.text ? (
          <div
            key={`g${i}`}
            style={{
              position: 'absolute',
              left: CARD_X + 30,
              top: RY[i] - 26,
              fontFamily: SANS,
              fontSize: 34,
              color: C.muted,
              opacity: 0.4,
              whiteSpace: 'nowrap',
              filter: `blur(${i * 0.6}px)`,
            }}
          >
            {r.text}
          </div>
        ) : null
      )}
      {/* the traveling card */}
      <div
        style={{
          position: 'absolute',
          left: CARD_X,
          top: y - 52,
          width: CARD_W - decay * 260,
          height: 104,
          display: 'flex',
          alignItems: 'center',
          padding: '0 30px',
          background: C.panel,
          border: `1.5px ${level === 5 ? 'dashed' : 'solid'} ${alpha(level === 0 ? C.observed : level === 5 ? C.muted : C.derived, 0.6 - decay * 0.3)}`,
          borderRadius: 18,
          boxShadow: `0 30px 70px ${alpha('#000000', 0.6)}, 0 0 60px ${alpha(C.observed, 0.25 * (1 - decay))}`,
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: rung.size,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            color: level === 0 ? C.fg : `rgba(232,234,237,${1 - decay * 0.55})`,
            opacity: swap,
            filter: `blur(${decay * 2.2 + (1 - swap) * 8}px)`,
          }}
        >
          {rung.text || '…'}
        </div>
      </div>
      {/* counter */}
      <div style={{position: 'absolute', left: 1620, top: 440, textAlign: 'left'}}>
        <div style={{fontFamily: MONO, fontSize: 24, letterSpacing: '0.16em', color: C.muted, textTransform: 'uppercase'}}>summarized</div>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: 150,
            letterSpacing: '-0.05em',
            color: count === 0 ? C.muted : C.derived,
            transform: `scale(${count === 0 ? 1 : 0.8 + 0.2 * countPop})`,
            transformOrigin: 'left center',
            textShadow: count > 0 ? `0 0 50px ${alpha(C.derived, 0.4)}` : undefined,
            lineHeight: 1.1,
          }}
        >
          {count}×
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 3. GONE

export const Gone: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 30], [1, 0.35], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: C.bg}} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 70}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 30, opacity: fade}}>
          <div style={{fontFamily: MONO, fontSize: 26, letterSpacing: '0.1em', color: C.muted}}>CEO</div>
          <div
            style={{
              width: 740,
              height: 104,
              border: `1.5px dashed ${alpha(C.muted, 0.5)}`,
              borderRadius: 18,
              background: alpha(C.panel, 0.6),
              display: 'flex',
              alignItems: 'center',
              padding: '0 30px',
              fontFamily: SANS,
              fontSize: 38,
              color: alpha(C.muted, 0.5),
            }}
          >
            …
          </div>
        </div>
        <Words text="By then, the signal is gone." size={96} delay={6} stagger={4} highlight={{gone: C.danger}} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 4. PROMISE

const PROMISE: {text: string; hl: Record<string, string>}[] = [
  {text: 'Cortex captures the original observation,', hl: {original: C.observed, observation: C.observed}},
  {text: 'connects it to everything the company already knows,', hl: {everything: C.recalled, already: C.recalled, knows: C.recalled}},
  {text: 'and shows what actually changed.', hl: {actually: C.proposed, changed: C.proposed}},
];

export const PromiseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const at = [beat(3), beat(7), beat(11)];
  const up = spring({frame: frame - at[0] + 6, fps, config: {damping: 20, stiffness: 110}});
  return (
    <AbsoluteFill>
      <Backdrop glow={C.recalled} glow2={C.observed} />
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 30,
          transform: `translateY(${-up * 300}px) scale(${1 - up * 0.45})`,
        }}
      >
        <LogoMark size={100} />
        <Wordmark size={140} delay={16} />
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 150, right: 150, top: 470, display: 'flex', flexDirection: 'column', gap: 26}}>
        {PROMISE.map((p, i) => {
          if (frame < at[i]) return null;
          const next = at[i + 1];
          const dim = next !== undefined ? interpolate(frame, [next, next + 10], [1, 0.45], clamp) : 1;
          return (
            <div key={i} style={{opacity: dim}}>
              <Words text={p.text} size={76} delay={at[i]} stagger={2} align="left" highlight={p.hl} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ brand

const MARK = [C.observed, C.recalled, C.derived, C.proposed];

export const LogoMark: React.FC<{size?: number; delay?: number}> = ({size = 120, delay = 0}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, 34], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const ring = interpolate(frame - delay, [26, 46], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const spin = (frame - delay) * 0.6;
  const R = size * 0.36;
  return (
    <svg width={size * 2} height={size * 2} viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`} style={{overflow: 'visible'}}>
      <circle
        r={R}
        fill="none"
        stroke={alpha(C.fg, 0.35)}
        strokeWidth={2}
        strokeDasharray={2 * Math.PI * R}
        strokeDashoffset={(1 - ring) * 2 * Math.PI * R}
      />
      {MARK.map((c, i) => {
        const a = ((i * 90 + spin + (1 - t) * 220) * Math.PI) / 180;
        const r = R + (1 - t) * 900;
        return (
          <circle
            key={c}
            cx={Math.cos(a) * r}
            cy={Math.sin(a) * r}
            r={size * 0.075}
            fill={c}
            style={{filter: `drop-shadow(0 0 ${size * 0.12}px ${c})`}}
          />
        );
      })}
      <circle r={size * 0.09 * ring} fill={C.fg} style={{filter: `drop-shadow(0 0 18px ${alpha(C.fg, 0.8)})`}} />
    </svg>
  );
};

export const Wordmark: React.FC<{size?: number; delay?: number}> = ({size = 150, delay = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 20, stiffness: 120}});
  return (
    <div
      style={{
        fontFamily: SANS,
        fontSize: size,
        letterSpacing: '-0.045em',
        lineHeight: 1,
        opacity: s,
        transform: `translateY(${(1 - s) * 30}px)`,
        filter: `blur(${(1 - s) * 12}px)`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{fontWeight: 400, color: C.muted}}>CompanyOS </span>
      <span style={{fontWeight: 600, color: C.fg}}>Cortex</span>
    </div>
  );
};
