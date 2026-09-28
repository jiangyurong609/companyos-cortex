import React from 'react';
import {AbsoluteFill, Easing, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, MONO, SANS, alpha, beat} from '../theme';
import {clip, fmtTime, plan} from '../clips';
import {
  Backdrop,
  BrowserFrame,
  Callout,
  Chip,
  ClickRing,
  ClipVideo,
  Kicker,
  PhoneFrame,
  SpeedBadge,
  Swap,
  Words,
  Zoom,
  mapPoint,
} from '../ui';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = {...clamp, easing: Easing.inOut(Easing.cubic)};

// Standard layout for framed desktop recordings.
const FW = 1400;
const FX = (1920 - FW) / 2;
const FY = 196;

const Header: React.FC<{kicker: string; color: string; right?: React.ReactNode; children: React.ReactNode}> = ({
  kicker,
  color,
  right,
  children,
}) => (
  <>
    <div style={{position: 'absolute', left: FX, top: 52}}>
      <Kicker color={color}>{kicker}</Kicker>
    </div>
    <div style={{position: 'absolute', left: FX, top: 92, width: 1500, height: 90}}>{children}</div>
    {right && <div style={{position: 'absolute', right: FX, top: 46}}>{right}</div>}
  </>
);

const Headline: React.FC<{text: string; at: number; until?: number; hl?: Record<string, string>}> = ({text, at, until, hl}) => (
  <Swap at={at} until={until} style={{left: 0, top: 0}}>
    <Words text={text} size={62} align="left" delay={at} stagger={2} highlight={hl} style={{whiteSpace: 'nowrap', flexWrap: 'nowrap'}} />
  </Swap>
);

/** Perspective stage: frame settles from a tilt, then drifts slowly (parallax). */
const Stage: React.FC<{
  frames: number;
  children: React.ReactNode;
  from?: {rx: number; ry: number};
  style?: React.CSSProperties;
}> = ({frames, children, from = {rx: 16, ry: -12}, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 22, stiffness: 70, mass: 1.1}});
  const drift = interpolate(frame, [0, frames], [0, 1], clamp);
  const rx = from.rx * (1 - s) + 3 - drift * 2;
  const ry = from.ry * (1 - s) - 2 + drift * 4;
  return (
    <div style={{position: 'absolute', inset: 0, perspective: 2600, ...style}}>
      <div
        style={{
          position: 'absolute',
          left: FX,
          top: FY,
          transform: `translateY(${(1 - s) * 140}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${0.9 + 0.1 * s + drift * 0.02})`,
          transformOrigin: '50% 40%',
          opacity: Math.min(1, s * 1.6),
        }}
      >
        {children}
      </div>
    </div>
  );
};

const px = (p: [number, number], w = FW): [number, number] => [p[0] * w, p[1] * ((w * 9) / 16)];

// ------------------------------------------------------------------ 4. CAPTURE

const SOURCES = [
  {label: 'call recording', color: C.observed},
  {label: 'Slack', color: C.recalled},
  {label: 'support ticket', color: C.derived},
  {label: 'GitHub', color: C.fg},
  {label: 'email', color: C.proposed},
];

export const Capture: React.FC<{frames: number}> = ({frames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const c = clip('phone-capture');
  // Typing + send at ~real speed, fast-forward through grounding, land on "routed".
  const typing = c.mark('typing', 0);
  const sent = c.mark('sent', Math.min(10, c.duration / 3));
  const routed = c.mark('routed', c.duration - 3);
  const A = 150;
  const B = 65;
  const segs = plan(c, [
    {frames: A, from: typing, to: sent + 0.6},
    {frames: B, from: sent + 0.6, to: routed - 0.6},
    {frames: frames - A - B, from: routed - 0.6, to: Math.min(c.duration, routed + 3)},
  ]);
  const ph = spring({frame, fps, config: {damping: 22, stiffness: 80}});
  const drift = interpolate(frame, [0, frames], [-6, 4]);
  const phoneH = 860;
  const PHONE_CX = 560;
  const lastLine = beat(12);

  return (
    <AbsoluteFill>
      <Backdrop glow={C.observed} glow2={C.proposed} />
      <div style={{position: 'absolute', inset: 0, perspective: 2200}}>
        <div
          style={{
            position: 'absolute',
            left: PHONE_CX - 216,
            top: 60,
            transform: `translateY(${(1 - ph) * 160}px) rotateY(${drift + (1 - ph) * -18}deg) rotateX(${(1 - ph) * 10}deg)`,
            opacity: Math.min(1, ph * 1.5),
          }}
        >
          <PhoneFrame height={phoneH}>
            <ClipVideo clip={c} segs={segs} unit={12} />
          </PhoneFrame>
        </div>
      </div>

      <div style={{position: 'absolute', left: PHONE_CX - 300, width: 600, top: 956, display: 'flex', justifyContent: 'center', opacity: ph}}>
        <SpeedBadge segs={segs} color={C.observed} />
      </div>

      {/* signal particles streaming from the sources into the phone */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {Array.from({length: 14}, (_, i) => {
          const start = beat(2) + i * 11;
          const t = ((frame - start) % 60) / 60;
          if (frame < start || frame > lastLine + 40) return null;
          const src = SOURCES[i % SOURCES.length];
          const y0 = 440 + ((i * 97) % 240);
          const x = 1010 - t * 240;
          const y = y0 + (540 - y0) * t;
          return <circle key={i} cx={x} cy={y} r={4} fill={src.color} opacity={Math.sin(t * Math.PI) * 0.9} style={{filter: `drop-shadow(0 0 8px ${src.color})`}} />;
        })}
      </svg>

      <div style={{position: 'absolute', left: 1010, top: 150, width: 840}}>
        <Kicker color={C.observed}>Captures the original observation</Kicker>
        <div style={{marginTop: 26}}>
          <Words text="Sarah types one sentence from the field." size={64} align="left" delay={6} stagger={2} highlight={{Sarah: C.observed}} />
        </div>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 56}}>
          {SOURCES.map((s, i) => {
            const at = beat(3 + i * 1.5);
            const k = spring({frame: frame - at, fps, config: {damping: 14, stiffness: 170}});
            const fromX = 500 + i * 60;
            return (
              <div
                key={s.label}
                style={{
                  transform: `translate(${(1 - k) * fromX}px, ${(1 - k) * (i % 2 ? -80 : 80)}px) scale(${0.7 + 0.3 * k})`,
                  opacity: Math.min(1, k * 1.4),
                }}
              >
                <Chip label={s.label} color={s.color} size={32} />
              </div>
            );
          })}
        </div>
        <div style={{marginTop: 70}}>
          {frame >= lastLine && (
            <Words text="No one writes a report." size={92} align="left" delay={lastLine} stagger={3} highlight={{No: C.proposed, one: C.proposed}} />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 5. DIGEST

export const Digest: React.FC<{frames: number}> = ({frames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const c = clip('exec-workday');
  const t = clip('team');
  const from = Math.max(0, c.mark('workday_start', c.mark('first_signal', 3) - 3) - 0.5);
  const to = Math.min(c.duration, c.mark('end', c.mark('all_triaged', c.duration - 3) + 3));
  const segs = plan(c, [{frames, from, to}]);
  const realMin = Math.max(1, Math.round((to - from) / 60));

  const teamAt = beat(21);
  const teamSecs = (frames - teamAt) / fps;
  const teamRate = Math.min(1.6, Math.max(1, (t.duration - 0.3) / teamSecs));
  const teamSegs = plan(t, [{frames: frames - teamAt, from: 0, rate: teamRate}]);

  // Zoom onto "Status reports written: 0", then release for the team view.
  const zAt = beat(16);
  const sr = c.point('status_reports');
  const zs = interpolate(frame, [zAt, zAt + 20, teamAt - 4, teamAt + 10], [1, 1.55, 1.55, 1], ease);
  const zoom: Zoom = {scale: zs, ox: sr[0], oy: sr[1]};
  const P = (k: string) => px(mapPoint(c.point(k), zoom));

  const team = spring({frame: frame - teamAt, fps, config: {damping: 20, stiffness: 90}});

  const [kx, ky] = P('kpis');
  const [sx, sy] = P('stake');
  const [rx, ry] = P('routing');
  const [qx, qy] = P('status_reports');

  return (
    <AbsoluteFill>
      <Backdrop glow={C.observed} glow2={C.derived} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateX(${-team * 300}px) scale(${1 - team * 0.14})`,
          transformOrigin: '30% 55%',
          opacity: 1 - team * 0.55,
          filter: team > 0.01 ? `blur(${team * 3}px)` : undefined,
        }}
      >
        <Stage frames={frames}>
          <BrowserFrame
            width={FW}
            url="cortex / exec — company pulse"
            live
            zoom={zoom}
            overlay={
              <>
                <Callout x={kx} y={ky} dx={-60} dy={250} label="Every signal, captured live" sub="calls · Slack · tickets · email" color={C.observed} delay={beat(4)} until={beat(8.5)} />
                <Callout x={sx} y={sy} dx={220} dy={320} label="$ at stake — grounded" sub="each customer need counted once" color={C.derived} delay={beat(8)} until={beat(12.5)} />
                <Callout x={rx} y={ry} dx={330} dy={190} label="Routed to whoever must act" sub="CEO · managers · owners" color={C.observed} delay={beat(12)} until={beat(16)} />
                <Callout x={qx} y={qy} dx={-40} dy={300} label="Status reports written: 0" color={C.proposed} big delay={beat(17)} until={teamAt - 2} />
              </>
            }
          >
            <ClipVideo clip={c} segs={segs} />
          </BrowserFrame>
        </Stage>
      </div>

      {frame >= teamAt - 2 && (
        <div
          style={{
            position: 'absolute',
            left: 720,
            top: 250,
            transform: `translateX(${(1 - team) * 900}px) rotateY(${(1 - team) * -20}deg)`,
            opacity: Math.min(1, team * 1.5),
          }}
        >
          <BrowserFrame width={1100} url="cortex / team — sales" glow={C.recalled}>
            <Sequence from={teamAt}>
              <ClipVideo clip={t} segs={teamSegs} />
            </Sequence>
          </BrowserFrame>
        </div>
      )}

      <Header
        kicker="Connects it to everything the company knows"
        color={C.observed}
        right={<SpeedBadge segs={segs} caption={`${realMin} min of a workday → ${Math.round(frames / fps)}s`} />}
      >
        <Headline text="Every signal understood, grounded, routed." at={4} until={teamAt} hl={{grounded: C.recalled, routed: C.observed}} />
        <Headline text="Managers see their team. No update meeting." at={teamAt} hl={{No: C.proposed, update: C.proposed, meeting: C.proposed}} />
      </Header>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 6. CONNECTED

const PEOPLE = [
  {name: 'Sarah', team: 'Sales', via: 'call', color: C.observed, x: 70, y: 440, side: 'l'},
  {name: 'Priya', team: 'Customer Success', via: 'ticket', color: C.derived, x: 1850, y: 590, side: 'r'},
  {name: 'Jordan', team: 'Marketing', via: 'email', color: C.proposed, x: 70, y: 760, side: 'l'},
] as const;

export const Connected: React.FC<{frames: number}> = ({frames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const c = clip('brief-digest');
  const from = c.mark('headline', 0);
  const secs = frames / fps;
  // Play the whole digest so the headline visibly updates as signals land.
  const rate = Math.min(2.6, Math.max(1, (c.duration - from - 0.3) / secs));
  const segs = plan(c, [{frames, from, rate}]);

  const hp = c.point('headline');
  const push = interpolate(frame, [0, beat(10)], [1, 1.7], {...clamp, easing: Easing.inOut(Easing.sin)});
  const zoom: Zoom = {scale: push, ox: hp[0], oy: hp[1]};

  const lineAt = beat(9);
  const flyAt = beat(11);
  const pillAt = beat(12);
  const fly = interpolate(frame, [flyAt, flyAt + 14], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const dim = interpolate(frame, [lineAt, pillAt], [0, 1], ease);
  const pill = spring({frame: frame - pillAt, fps, config: {damping: 13, stiffness: 150}});
  const CX = 960;
  const CY = 600;

  return (
    <AbsoluteFill>
      <Backdrop glow={C.recalled} glow2={C.derived} />
      <div style={{position: 'absolute', inset: 0, opacity: 1 - dim * 0.7, filter: dim > 0.01 ? `blur(${dim * 6}px)` : undefined}}>
        <Stage frames={frames} from={{rx: 10, ry: 10}}>
          <BrowserFrame width={FW} url="cortex / brief — today" glow={C.recalled}>
            <ClipVideo clip={c} segs={segs} />
          </BrowserFrame>
        </Stage>
      </div>

      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {PEOPLE.map((p, i) => {
          const d = interpolate(frame, [lineAt + i * 2, lineAt + 16 + i * 2], [0, 1], ease) * (1 - fly);
          const ax = p.side === 'l' ? p.x + 400 : p.x - 400;
          return d > 0 ? (
            <line key={p.name} x1={ax} y1={p.y} x2={ax + (CX - ax) * d} y2={p.y + (CY - p.y) * d} stroke={p.color} strokeWidth={2.5} strokeOpacity={0.7} strokeDasharray="6 8" />
          ) : null;
        })}
      </svg>

      {PEOPLE.map((p, i) => {
        const at = beat(3 + i * 1.5);
        const k = spring({frame: frame - at, fps, config: {damping: 15, stiffness: 160}});
        if (frame < at) return null;
        const w = 400;
        const x0 = p.side === 'l' ? p.x : p.x - w;
        const x = x0 + (CX - w / 2 - x0) * fly;
        const y = p.y + (CY - p.y) * fly;
        return (
          <div
            key={p.name}
            style={{
              position: 'absolute',
              left: x,
              top: y - 60,
              width: w,
              transform: `translateX(${(1 - k) * (p.side === 'l' ? -120 : 120)}px) scale(${1 - fly * 0.6})`,
              opacity: Math.min(1, k * 1.4) * (1 - fly),
              background: alpha('#0e1013', 0.94),
              border: `1.5px solid ${alpha(p.color, 0.55)}`,
              borderRadius: 18,
              padding: '18px 24px',
              boxShadow: `0 30px 70px ${alpha('#000000', 0.6)}, 0 0 40px ${alpha(p.color, 0.18)}`,
            }}
          >
            <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 42, color: C.fg, letterSpacing: '-0.02em'}}>{p.name}</div>
            <div style={{fontFamily: MONO, fontSize: 24, color: p.color, marginTop: 2}}>
              {p.team} · {p.via}
            </div>
          </div>
        );
      })}

      {frame >= pillAt && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingTop: 120}}>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 600,
              fontSize: 200,
              letterSpacing: '-0.05em',
              color: C.derived,
              transform: `scale(${0.6 + 0.4 * pill})`,
              opacity: Math.min(1, pill * 1.4),
              textShadow: `0 0 80px ${alpha(C.derived, 0.55)}`,
              lineHeight: 1,
            }}
          >
            $340K
          </div>
          <Words text="computed in code, every sentence cited" size={48} weight={500} color={C.fg} delay={pillAt + 8} stagger={2} style={{marginTop: 26}} />
        </AbsoluteFill>
      )}

      <Header kicker="Shows what actually changed" color={C.recalled} right={<SpeedBadge segs={segs} color={C.recalled} />}>
        <Headline text="3 people on 3 teams flagged SAML today." at={4} hl={{SAML: C.derived}} />
      </Header>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 7. DECIDE → ACT

export const Decide: React.FC<{frames: number}> = ({frames}) => {
  const frame = useCurrentFrame();
  const c = clip('brief-approve');
  const click = c.mark('approve_click', 3);
  const planReady = c.mark('plan_ready', Math.max(click + 5, c.duration - 8));
  const A = 75; // real time around the click
  const B = 140; // fast-forward to the plan
  const Cf = frames - A - B;
  const leadIn = 1.5;
  const segs = plan(c, [
    {frames: A, from: click - leadIn, rate: 1},
    {frames: B, from: click - leadIn + A / 30, to: planReady},
    {frames: Cf, from: planReady, rate: 1},
  ]);
  const clickFrame = Math.round(Math.min(leadIn, click) * 30);

  const ap = c.point('approve_click');
  const pp = c.point('plan_ready');
  const inA = interpolate(frame, [0, 40, A, A + 24], [1, 1.6, 1.6, 1], ease);
  const inC = interpolate(frame, [A + B, A + B + 36], [1, 1.35], ease);
  const zoom: Zoom = frame < A + B ? {scale: inA, ox: ap[0], oy: ap[1]} : {scale: inC, ox: pp[0], oy: pp[1]};
  const [cx, cy] = px(mapPoint(ap, zoom));
  const [ox, oy] = px(mapPoint(pp, zoom));

  return (
    <AbsoluteFill>
      <Backdrop glow={C.proposed} glow2={C.recalled} />
      <Stage frames={frames} from={{rx: 12, ry: -8}}>
        <BrowserFrame
          width={FW}
          url="cortex / brief — decision"
          glow={C.proposed}
          zoom={zoom}
          overlay={
            <>
              <ClickRing x={cx} y={cy} at={clickFrame} color={C.proposed} />
              <Callout x={ox} y={oy} dx={260} dy={200} label="Owner: Dana — Head of Product" sub="plan drafted by an agent" color={C.proposed} big delay={A + B + 30} />
            </>
          }
        >
          <ClipVideo clip={c} segs={segs} />
        </BrowserFrame>
      </Stage>
      <Header kicker="Decide → act" color={C.proposed} right={<SpeedBadge segs={segs} color={C.proposed} />}>
        <Headline text="One click." at={clickFrame - 2} until={A} hl={{One: C.proposed}} />
        <Headline text="Written to company memory." at={A + 2} until={A + B} hl={{memory: C.recalled}} />
        <Headline text="An agent assigns the owner and drafts the plan." at={A + B + 2} hl={{owner: C.proposed, plan: C.proposed}} />
      </Header>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ 8. TRUST

export const Trust: React.FC<{frames: number}> = ({frames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const c = clip('evidence');
  const from = Math.max(0, c.mark('expand', 1.5) - 1.5);
  const secs = frames / fps;
  const rate = Math.min(2.2, Math.max(1, (c.duration - from - 0.3) / secs));
  const segs = plan(c, [{frames, from, rate}]);
  const s = spring({frame, fps, config: {damping: 22, stiffness: 80}});
  const chipsAt = beat(4);
  const W2 = 1080;

  return (
    <AbsoluteFill>
      <Backdrop glow={C.recalled} glow2={C.danger} />
      <div style={{position: 'absolute', inset: 0, perspective: 2400}}>
        <div
          style={{
            position: 'absolute',
            left: 70,
            top: 190,
            transform: `translateX(${(1 - s) * -200}px) rotateY(${6 + (1 - s) * 14}deg)`,
            transformOrigin: '0% 50%',
            opacity: Math.min(1, s * 1.5),
          }}
        >
          <BrowserFrame width={W2} url="cortex / evidence" glow={C.recalled}>
            <ClipVideo clip={c} segs={segs} />
          </BrowserFrame>
          <div style={{fontFamily: MONO, fontSize: 24, color: C.muted, marginTop: 26}}>
            every fact → the exact quote it came from · src {fmtTime(from)}
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 1230, top: 250, width: 640}}>
        <Kicker color={C.recalled}>Trust</Kicker>
        <div style={{marginTop: 26}}>
          <Words text="Provenance or it didn't happen." size={86} align="left" delay={4} stagger={3} highlight={{Provenance: C.recalled}} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 18, marginTop: 50, alignItems: 'flex-start'}}>
          {[
            {label: '✓ sourced → written to memory', color: C.proposed},
            {label: '✕ unsourced → rejected', color: C.danger},
          ].map((x, i) => {
            const k = spring({frame: frame - chipsAt - i * 8, fps, config: {damping: 15, stiffness: 170}});
            return (
              <div key={x.label} style={{opacity: k, transform: `translateY(${(1 - k) * 30}px)`}}>
                <Chip label={x.label} color={x.color} size={28} />
              </div>
            );
          })}
        </div>
        <div style={{marginTop: 40}}>
          <Words text="Unsourced claims are rejected." size={44} weight={500} align="left" color={C.muted} delay={chipsAt + 20} stagger={2} />
        </div>
      </div>
    </AbsoluteFill>
  );
};


/** It learns: a human merges a policy change proven on held-out decisions; the company's own model trains on River. */
export const Learn: React.FC<{frames: number}> = ({frames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const c = clip('learn');
  const from = 1.5;
  const secs = frames / fps;
  const rate = Math.min(1.6, Math.max(0.8, (c.duration - from - 0.3) / secs));
  const segs = plan(c, [{frames, from, rate}]);
  const s = spring({frame, fps, config: {damping: 22, stiffness: 80}});
  const chipsAt = beat(6);
  const W2 = 1100;
  return (
    <AbsoluteFill>
      <Backdrop glow={C.proposed} glow2={C.observed} />
      <div style={{position: 'absolute', inset: 0, perspective: 2400}}>
        <div
          style={{
            position: 'absolute',
            left: 70,
            top: 170,
            transform: `translateX(${(1 - s) * -200}px) rotateY(${6 + (1 - s) * 14}deg)`,
            transformOrigin: '0% 50%',
            opacity: Math.min(1, s * 1.5),
          }}
        >
          <BrowserFrame width={W2} url="cortex / learn" glow={C.proposed}>
            <ClipVideo clip={c} segs={segs} />
          </BrowserFrame>
          <div style={{fontFamily: MONO, fontSize: 22, color: C.muted, marginTop: 24}}>
            proposal → human merge → policy v2 in GBrain · seeded history + live decisions
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 1250, top: 210, width: 620}}>
        <Kicker color={C.proposed}>It learns</Kicker>
        <div style={{marginTop: 26}}>
          <Words text="The company improves how it runs." size={72} align="left" delay={4} stagger={3} highlight={{improves: C.proposed}} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 18, marginTop: 46, alignItems: 'flex-start'}}>
          {[
            {label: 'New rule · competitor signals → CEO', color: C.derived},
            {label: 'Held-out decisions · 62% → 86%', color: C.proposed},
            {label: 'Own model on River · 62% → 95%', color: C.observed},
          ].map((x, i) => {
            const k = spring({frame: frame - chipsAt - i * 10, fps, config: {damping: 15, stiffness: 170}});
            return (
              <div key={x.label} style={{opacity: k, transform: `translateY(${(1 - k) * 30}px)`}}>
                <Chip label={x.label} color={x.color} size={26} />
              </div>
            );
          })}
        </div>
        <div style={{marginTop: 36}}>
          <Words text="A human merges every change." size={40} weight={500} align="left" color={C.muted} delay={chipsAt + 34} stagger={2} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
