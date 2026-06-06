import { useRef, useCallback, useEffect } from 'react';

export function useAudioVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback((
    analyser: AnalyserNode,
    canvas: HTMLCanvasElement,
    colorA: string,
    colorB: string
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barCount = 64;
      const barWidth = width / barCount;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255;
        const barHeight = value * height;
        const x = i * barWidth;
        const y = height - barHeight;

        const gradient = ctx.createLinearGradient(x, height, x, y);
        gradient.addColorStop(0, colorA);
        gradient.addColorStop(1, colorB);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x + 1, y, barWidth - 2, barHeight, 3);
        ctx.fill();
      }
    };

    render();
  }, []);

  const startVisualization = useCallback((
    analyser: AnalyserNode,
    colorA: string = 'rgba(100, 80, 200, 0.8)',
    colorB: string = 'rgba(255, 120, 100, 0.6)'
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    draw(analyser, canvas, colorA, colorB);
  }, [draw]);

  const stopVisualization = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return { canvasRef, startVisualization, stopVisualization };
}
