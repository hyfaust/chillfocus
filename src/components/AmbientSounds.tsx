import { useState, useRef, useCallback, useEffect } from 'react';
import { generateId } from '../utils/timeUtils';
import { saveAudioFile, getAudioFile } from '../utils/audioStore';
import { isSupportedAudioFile } from '../utils/audioFormats';
import styles from './AmbientSounds.module.css';

interface PresetSound {
  id: string;
  label: string;
  icon: string;
  src: string;
}

const PRESETS: PresetSound[] = [
  { id: 'rain', label: '雨声', icon: '🌧️', src: `${import.meta.env.BASE_URL}sounds/rain.ogg` },
  { id: 'fireplace', label: '壁炉', icon: '🔥', src: `${import.meta.env.BASE_URL}sounds/fireplace.ogg` },
  { id: 'forest', label: '森林', icon: '🌲', src: `${import.meta.env.BASE_URL}sounds/forest.ogg` },
  { id: 'wind', label: '风声', icon: '💨', src: `${import.meta.env.BASE_URL}sounds/wind.ogg` },
];

interface ActiveSound {
  audio: HTMLAudioElement;
  volume: number;
}

interface CustomSound {
  id: string;
  label: string;
  url: string;
  fileKey?: string;
}

const STORAGE_KEY = 'chillfocus-custom-sounds';
const VOLUMES_KEY = 'chillfocus-ambient-volumes';
const ACTIVE_KEY = 'chillfocus-ambient-active';

function loadCustomSounds(): CustomSound[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.map((s: CustomSound) => ({ ...s, url: s.fileKey ? '' : s.url })) : [];
  } catch { return []; }
}

function saveCustomSounds(sounds: CustomSound[]) {
  try {
    const serializable = sounds.map(s => ({ ...s, url: s.fileKey ? '' : s.url }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch { /* */ }
}

function loadVolumes(): Record<string, number> {
  try {
    const raw = localStorage.getItem(VOLUMES_KEY);
    if (!raw) return Object.fromEntries(PRESETS.map(p => [p.id, 0.5]));
    return JSON.parse(raw);
  } catch { return Object.fromEntries(PRESETS.map(p => [p.id, 0.5])); }
}

function saveVolumes(volumes: Record<string, number>) {
  try { localStorage.setItem(VOLUMES_KEY, JSON.stringify(volumes)); } catch { /* */ }
}

function loadActiveIds(): string[] {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function saveActiveIds(ids: string[]) {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(ids)); } catch { /* */ }
}

export default function AmbientSounds() {
  const [, setTick] = useState(0);
  const [volumes, setVolumes] = useState<Record<string, number>>(loadVolumes);
  const [customSounds, setCustomSounds] = useState<CustomSound[]>(loadCustomSounds);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const soundsRef = useRef<Map<string, ActiveSound>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);
  const pausedStateRef = useRef<{ ids: string[]; volumes: Record<string, number> } | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Persist custom sounds
  useEffect(() => { saveCustomSounds(customSounds); }, [customSounds]);

  // Persist volumes
  useEffect(() => { saveVolumes(volumes); }, [volumes]);

  // Persist active sound IDs — skip until restoration is complete
  useEffect(() => {
    if (!restoredRef.current) return;
    saveActiveIds(Array.from(soundsRef.current.keys()));
  });

  // Resolve IndexedDB audio for custom sounds, then restore active sounds
  useEffect(() => {
    (async () => {
      const resolved = await Promise.all(customSounds.map(async (s) => {
        if (s.url) return s;
        if (s.fileKey) {
          const file = await getAudioFile(s.fileKey);
          if (file) return { ...s, url: URL.createObjectURL(file) };
        }
        return s;
      }));
      const changed = resolved.some((s, i) => s.url !== customSounds[i].url);
      if (changed) setCustomSounds(resolved);

      // Restore active sounds after first resolution
      if (!restoredRef.current) {
        restoredRef.current = true;
        const savedActive = loadActiveIds();
        if (savedActive.length > 0) {
          const allSrcMap = new Map<string, string>();
          PRESETS.forEach(p => allSrcMap.set(p.id, p.src));
          resolved.forEach(s => { if (s.url) allSrcMap.set(s.id, s.url); });
          savedActive.forEach(id => {
            const src = allSrcMap.get(id);
            if (src && !soundsRef.current.has(id)) {
              const audio = new Audio(src);
              audio.loop = true;
              audio.volume = volumes[id] ?? 0.5;
              const onEnded = () => { audio.currentTime = 0; audio.play().catch(() => {}); };
              audio.addEventListener('ended', onEnded);
              audio.play().catch(() => {});
              soundsRef.current.set(id, { audio, volume: volumes[id] ?? 0.5 });
            }
          });
          setTick(t => t + 1);
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!file || !isSupportedAudioFile(file)) return;
    const id = generateId();
    const fileKey = `ambient_${id}`;
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^/.]+$/, '');
    saveAudioFile(fileKey, file);
    setCustomSounds(prev => [...prev, { id, label: name, url, fileKey }]);
    setVolumes(prev => ({ ...prev, [id]: 0.5 }));
    setShowCustomForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleAddCustomUrl = useCallback(() => {
    if (!customUrl.trim()) return;
    const id = generateId();
    const label = customLabel.trim() || '自定义音效';
    setCustomSounds(prev => [...prev, { id, label, url: customUrl.trim() }]);
    setVolumes(prev => ({ ...prev, [id]: 0.5 }));
    setCustomUrl('');
    setCustomLabel('');
    setShowCustomForm(false);
  }, [customUrl, customLabel]);

  const removeCustomSound = useCallback((id: string) => {
    const active = soundsRef.current.get(id);
    if (active) {
      active.audio.pause();
      soundsRef.current.delete(id);
      setTick(t => t + 1);
    }
    setCustomSounds(prev => prev.filter(s => s.id !== id));
  }, []);

  const togglePauseAll = useCallback(() => {
    if (isPaused) {
      // Resume: restore from saved state
      if (pausedStateRef.current) {
        const { ids, volumes: savedVolumes } = pausedStateRef.current;
        const allSrcMap = new Map<string, string>();
        PRESETS.forEach(p => allSrcMap.set(p.id, p.src));
        customSounds.forEach(s => { if (s.url) allSrcMap.set(s.id, s.url); });
        ids.forEach(id => {
          const src = allSrcMap.get(id);
          if (src && !soundsRef.current.has(id)) {
            const audio = new Audio(src);
            audio.loop = true;
            audio.volume = savedVolumes[id] ?? 0.5;
            const onEnded = () => { audio.currentTime = 0; audio.play().catch(() => {}); };
            audio.addEventListener('ended', onEnded);
            audio.play().catch(() => {});
            soundsRef.current.set(id, { audio, volume: savedVolumes[id] ?? 0.5 });
          }
        });
        pausedStateRef.current = null;
      }
      setIsPaused(false);
    } else {
      // Pause: save current state and stop all
      const ids = Array.from(soundsRef.current.keys());
      const savedVolumes: Record<string, number> = {};
      soundsRef.current.forEach((s, id) => { savedVolumes[id] = s.volume; });
      pausedStateRef.current = { ids, volumes: savedVolumes };
      soundsRef.current.forEach(s => { s.audio.pause(); s.audio.currentTime = 0; });
      soundsRef.current.clear();
      setIsPaused(true);
    }
    setTick(t => t + 1);
  }, [isPaused, customSounds]);

  useEffect(() => {
    return () => {
      soundsRef.current.forEach(s => { s.audio.pause(); s.audio.currentTime = 0; });
      soundsRef.current.clear();
    };
  }, []);

  const allSounds: { id: string; label: string; icon: string; src: string; isCustom?: boolean }[] = [
    ...PRESETS.map(p => ({ ...p })),
    ...customSounds.map(c => ({ id: c.id, label: c.label, icon: '🎵', src: c.url, isCustom: true })),
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
        <button className={`${styles.addBtn} ${isPaused ? styles.pauseBtnActive : ''}`} onClick={togglePauseAll} title={isPaused ? '继续环境音' : '暂停所有环境音'}>
          {isPaused ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          )}
        </button>
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
