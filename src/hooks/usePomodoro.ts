import { useState, useRef, useCallback, useEffect } from 'react';
import type { TimerPhase, PomodoroSettings } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { playDefaultNotification } from '../utils/notificationSound';

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  roundsBeforeLongBreak: 4,
  notificationSound: '',
  backgroundImage: '',
  autoLoop: false,
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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifAudioRef = useRef<HTMLAudioElement | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const getDuration = useCallback((phase: TimerPhase, s = settings) => {
    switch (phase) {
      case 'focus': return s.focusDuration;
      case 'short-break': return s.shortBreakDuration;
      case 'long-break': return s.longBreakDuration;
    }
  }, [settings]);

  const nextPhase = useCallback((currentPhase: TimerPhase, round: number, s = settings): { phase: TimerPhase; nextRound: number } => {
    if (currentPhase === 'focus') {
      if (round >= s.roundsBeforeLongBreak) return { phase: 'long-break', nextRound: 1 };
      return { phase: 'short-break', nextRound: round };
    }
    if (currentPhase === 'short-break') return { phase: 'focus', nextRound: round + 1 };
    return { phase: 'focus', nextRound: 1 };
  }, [settings]);

  const playNotification = useCallback(() => {
    const s = settingsRef.current;
    if (s.notificationSound) {
      try {
        if (notifAudioRef.current) {
          notifAudioRef.current.pause();
          notifAudioRef.current.currentTime = 0;
        }
        const audio = new Audio(s.notificationSound);
        audio.volume = 0.6;
        audio.play().catch(() => {});
        notifAudioRef.current = audio;
      } catch { /* ignore */ }
    } else {
      playDefaultNotification();
    }
  }, []);

  useEffect(() => {
    if (!state.isRunning) return;

    intervalRef.current = setInterval(() => {
      setState(prev => {
        if (prev.timeLeft <= 1) {
          playNotification();
          const s = settingsRef.current;
          const { phase: nextP, nextRound } = nextPhase(prev.phase, prev.currentRound, s);
          const nextDuration = getDuration(nextP, s);
          return {
            ...prev,
            phase: nextP,
            timeLeft: nextDuration,
            isRunning: s.autoLoop,
            currentRound: nextRound,
          };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return clearTimer;
  }, [state.isRunning, clearTimer, nextPhase, getDuration, playNotification]);

  const start = useCallback(() => {
    setState(prev => ({ ...prev, isRunning: true }));
  }, []);

  const pause = useCallback(() => {
    clearTimer();
    setState(prev => ({ ...prev, isRunning: false }));
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setState({
      phase: 'focus',
      timeLeft: settings.focusDuration,
      isRunning: false,
      currentRound: 1,
      totalRounds: settings.roundsBeforeLongBreak,
    });
  }, [clearTimer, settings.focusDuration, settings.roundsBeforeLongBreak]);

  const skip = useCallback(() => {
    clearTimer();
    setState(prev => {
      const { phase: nextP, nextRound } = nextPhase(prev.phase, prev.currentRound);
      return {
        ...prev,
        phase: nextP,
        timeLeft: getDuration(nextP),
        isRunning: false,
        currentRound: nextRound,
      };
    });
  }, [clearTimer, nextPhase, getDuration]);

  const updateSettings = useCallback((partial: Partial<PomodoroSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      if (!state.isRunning) {
        setState(s => ({
          ...s,
          timeLeft: getDuration(s.phase, next),
          totalRounds: next.roundsBeforeLongBreak,
        }));
      }
      return next;
    });
  }, [setSettings, state.isRunning, getDuration]);

  const progress = 1 - state.timeLeft / getDuration(state.phase);

  return { ...state, settings, progress, start, pause, reset, skip, updateSettings };
}
