import { useRef, useCallback, useState, useEffect } from 'react';
import type { Track, Playlist, PlayMode } from '../types';
import { formatTime } from '../utils/timeUtils';
import styles from './MusicPlayer.module.css';

interface Props {
  playlists: Playlist[];
  activePlaylistId: string | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onSetVolume: (vol: number) => void;
  onSetPlayMode: (mode: PlayMode) => void;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onRenamePlaylist: (id: string, name: string) => void;
  onSetActivePlaylist: (id: string) => void;
  onAddTracks: (playlistId: string, files: File[]) => void;
  onRemoveTrack: (playlistId: string, trackId: string) => void;
  onPlayTrack: (playlistId: string, track: Track) => void;
  onExportPlaylist: (playlistId: string) => void;
  onExportAllPlaylists: () => void;
  onImportPlaylists: (file: File) => void;
}

const playModeIcons: Record<PlayMode, string> = {
  sequential: '↻',
  shuffle: '⤮',
  'loop-list': '🔁',
  'loop-single': '🔂',
};

const playModeLabels: Record<PlayMode, string> = {
  sequential: '顺序播放',
  shuffle: '随机播放',
  'loop-list': '列表循环',
  'loop-single': '单曲循环',
};

const modeOrder: PlayMode[] = ['sequential', 'loop-list', 'loop-single', 'shuffle'];

export default function MusicPlayer({
  playlists, activePlaylistId, currentTrack, isPlaying, currentTime, duration, volume, playMode,
  onTogglePlay, onNext, onPrev, onSeek, onSetVolume, onSetPlayMode,
  onCreatePlaylist, onDeletePlaylist, onRenamePlaylist, onSetActivePlaylist,
  onAddTracks, onRemoveTrack, onPlayTrack,
  onExportPlaylist, onExportAllPlaylists, onImportPlaylists,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length && activePlaylistId) {
      onAddTracks(activePlaylistId, files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [activePlaylistId, onAddTracks]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
    if (files.length && activePlaylistId) {
      onAddTracks(activePlaylistId, files);
    }
  }, [activePlaylistId, onAddTracks]);

  const cyclePlayMode = useCallback(() => {
    const idx = modeOrder.indexOf(playMode);
    onSetPlayMode(modeOrder[(idx + 1) % modeOrder.length]);
  }, [playMode, onSetPlayMode]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      onSetVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      onSetVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, prevVolume, onSetVolume]);

  const handleCreatePlaylist = useCallback(() => {
    const name = newPlaylistName.trim() || `播放列表 ${playlists.length + 1}`;
    onCreatePlaylist(name);
    setNewPlaylistName('');
    setShowPlaylistMenu(false);
  }, [newPlaylistName, playlists.length, onCreatePlaylist]);

  const handleSeekClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  }, [duration, onSeek]);

  useEffect(() => {
    if (volume > 0 && isMuted) setIsMuted(false);
  }, [volume, isMuted]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportPlaylists(file);
    }
    if (importFileRef.current) importFileRef.current.value = '';
  }, [onImportPlaylists]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
          音乐播放器
        </h3>
        <div className={styles.headerActions}>
          <button className={styles.headerBtn} onClick={() => importFileRef.current?.click()} title="导入播放列表">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          </button>
          <input ref={importFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className={styles.headerBtn} onClick={onExportAllPlaylists} title="导出全部播放列表">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          </button>
        </div>
      </div>

      {/* 播放列表选择 */}
      <div className={styles.playlistTabs}>
        {playlists.map(p => (
          <div key={p.id} className={styles.playlistTabWrapper}>
            {editingPlaylistId === p.id ? (
              <input
                className={styles.playlistEditInput}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => {
                  if (editName.trim()) onRenamePlaylist(p.id, editName.trim());
                  setEditingPlaylistId(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (editName.trim()) onRenamePlaylist(p.id, editName.trim());
                    setEditingPlaylistId(null);
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                className={`${styles.playlistTab} ${p.id === activePlaylistId ? styles.playlistTabActive : ''}`}
                onClick={() => onSetActivePlaylist(p.id)}
                onDoubleClick={() => { setEditingPlaylistId(p.id); setEditName(p.name); }}
              >
                {p.name}
              </button>
            )}
            {playlists.length > 1 && editingPlaylistId !== p.id && (
              <button
                className={styles.playlistDeleteBtn}
                onClick={(e) => { e.stopPropagation(); onDeletePlaylist(p.id); }}
                title="删除列表"
              >×</button>
            )}
            {editingPlaylistId !== p.id && (
              <button
                className={styles.playlistExportBtn}
                onClick={(e) => { e.stopPropagation(); onExportPlaylist(p.id); }}
                title="导出此列表"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              </button>
            )}
          </div>
        ))}
        <button className={styles.addPlaylistBtn} onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}>
          +
        </button>
      </div>

      {showPlaylistMenu && (
        <div className={styles.createPlaylistRow}>
          <input
            className={styles.input}
            placeholder="播放列表名称"
            value={newPlaylistName}
            onChange={e => setNewPlaylistName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()}
            autoFocus
          />
          <button className={styles.addBtn} onClick={handleCreatePlaylist}>创建</button>
        </div>
      )}

      {/* 当前播放 */}
      {currentTrack && (
        <div className={styles.nowPlaying}>
          <div className={styles.trackInfo}>
            <span className={styles.trackName}>{currentTrack.name}</span>
            <span className={styles.trackTime}>
              {formatTime(Math.floor(currentTime))} / {formatTime(Math.floor(duration))}
            </span>
          </div>

          <div className={styles.progressWrap} onClick={handleSeekClick}>
            <div className={styles.progressBar} style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
          </div>
        </div>
      )}

      {/* 控制栏 */}
      <div className={styles.controls}>
        <button
          className={styles.modeBtn}
          onClick={cyclePlayMode}
          title={playModeLabels[playMode]}
        >
          {playModeIcons[playMode]}
        </button>

        <button className={styles.controlBtn} onClick={onPrev}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4" /><rect x="5" y="4" width="2" height="16" /></svg>
        </button>

        <button className={styles.playBtn} onClick={onTogglePlay}>
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
          )}
        </button>

        <button className={styles.controlBtn} onClick={onNext}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20" /><rect x="17" y="4" width="2" height="16" /></svg>
        </button>

        <div className={styles.volumeWrap}>
          <button className={styles.volumeBtn} onClick={toggleMute}>
            {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            className={styles.volumeSlider}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={e => onSetVolume(parseFloat(e.target.value))}
          />
        </div>
      </div>

      {/* 曲目列表 */}
      <div
        className={styles.trackListWrap}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        <div className={styles.trackListHeader}>
          <span>{activePlaylist ? `${activePlaylist.tracks.length} 首曲目` : '选择播放列表'}</span>
          <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            添加音乐
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        <ul className={styles.trackList}>
          {activePlaylist?.tracks.map((track, i) => (
            <li
              key={track.id}
              className={`${styles.trackItem} ${currentTrack?.id === track.id ? styles.trackItemActive : ''}`}
              onClick={() => onPlayTrack(activePlaylist.id, track)}
            >
              <span className={styles.trackIndex}>
                {currentTrack?.id === track.id && isPlaying ? '♪' : i + 1}
              </span>
              <span className={styles.trackItemName}>{track.name}</span>
              <span className={styles.trackItemDuration}>
                {track.duration ? formatTime(Math.floor(track.duration)) : '--:--'}
              </span>
              <button
                className={styles.removeBtn}
                onClick={(e) => { e.stopPropagation(); onRemoveTrack(activePlaylist.id, track.id); }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </li>
          ))}
        </ul>

        {(!activePlaylist || activePlaylist.tracks.length === 0) && (
          <div className={styles.empty}>
            拖拽音频文件到此处，或点击「添加音乐」
          </div>
        )}
      </div>
    </div>
  );
}
