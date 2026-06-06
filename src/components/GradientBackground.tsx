import { useMemo } from 'react';
import type { TimerPhase } from '../types';
import styles from './GradientBackground.module.css';

interface Props {
  phase: TimerPhase;
  progress: number;
  backgroundImage?: string;
}

const phaseGradients: Record<TimerPhase, { start: string[]; end: string[] }> = {
  focus: {
    start: ['#1a1a2e', '#16213e', '#2d1b69'],
    end: ['#4a1942', '#ff6b6b', '#ee5a24'],
  },
  'short-break': {
    start: ['#0f3443', '#1a5276', '#2e86c1'],
    end: ['#48c9b0', '#76d7c4', '#a3e4d7'],
  },
  'long-break': {
    start: ['#1b4332', '#2d6a4f', '#40916c'],
    end: ['#95d5b2', '#b7e4c7', '#d8f3dc'],
  },
};

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `#${((rr << 16) | (rg << 8) | rb).toString(16).padStart(6, '0')}`;
}

export default function GradientBackground({ phase, progress, backgroundImage }: Props) {
  const gradient = useMemo(() => {
    const colors = phaseGradients[phase];
    const t = Math.min(1, Math.max(0, progress));
    const c1 = lerpColor(colors.start[0], colors.end[0], t);
    const c2 = lerpColor(colors.start[1], colors.end[1], t);
    const c3 = lerpColor(colors.start[2], colors.end[2], t);
    return `radial-gradient(ellipse at 30% 20%, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
  }, [phase, progress]);

  return (
    <>
      <div className={styles.background} style={{ background: gradient }} />
      {backgroundImage && (
        <div
          className={styles.backgroundImage}
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}
    </>
  );
}
