import { useState, useRef, useCallback, useEffect } from 'react';
import type { Track, Playlist, PlayMode, PlayTimer } from '../types';
import { generateId } from '../utils/timeUtils';
import { saveAudioFile, getAudioFile, deleteAudioFile } from '../utils/audioStore';
import { readFileAsBlobUrl } from '../utils/tauriFileAccess';

interface AudioPlayerState {
  playlists: Playlist[];
  activePlaylistId: string | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  shuffleOrder: number[];
  shuffleIndex: number;
  playTimer: PlayTimer;
}

const STORAGE_KEY = 'chillfocus-playlists';
const PREFS_KEY = 'chillfocus-player-prefs';

function loadPlaylistsFromStorage(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.map((p: Playlist) => ({
      ...p,
      tracks: p.tracks.map((t: Track) => ({ ...t, url: '' })),
    })) : [];
  } catch { return []; }
}

function loadPrefsFromStorage(): { volume: number; playMode: PlayMode } {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { volume: 0.7, playMode: 'sequential' };
    const data = JSON.parse(raw);
    return { volume: data.volume ?? 0.7, playMode: data.playMode ?? 'sequential' };
  } catch { return { volume: 0.7, playMode: 'sequential' }; }
}

function savePlaylistsToStorage(playlists: Playlist[]) {
  try {
    const serializable = playlists.map(p => ({
      ...p,
      tracks: p.tracks.map(t => ({ ...t, url: '' })),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch { /* quota exceeded */ }
}

function savePrefsToStorage(volume: number, playMode: PlayMode) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ volume, playMode }));
  } catch { /* */ }
}

export function useAudioPlayer() {
  const [state, setState] = useState<AudioPlayerState>(() => {
    const playlists = loadPlaylistsFromStorage();
    const prefs = loadPrefsFromStorage();
    return {
      playlists,
      activePlaylistId: playlists[0]?.id ?? null,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: prefs.volume,
      playMode: prefs.playMode,
      shuffleOrder: [],
      shuffleIndex: 0,
      playTimer: { duration: 0, remaining: 0, waitForTrackEnd: false, active: false },
    };
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist playlists to localStorage whenever they change
  useEffect(() => {
    savePlaylistsToStorage(state.playlists);
  }, [state.playlists]);

  // Persist volume and playMode
  useEffect(() => {
    savePrefsToStorage(state.volume, state.playMode);
  }, [state.volume, state.playMode]);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = state.volume;
    }
    return audioRef.current;
  }, [state.volume]);

  const getAnalyser = useCallback((): AnalyserNode | null => {
    if (analyserRef.current) return analyserRef.current;
    const audio = getAudio();
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    const ctx = audioContextRef.current;
    if (!sourceRef.current) sourceRef.current = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    sourceRef.current.connect(analyser);
    analyser.connect(ctx.destination);
    analyserRef.current = analyser;
    return analyser;
  }, [getAudio]);

  const generateShuffleOrder = useCallback((length: number): number[] => {
    const order = Array.from({ length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }, []);

  // Resolve track URL from IndexedDB or disk if needed
  const resolveTrackUrl = useCallback(async (track: Track): Promise<string> => {
    if (track.url && !track.url.startsWith('blob:')) return track.url;
    if (track.fileKey) {
      const file = await getAudioFile(track.fileKey);
      if (file) {
        const url = URL.createObjectURL(file);
        setState(prev => ({
          ...prev,
          playlists: prev.playlists.map(p => ({
            ...p,
            tracks: p.tracks.map(t => t.id === track.id ? { ...t, url } : t),
          })),
          currentTrack: prev.currentTrack?.id === track.id ? { ...prev.currentTrack, url } : prev.currentTrack,
        }));
        return url;
      }
    }
    // Tauri: try reading from disk using filePath
    if (track.filePath) {
      const url = await readFileAsBlobUrl(track.filePath);
      if (url) {
        setState(prev => ({
          ...prev,
          playlists: prev.playlists.map(p => ({
            ...p,
            tracks: p.tracks.map(t => t.id === track.id ? { ...t, url } : t),
          })),
          currentTrack: prev.currentTrack?.id === track.id ? { ...prev.currentTrack, url } : prev.currentTrack,
        }));
        return url;
      }
    }
    return track.url || '';
  }, []);

  const playTrack = useCallback(async (track: Track) => {
    const audio = getAudio();
    let url = track.url;
    if (!url || url.startsWith('blob:')) {
      url = await resolveTrackUrl(track);
    }
    if (!url) return;
    audio.src = url;
    audio.play().catch(() => {});
    setState(prev => ({ ...prev, currentTrack: { ...track, url }, isPlaying: true, currentTime: 0 }));
  }, [getAudio, resolveTrackUrl]);

  const getNextTrackIndex = useCallback((currentIndex: number, playlist: Playlist, mode: PlayMode, shuffleIdx: number, shuffleOrd: number[]): { index: number; newShuffleIdx: number } => {
    if (mode === 'loop-single' || mode === 'single') return { index: currentIndex, newShuffleIdx: shuffleIdx };
    if (mode === 'shuffle') {
      let nextShuffleIdx = shuffleIdx + 1;
      if (nextShuffleIdx >= shuffleOrd.length) nextShuffleIdx = 0;
      return { index: shuffleOrd[nextShuffleIdx], newShuffleIdx: nextShuffleIdx };
    }
    const next = currentIndex + 1;
    if (next >= playlist.tracks.length) {
      if (mode === 'loop-list') return { index: 0, newShuffleIdx: 0 };
      return { index: -1, newShuffleIdx: 0 };
    }
    return { index: next, newShuffleIdx: 0 };
  }, []);

  const getPrevTrackIndex = useCallback((currentIndex: number, playlist: Playlist, mode: PlayMode, shuffleIdx: number, shuffleOrd: number[]): { index: number; newShuffleIdx: number } => {
    if (mode === 'loop-single' || mode === 'single') return { index: currentIndex, newShuffleIdx: shuffleIdx };
    if (mode === 'shuffle') {
      let prevShuffleIdx = shuffleIdx - 1;
      if (prevShuffleIdx < 0) prevShuffleIdx = shuffleOrd.length - 1;
      return { index: shuffleOrd[prevShuffleIdx], newShuffleIdx: prevShuffleIdx };
    }
    const prev = currentIndex - 1;
    if (prev < 0) {
      if (mode === 'loop-list') return { index: playlist.tracks.length - 1, newShuffleIdx: 0 };
      return { index: 0, newShuffleIdx: 0 };
    }
    return { index: prev, newShuffleIdx: 0 };
  }, []);

  // Audio ended handler
  useEffect(() => {
    const audio = getAudio();
    const onTimeUpdate = () => setState(prev => ({ ...prev, currentTime: audio.currentTime }));
    const onLoadedMetadata = () => setState(prev => ({ ...prev, duration: audio.duration }));
    const onEnded = async () => {
      const s = stateRef.current;
      const playlist = s.playlists.find(p => p.id === s.activePlaylistId);
      if (!playlist || !s.currentTrack) { setState(prev => ({ ...prev, isPlaying: false })); return; }
      if (s.playMode === 'single') { setState(prev => ({ ...prev, isPlaying: false })); return; }
      const idx = playlist.tracks.findIndex(t => t.id === s.currentTrack!.id);
      const { index: nextIdx, newShuffleIdx } = getNextTrackIndex(idx, playlist, s.playMode, s.shuffleIndex, s.shuffleOrder);
      if (nextIdx < 0 || nextIdx >= playlist.tracks.length) { setState(prev => ({ ...prev, isPlaying: false })); return; }
      const nextTrack = playlist.tracks[nextIdx];
      const url = await resolveTrackUrl(nextTrack);
      if (!url) { setState(prev => ({ ...prev, isPlaying: false })); return; }
      audio.src = url;
      audio.play().catch(() => {});
      setState(prev => ({ ...prev, currentTrack: { ...nextTrack, url }, isPlaying: true, currentTime: 0, shuffleIndex: newShuffleIdx }));
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [getAudio, getNextTrackIndex, resolveTrackUrl]);

  useEffect(() => { getAudio().volume = state.volume; }, [state.volume, getAudio]);

  // Play timer
  useEffect(() => {
    if (!state.playTimer.active || !state.isPlaying) {
      if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
      return;
    }
    timerIntervalRef.current = setInterval(() => {
      setState(prev => {
        const remaining = prev.playTimer.remaining - 1;
        if (remaining <= 0) {
          if (prev.playTimer.waitForTrackEnd) return { ...prev, playTimer: { ...prev.playTimer, remaining: 0, active: false } };
          getAudio().pause();
          return { ...prev, isPlaying: false, playTimer: { ...prev.playTimer, remaining: 0, active: false } };
        }
        return { ...prev, playTimer: { ...prev.playTimer, remaining } };
      });
    }, 1000);
    return () => { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; } };
  }, [state.playTimer.active, state.isPlaying, getAudio]);

  const createPlaylist = useCallback((name: string) => {
    const playlist: Playlist = { id: generateId(), name, tracks: [] };
    setState(prev => {
      const playlists = [...prev.playlists, playlist];
      return { ...prev, playlists, activePlaylistId: prev.activePlaylistId ?? playlist.id };
    });
    return playlist;
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setState(prev => {
      const playlists = prev.playlists.filter(p => p.id !== id);
      // Clean up IndexedDB files for deleted playlist
      const deleted = prev.playlists.find(p => p.id === id);
      if (deleted) deleted.tracks.forEach(t => { if (t.fileKey) deleteAudioFile(t.fileKey); });
      return { ...prev, playlists, activePlaylistId: prev.activePlaylistId === id ? (playlists[0]?.id ?? null) : prev.activePlaylistId };
    });
  }, []);

  const renamePlaylist = useCallback((id: string, name: string) => {
    setState(prev => ({ ...prev, playlists: prev.playlists.map(p => p.id === id ? { ...p, name } : p) }));
  }, []);

  const setActivePlaylist = useCallback((id: string) => {
    setState(prev => ({ ...prev, activePlaylistId: id }));
  }, []);

  const addTracksToPlaylist = useCallback((playlistId: string, files: File[]) => {
    const newTracks: Track[] = files.map(file => {
      const fileKey = `audio_${generateId()}`;
      saveAudioFile(fileKey, file);
      return {
        id: generateId(),
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: '',
        fileKey,
        sourceFileName: file.name,
        duration: 0,
      };
    });
    // Get durations
    newTracks.forEach(async (track) => {
      const file = await getAudioFile(track.fileKey!);
      if (!file) return;
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.addEventListener('loadedmetadata', () => {
        track.duration = audio.duration;
        URL.revokeObjectURL(url);
        setState(prev => ({
          ...prev,
          playlists: prev.playlists.map(p =>
            p.id === playlistId ? { ...p, tracks: p.tracks.map(t => t.id === track.id ? { ...t, duration: audio.duration } : t) } : p
          ),
        }));
      });
    });
    setState(prev => ({
      ...prev,
      playlists: prev.playlists.map(p =>
        p.id === playlistId ? { ...p, tracks: [...p.tracks, ...newTracks] } : p
      ),
    }));
  }, []);

  const addUrlTrackToPlaylist = useCallback((playlistId: string, url: string, name?: string) => {
    const track: Track = {
      id: generateId(),
      name: name || url.split('/').pop()?.replace(/\.[^/.]+$/, '') || '网络音乐',
      url,
      duration: 0,
    };
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      track.duration = audio.duration;
      setState(prev => ({
        ...prev,
        playlists: prev.playlists.map(p =>
          p.id === playlistId ? { ...p, tracks: p.tracks.map(t => t.id === track.id ? { ...t, duration: audio.duration } : t) } : p
        ),
      }));
    });
    setState(prev => ({
      ...prev,
      playlists: prev.playlists.map(p =>
        p.id === playlistId ? { ...p, tracks: [...p.tracks, track] } : p
      ),
    }));
  }, []);

  // Tauri: add tracks from native file dialog (with filePath)
  const addLocalTracksToPlaylist = useCallback((playlistId: string, tracks: Track[]) => {
    tracks.forEach(track => {
      const audio = new Audio(track.url);
      audio.addEventListener('loadedmetadata', () => {
        track.duration = audio.duration;
        setState(prev => ({
          ...prev,
          playlists: prev.playlists.map(p =>
            p.id === playlistId ? { ...p, tracks: p.tracks.map(t => t.id === track.id ? { ...t, duration: audio.duration } : t) } : p
          ),
        }));
      });
    });
    setState(prev => ({
      ...prev,
      playlists: prev.playlists.map(p =>
        p.id === playlistId ? { ...p, tracks: [...p.tracks, ...tracks] } : p
      ),
    }));
  }, []);

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setState(prev => {
      const playlist = prev.playlists.find(p => p.id === playlistId);
      const track = playlist?.tracks.find(t => t.id === trackId);
      if (track?.fileKey) deleteAudioFile(track.fileKey);
      return {
        ...prev,
        playlists: prev.playlists.map(p => p.id === playlistId ? { ...p, tracks: p.tracks.filter(t => t.id !== trackId) } : p),
        currentTrack: prev.currentTrack?.id === trackId ? null : prev.currentTrack,
      };
    });
  }, []);

  const play = useCallback(async () => {
    const audio = getAudio();
    if (state.currentTrack) {
      if (!state.currentTrack.url || state.currentTrack.url.startsWith('blob:')) {
        const url = await resolveTrackUrl(state.currentTrack);
        if (url) audio.src = url;
      }
      audio.play().catch(() => {});
      setState(prev => ({ ...prev, isPlaying: true }));
    } else {
      const playlist = state.playlists.find(p => p.id === state.activePlaylistId);
      if (playlist && playlist.tracks.length > 0) playTrack(playlist.tracks[0]);
    }
  }, [getAudio, state.currentTrack, state.playlists, state.activePlaylistId, playTrack, resolveTrackUrl]);

  const pause = useCallback(() => { getAudio().pause(); setState(prev => ({ ...prev, isPlaying: false })); }, [getAudio]);

  const togglePlay = useCallback(() => { if (state.isPlaying) pause(); else play(); }, [state.isPlaying, play, pause]);

  const next = useCallback(async () => {
    const playlist = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!playlist || !state.currentTrack) return;
    const idx = playlist.tracks.findIndex(t => t.id === state.currentTrack!.id);
    const { index: nextIdx, newShuffleIdx } = getNextTrackIndex(idx, playlist, state.playMode, state.shuffleIndex, state.shuffleOrder);
    if (nextIdx >= 0 && nextIdx < playlist.tracks.length) {
      setState(prev => ({ ...prev, shuffleIndex: newShuffleIdx }));
      playTrack(playlist.tracks[nextIdx]);
    }
  }, [state.playlists, state.activePlaylistId, state.currentTrack, state.playMode, state.shuffleIndex, state.shuffleOrder, getNextTrackIndex, playTrack]);

  const prev = useCallback(async () => {
    const playlist = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!playlist || !state.currentTrack) return;
    const idx = playlist.tracks.findIndex(t => t.id === state.currentTrack!.id);
    const { index: prevIdx, newShuffleIdx } = getPrevTrackIndex(idx, playlist, state.playMode, state.shuffleIndex, state.shuffleOrder);
    if (prevIdx >= 0 && prevIdx < playlist.tracks.length) {
      setState(prev => ({ ...prev, shuffleIndex: newShuffleIdx }));
      playTrack(playlist.tracks[prevIdx]);
    }
  }, [state.playlists, state.activePlaylistId, state.currentTrack, state.playMode, state.shuffleIndex, state.shuffleOrder, getPrevTrackIndex, playTrack]);

  const seek = useCallback((time: number) => { getAudio().currentTime = time; setState(prev => ({ ...prev, currentTime: time })); }, [getAudio]);

  const setVolume = useCallback((vol: number) => { setState(prev => ({ ...prev, volume: Math.max(0, Math.min(1, vol)) })); }, []);

  const setPlayMode = useCallback((mode: PlayMode) => {
    setState(prev => {
      const playlist = prev.playlists.find(p => p.id === prev.activePlaylistId);
      let shuffleOrder = prev.shuffleOrder;
      let shuffleIndex = prev.shuffleIndex;
      if (mode === 'shuffle' && playlist) {
        shuffleOrder = generateShuffleOrder(playlist.tracks.length);
        if (prev.currentTrack) {
          const currentIdx = playlist.tracks.findIndex(t => t.id === prev.currentTrack!.id);
          const pos = shuffleOrder.indexOf(currentIdx);
          if (pos > 0) [shuffleOrder[0], shuffleOrder[pos]] = [shuffleOrder[pos], shuffleOrder[0]];
          shuffleIndex = 0;
        }
      }
      return { ...prev, playMode: mode, shuffleOrder, shuffleIndex };
    });
  }, [generateShuffleOrder]);

  const playSpecificTrack = useCallback((playlistId: string, track: Track) => {
    setState(prev => {
      const playlist = prev.playlists.find(p => p.id === playlistId);
      let shuffleOrder = prev.shuffleOrder;
      let shuffleIndex = prev.shuffleIndex;
      if (prev.playMode === 'shuffle' && playlist) {
        shuffleOrder = generateShuffleOrder(playlist.tracks.length);
        const currentIdx = playlist.tracks.findIndex(t => t.id === track.id);
        const pos = shuffleOrder.indexOf(currentIdx);
        if (pos > 0) [shuffleOrder[0], shuffleOrder[pos]] = [shuffleOrder[pos], shuffleOrder[0]];
        shuffleIndex = 0;
      }
      return { ...prev, activePlaylistId: playlistId, shuffleOrder, shuffleIndex };
    });
    playTrack(track);
  }, [playTrack, generateShuffleOrder]);

  // Export/Import
  const sanitizeTrack = (t: Track): Track => ({
    id: t.id, name: t.name, url: '',
    fileKey: t.fileKey || '',
    filePath: '',
    sourceFileName: t.sourceFileName || t.name, duration: t.duration,
  });

  const triggerDownload = (data: object, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPlaylist = useCallback((playlistId: string) => {
    const playlist = state.playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    triggerDownload({ version: 3, type: 'chillfocus-playlist', playlist: { ...playlist, tracks: playlist.tracks.map(sanitizeTrack) } }, `${playlist.name}.json`);
  }, [state.playlists]);

  const exportPlaylists = useCallback((playlistIds: string[]) => {
    const toExport = state.playlists.filter(p => playlistIds.includes(p.id));
    if (toExport.length === 0) return;
    const sanitize = (p: Playlist) => ({ ...p, tracks: p.tracks.map(sanitizeTrack) });
    const data = toExport.length === 1
      ? { version: 3, type: 'chillfocus-playlist', playlist: sanitize(toExport[0]) }
      : { version: 3, type: 'chillfocus-playlists', playlists: toExport.map(sanitize) };
    triggerDownload(data, toExport.length === 1 ? `${toExport[0].name}.json` : 'chillfocus-playlists.json');
  }, [state.playlists]);

  const importPlaylists = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const importOne = (p: Playlist) => ({
          ...p,
          id: generateId(),
          tracks: p.tracks.map((t: Track) => ({ ...t, id: generateId(), url: '', fileKey: t.fileKey || '' })),
        });
        if (data.type === 'chillfocus-playlist' && data.playlist) {
          const playlist = importOne(data.playlist);
          setState(prev => ({ ...prev, playlists: [...prev.playlists, playlist], activePlaylistId: prev.activePlaylistId ?? playlist.id }));
        } else if (data.type === 'chillfocus-playlists' && data.playlists) {
          const newPlaylists = data.playlists.map(importOne);
          setState(prev => ({ ...prev, playlists: [...prev.playlists, ...newPlaylists], activePlaylistId: prev.activePlaylistId ?? newPlaylists[0]?.id ?? null }));
        }
      } catch { /* invalid */ }
    };
    reader.readAsText(file);
  }, []);

  const reassociateFiles = useCallback((playlistId: string, files: File[]) => {
    const fileMap = new Map(files.map(f => [f.name, f]));
    setState(prev => {
      const playlist = prev.playlists.find(p => p.id === playlistId);
      if (!playlist) return prev;
      const updatedTracks = playlist.tracks.map(t => {
        if (t.url && !t.url.startsWith('blob:')) return t;
        const matchKey = t.sourceFileName || t.name;
        const file = fileMap.get(matchKey) || fileMap.get(matchKey + '.mp3') || files.find(f => f.name.replace(/\.[^/.]+$/, '') === t.name);
        if (file) {
          const fileKey = t.fileKey || `audio_${generateId()}`;
          saveAudioFile(fileKey, file);
          return { ...t, fileKey, sourceFileName: file.name, url: '' };
        }
        return t;
      });
      return { ...prev, playlists: prev.playlists.map(p => p.id === playlistId ? { ...p, tracks: updatedTracks } : p) };
    });
  }, []);

  const startPlayTimer = useCallback((minutes: number, waitForTrackEnd: boolean) => {
    setState(prev => ({ ...prev, playTimer: { duration: minutes * 60, remaining: minutes * 60, waitForTrackEnd, active: true } }));
  }, []);

  const cancelPlayTimer = useCallback(() => {
    setState(prev => ({ ...prev, playTimer: { ...prev.playTimer, active: false, remaining: 0 } }));
  }, []);

  return {
    ...state, audioRef, getAnalyser,
    createPlaylist, deletePlaylist, renamePlaylist, setActivePlaylist,
    addTracksToPlaylist, addUrlTrackToPlaylist, addLocalTracksToPlaylist, removeTrackFromPlaylist,
    play, pause, togglePlay, next, prev, seek, setVolume, setPlayMode,
    playSpecificTrack, playTrack,
    exportPlaylist, exportPlaylists, importPlaylists, reassociateFiles,
    startPlayTimer, cancelPlayTimer,
  };
}
