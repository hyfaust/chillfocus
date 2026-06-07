import { useState, useEffect, useCallback } from 'react';
import { usePomodoro } from './hooks/usePomodoro';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import PomodoroTimer from './components/PomodoroTimer';
import TaskManager from './components/TaskManager';
import MusicPlayer from './components/MusicPlayer';
import AmbientSounds from './components/AmbientSounds';
import StickyNotes from './components/StickyNotes';
import GlobalSettings from './components/GlobalSettings';
import './App.css';

function App() {
  const pomodoro = usePomodoro();
  const player = useAudioPlayer();
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const ensureAnalyser = useCallback(() => {
    if (analyser) return analyser;
    const a = player.getAnalyser();
    setAnalyser(a);
    return a;
  }, [analyser, player]);

  useEffect(() => {
    const handleClick = () => ensureAnalyser();
    document.addEventListener('click', handleClick, { once: true });
    return () => document.removeEventListener('click', handleClick);
  }, [ensureAnalyser]);

  // Expose toggle functions for Tauri tray menu
  useEffect(() => {
    (window as any).__togglePomodoro = () => {
      if (pomodoro.isRunning) pomodoro.pause();
      else pomodoro.start();
    };
    (window as any).__toggleMusic = () => {
      ensureAnalyser();
      player.togglePlay();
    };
  }, [pomodoro, player, ensureAnalyser]);

  const handleVolumeUp = useCallback(() => {
    player.setVolume(Math.min(1, player.volume + 0.1));
  }, [player]);

  const handleVolumeDown = useCallback(() => {
    player.setVolume(Math.max(0, player.volume - 0.1));
  }, [player]);

  const handleNextTrack = useCallback(() => {
    ensureAnalyser();
    player.next();
  }, [player, ensureAnalyser]);

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

      {/* Settings icon — bottom left, next to sticky notes icon */}
      <button
        className="settings-icon"
        onClick={() => setShowSettings(true)}
        title="设置"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>

      <StickyNotes />

      {showSettings && (
        <GlobalSettings
          onClose={() => setShowSettings(false)}
          onTogglePomodoro={() => { if (pomodoro.isRunning) pomodoro.pause(); else pomodoro.start(); }}
          onToggleMusic={() => { ensureAnalyser(); player.togglePlay(); }}
          onNextTrack={handleNextTrack}
          onVolumeUp={handleVolumeUp}
          onVolumeDown={handleVolumeDown}
        />
      )}
    </div>
  );
}

export default App;
