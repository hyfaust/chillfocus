import { useState, useRef, useCallback, useEffect } from 'react';
import type { Track, Playlist, PlayMode } from '../types';
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
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

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
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    if (!sourceRef.current) {
      sourceRef.current = ctx.createMediaElementSource(audio);
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    sourceRef.current.connect(analyser);
    analyser.connect(ctx.destination);
    analyserRef.current = analyser;
    return analyser;
  }, [getAudio]);

  const getActivePlaylist = useCallback((): Playlist | undefined => {
    return state.playlists.find(p => p.id === state.activePlaylistId);
  }, [state.playlists, state.activePlaylistId]);

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
    if (mode === 'loop-single') {
      return { index: currentIndex, newShuffleIdx: shuffleIdx };
    }
    if (mode === 'shuffle') {
      let nextShuffleIdx = shuffleIdx + 1;
      if (nextShuffleIdx >= shuffleOrd.length) {
        nextShuffleIdx = 0;
      }
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
    if (mode === 'loop-single') {
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

  useEffect(() => {
    const audio = getAudio();
    const onTimeUpdate = () => {
      setState(prev => ({ ...prev, currentTime: audio.currentTime }));
    };
    const onLoadedMetadata = () => {
      setState(prev => ({ ...prev, duration: audio.duration }));
    };
    const onEnded = () => {
      setState(prev => {
        const playlist = prev.playlists.find(p => p.id === prev.activePlaylistId);
        if (!playlist || !prev.currentTrack) return { ...prev, isPlaying: false };
        const idx = playlist.tracks.findIndex(t => t.id === prev.currentTrack!.id);
        const { index: nextIdx, newShuffleIdx } = getNextTrackIndex(idx, playlist, prev.playMode, prev.shuffleIndex, prev.shuffleOrder);
        if (nextIdx < 0 || nextIdx >= playlist.tracks.length) return { ...prev, isPlaying: false };
        return { ...prev, currentTrack: playlist.tracks[nextIdx], isPlaying: true, currentTime: 0, shuffleIndex: newShuffleIdx };
      });
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

  useEffect(() => {
    if (!state.currentTrack) return;
    const audio = getAudio();
    audio.loop = state.playMode === 'loop-single';
  }, [state.playMode, state.currentTrack, getAudio]);

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
      url: URL.createObjectURL(file),
      duration: 0,
    }));

    newTracks.forEach(track => {
      const audio = new Audio(track.url);
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
    });

    setState(prev => ({
      ...prev,
      playlists: prev.playlists.map(p =>
        p.id === playlistId ? { ...p, tracks: [...p.tracks, ...newTracks] } : p
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
      const playlist = getActivePlaylist();
      if (playlist && playlist.tracks.length > 0) {
        playTrack(playlist.tracks[0]);
      }
    }
  }, [getAudio, state.currentTrack, getActivePlaylist, playTrack]);

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
    const playlist = getActivePlaylist();
    if (!playlist || !state.currentTrack) return;
    const idx = playlist.tracks.findIndex(t => t.id === state.currentTrack!.id);
    const { index: nextIdx, newShuffleIdx } = getNextTrackIndex(idx, playlist, state.playMode, state.shuffleIndex, state.shuffleOrder);
    if (nextIdx >= 0 && nextIdx < playlist.tracks.length) {
      setState(prev => ({ ...prev, shuffleIndex: newShuffleIdx }));
      playTrack(playlist.tracks[nextIdx]);
    }
  }, [getActivePlaylist, state.currentTrack, state.playMode, state.shuffleIndex, state.shuffleOrder, getNextTrackIndex, playTrack]);

  const prev = useCallback(() => {
    const playlist = getActivePlaylist();
    if (!playlist || !state.currentTrack) return;
    const idx = playlist.tracks.findIndex(t => t.id === state.currentTrack!.id);
    const { index: prevIdx, newShuffleIdx } = getPrevTrackIndex(idx, playlist, state.playMode, state.shuffleIndex, state.shuffleOrder);
    if (prevIdx >= 0 && prevIdx < playlist.tracks.length) {
      setState(prev => ({ ...prev, shuffleIndex: newShuffleIdx }));
      playTrack(playlist.tracks[prevIdx]);
    }
  }, [getActivePlaylist, state.currentTrack, state.playMode, state.shuffleIndex, state.shuffleOrder, getPrevTrackIndex, playTrack]);

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
          if (pos > 0) {
            [shuffleOrder[0], shuffleOrder[pos]] = [shuffleOrder[pos], shuffleOrder[0]];
          }
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
        if (pos > 0) {
          [shuffleOrder[0], shuffleOrder[pos]] = [shuffleOrder[pos], shuffleOrder[0]];
        }
        shuffleIndex = 0;
      }
      return { ...prev, activePlaylistId: playlistId, shuffleOrder, shuffleIndex };
    });
    playTrack(track);
  }, [playTrack, generateShuffleOrder]);

  const exportPlaylist = useCallback((playlistId: string) => {
    const playlist = state.playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    const exportData = {
      version: 1,
      type: 'chillfocus-playlist',
      playlist: { ...playlist, tracks: playlist.tracks.map(t => ({ ...t, url: '' })) },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${playlist.name}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [state.playlists]);

  const exportAllPlaylists = useCallback(() => {
    const exportData = {
      version: 1,
      type: 'chillfocus-playlists',
      playlists: state.playlists.map(p => ({
        ...p,
        tracks: p.tracks.map(t => ({ ...t, url: '' })),
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chillfocus-playlists.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [state.playlists]);

  const importPlaylists = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.type === 'chillfocus-playlist' && data.playlist) {
          const playlist: Playlist = {
            ...data.playlist,
            id: generateId(),
            tracks: data.playlist.tracks.map((t: Track) => ({ ...t, id: generateId(), url: '' })),
          };
          setState(prev => ({
            ...prev,
            playlists: [...prev.playlists, playlist],
            activePlaylistId: prev.activePlaylistId ?? playlist.id,
          }));
        } else if (data.type === 'chillfocus-playlists' && data.playlists) {
          const newPlaylists: Playlist[] = data.playlists.map((p: Playlist) => ({
            ...p,
            id: generateId(),
            tracks: p.tracks.map((t: Track) => ({ ...t, id: generateId(), url: '' })),
          }));
          setState(prev => ({
            ...prev,
            playlists: [...prev.playlists, ...newPlaylists],
            activePlaylistId: prev.activePlaylistId ?? newPlaylists[0]?.id ?? null,
          }));
        }
      } catch {
        // invalid file
      }
    };
    reader.readAsText(file);
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
    exportAllPlaylists,
    importPlaylists,
  };
}
