type NoiseType = 'rain' | 'ocean' | 'fireplace' | 'forest' | 'cafe';

const DURATION = 2;
const SAMPLE_RATE = 44100;

function createBuffer(ctx: AudioContext, type: NoiseType): AudioBuffer {
  const length = DURATION * SAMPLE_RATE;
  const buffer = ctx.createBuffer(2, length, SAMPLE_RATE);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    switch (type) {
      case 'rain':
        generateRain(data, length);
        break;
      case 'ocean':
        generateOcean(data, length, ch);
        break;
      case 'fireplace':
        generateFireplace(data, length);
        break;
      case 'forest':
        generateForest(data, length, ch);
        break;
      case 'cafe':
        generateCafe(data, length);
        break;
    }
  }
  return buffer;
}

function generateRain(data: Float32Array, length: number) {
  for (let i = 0; i < length; i++) {
    const noise = Math.random() * 2 - 1;
    const burst = Math.random() < 0.001 ? (Math.random() * 0.5 + 0.5) : 0;
    data[i] = noise * 0.15 + burst * 0.3;
  }
}

function generateOcean(data: Float32Array, length: number, ch: number) {
  const phase = ch * 0.7;
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const wave = Math.sin(t * 0.3 + phase) * 0.5 + 0.5;
    const noise = Math.random() * 2 - 1;
    data[i] = noise * 0.1 * wave + Math.sin(t * 0.5 + phase) * 0.05;
  }
}

function generateFireplace(data: Float32Array, length: number) {
  for (let i = 0; i < length; i++) {
    const noise = Math.random() * 2 - 1;
    const crackle = Math.random() < 0.005 ? Math.random() * 0.8 : 0;
    const lowRumble = Math.sin(i / SAMPLE_RATE * 1.5) * 0.03;
    data[i] = noise * 0.08 + crackle + lowRumble;
  }
}

function generateForest(data: Float32Array, length: number, ch: number) {
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const wind = Math.sin(t * 0.2 + ch) * 0.05;
    const rustle = (Math.random() * 2 - 1) * 0.06;
    const bird = Math.sin(t * 800 + Math.sin(t * 3) * 200) *
      (Math.random() < 0.0003 ? 0.15 : 0);
    data[i] = wind + rustle + bird;
  }
}

function generateCafe(data: Float32Array, length: number) {
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const murmur = (Math.random() * 2 - 1) * 0.06;
    const clink = Math.random() < 0.002 ? Math.sin(t * 3000) * 0.2 * Math.random() : 0;
    const ambience = Math.sin(t * 0.1) * 0.02;
    data[i] = murmur + clink + ambience;
  }
}

export interface AmbientNoiseNode {
  gainNode: GainNode;
  sourceNode: AudioBufferSourceNode;
  stop: () => void;
}

export function createAmbientNoise(
  audioCtx: AudioContext,
  type: NoiseType,
  volume: number
): AmbientNoiseNode {
  const buffer = createBuffer(audioCtx, type);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const gainNode = audioCtx.createGain();
  gainNode.gain.value = volume;

  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  source.start();

  return {
    gainNode,
    sourceNode: source,
    stop: () => {
      try { source.stop(); } catch { /* already stopped */ }
    },
  };
}
