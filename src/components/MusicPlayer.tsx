import { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Track, Playlist, LoopMode, OrderMode, PlayTimer } from '../types';
import { formatTime } from '../utils/timeUtils';
import { filterAudioFiles, SUPPORTED_AUDIO_EXTENSIONS } from '../utils/audioFormats';
import { isTauri, selectAudioFiles, selectAudioDirectory, selectAudioDirectoryRecursive, filesToFileArray, filesToFilePaths } from '../utils/tauriFileAccess';
import styles from './MusicPlayer.module.css';

interface Props {
  playlists: Playlist[];
  activePlaylistId: string | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  loopMode: LoopMode;
  orderMode: OrderMode;
  playTimer: PlayTimer;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onSetVolume: (vol: number) => void;
  onSetLoopMode: (mode: LoopMode) => void;
  onSetOrderMode: (mode: OrderMode) => void;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onRenamePlaylist: (id: string, name: string) => void;
  onSetActivePlaylist: (id: string) => void;
  onAddTracks: (playlistId: string, files: File[], paths?: string[]) => void;
  onAddUrlTrack: (playlistId: string, url: string, name?: string) => void;
  onRemoveTrack: (playlistId: string, trackId: string) => void;
  onCopyTrackToPlaylist: (track: Track, targetPlaylistId: string) => void;
  onRenameTrack: (trackId: string, newName: string) => void;
  onPlayTrack: (playlistId: string, track: Track) => void;
  onExportPlaylists: (ids: string[]) => void;
  onImportPlaylists: (file: File) => void;
  onReassociateFiles: (playlistId: string, files: File[]) => void;
  onStartPlayTimer: (minutes: number, waitForTrackEnd: boolean) => void;
  onCancelPlayTimer: () => void;
}

const loopModeOrder: LoopMode[] = ['single', 'list', 'none'];
const orderModeOrder: OrderMode[] = ['sequential', 'random'];

export default function MusicPlayer({
  playlists, activePlaylistId, currentTrack, isPlaying, currentTime, duration, volume, loopMode, orderMode, playTimer,
  onTogglePlay, onNext, onPrev, onSeek, onSetVolume, onSetLoopMode, onSetOrderMode,
  onCreatePlaylist, onDeletePlaylist, onRenamePlaylist, onSetActivePlaylist,
  onAddTracks, onAddUrlTrack, onRemoveTrack, onCopyTrackToPlaylist, onRenameTrack, onPlayTrack,
  onExportPlaylists, onImportPlaylists, onReassociateFiles, onStartPlayTimer, onCancelPlayTimer,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reassociateInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const trackListRef = useRef<HTMLDivElement>(null);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set());
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addUrlName, setAddUrlName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [timerWaitForEnd, setTimerWaitForEnd] = useState(false);

  // View mode: normal, star, or all
  type ViewMode = 'normal' | 'star' | 'all';
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [previousPlaylistId, setPreviousPlaylistId] = useState<string | null>(null);

  // Context menu state
  interface ContextMenuState {
    type: 'track' | 'tab';
    x: number;
    y: number;
    targetId: string;
  }
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [submenuTarget, setSubmenuTarget] = useState<string | null>(null);

  // Multi-select state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);
  const starPlaylist = playlists.find(p => p.id === 'star');

  // Compute displayed tracks based on view mode
  const displayedTracks = (() => {
    if (viewMode === 'star') return starPlaylist?.tracks ?? [];
    if (viewMode === 'all') {
      const seen = new Set<string>();
      const result: Track[] = [];
      for (const p of playlists) {
        for (const t of p.tracks) {
          const key = t.sourceFileName || t.name;
          if (!seen.has(key)) {
            seen.add(key);
            result.push(t);
          }
        }
      }
      return result;
    }
    return activePlaylist?.tracks ?? [];
  })();

  // View mode toggle handlers
  const toggleStarView = useCallback(() => {
    if (viewMode === 'star') {
      setViewMode('normal');
      if (previousPlaylistId) onSetActivePlaylist(previousPlaylistId);
    } else {
      setPreviousPlaylistId(activePlaylistId);
      setViewMode('star');
    }
  }, [viewMode, previousPlaylistId, activePlaylistId, onSetActivePlaylist]);

  const toggleAllView = useCallback(() => {
    if (viewMode === 'all') {
      setViewMode('normal');
      if (previousPlaylistId) onSetActivePlaylist(previousPlaylistId);
    } else {
      setPreviousPlaylistId(activePlaylistId);
      setViewMode('all');
    }
  }, [viewMode, previousPlaylistId, activePlaylistId, onSetActivePlaylist]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setSubmenuTarget(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  const handleFileSelect = useCallback(async (e?: React.ChangeEvent<HTMLInputElement>) => {
    // Tauri: use native file dialog, pass both files and paths
    if (await isTauri()) {
      if (!activePlaylistId) return;
      const results = await selectAudioFiles();
      if (results.length) onAddTracks(activePlaylistId, filesToFileArray(results), filesToFilePaths(results));
      return;
    }
    // Web: use input element
    if (e) {
      const files = filterAudioFiles(Array.from(e.target.files || []));
      if (files.length && activePlaylistId) onAddTracks(activePlaylistId, files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [activePlaylistId, onAddTracks]);

  const handleFolderSelect = useCallback(async () => {
    if (!activePlaylistId) return;
    const results = await selectAudioDirectoryRecursive();
    if (results.length) {
      onAddTracks(activePlaylistId, filesToFileArray(results), filesToFilePaths(results));
    }
  }, [activePlaylistId, onAddTracks]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = filterAudioFiles(Array.from(e.dataTransfer.files));
    if (files.length && activePlaylistId) onAddTracks(activePlaylistId, files);
  }, [activePlaylistId, onAddTracks]);

  const cycleLoopMode = useCallback(() => {
    const idx = loopModeOrder.indexOf(loopMode);
    onSetLoopMode(loopModeOrder[(idx + 1) % loopModeOrder.length]);
  }, [loopMode, onSetLoopMode]);

  const cycleOrderMode = useCallback(() => {
    const idx = orderModeOrder.indexOf(orderMode);
    onSetOrderMode(orderModeOrder[(idx + 1) % orderModeOrder.length]);
  }, [orderMode, onSetOrderMode]);

  const toggleMute = useCallback(() => {
    if (isMuted) { onSetVolume(prevVolume); setIsMuted(false); }
    else { setPrevVolume(volume); onSetVolume(0); setIsMuted(true); }
  }, [isMuted, volume, prevVolume, onSetVolume]);

  const handleCreatePlaylist = useCallback(() => {
    const name = newPlaylistName.trim() || `播放列表 ${playlists.length + 1}`;
    onCreatePlaylist(name);
    setNewPlaylistName('');
    setShowPlaylistMenu(false);
  }, [newPlaylistName, playlists.length, onCreatePlaylist]);

  const handleSeekClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek((e.clientX - rect.left) / rect.width * duration);
  }, [duration, onSeek]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportPlaylists(file);
    if (importFileRef.current) importFileRef.current.value = '';
  }, [onImportPlaylists]);

  const handleReassociateFile = useCallback(async (e?: React.ChangeEvent<HTMLInputElement>) => {
    // Tauri: use native folder dialog, replace tracks (saved to IndexedDB + filePath)
    if (await isTauri()) {
      if (!activePlaylistId) return;
      const results = await selectAudioDirectory();
      if (results.length) {
        const oldPlaylist = playlists.find(p => p.id === activePlaylistId);
        if (oldPlaylist) {
          oldPlaylist.tracks.forEach(t => onRemoveTrack(activePlaylistId, t.id));
        }
        onAddTracks(activePlaylistId, filesToFileArray(results), filesToFilePaths(results));
      }
      return;
    }
    // Web: use input element
    if (e) {
      const audioFiles = filterAudioFiles(Array.from(e.target.files || []));
      if (audioFiles.length && activePlaylistId) onReassociateFiles(activePlaylistId, audioFiles);
      if (reassociateInputRef.current) reassociateInputRef.current.value = '';
    }
  }, [activePlaylistId, onReassociateFiles, onAddTracks, onRemoveTrack, playlists]);

  const hasUnresolvedTracks = activePlaylist?.tracks.some(t => !t.url && !t.fileKey && !t.filePath) ?? false;

  const toggleExportSelect = useCallback((id: string) => {
    setExportSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    const ids = playlists.length === 0 ? [] : Array.from(exportSelected.size > 0 ? exportSelected : new Set(playlists.map(p => p.id)));
    if (ids.length > 0) onExportPlaylists(ids);
    setShowExportMenu(false);
    setExportSelected(new Set());
  }, [exportSelected, playlists, onExportPlaylists]);

  const handleAddUrl = useCallback(() => {
    if (!addUrl.trim() || !activePlaylistId) return;
    onAddUrlTrack(activePlaylistId, addUrl.trim(), addUrlName.trim() || undefined);
    setAddUrl('');
    setAddUrlName('');
    setShowAddMenu(false);
  }, [addUrl, addUrlName, activePlaylistId, onAddUrlTrack]);

  useEffect(() => {
    if (volume > 0 && isMuted) setIsMuted(false);
  }, [volume, isMuted]);

  // Tauri native file drop handler
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    (async () => {
      if (!(await isTauri())) return;
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<{ paths: string[]; position: { x: number; y: number } }>('tauri://drag-drop', async (event) => {
        const paths = event.payload.paths;
        const audioPaths = paths.filter(p => SUPPORTED_AUDIO_EXTENSIONS.test(p));
        if (audioPaths.length === 0) return;
        // Determine target playlist
        const targetId = viewMode === 'star' ? 'star' : activePlaylistId;
        if (!targetId) return;
        // Read files from paths using Tauri fs
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const files: File[] = [];
        const filePaths: string[] = [];
        for (const path of audioPaths) {
          try {
            const data = await readFile(path);
            const fileName = path.split(/[/\\]/).pop() || 'Unknown';
            files.push(new File([data], fileName));
            filePaths.push(path);
          } catch { /* skip unreadable */ }
        }
        if (files.length > 0) onAddTracks(targetId, files, filePaths);
      });
    })();
    return () => { unlisten?.(); };
  }, [activePlaylistId, viewMode, onAddTracks]);

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
          <button className={`${styles.headerBtn} ${viewMode === 'star' ? styles.viewBtnActive : ''}`} onClick={toggleStarView} title="收藏列表">
            <svg width="14" height="14" viewBox="0 0 24 24" fill={viewMode === 'star' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          <button className={`${styles.headerBtn} ${viewMode === 'all' ? styles.viewBtnActive : ''}`} onClick={toggleAllView} title="所有音乐">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </button>
          <button className={styles.headerBtn} onClick={() => importFileRef.current?.click()} title="导入播放列表">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          </button>
          <input ref={importFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
          <div className={styles.headerBtnWrap}>
            <button className={styles.headerBtn} onClick={() => { setShowExportMenu(!showExportMenu); setExportSelected(new Set()); }} title="导出播放列表">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            </button>
            {showExportMenu && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownTitle}>选择要导出的列表</div>
                {playlists.map(p => (
                  <label key={p.id} className={styles.dropdownItem}>
                    <input type="checkbox" checked={exportSelected.has(p.id)} onChange={() => toggleExportSelect(p.id)} />
                    {p.name}
                  </label>
                ))}
                {playlists.length === 0 && <div className={styles.dropdownEmpty}>暂无播放列表</div>}
                <button className={styles.dropdownBtn} onClick={handleExport}>导出{exportSelected.size > 0 ? ` (${exportSelected.size})` : '全部'}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 播放列表选择 */}
      <div className={styles.playlistTabs}>
        {playlists.filter(p => p.id !== 'star').map(p => (
          <div key={p.id} className={styles.playlistTabWrapper}>
            {editingPlaylistId === p.id ? (
              <input className={styles.playlistEditInput} value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => { if (editName.trim()) onRenamePlaylist(p.id, editName.trim()); setEditingPlaylistId(null); }}
                onKeyDown={e => { if (e.key === 'Enter') { if (editName.trim()) onRenamePlaylist(p.id, editName.trim()); setEditingPlaylistId(null); } }}
                autoFocus />
            ) : (
              <button className={`${styles.playlistTab} ${p.id === activePlaylistId && viewMode === 'normal' ? styles.playlistTabActive : ''}`}
                onClick={() => { onSetActivePlaylist(p.id); setViewMode('normal'); }}
                onDoubleClick={() => { setEditingPlaylistId(p.id); setEditName(p.name); }}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ type: 'tab', x: e.clientX, y: e.clientY, targetId: p.id }); setSubmenuTarget(null); }}>
                {p.name}
              </button>
            )}
            {editingPlaylistId !== p.id && (
              <button className={styles.playlistDeleteBtn}
                onClick={(e) => { e.stopPropagation(); onDeletePlaylist(p.id); }} title="删除列表">×</button>
            )}
          </div>
        ))}
        <button className={styles.addPlaylistBtn} onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}>+</button>
      </div>

      {showPlaylistMenu && (
        <div className={styles.createPlaylistRow}>
          <input className={styles.input} placeholder="播放列表名称" value={newPlaylistName}
            onChange={e => setNewPlaylistName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()} autoFocus />
          <button className={styles.addBtn} onClick={handleCreatePlaylist}>创建</button>
        </div>
      )}

      {/* 当前播放 */}
      {currentTrack && (
        <div className={styles.nowPlaying}>
          <div className={styles.trackInfo}>
            <span className={styles.trackName}>{currentTrack.name}</span>
            <span className={styles.trackTime}>{formatTime(Math.floor(currentTime))} / {formatTime(Math.floor(duration))}</span>
          </div>
          <div className={styles.progressWrap} onClick={handleSeekClick}>
            <div className={styles.progressBar} style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
          </div>
        </div>
      )}

      {/* 控制栏 */}
      <div className={styles.controls}>
        <div className={styles.controlsLeft}>
          <button
            className={`${styles.modeBtn} ${loopMode === 'none' ? styles.modeBtnInactive : ''}`}
            onClick={cycleLoopMode}
            title={loopMode === 'single' ? '单曲循环' : loopMode === 'list' ? '列表循环' : '不循环'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            {loopMode === 'single' && <span className={styles.modeBtnBadge}>1</span>}
            {loopMode === 'none' && <span className={styles.modeBtnSlash}>/</span>}
          </button>
          <button
            className={`${styles.modeBtn} ${orderMode === 'sequential' ? styles.modeBtnInactive : ''}`}
            onClick={cycleOrderMode}
            title={orderMode === 'sequential' ? '顺序播放' : '随机播放'}
          >
            {orderMode === 'random' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            )}
          </button>
          {playTimer.active ? (
            <div className={styles.timerActive}>
              <span>⏱{formatTime(playTimer.remaining)}</span>
              <button className={styles.timerCancelBtn} onClick={onCancelPlayTimer}>×</button>
            </div>
          ) : (
            <div className={styles.timerBtnWrap}>
              <button className={styles.timerBtn} onClick={() => setShowTimerMenu(!showTimerMenu)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </button>
              {showTimerMenu && (
                <div className={styles.timerMenu}>
                  <div className={styles.timerRow}>
                    <span>分钟后停止</span>
                    <input className={styles.timerInput} type="number" min="1" max="480" value={timerMinutes}
                      onChange={e => setTimerMinutes(parseInt(e.target.value) || 1)} />
                  </div>
                  <label className={styles.timerCheck}>
                    <input type="checkbox" checked={timerWaitForEnd} onChange={e => setTimerWaitForEnd(e.target.checked)} />
                    等待当前曲目结束
                  </label>
                  <button className={styles.timerStartBtn} onClick={() => { onStartPlayTimer(timerMinutes, timerWaitForEnd); setShowTimerMenu(false); }}>
                    开始
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.controlsCenter}>
          <button className={styles.controlBtn} onClick={onPrev}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4" /><rect x="5" y="4" width="2" height="16" /></svg>
          </button>
          <button className={styles.playBtn} onClick={onTogglePlay}>
            {isPlaying
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>}
          </button>
          <button className={styles.controlBtn} onClick={onNext}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20" /><rect x="17" y="4" width="2" height="16" /></svg>
          </button>
        </div>

        <div className={styles.controlsRight}>
          <div className={styles.volumeWrap}>
            <button className={styles.volumeBtn} onClick={toggleMute}>
              {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </button>
            <input className={styles.volumeSlider} type="range" min="0" max="1" step="0.01"
              value={isMuted ? 0 : volume} onChange={e => onSetVolume(parseFloat(e.target.value))} />
          </div>
        </div>
      </div>

      {/* 曲目列表 */}
      <div
        className={`${styles.trackListWrap} ${isDragOver ? styles.dragOver : ''}`}
        ref={trackListRef}
        onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
        onDrop={handleDrop}
      >
        <div className={styles.trackListHeader}>
          <span>
            {viewMode === 'star' ? `★ 收藏 · ${displayedTracks.length} 首曲目` :
             viewMode === 'all' ? `所有音乐 · ${displayedTracks.length} 首曲目` :
             activePlaylist ? `${activePlaylist.tracks.length} 首曲目` : '选择播放列表'}
          </span>
          {viewMode === 'normal' && hasUnresolvedTracks && (
            <button className={styles.reassociateBtn} onClick={() => reassociateInputRef.current?.click()}>
              📂 重新关联文件
            </button>
          )}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <input ref={reassociateInputRef} type="file" {...({ webkitdirectory: '' } as any)} style={{ display: 'none' }} onChange={handleReassociateFile} />
          <button
            className={`${styles.multiSelectBtn} ${multiSelectMode ? styles.multiSelectActive : ''}`}
            onClick={() => {
              setMultiSelectMode(m => !m);
              setSelectedTrackIds(new Set());
              setLastSelectedId(null);
            }}
            title={multiSelectMode ? '退出多选' : '多选模式'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          {viewMode !== 'all' && (
          <div className={styles.addMusicWrap}>
            <button className={styles.uploadBtn} onClick={() => setShowAddMenu(!showAddMenu)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              添加音乐
            </button>
            {showAddMenu && (
              <div className={styles.dropdown}>
                <button className={styles.dropdownAction} onClick={() => { handleFileSelect(); setShowAddMenu(false); }}>
                  📁 本地文件
                </button>
                <button className={styles.dropdownAction} onClick={() => { handleFolderSelect(); setShowAddMenu(false); }}>
                  📂 添加文件夹
                </button>
                <div className={styles.dropdownDivider} />
                <input className={styles.dropdownInput} type="text" placeholder="曲目名称（可选）" value={addUrlName}
                  onChange={e => setAddUrlName(e.target.value)} />
                <input className={styles.dropdownInput} type="url" placeholder="输入音频 URL" value={addUrl}
                  onChange={e => setAddUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddUrl()} />
                <button className={styles.dropdownBtn} onClick={handleAddUrl}>添加</button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
          </div>
          )}
        </div>

        <ul className={styles.trackList}>
          {displayedTracks.map((track, i) => {
            const isSelected = selectedTrackIds.has(track.id);
            return (
            <li key={`${viewMode}-${track.id}`}
              className={`${styles.trackItem} ${currentTrack?.id === track.id ? styles.trackItemActive : ''} ${isSelected ? styles.trackItemSelected : ''}`}
              onClick={(e) => {
                if (multiSelectMode) {
                  setSelectedTrackIds(prev => {
                    const next = new Set(prev);
                    if (e.shiftKey && lastSelectedId) {
                      // Range select
                      const ids = displayedTracks.map(t => t.id);
                      const start = ids.indexOf(lastSelectedId);
                      const end = ids.indexOf(track.id);
                      if (start >= 0 && end >= 0) {
                        const [lo, hi] = start < end ? [start, end] : [end, start];
                        for (let j = lo; j <= hi; j++) next.add(ids[j]);
                      }
                    } else if (e.ctrlKey || e.metaKey) {
                      // Toggle single
                      if (next.has(track.id)) next.delete(track.id); else next.add(track.id);
                    } else {
                      // Normal click in multi-select = toggle
                      if (next.has(track.id)) next.delete(track.id); else next.add(track.id);
                    }
                    return next;
                  });
                  setLastSelectedId(track.id);
                } else {
                  const pid = viewMode === 'star' ? 'star' : viewMode === 'all' ? playlists.find(p => p.tracks.some(t => t.sourceFileName === track.sourceFileName && t.name === track.name))?.id ?? activePlaylistId : activePlaylistId;
                  if (pid) onPlayTrack(pid, track);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (multiSelectMode && selectedTrackIds.size > 1) {
                  // Batch context menu
                  setContextMenu({ type: 'track', x: e.clientX, y: e.clientY, targetId: track.id });
                } else {
                  setContextMenu({ type: 'track', x: e.clientX, y: e.clientY, targetId: track.id });
                }
                setSubmenuTarget(null);
              }}
            >
              <span className={styles.trackIndex}>{currentTrack?.id === track.id && isPlaying ? '♪' : i + 1}</span>
              <span className={styles.trackItemName}>{track.name}</span>
              <span className={styles.trackItemDuration}>{track.duration ? formatTime(Math.floor(track.duration)) : '--:--'}</span>
              {viewMode !== 'all' && (
              <button className={styles.removeBtn} onClick={(e) => { e.stopPropagation(); const pid = viewMode === 'star' ? 'star' : activePlaylistId; if (pid) onRemoveTrack(pid, track.id); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
              )}
            </li>
            );
          })}
        </ul>
        {displayedTracks.length === 0 && (
          <div className={styles.empty}>
            {viewMode === 'all' ? '暂无曲目' : '拖拽音频文件到此处，或点击「添加音乐」'}
          </div>
        )}
        {displayedTracks.length > 5 && (
          <button className={styles.backToTopBtn} onClick={() => trackListRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} title="回到顶部">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
          </button>
        )}
      </div>

      {/* Context Menu — rendered via portal to escape backdrop-filter containing block */}
      {contextMenu && createPortal(
        <div ref={contextMenuRef} className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.type === 'track' && (() => {
            const trackId = contextMenu.targetId;
            const track = displayedTracks.find(t => t.id === trackId);
            if (!track) return null;
            const isBatch = multiSelectMode && selectedTrackIds.size > 1 && selectedTrackIds.has(trackId);
            const batchTracks = isBatch ? displayedTracks.filter(t => selectedTrackIds.has(t.id)) : [track];
            const isStarred = starPlaylist?.tracks.some(t => (t.sourceFileName || t.name) === (track.sourceFileName || track.name));
            const currentPid = viewMode === 'star' ? 'star' : viewMode === 'all' ? undefined : activePlaylistId;
            const otherPlaylists = playlists.filter(p => p.id !== currentPid && p.id !== 'star');
            const sourceTrack = playlists.flatMap(p => p.tracks).find(t => t.id === trackId);
            const hasFilePath = !!sourceTrack?.filePath;

            if (isBatch) {
              // Batch context menu
              return <>
                <button className={styles.contextMenuItem} onClick={() => {
                  batchTracks.forEach(t => onCopyTrackToPlaylist(t, 'star'));
                  setContextMenu(null);
                  setSelectedTrackIds(new Set());
                }}>
                  ☆ 批量添加到收藏 ({batchTracks.length})
                </button>
                <div className={styles.contextSubmenuWrap}
                  onMouseEnter={() => setSubmenuTarget('batch-add-to')}
                  onMouseLeave={() => setSubmenuTarget(null)}>
                  <button className={styles.contextMenuItem}>
                    批量添加到 ▸
                  </button>
                  {submenuTarget === 'batch-add-to' && (
                    <div className={styles.contextSubmenu}>
                      {otherPlaylists.map(p => (
                        <button key={p.id} className={styles.contextMenuItem} onClick={() => {
                          batchTracks.forEach(t => onCopyTrackToPlaylist(t, p.id));
                          setContextMenu(null);
                          setSubmenuTarget(null);
                          setSelectedTrackIds(new Set());
                        }}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.contextDivider} />
                <button className={styles.contextMenuItem} onClick={() => {
                  const pid = viewMode === 'star' ? 'star' : activePlaylistId;
                  if (pid) batchTracks.forEach(t => onRemoveTrack(pid, t.id));
                  setContextMenu(null);
                  setSelectedTrackIds(new Set());
                }}>
                  ✕ 批量删除 ({batchTracks.length})
                </button>
              </>;
            }

            // Single track context menu
            return <>
              <button className={styles.contextMenuItem} onClick={() => {
                if (!starPlaylist) return;
                if (isStarred) {
                  const starTrack = starPlaylist.tracks.find(t => (t.sourceFileName || t.name) === (track.sourceFileName || track.name));
                  if (starTrack) onRemoveTrack('star', starTrack.id);
                } else {
                  onCopyTrackToPlaylist(track, 'star');
                }
                setContextMenu(null);
              }}>
                {isStarred ? '★ 从收藏移除' : '☆ 添加到收藏'}
              </button>
              <div className={styles.contextDivider} />
              <button className={styles.contextMenuItem} onClick={() => {
                const newName = prompt('输入新的曲目名称', track.name);
                if (newName && newName.trim()) onRenameTrack(trackId, newName.trim());
                setContextMenu(null);
              }}>
                ✏ 重命名
              </button>
              {hasFilePath && (
                <button className={styles.contextMenuItem} onClick={async () => {
                  const filePath = sourceTrack!.filePath!;
                  const dir = filePath.replace(/[/\\][^/\\]+$/, '');
                  try {
                    if (await isTauri()) {
                      const { invoke } = await import('@tauri-apps/api/core');
                      await invoke('open_in_explorer', { path: dir });
                    }
                  } catch { /* ignore */ }
                  setContextMenu(null);
                }}>
                  📁 在资源管理器中打开
                </button>
              )}
              <div className={styles.contextDivider} />
              <div className={styles.contextSubmenuWrap}
                onMouseEnter={() => setSubmenuTarget('add-to')}
                onMouseLeave={() => setSubmenuTarget(null)}>
                <button className={styles.contextMenuItem}>
                  添加到 ▸
                </button>
                {submenuTarget === 'add-to' && (
                  <div className={styles.contextSubmenu}>
                    {otherPlaylists.map(p => (
                      <button key={p.id} className={styles.contextMenuItem} onClick={() => {
                        onCopyTrackToPlaylist(track, p.id);
                        setContextMenu(null);
                        setSubmenuTarget(null);
                      }}>
                        {p.name}
                      </button>
                    ))}
                    {otherPlaylists.length === 0 && <div className={styles.contextMenuEmpty}>无其它列表</div>}
                  </div>
                )}
              </div>
              <div className={styles.contextDivider} />
              <button className={styles.contextMenuItem} onClick={() => {
                const pid = viewMode === 'all' ? playlists.find(p => p.tracks.some(t => t.sourceFileName === track.sourceFileName && t.name === track.name))?.id : (viewMode === 'star' ? 'star' : activePlaylistId);
                if (pid) onRemoveTrack(pid, track.id);
                setContextMenu(null);
              }}>
                ✕ {viewMode === 'all' ? '从源列表删除' : '从当前列表删除'}
              </button>
            </>;
          })()}

          {contextMenu.type === 'tab' && (() => {
            const tabId = contextMenu.targetId;
            const playlist = playlists.find(p => p.id === tabId);
            if (!playlist) return null;
            const otherPlaylists = playlists.filter(p => p.id !== tabId && p.id !== 'star');
            return <>
              <button className={styles.contextMenuItem} onClick={() => {
                setEditingPlaylistId(tabId);
                setEditName(playlist.name);
                setContextMenu(null);
              }}>
                ✏ 重命名
              </button>
              <button className={styles.contextMenuItem} onClick={() => {
                onDeletePlaylist(tabId);
                setContextMenu(null);
              }}>
                ✕ 删除列表
              </button>
              <div className={styles.contextDivider} />
              {tabId !== 'star' && (
                <button className={styles.contextMenuItem} onClick={() => {
                  playlist.tracks.forEach(t => onCopyTrackToPlaylist(t, 'star'));
                  setContextMenu(null);
                }}>
                  ☆ 复制全部到收藏
                </button>
              )}
              <div className={styles.contextSubmenuWrap}
                onMouseEnter={() => setSubmenuTarget('tab-copy-to')}
                onMouseLeave={() => setSubmenuTarget(null)}>
                <button className={styles.contextMenuItem}>
                  复制全部到 ▸
                </button>
                {submenuTarget === 'tab-copy-to' && (
                  <div className={styles.contextSubmenu}>
                    {otherPlaylists.map(p => (
                      <button key={p.id} className={styles.contextMenuItem} onClick={() => {
                        playlist.tracks.forEach(t => onCopyTrackToPlaylist(t, p.id));
                        setContextMenu(null);
                        setSubmenuTarget(null);
                      }}>
                        {p.id === 'star' ? '★ ' : ''}{p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.contextDivider} />
              <button className={styles.contextMenuItem} onClick={() => {
                onExportPlaylists([tabId]);
                setContextMenu(null);
              }}>
                ↓ 导出播放列表
              </button>
            </>;
          })()}
        </div>,
        document.body
      )}
    </div>
  );
}
