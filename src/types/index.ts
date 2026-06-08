export interface Track {
  id: string;
  name: string;
  url: string;
  fileKey?: string;
  filePath?: string;
  sourceFileName?: string;
  duration: number;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

export type PlayMode = 'sequential' | 'loop-list' | 'loop-single' | 'shuffle' | 'single';

export type TimerPhase = 'focus' | 'short-break' | 'long-break';

export interface PomodoroSettings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  roundsBeforeLongBreak: number;
  notificationSound: string;
  breakNotificationSound: string;
  backgroundImage: string;
  autoLoop: boolean;
  hideTimeDisplay: boolean;
  hideVisualization: boolean;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  color: string;
  createdAt: number;
}

export interface PlayTimer {
  duration: number;
  remaining: number;
  waitForTrackEnd: boolean;
  active: boolean;
}
