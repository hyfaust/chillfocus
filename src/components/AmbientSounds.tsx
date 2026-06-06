import { useState, useRef, useCallback, useEffect } from 'react';
import { generateId } from '../utils/timeUtils';
import styles from './AmbientSounds.module.css';

interface PresetSound {
  id: string;
  label: string;
  icon: string;
  src: string;
  isCustom?: boolean;
}

const PRESETS: PresetSound[] = [
  { id: 'rain', label: '雨声', icon: '🌧️', src: '/sounds/rain.ogg' },
  { id: 'fireplace', label: '壁炉', icon: '🔥', src: '/sounds/fireplace.ogg' },
  { id: 'forest', label: '森林', icon: '🌲', src: '/sounds/forest.ogg' },
  { id: 'wind', label: '风声', icon: '💨', src: '/sounds/wind.ogg' },
];

interface ActiveSound {
  audio: HTMLAudioElement;
  volume: number;
}

interface CustomSound {
  id: string;
  label: string;
  url: string;
}

export default function AmbientSounds() {
  const [, setTick] = useState(0);
  const [volumes, setVolumes] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    PRESETS.forEach(p => { v[p.id] = 0.5; });
    return v;
  });
  const [customSounds, setCustomSounds] = useCustomSounds();
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const soundsRef = useRef<Map<string, ActiveSound>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSound = useCallback((id: string, src: string) => {
    const existing = soundsRef.current.get(id);
    if (existing) {
      existing.audio.pause();
      existing.audio.currentTime = 0;
      soundsRef.current.delete(id);
    } else {
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = volumes[id] ?? 0.5;
      const onEnded = () => { audio.currentTime = 0; audio.play().catch(() => {}); };
      audio.addEventListener('ended', onEnded);
      audio.play().catch(() => {});
      soundsRef.current.set(id, { audio, volume: volumes[id] ?? 0.5 });
    }
    setTick(t => t + 1);
  }, [volumes]);

  const changeVolume = useCallback((id: string, vol: number) => {
    setVolumes(prev => ({ ...prev, [id]: vol }));
    const active = soundsRef.current.get(id);
    if (active) {
      active.audio.volume = vol;
      active.volume = vol;
    }
  }, []);

  const handleCustomFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^/.]+$/, '');
    const id = generateId();
    setCustomSounds(prev => [...prev, { id, label: name, url }]);
    setVolumes(prev => ({ ...prev, [id]: 0.5 }));
    setShowCustomForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [setCustomSounds]);

  const handleAddCustomUrl = useCallback(() => {
    if (!customUrl.trim()) return;
    const id = generateId();
    const label = customLabel.trim() || '自定义音效';
    setCustomSounds(prev => [...prev, { id, label, url: customUrl.trim() }]);
    setVolumes(prev => ({ ...prev, [id]: 0.5 }));
    setCustomUrl('');
    setCustomLabel('');
    setShowCustomForm(false);
  }, [customUrl, customLabel, setCustomSounds]);

  const removeCustomSound = useCallback((id: string) => {
    const active = soundsRef.current.get(id);
    if (active) {
      active.audio.pause();
      soundsRef.current.delete(id);
      setTick(t => t + 1);
    }
    setCustomSounds(prev => prev.filter(s => s.id !== id));
  }, [setCustomSounds]);

  useEffect(() => {
    return () => {
      soundsRef.current.forEach(s => { s.audio.pause(); s.audio.currentTime = 0; });
      soundsRef.current.clear();
    };
  }, []);

  const allSounds = [
    ...PRESETS,
    ...customSounds.map(c => ({ id: c.id, label: c.label, icon: '🎵', src: c.url, isCustom: true as const })),
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          环境音
        </h3>
        <button className={styles.addBtn} onClick={() => setShowCustomForm(!showCustomForm)} title="添加自定义环境音">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleCustomFileUpload} />
      </div>

      <div className={styles.grid}>
        {allSounds.map(({ id, label, icon, src, isCustom }) => {
          const isActive = soundsRef.current.has(id);
          return (
            <div key={id} className={`${styles.soundCard} ${isActive ? styles.soundCardActive : ''}`}>
              <button className={styles.soundBtn} onClick={() => toggleSound(id, src)}>
                <span className={styles.icon}>{icon}</span>
                <span className={styles.label}>{label}</span>
              </button>
              {isActive && (
                <input
                  className={styles.slider}
                  type="range" min="0" max="1" step="0.01"
                  value={volumes[id] ?? 0.5}
                  onChange={e => changeVolume(id, parseFloat(e.target.value))}
                />
              )}
              {isCustom && (
                <button className={styles.removeCustom} onClick={(e) => { e.stopPropagation(); removeCustomSound(id); }} title="移除">×</button>
              )}
            </div>
          );
        })}
      </div>

      {showCustomForm && (
        <div className={styles.customForm}>
          <div className={styles.customFormRow}>
            <button className={styles.customFormBtn} onClick={() => fileInputRef.current?.click()}>📁 本地上传</button>
          </div>
          <div className={styles.customFormDivider}>或</div>
          <div className={styles.customFormRow}>
            <input className={styles.customInput} type="text" placeholder="名称（可选）" value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
            <input className={styles.customInput} type="url" placeholder="音频 URL" value={customUrl} onChange={e => setCustomUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCustomUrl()} />
            <button className={styles.customFormBtn} onClick={handleAddCustomUrl}>添加</button>
          </div>
        </div>
      )}
    </div>
  );
}

function useCustomSounds() {
  return useState<CustomSound[]>([]);
}
