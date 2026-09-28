import {Composition} from 'remotion';
import {CortexLaunch} from './CortexLaunch';
import {DURATION, FPS, H, W} from './theme';

export const Root: React.FC = () => (
  <Composition id="CortexLaunch" component={CortexLaunch} durationInFrames={DURATION} fps={FPS} width={W} height={H} />
);
