import { useState, useEffect, useCallback } from 'react';
import { usePomodoro } from './hooks/usePomodoro';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import PomodoroTimer from './components/PomodoroTimer';
import TaskManager from './components/TaskManager';
import MusicPlayer from './components/MusicPlayer';
import AmbientSounds from './components/AmbientSounds';
import StickyNotes from './components/StickyNotes';
import './App.css';

function App() {
  const pomodoro = usePomodoro();
  const player = useAudioPlayer();
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const ensureAnalyser = useCallback(() => {
    if (analyser) return analyser;
    const a = player.getAnalyser();
    setAnalyser(a);
    return a;
  }, [analyser, player]);

  useEffect(() => {
    const handleClick = () => {
      ensureAnalyser();
    };
    document.addEventListener('click', handleClick, { once: true });
    return () => document.removeEventListener('click', handleClick);
  }, [ensureAnalyser]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🎵</span>
          <span className="logo-text">ChillFocus</span>
        </div>
      </header>

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

      <StickyNotes />
    </div>
  );
}

export default App;
