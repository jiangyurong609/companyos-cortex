import React from 'react';
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {C, MONO, SANS, alpha} from './theme';
import {Clip, Segment, fmtTime, rateAt, sourceTimeAt} from './clips';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const useSpring = (delay = 0, config?: Parameters<typeof spring>[0]['config']) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delay, fps, config: {damping: 18, stiffness: 140, mass: 0.8, ...config}});
};

// ---------------------------------------------------------------- backdrop

export const Backdrop: React.FC<{glow?: string; glow2?: string; grid?: boolean}> = ({
  glow = C.observed,
  glow2 = C.recalled,
  grid = true,
}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  return (
    <AbsoluteFill style={{background: C.bg, overflow: 'hidden'}}>
      {grid && (
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(circle, ${alpha('#ffffff', 0.055)} 1.2px, transparent 1.6px)`,
            backgroundSize: '36px 36px',
            backgroundPosition: `${frame * 0.15}px ${frame * 0.1}px`,
            maskImage: 'radial-gradient(ellipse 70% 65% at 50% 50%, black 30%, transparent 100%)',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          width: 1300,
          height: 1300,
          left: -250 + drift,
          top: -500,
          background: `radial-gradient(circle, ${alpha(glow, 0.13)}, transparent 62%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1200,
          height: 1200,
          right: -300 - drift,
          bottom: -600,
          background: `radial-gradient(circle, ${alpha(glow2, 0.1)}, transparent 62%)`,
        }}
      />
      <AbsoluteFill
        style={{background: `radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, ${alpha('#000000', 0.7)} 100%)`}}
      />
    </AbsoluteFill>
  );
};

// Soft beat cut: 3-frame fade in, 4-frame fade out.
export const Shell: React.FC<{frames: number; children: React.ReactNode}> = ({frames, children}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 3, frames - 4, frames], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

// ---------------------------------------------------------------- type

/** Word-by-word rise with blur. */
export const Words: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  size?: number;
  weight?: number;
  color?: string;
  highlight?: Record<string, string>; // word -> color
  style?: React.CSSProperties;
  align?: 'left' | 'center';
}> = ({text, delay = 0, stagger = 3, size = 96, weight = 600, color = C.fg, highlight = {}, style, align = 'center'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.split(' ');
  return (
    <div
      style={{
        fontFamily: SANS,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: '-0.035em',
        color,
        textAlign: align,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        columnGap: size * 0.26,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const s = spring({frame: frame - delay - i * stagger, fps, config: {damping: 20, stiffness: 150, mass: 0.7}});
        const hl = highlight[w.replace(/[.,]/g, '')];
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: interpolate(s, [0, 0.6], [0, 1], clamp),
              transform: `translateY(${(1 - s) * size * 0.45}px)`,
              filter: `blur(${(1 - s) * 10}px)`,
              color: hl ?? undefined,
              textShadow: hl ? `0 0 40px ${alpha(hl, 0.45)}` : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Kicker: React.FC<{children: React.ReactNode; color?: string; delay?: number}> = ({
  children,
  color = C.observed,
  delay = 0,
}) => {
  const s = useSpring(delay);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14,
        fontFamily: MONO,
        fontSize: 24,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color,
        opacity: s,
        transform: `translateX(${(1 - s) * -24}px)`,
      }}
    >
      <span style={{width: 10, height: 10, borderRadius: 99, background: color, boxShadow: `0 0 16px ${color}`}} />
      {children}
    </div>
  );
};

/** A line that swaps in on a beat and out on the next (for captions). */
export const Swap: React.FC<{
  at: number;
  until?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({at, until = 1e9, children, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < at || frame >= until + 8) return null;
  const s = spring({frame: frame - at, fps, config: {damping: 20, stiffness: 160}});
  // Captions without an end stay on screen; interpolate needs finite input ranges.
  const out = Number.isFinite(until) ? interpolate(frame, [until, until + 8], [0, 1], clamp) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        opacity: s * (1 - out),
        transform: `translateY(${(1 - s) * 30 - out * 20}px)`,
        filter: `blur(${(1 - s) * 8 + out * 6}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------- clips

const Placeholder: React.FC<{clip: Clip; segs: Segment[]; unit: number}> = ({clip, segs, unit}) => {
  const frame = useCurrentFrame();
  const t = sourceTimeAt(segs, frame);
  const r = rateAt(segs, frame);
  return (
    <AbsoluteFill
      style={{
        background: `repeating-linear-gradient(135deg, ${C.panel} 0 ${unit * 2}px, #0b0d10 ${unit * 2}px ${unit * 4}px)`,
        alignItems: 'center',
        justifyContent: 'center',
        gap: unit * 0.8,
        fontFamily: MONO,
      }}
    >
      <div style={{fontSize: unit * 2.4, color: C.fg, letterSpacing: '-0.01em'}}>{clip.src}</div>
      <div style={{fontSize: unit * 1.3, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.2em'}}>
        awaiting recording
      </div>
      <div style={{fontSize: unit * 1.3, color: C.derived}}>
        src {fmtTime(t)} · ×{r.toFixed(1)}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${(frame * 1.4) % 100}%`,
          height: 2,
          background: alpha(C.observed, 0.25),
        }}
      />
    </AbsoluteFill>
  );
};

/** Plays a clip through a piecewise time map, or a placeholder if it isn't recorded yet. */
export const ClipVideo: React.FC<{clip: Clip; segs: Segment[]; unit?: number}> = ({clip, segs, unit = 18}) => {
  if (!clip.exists) return <Placeholder clip={clip} segs={segs} unit={unit} />;
  return (
    <AbsoluteFill style={{background: C.bg}}>
      {segs.map((s, i) => (
        <Sequence key={i} from={s.start} durationInFrames={s.frames}>
          <OffthreadVideo
            muted
            src={staticFile(clip.src)}
            // trimBefore is in source frames at the composition fps; playbackRate
            // then scales time from that point (verified with timecode fixtures).
            trimBefore={Math.round(s.fromSec * 30)}
            playbackRate={s.rate}
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- frames

export type Zoom = {scale: number; ox: number; oy: number}; // origin as fraction of content
export const mapPoint = (p: [number, number], z?: Zoom): [number, number] =>
  z ? [z.ox + (p[0] - z.ox) * z.scale, z.oy + (p[1] - z.oy) * z.scale] : p;

export const BAR = 46;

export const BrowserFrame: React.FC<{
  width: number;
  url: string;
  live?: boolean;
  zoom?: Zoom;
  children: React.ReactNode;
  overlay?: React.ReactNode;
  glow?: string;
}> = ({width, url, live, zoom, children, overlay, glow = C.observed}) => {
  const frame = useCurrentFrame();
  const h = (width * 9) / 16;
  const k = width / 1920;
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(frame / 9));
  return (
    <div
      style={{
        position: 'relative',
        width,
        height: h + BAR,
        borderRadius: 18,
        background: C.panel,
        border: `1px solid ${C.line}`,
        boxShadow: `0 60px 140px ${alpha('#000000', 0.75)}, 0 0 0 1px ${alpha('#ffffff', 0.03)}, 0 0 120px ${alpha(glow, 0.12)}`,
      }}
    >
      <div
        style={{
          height: BAR,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 9,
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} style={{width: 12, height: 12, borderRadius: 99, background: '#2a2f36'}} />
        ))}
        <div style={{flex: 1, display: 'flex', justifyContent: 'center'}}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 17,
              color: C.muted,
              background: C.bg,
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              padding: '5px 22px',
              minWidth: 360,
              textAlign: 'center',
            }}
          >
            {url}
          </div>
        </div>
        {live ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: MONO,
              fontSize: 16,
              letterSpacing: '0.16em',
              color: C.danger,
              border: `1px solid ${alpha(C.danger, 0.4)}`,
              borderRadius: 99,
              padding: '4px 12px',
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 99,
                background: C.danger,
                opacity: pulse,
                boxShadow: `0 0 12px ${C.danger}`,
              }}
            />
            LIVE
          </div>
        ) : (
          <span style={{width: 60}} />
        )}
      </div>
      <div
        style={{
          position: 'relative',
          width,
          height: h,
          overflow: 'hidden',
          borderRadius: '0 0 17px 17px',
        }}
      >
        <div style={{position: 'absolute', width: 1920, height: 1080, transform: `scale(${k})`, transformOrigin: '0 0'}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: zoom ? `scale(${zoom.scale})` : undefined,
              transformOrigin: zoom ? `${zoom.ox * 100}% ${zoom.oy * 100}%` : undefined,
            }}
          >
            {children}
          </div>
        </div>
      </div>
      {overlay && (
        <div style={{position: 'absolute', left: 0, top: BAR, width, height: h, pointerEvents: 'none'}}>{overlay}</div>
      )}
    </div>
  );
};

export const PhoneFrame: React.FC<{height: number; children: React.ReactNode; glow?: string}> = ({
  height,
  children,
  glow = C.observed,
}) => {
  const bezel = 16;
  const k = (height - bezel * 2) / 932;
  const w = 430 * k + bezel * 2;
  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height,
        borderRadius: 68,
        background: '#121418',
        border: `2px solid #262a31`,
        padding: bezel,
        boxShadow: `0 60px 140px ${alpha('#000000', 0.8)}, 0 0 140px ${alpha(glow, 0.16)}, inset 0 0 0 2px #0a0b0d`,
      }}
    >
      <div style={{position: 'relative', width: 430 * k, height: 932 * k, borderRadius: 54, overflow: 'hidden'}}>
        <div style={{position: 'absolute', width: 430, height: 932, transform: `scale(${k})`, transformOrigin: '0 0'}}>
          {children}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            width: 120,
            height: 34,
            marginLeft: -60,
            borderRadius: 99,
            background: '#000',
          }}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- annotations

/** Ring on a point + leader line + label. Coordinates in overlay px. */
export const Callout: React.FC<{
  x: number;
  y: number;
  dx: number;
  dy: number;
  label: string;
  sub?: string;
  color?: string;
  delay?: number;
  until?: number;
  big?: boolean;
}> = ({x, y, dx, dy, label, sub, color = C.observed, delay = 0, until = 1e9, big}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < delay || frame > until + 10) return null;
  const s = spring({frame: frame - delay, fps, config: {damping: 16, stiffness: 150}});
  const line = interpolate(frame - delay, [4, 16], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const label$ = spring({frame: frame - delay - 10, fps, config: {damping: 18, stiffness: 160}});
  const out = interpolate(frame, [until, until + 10], [1, 0], clamp);
  const ring = ((frame - delay) % 40) / 40;
  const lx = x + dx;
  const ly = y + dy;
  const right = dx >= 0;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: out}}>
      <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width="100%" height="100%">
        <line
          x1={x}
          y1={y}
          x2={x + dx * line}
          y2={y + dy * line}
          stroke={color}
          strokeWidth={2.5}
          strokeOpacity={0.85}
        />
        <circle cx={x} cy={y} r={14 * s} fill="none" stroke={color} strokeWidth={3} />
        <circle cx={x} cy={y} r={5 * s} fill={color} />
        <circle cx={x} cy={y} r={14 + ring * 30} fill="none" stroke={color} strokeWidth={2} strokeOpacity={(1 - ring) * 0.6 * s} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: lx,
          top: ly,
          transform: `translate(${right ? 0 : -100}%, -50%) translateX(${right ? 14 : -14}px) scale(${0.9 + 0.1 * label$})`,
          transformOrigin: right ? 'left center' : 'right center',
          opacity: label$,
          background: alpha('#0b0d10', 0.92),
          border: `1.5px solid ${alpha(color, 0.6)}`,
          borderRadius: 14,
          padding: big ? '16px 26px' : '12px 20px',
          boxShadow: `0 20px 60px ${alpha('#000000', 0.6)}, 0 0 40px ${alpha(color, 0.2)}`,
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{fontFamily: SANS, fontWeight: 600, fontSize: big ? 44 : 34, color: C.fg, letterSpacing: '-0.02em'}}>
          {label}
        </div>
        {sub && <div style={{fontFamily: MONO, fontSize: 21, color, marginTop: 4}}>{sub}</div>}
      </div>
    </div>
  );
};

/** Expanding click rings at a point, starting at frame `at`. */
export const ClickRing: React.FC<{x: number; y: number; at: number; color?: string}> = ({x, y, at, color = C.fg}) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < -14 || t > 40) return null;
  const pre = interpolate(t, [-14, 0], [0, 1], clamp);
  return (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width="100%" height="100%">
      <circle cx={x} cy={y} r={26 - 8 * pre} fill={alpha(color, 0.12 * pre)} stroke={color} strokeWidth={3} strokeOpacity={pre * (t > 0 ? interpolate(t, [0, 20], [1, 0], clamp) : 1)} />
      {[0, 8].map((d) => {
        const k = interpolate(t - d, [0, 30], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
        return t - d > 0 ? (
          <circle key={d} cx={x} cy={y} r={18 + k * 90} fill="none" stroke={color} strokeWidth={3} strokeOpacity={(1 - k) * 0.8} />
        ) : null;
      })}
    </svg>
  );
};

export const SpeedBadge: React.FC<{segs: Segment[]; caption?: string; color?: string}> = ({segs, caption, color = C.derived}) => {
  const frame = useCurrentFrame();
  const r = rateAt(segs, frame);
  const t = sourceTimeAt(segs, frame);
  const fast = r > 1.2;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, fontFamily: MONO}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 26,
          color: fast ? color : C.muted,
          border: `1.5px solid ${alpha(fast ? color : C.muted, 0.5)}`,
          borderRadius: 99,
          padding: '6px 18px',
          background: alpha('#0b0d10', 0.8),
          boxShadow: fast ? `0 0 30px ${alpha(color, 0.25)}` : undefined,
        }}
      >
        <span>{fast ? '▶▶' : '▶'}</span>
        <span>×{r >= 10 ? Math.round(r) : r.toFixed(1)}</span>
        <span style={{color: C.muted}}>·</span>
        <span style={{color: C.fg}}>{fmtTime(t)}</span>
      </div>
      {caption && <div style={{fontSize: 24, color: C.muted}}>{caption}</div>}
    </div>
  );
};

/** Small rounded source chip ("Slack", "call recording" …). */
export const Chip: React.FC<{label: string; color: string; icon?: string; size?: number; style?: React.CSSProperties}> = ({
  label,
  color,
  icon,
  size = 30,
  style,
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      fontFamily: MONO,
      fontSize: size,
      color: C.fg,
      background: alpha('#0e1013', 0.92),
      border: `1.5px solid ${alpha(color, 0.55)}`,
      borderRadius: 99,
      padding: `${size * 0.38}px ${size * 0.8}px`,
      boxShadow: `0 16px 40px ${alpha('#000000', 0.5)}, 0 0 30px ${alpha(color, 0.18)}`,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    <span style={{width: size * 0.36, height: size * 0.36, borderRadius: 99, background: color, boxShadow: `0 0 12px ${color}`}} />
    {icon && <span style={{color}}>{icon}</span>}
    {label}
  </div>
);
