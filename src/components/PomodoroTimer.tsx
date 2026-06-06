import { useState } from 'react';
import { formatTime } from '../utils/timeUtils';
import type { TimerPhase, PomodoroSettings } from '../types';
import GradientBackground from './GradientBackground';
import AudioVisualizer from './AudioVisualizer';
import PomodoroSettingsPanel from './PomodoroSettings';
import styles from './PomodoroTimer.module.css';

interface PomodoroState {
  phase: TimerPhase;
  timeLeft: number;
  isRunning: boolean;
  currentRound: number;
  totalRounds: number;
  progress: number;
  settings: PomodoroSettings;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  updateSettings: (partial: Partial<PomodoroSettings>) => void;
}

interface Props {
  pomodoro: PomodoroState;
  analyser: AnalyserNode | null;
}

const phaseLabels: Record<TimerPhase, string> = {
  focus: '专注',
  'short-break': '短休息',
  'long-break': '长休息',
};

const RING_RADIUS = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function PomodoroTimer({ pomodoro, analyser }: Props) {
  const { phase, timeLeft, isRunning, currentRound, totalRounds, progress, settings, start, pause, reset, skip, updateSettings } = pomodoro;
  const [showSettings, setShowSettings] = useState(false);

  const strokeOffset = RING_CIRCUMFERENCE * (1 - progress);
  const hideTime = settings.hideTimeDisplay;

  return (
    <div className={styles.container}>
      <GradientBackground phase={phase} progress={progress} backgroundImage={settings.backgroundImage} />

      <div className={styles.content}>
        <div className={styles.topBar}>
          <div className={styles.phaseLabel}>{phaseLabels[phase]}</div>
          <button className={styles.settingsBtn} onClick={() => setShowSettings(true)} title="设置">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        </div>

        {!hideTime && (
          <div className={styles.ringWrap}>
            <svg className={styles.ring} viewBox="0 0 200 200">
              <circle className={styles.ringBg} cx="100" cy="100" r={RING_RADIUS} fill="none" strokeWidth="6" />
              <circle className={styles.ringProgress} cx="100" cy="100" r={RING_RADIUS} fill="none" strokeWidth="6"
                strokeLinecap="round" strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={strokeOffset}
                style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <div className={styles.ringCenter}>
              <span className={styles.timeText}>{formatTime(timeLeft)}</span>
              <span className={styles.roundText}>第 {currentRound} / {totalRounds} 轮</span>
            </div>
          </div>
        )}

        <div className={styles.controls}>
          <button className={styles.btnSecondary} onClick={reset} title="重置">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
          <button className={`${styles.btnPrimary} ${isRunning ? styles.btnPause : ''}`} onClick={isRunning ? pause : start}>
            {isRunning
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>}
          </button>
          <button className={styles.btnSecondary} onClick={skip} title="跳过">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5,4 15,12 5,20" /><line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        </div>
      </div>

      {!settings.hideVisualization && (
        <div className={styles.visualizerWrap}>
          <AudioVisualizer analyser={analyser} phase={phase} />
        </div>
      )}

      {showSettings && (
        <PomodoroSettingsPanel settings={settings} onUpdate={updateSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
