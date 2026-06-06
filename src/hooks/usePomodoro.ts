import { useState, useRef, useCallback, useEffect } from 'react';
import type { TimerPhase, PomodoroSettings } from '../types';
import { useLocalStorage } from './useLocalStorage';

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  roundsBeforeLongBreak: 4,
  notificationSound: '',
  backgroundImage: '',
  autoLoop: false,
  hideTimeDisplay: false,
  hideVisualization: false,
};

interface PomodoroState {
  phase: TimerPhase;
  timeLeft: number;
  isRunning: boolean;
  currentRound: number;
  totalRounds: number;
}

export function usePomodoro() {
  const [settings, setSettings] = useLocalStorage<PomodoroSettings>('chillfocus-pomodoro-settings', DEFAULT_SETTINGS);
  const [state, setState] = useState<PomodoroState>({
    phase: 'focus',
    timeLeft: settings.focusDuration,
    isRunning: false,
    currentRound: 1,
    totalRounds: settings.roundsBeforeLongBreak,
  });

  const isRunningRef = useRef(false);
  const settingsRef = useRef(settings);
  const notifAudioRef = useRef<HTMLAudioElement | null>(null);
  settingsRef.current = settings;

  const getDuration = useCallback((phase: TimerPhase, s?: PomodoroSettings) => {
    const cfg = s ?? settingsRef.current;
    switch (phase) {
      case 'focus': return cfg.focusDuration;
      case 'short-break': return cfg.shortBreakDuration;
      case 'long-break': return cfg.longBreakDuration;
    }
  }, []);

  // Single persistent interval — never recreated
  useEffect(() => {
    const id = setInterval(() => {
      if (!isRunningRef.current) return;

      setState(prev => {
        if (prev.timeLeft <= 1) {
          // Play notification
          const s = settingsRef.current;
          if (s.notificationSound) {
            try {
              if (notifAudioRef.current) { notifAudioRef.current.pause(); notifAudioRef.current.currentTime = 0; }
              const audio = new Audio(s.notificationSound);
              audio.volume = 0.6;
              audio.play().catch(() => {});
              notifAudioRef.current = audio;
            } catch { /* ignore */ }
          } else {
            try {
              if (notifAudioRef.current) { notifAudioRef.current.pause(); notifAudioRef.current.currentTime = 0; }
              const audio = new Audio(`${import.meta.env.BASE_URL}sounds/notification.mp3`);
              audio.volume = 0.6;
              audio.play().catch(() => {});
              notifAudioRef.current = audio;
            } catch { /* ignore */ }
          }

          // Next phase
          let nextP: TimerPhase;
          let nextRound: number;
          if (prev.phase === 'focus') {
            if (prev.currentRound >= s.roundsBeforeLongBreak) { nextP = 'long-break'; nextRound = 1; }
            else { nextP = 'short-break'; nextRound = prev.currentRound; }
          } else if (prev.phase === 'short-break') {
            nextP = 'focus'; nextRound = prev.currentRound + 1;
          } else {
            nextP = 'focus'; nextRound = 1;
          }

          return {
            ...prev,
            phase: nextP,
            timeLeft: getDuration(nextP, s),
            isRunning: s.autoLoop,
            currentRound: nextRound,
          };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(id);
  }, [getDuration]);

  const start = useCallback(() => {
    isRunningRef.current = true;
    setState(prev => ({ ...prev, isRunning: true }));
  }, []);

  const pause = useCallback(() => {
    isRunningRef.current = false;
    setState(prev => ({ ...prev, isRunning: false }));
  }, []);

  const reset = useCallback(() => {
    isRunningRef.current = false;
    setState({
      phase: 'focus',
      timeLeft: settingsRef.current.focusDuration,
      isRunning: false,
      currentRound: 1,
      totalRounds: settingsRef.current.roundsBeforeLongBreak,
    });
  }, []);

  const skip = useCallback(() => {
    isRunningRef.current = false;
    setState(prev => {
      const s = settingsRef.current;
      let nextP: TimerPhase;
      let nextRound: number;
      if (prev.phase === 'focus') {
        if (prev.currentRound >= s.roundsBeforeLongBreak) { nextP = 'long-break'; nextRound = 1; }
        else { nextP = 'short-break'; nextRound = prev.currentRound; }
      } else if (prev.phase === 'short-break') {
        nextP = 'focus'; nextRound = prev.currentRound + 1;
      } else {
        nextP = 'focus'; nextRound = 1;
      }
      return { ...prev, phase: nextP, timeLeft: getDuration(nextP, s), isRunning: false, currentRound: nextRound };
    });
  }, [getDuration]);

  const updateSettings = useCallback((partial: Partial<PomodoroSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      if (!isRunningRef.current) {
        setState(s => ({ ...s, timeLeft: getDuration(s.phase, next), totalRounds: next.roundsBeforeLongBreak }));
      }
      return next;
    });
  }, [setSettings, getDuration]);

  const progress = 1 - state.timeLeft / getDuration(state.phase);

  return { ...state, settings, progress, start, pause, reset, skip, updateSettings };
}
