import { useState, useEffect, useCallback, useRef } from 'react';
import { usePomodoro } from './hooks/usePomodoro';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import PomodoroTimer from './components/PomodoroTimer';
import TaskManager from './components/TaskManager';
import MusicPlayer from './components/MusicPlayer';
import AmbientSounds from './components/AmbientSounds';
import StickyNotes from './components/StickyNotes';
import GlobalSettings, { type ShortcutConfig } from './components/GlobalSettings';
import './App.css';

function loadShortcuts(): { local: ShortcutConfig; global: ShortcutConfig; globalEnabled: boolean } {
  try {
    const raw = localStorage.getItem('chillfocus-global-settings');
    if (!raw) return { local: DEFAULT_LOCAL, global: EMPTY_SHORTCUTS, globalEnabled: false };
    const d = JSON.parse(raw);
    return {
      local: d.localShortcuts || DEFAULT_LOCAL,
      global: d.globalShortcuts || EMPTY_SHORTCUTS,
      globalEnabled: d.globalShortcutsEnabled || false,
    };
  } catch { return { local: DEFAULT_LOCAL, global: EMPTY_SHORTCUTS, globalEnabled: false }; }
}

const isTauriEnv = () => !!(window as any).__TAURI_INTERNALS__;
const EMPTY_SHORTCUTS: ShortcutConfig = { togglePomodoro: '', toggleMusic: '', nextTrack: '', volumeUp: '', volumeDown: '', showWindow: '' };
const DEFAULT_LOCAL: ShortcutConfig = { togglePomodoro: 'Space', toggleMusic: 'm', nextTrack: 'n', volumeUp: 'ArrowUp', volumeDown: 'ArrowDown', showWindow: '' };

function matchesKeyCombo(e: KeyboardEvent, combo: string): boolean {
  if (!combo) return false;
  const parts = combo.split('+').map(s => s.trim());
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);
  const keyMatch = e.key === key || e.key.toLowerCase() === key.toLowerCase() || e.code === key;
  if (!keyMatch) return false;
  return e.ctrlKey === mods.includes('Ctrl') &&
         e.altKey === mods.includes('Alt') &&
         e.shiftKey === mods.includes('Shift') &&
         e.metaKey === mods.includes('Super');
}

function convertToTauriShortcut(combo: string): string {
  const parts = combo.split('+').map(s => s.trim());
  const keyMap: Record<string, string> = {
    space: 'space', arrowup: 'arrowup', arrowdown: 'arrowdown',
    arrowleft: 'arrowleft', arrowright: 'arrowright',
    escape: 'escape', enter: 'enter', backspace: 'backspace',
    delete: 'delete', tab: 'tab', home: 'home', end: 'end',
    pageup: 'pageup', pagedown: 'pagedown',
  };
  return parts.map((part, i) => {
    if (i < parts.length - 1) return part; // modifiers: Ctrl, Alt, Shift, Super
    const lower = part.toLowerCase();
    return keyMap[lower] || (part.length === 1 ? part : lower);
  }).join('+');
}

function App() {
  const pomodoro = usePomodoro();
  const player = useAudioPlayer();
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Refs for stable shortcut/tray callbacks
  const pomodoroRef = useRef(pomodoro);
  pomodoroRef.current = pomodoro;
  const playerRef = useRef(player);
  playerRef.current = player;
  const analyserRef = useRef(analyser);
  analyserRef.current = analyser;

  const ensureAnalyser = useCallback(() => {
    if (analyserRef.current) return analyserRef.current;
    const a = playerRef.current.getAnalyser();
    setAnalyser(a);
    return a;
  }, []);

  // First click → init AudioContext
  useEffect(() => {
    const handleClick = () => ensureAnalyser();
    document.addEventListener('click', handleClick, { once: true });
    return () => document.removeEventListener('click', handleClick);
  }, [ensureAnalyser]);

  // Sync minimizeToTray setting to Rust on mount
  useEffect(() => {
    if (!isTauriEnv()) return;
    try {
      const raw = localStorage.getItem('chillfocus-global-settings');
      if (!raw) return;
      const s = JSON.parse(raw);
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('set_minimize_to_tray', { enabled: !!s.minimizeToTray });
      });
    } catch { /* ignore */ }
  }, []);

  // Tray toggle functions (stable via refs)
  useEffect(() => {
    (window as any).__togglePomodoro = () => {
      const p = pomodoroRef.current;
      if (p.isRunning) p.pause(); else p.start();
    };
    (window as any).__toggleMusic = () => {
      ensureAnalyser();
      playerRef.current.togglePlay();
    };
  }, [ensureAnalyser]);

  // Save/restore window size and position
  useEffect(() => {
    if (!isTauriEnv()) return;
    const WIN_KEY = 'chillfocus-window-geometry';
    let restoring = false;

    const isSaveEnabled = () => {
      try {
        const raw = localStorage.getItem('chillfocus-global-settings');
        if (!raw) return false;
        return JSON.parse(raw).saveWindowSize === true;
      } catch { return false; }
    };

    // Restore on mount
    (async () => {
      try {
        if (!isSaveEnabled()) return;
        const raw = localStorage.getItem(WIN_KEY);
        if (!raw) return;
        const geo = JSON.parse(raw);
        if (!geo.w || !geo.h) return;
        const { getCurrentWindow, LogicalSize, LogicalPosition } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        restoring = true;
        await win.setSize(new LogicalSize(geo.w, geo.h));
        if (geo.x !== undefined && geo.y !== undefined) {
          await win.setPosition(new LogicalPosition(geo.x, geo.y));
        }
        // Wait for events from restore to settle before enabling saves
        setTimeout(() => { restoring = false; }, 1000);
      } catch { restoring = false; }
    })();

    // Save geometry on resize/move (debounced)
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const saveGeometry = async () => {
      if (restoring || !isSaveEnabled()) return;
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const size = await win.innerSize();
        const pos = await win.outerPosition();
        const factor = await win.scaleFactor();
        localStorage.setItem(WIN_KEY, JSON.stringify({
          w: Math.round(size.width / factor),
          h: Math.round(size.height / factor),
          x: Math.round(pos.x / factor),
          y: Math.round(pos.y / factor),
        }));
      } catch { /* ignore */ }
    };
    const debouncedSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(saveGeometry, 500);
    };

    let unlisteners: (() => void)[] = [];
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        unlisteners.push(await win.onResized(debouncedSave));
        unlisteners.push(await win.onMoved(debouncedSave));
      } catch { /* ignore */ }
    })();

    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      unlisteners.forEach(fn => fn());
    };
  }, []);

  // Local shortcuts — stable listener via refs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Re-read settings from localStorage each time (always fresh)
      const { local } = loadShortcuts();
      const p = pomodoroRef.current;
      const pl = playerRef.current;

      if (matchesKeyCombo(e, local.togglePomodoro)) { e.preventDefault(); if (p.isRunning) p.pause(); else p.start(); return; }
      if (matchesKeyCombo(e, local.toggleMusic)) { e.preventDefault(); ensureAnalyser(); pl.togglePlay(); return; }
      if (matchesKeyCombo(e, local.nextTrack)) { e.preventDefault(); ensureAnalyser(); pl.next(); return; }
      if (matchesKeyCombo(e, local.volumeUp)) { e.preventDefault(); pl.setVolume(Math.min(1, pl.volume + 0.1)); return; }
      if (matchesKeyCombo(e, local.volumeDown)) { e.preventDefault(); pl.setVolume(Math.max(0, pl.volume - 0.1)); return; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ensureAnalyser]);

  // Global shortcuts (Tauri only) — re-register when settings change
  const [shortcutVersion, setShortcutVersion] = useState(0);
  useEffect(() => {
    const onChanged = () => setShortcutVersion(v => v + 1);
    window.addEventListener('chillfocus-shortcuts-changed', onChanged);
    return () => window.removeEventListener('chillfocus-shortcuts-changed', onChanged);
  }, []);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      if (!isTauriEnv()) return;
      const { register, unregister: unreg } = await import('@tauri-apps/plugin-global-shortcut');
      if (!mounted) return;

      // Unregister previous shortcuts first
      const { global: prevShortcuts } = loadShortcuts();
      for (const combo of Object.values(prevShortcuts)) {
        if (combo) await unreg(convertToTauriShortcut(combo)).catch(() => {});
      }

      const { global: shortcuts, globalEnabled } = loadShortcuts();
      if (!globalEnabled) return;

      const actionMap: Record<string, () => void> = {
        togglePomodoro: () => { const p = pomodoroRef.current; if (p.isRunning) p.pause(); else p.start(); },
        toggleMusic: () => { ensureAnalyser(); playerRef.current.togglePlay(); },
        nextTrack: () => { ensureAnalyser(); playerRef.current.next(); },
        volumeUp: () => { playerRef.current.setVolume(Math.min(1, playerRef.current.volume + 0.1)); },
        volumeDown: () => { playerRef.current.setVolume(Math.max(0, playerRef.current.volume - 0.1)); },
        showWindow: async () => {
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            const visible = await win.isVisible();
            const minimized = await win.isMinimized();
            if (visible && !minimized) {
              await win.hide();
            } else {
              await win.show();
              await win.setFocus();
            }
          } catch { /* ignore */ }
        },
      };

      for (const [action, combo] of Object.entries(shortcuts)) {
        if (!combo) continue;
        const tauriKey = convertToTauriShortcut(combo);
        try {
          await register(tauriKey, (event) => {
            if (event.state !== 'Pressed') return;
            actionMap[action]?.();
          });
        } catch { /* shortcut conflict */ }
      }
    };
    setup();
    return () => {
      mounted = false;
      if (!isTauriEnv()) return;
      import('@tauri-apps/plugin-global-shortcut').then(({ unregister }) => {
        const { global: shortcuts } = loadShortcuts();
        for (const combo of Object.values(shortcuts)) {
          if (combo) unregister(convertToTauriShortcut(combo)).catch(() => {});
        }
      });
    };
  }, [ensureAnalyser, shortcutVersion]);


  return (
    <div className="app">
      <main className="app-main">
        <section className="timer-section">
          <PomodoroTimer pomodoro={pomodoro} analyser={analyser} />
        </section>

        <div className="bottom-panels">
          <aside className="panel task-panel">
            <TaskManager />
          </aside>

          <section className="panel music-panel">
            <MusicPlayer
              playlists={player.playlists}
              activePlaylistId={player.activePlaylistId}
              currentTrack={player.currentTrack}
              isPlaying={player.isPlaying}
              currentTime={player.currentTime}
              duration={player.duration}
              volume={player.volume}
              playMode={player.playMode}
              playTimer={player.playTimer}
              onTogglePlay={() => { ensureAnalyser(); player.togglePlay(); }}
              onNext={player.next}
              onPrev={player.prev}
              onSeek={player.seek}
              onSetVolume={player.setVolume}
              onSetPlayMode={player.setPlayMode}
              onCreatePlaylist={player.createPlaylist}
              onDeletePlaylist={player.deletePlaylist}
              onRenamePlaylist={player.renamePlaylist}
              onSetActivePlaylist={player.setActivePlaylist}
              onAddTracks={player.addTracksToPlaylist}
              onAddUrlTrack={player.addUrlTrackToPlaylist}
              onRemoveTrack={player.removeTrackFromPlaylist}
              onPlayTrack={(plId, track) => { ensureAnalyser(); player.playSpecificTrack(plId, track); }}
              onExportPlaylists={player.exportPlaylists}
              onImportPlaylists={player.importPlaylists}
              onReassociateFiles={player.reassociateFiles}
              onStartPlayTimer={player.startPlayTimer}
              onCancelPlayTimer={player.cancelPlayTimer}
            />
            <div className="ambient-divider" />
            <AmbientSounds />
          </section>
        </div>
      </main>

      <button className="settings-icon" onClick={() => setShowSettings(true)} title="设置">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>

      <StickyNotes />

      {showSettings && (
        <GlobalSettings
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
