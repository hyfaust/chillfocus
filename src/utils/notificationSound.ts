const audioCtxRef: { current: AudioContext | null } = { current: null };

function getCtx() {
  if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
  return audioCtxRef.current;
}

export function playDefaultNotification() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

  osc.start(now);
  osc.stop(now + 0.5);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1320, now + 0.25);
  gain2.gain.setValueAtTime(0.001, now);
  gain2.gain.setValueAtTime(0.25, now + 0.25);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
  osc2.start(now + 0.25);
  osc2.stop(now + 0.7);
}
