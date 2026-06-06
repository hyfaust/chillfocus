import { useEffect, useCallback } from 'react';
import { useAudioVisualizer } from '../hooks/useAudioVisualizer';
import type { TimerPhase } from '../types';
import styles from './AudioVisualizer.module.css';

interface Props {
  analyser: AnalyserNode | null;
  phase: TimerPhase;
}

const phaseColors: Record<TimerPhase, [string, string]> = {
  focus: ['rgba(100, 60, 200, 0.7)', 'rgba(255, 100, 80, 0.5)'],
  'short-break': ['rgba(46, 134, 193, 0.7)', 'rgba(118, 215, 196, 0.5)'],
  'long-break': ['rgba(64, 145, 108, 0.7)', 'rgba(149, 213, 178, 0.5)'],
};

export default function AudioVisualizer({ analyser, phase }: Props) {
  const { canvasRef, startVisualization, stopVisualization } = useAudioVisualizer();

  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const { width, height } = rect;
    ctx.clearRect(0, 0, width, height);

    const barCount = 64;
    const barWidth = width / barCount;
    const colors = phaseColors[phase];

    for (let i = 0; i < barCount; i++) {
      const t = Date.now() / 3000 + i * 0.15;
      const value = (Math.sin(t) * 0.5 + 0.5) * 0.15 + 0.05;
      const barHeight = value * height;
      const x = i * barWidth;
      const y = height - barHeight;

      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(1, colors[1]);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x + 1, y, barWidth - 2, barHeight, 2);
      ctx.fill();
    }
  }, [canvasRef, phase]);

  useEffect(() => {
    if (analyser) {
      const colors = phaseColors[phase];
      startVisualization(analyser, colors[0], colors[1]);
    } else {
      let frameId: number;
      const animate = () => {
        drawIdle();
        frameId = requestAnimationFrame(animate);
      };
      animate();
      return () => cancelAnimationFrame(frameId);
    }
    return () => stopVisualization();
  }, [analyser, phase, startVisualization, stopVisualization, drawIdle]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
}
