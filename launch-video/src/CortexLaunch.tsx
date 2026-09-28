import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {C, DURATION, SectionId, TIMELINE} from './theme';
import {Shell} from './ui';
import {Gone, PromiseScene, Quote, Relay} from './scenes/Intro';
import {Capture, Connected, Decide, Digest, Learn, Trust} from './scenes/Product';
import {Close, Stack} from './scenes/Outro';

const SCENES: Record<SectionId, React.FC<{frames: number}>> = {
  quote: Quote,
  relay: Relay,
  gone: Gone,
  promise: PromiseScene,
  capture: Capture,
  digest: Digest,
  connected: Connected,
  decide: Decide,
  trust: Trust,
  learn: Learn,
  stack: Stack,
  close: Close,
};

export const CortexLaunch: React.FC = () => {
  const frame = useCurrentFrame();
  // Music dips under "By then, the signal is gone." — a beat of near-silence — and
  // comes back as Cortex is introduced.
  const g = TIMELINE.sections.gone;
  const music = interpolate(
    frame,
    [0, 8, g.from - 4, g.from + 6, g.from + g.frames - 6, g.from + g.frames + 10, DURATION - 60, DURATION - 4],
    [0, 0.85, 0.85, 0.12, 0.12, 0.85, 0.85, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <Audio src={staticFile('audio/voxel-revolution.mp3')} volume={music} />
      {(Object.keys(SCENES) as SectionId[]).map((id) => {
        const {from, frames} = TIMELINE.sections[id];
        const Scene = SCENES[id];
        return (
          <Sequence key={id} name={id} from={from} durationInFrames={frames}>
            <Shell frames={frames}>
              <Scene frames={frames} />
            </Shell>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
