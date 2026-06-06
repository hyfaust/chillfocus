import { useState, useRef, useCallback, useEffect } from 'react';
import type { Track, Playlist, PlayMode, PlayTimer } from '../types';
import { generateId } from '../utils/timeUtils';

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

export function useAudioPlayer() {
  const [state, setState] = useState<AudioPlayerState>({
    playlists: [],
    activePlaylistId: null,
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    playMode: 'sequential',
    shuffleOrder: [],
    shuffleIndex: 0,
    playTimer: { duration: 0, remaining: 0, waitForTrackEnd: false, active: false },
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

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

  const playTrack = useCallback((track: Track) => {
    const audio = getAudio();
    audio.src = track.url;
    audio.play().catch(() => {});
    setState(prev => ({ ...prev, currentTrack: track, isPlaying: true, currentTime: 0 }));
  }, [getAudio]);

  const getNextTrackIndex = useCallback((currentIndex: number, playlist: Playlist, mode: PlayMode, shuffleIdx: number, shuffleOrd: number[]): { index: number; newShuffleIdx: number } => {
    if (mode === 'loop-single' || mode === 'single') {
      return { index: currentIndex, newShuffleIdx: shuffleIdx };
    }
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
    if (mode === 'loop-single' || mode === 'single') {
      return { index: currentIndex, newShuffleIdx: shuffleIdx };
    }
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

  // Audio event listeners
  useEffect(() => {
    const audio = getAudio();
    const onTimeUpdate = () => {
      setState(prev => ({ ...prev, currentTime: audio.currentTime }));
    };
    const onLoadedMetadata = () => {
      setState(prev => ({ ...prev, duration: audio.duration }));
    };
    const onEnded = () => {
      const s = stateRef.current;
      const playlist = s.playlists.find(p => p.id === s.activePlaylistId);
      if (!playlist || !s.currentTrack) {
        setState(prev => ({ ...prev, isPlaying: false }));
        return;
      }

      // single mode: stop after track ends
      if (s.playMode === 'single') {
        setState(prev => ({ ...prev, isPlaying: false }));
        return;
      }

      const idx = playlist.tracks.findIndex(t => t.id === s.currentTrack!.id);
      const { index: nextIdx, newShuffleIdx } = getNextTrackIndex(idx, playlist, s.playMode, s.shuffleIndex, s.shuffleOrder);
      if (nextIdx < 0 || nextIdx >= playlist.tracks.length) {
        setState(prev => ({ ...prev, isPlaying: false }));
        return;
      }

      const nextTrack = playlist.tracks[nextIdx];
      audio.src = nextTrack.url;
      audio.play().catch(() => {});
      setState(prev => ({
        ...prev,
        currentTrack: nextTrack,
        isPlaying: true,
        currentTime: 0,
        shuffleIndex: newShuffleIdx,
      }));
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [getAudio, getNextTrackIndex]);

  useEffect(() => {
    const audio = getAudio();
    audio.volume = state.volume;
  }, [state.volume, getAudio]);

  // Play timer countdown
  useEffect(() => {
    if (!state.playTimer.active || !state.isPlaying) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }
    timerIntervalRef.current = setInterval(() => {
      setState(prev => {
        const remaining = prev.playTimer.remaining - 1;
        if (remaining <= 0) {
          if (prev.playTimer.waitForTrackEnd) {
            return { ...prev, playTimer: { ...prev.playTimer, remaining: 0, active: false } };
          }
          const audio = getAudio();
          audio.pause();
          return { ...prev, isPlaying: false, playTimer: { ...prev.playTimer, remaining: 0, active: false } };
        }
        return { ...prev, playTimer: { ...prev.playTimer, remaining } };
      });
    }, 1000);
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [state.playTimer.active, state.isPlaying, getAudio]);

  // Check waitForTrackEnd on track end
  useEffect(() => {
    const audio = getAudio();
    const checkTimer = () => {
      const s = stateRef.current;
      if (s.playTimer.active && s.playTimer.remaining <= 0 && s.playTimer.waitForTrackEnd) {
        audio.pause();
        setState(prev => ({ ...prev, isPlaying: false, playTimer: { ...prev.playTimer, active: false } }));
      }
    };
    audio.addEventListener('ended', checkTimer);
    return () => audio.removeEventListener('ended', checkTimer);
  }, [getAudio]);

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
      const activePlaylistId = prev.activePlaylistId === id
        ? (playlists[0]?.id ?? null)
        : prev.activePlaylistId;
      return { ...prev, playlists, activePlaylistId };
    });
  }, []);

  const renamePlaylist = useCallback((id: string, name: string) => {
    setState(prev => ({
      ...prev,
      playlists: prev.playlists.map(p => p.id === id ? { ...p, name } : p),
    }));
  }, []);

  const setActivePlaylist = useCallback((id: string) => {
    setState(prev => ({ ...prev, activePlaylistId: id }));
  }, []);

  const addTracksToPlaylist = useCallback((playlistId: string, files: File[]) => {
    const newTracks: Track[] = files.map(file => ({
      id: generateId(),
      name: file.name.replace(/\.[^/.]+$/, ''),
      url: '',
      filePath: (file as any).path || '',
      sourceFileName: file.name,
      duration: 0,
    }));

    newTracks.forEach((track, i) => {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        track.url = dataUrl;
        const audio = new Audio(dataUrl);
        audio.addEventListener('loadedmetadata', () => {
          track.duration = audio.duration;
          setState(prev => ({
            ...prev,
            playlists: prev.playlists.map(p =>
              p.id === playlistId
                ? { ...p, tracks: p.tracks.map(t => t.id === track.id ? { ...t, url: dataUrl, duration: audio.duration } : t) }
                : p
            ),
          }));
        });
      };
      reader.readAsDataURL(file);
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
          p.id === playlistId
            ? { ...p, tracks: p.tracks.map(t => t.id === track.id ? { ...t, duration: audio.duration } : t) }
            : p
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

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setState(prev => ({
      ...prev,
      playlists: prev.playlists.map(p =>
        p.id === playlistId ? { ...p, tracks: p.tracks.filter(t => t.id !== trackId) } : p
      ),
      currentTrack: prev.currentTrack?.id === trackId ? null : prev.currentTrack,
    }));
  }, []);

  const play = useCallback(() => {
    const audio = getAudio();
    if (state.currentTrack) {
      audio.play().catch(() => {});
      setState(prev => ({ ...prev, isPlaying: true }));
    } else {
      const playlist = state.playlists.find(p => p.id === state.activePlaylistId);
      if (playlist && playlist.tracks.length > 0) playTrack(playlist.tracks[0]);
    }
  }, [getAudio, state.currentTrack, state.playlists, state.activePlaylistId, playTrack]);

  const pause = useCallback(() => {
    const audio = getAudio();
    audio.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
  }, [getAudio]);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) pause();
    else play();
  }, [state.isPlaying, play, pause]);

  const next = useCallback(() => {
    const playlist = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!playlist || !state.currentTrack) return;
    const idx = playlist.tracks.findIndex(t => t.id === state.currentTrack!.id);
    const { index: nextIdx, newShuffleIdx } = getNextTrackIndex(idx, playlist, state.playMode, state.shuffleIndex, state.shuffleOrder);
    if (nextIdx >= 0 && nextIdx < playlist.tracks.length) {
      setState(prev => ({ ...prev, shuffleIndex: newShuffleIdx }));
      playTrack(playlist.tracks[nextIdx]);
    }
  }, [state.playlists, state.activePlaylistId, state.currentTrack, state.playMode, state.shuffleIndex, state.shuffleOrder, getNextTrackIndex, playTrack]);

  const prev = useCallback(() => {
    const playlist = state.playlists.find(p => p.id === state.activePlaylistId);
    if (!playlist || !state.currentTrack) return;
    const idx = playlist.tracks.findIndex(t => t.id === state.currentTrack!.id);
    const { index: prevIdx, newShuffleIdx } = getPrevTrackIndex(idx, playlist, state.playMode, state.shuffleIndex, state.shuffleOrder);
    if (prevIdx >= 0 && prevIdx < playlist.tracks.length) {
      setState(prev => ({ ...prev, shuffleIndex: newShuffleIdx }));
      playTrack(playlist.tracks[prevIdx]);
    }
  }, [state.playlists, state.activePlaylistId, state.currentTrack, state.playMode, state.shuffleIndex, state.shuffleOrder, getPrevTrackIndex, playTrack]);

  const seek = useCallback((time: number) => {
    const audio = getAudio();
    audio.currentTime = time;
    setState(prev => ({ ...prev, currentTime: time }));
  }, [getAudio]);

  const setVolume = useCallback((vol: number) => {
    setState(prev => ({ ...prev, volume: Math.max(0, Math.min(1, vol)) }));
  }, []);

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

  const sanitizeTrack = (t: Track): Track => ({
    id: t.id,
    name: t.name,
    url: '',
    filePath: '',
    sourceFileName: t.sourceFileName || t.name,
    duration: t.duration,
  });

  const triggerDownload = (data: object, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPlaylist = useCallback((playlistId: string) => {
    const playlist = state.playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    triggerDownload(
      { version: 2, type: 'chillfocus-playlist', playlist: { ...playlist, tracks: playlist.tracks.map(sanitizeTrack) } },
      `${playlist.name}.json`
    );
  }, [state.playlists]);

  const exportPlaylists = useCallback((playlistIds: string[]) => {
    const toExport = state.playlists.filter(p => playlistIds.includes(p.id));
    if (toExport.length === 0) return;
    const sanitize = (p: Playlist) => ({ ...p, tracks: p.tracks.map(sanitizeTrack) });
    const exportData = toExport.length === 1
      ? { version: 2, type: 'chillfocus-playlist', playlist: sanitize(toExport[0]) }
      : { version: 2, type: 'chillfocus-playlists', playlists: toExport.map(sanitize) };
    const filename = toExport.length === 1 ? `${toExport[0].name}.json` : 'chillfocus-playlists.json';
    triggerDownload(exportData, filename);
  }, [state.playlists]);

  const importPlaylists = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const importOne = (p: Playlist) => ({
          ...p,
          id: generateId(),
          tracks: p.tracks.map((t: Track) => ({
            ...t,
            id: generateId(),
            url: t.filePath ? `file:///${t.filePath.replace(/\\/g, '/')}` : (t.url || ''),
            sourceFileName: t.sourceFileName || t.name,
          })),
        });
        if (data.type === 'chillfocus-playlist' && data.playlist) {
          const playlist = importOne(data.playlist);
          setState(prev => ({
            ...prev,
            playlists: [...prev.playlists, playlist],
            activePlaylistId: prev.activePlaylistId ?? playlist.id,
          }));
        } else if (data.type === 'chillfocus-playlists' && data.playlists) {
          const newPlaylists = data.playlists.map(importOne);
          setState(prev => ({
            ...prev,
            playlists: [...prev.playlists, ...newPlaylists],
            activePlaylistId: prev.activePlaylistId ?? newPlaylists[0]?.id ?? null,
          }));
        }
      } catch { /* invalid */ }
    };
    reader.readAsText(file);
  }, []);

  const reassociateFiles = useCallback((playlistId: string, files: File[]) => {
    setState(prev => {
      const playlist = prev.playlists.find(p => p.id === playlistId);
      if (!playlist) return prev;
      const fileMap = new Map(files.map(f => [f.name, f]));
      const updatedTracks = playlist.tracks.map(t => {
        if (t.url && !t.url.startsWith('blob:')) return t;
        const matchKey = t.sourceFileName || (t.name + '.mp3');
        const file = fileMap.get(matchKey) || files.find(f => f.name.replace(/\.[^/.]+$/, '') === t.name);
        if (file) {
          return { ...t, url: URL.createObjectURL(file), sourceFileName: file.name };
        }
        return t;
      });
      return {
        ...prev,
        playlists: prev.playlists.map(p =>
          p.id === playlistId ? { ...p, tracks: updatedTracks } : p
        ),
      };
    });
  }, []);

  const startPlayTimer = useCallback((minutes: number, waitForTrackEnd: boolean) => {
    setState(prev => ({
      ...prev,
      playTimer: { duration: minutes * 60, remaining: minutes * 60, waitForTrackEnd, active: true },
    }));
  }, []);

  const cancelPlayTimer = useCallback(() => {
    setState(prev => ({
      ...prev,
      playTimer: { ...prev.playTimer, active: false, remaining: 0 },
    }));
  }, []);

  return {
    ...state,
    audioRef,
    getAnalyser,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    setActivePlaylist,
    addTracksToPlaylist,
    addUrlTrackToPlaylist,
    removeTrackFromPlaylist,
    play,
    pause,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    setPlayMode,
    playSpecificTrack,
    playTrack,
    exportPlaylist,
    exportPlaylists,
    importPlaylists,
    reassociateFiles,
    startPlayTimer,
    cancelPlayTimer,
  };
}
