import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { isTauri } from '../utils/tauriFileAccess';
import styles from './GlobalSettings.module.css';

export interface ShortcutConfig {
  togglePomodoro: string;
  toggleMusic: string;
  nextTrack: string;
  volumeUp: string;
  volumeDown: string;
}

export interface GlobalSettingsData {
  minimizeToTray: boolean;
  localShortcuts: ShortcutConfig;
  globalShortcuts: ShortcutConfig;
  globalShortcutsEnabled: boolean;
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  togglePomodoro: 'Space',
  toggleMusic: 'm',
  nextTrack: 'n',
  volumeUp: 'ArrowUp',
  volumeDown: 'ArrowDown',
};

const DEFAULT_SETTINGS: GlobalSettingsData = {
  minimizeToTray: false,
  localShortcuts: { ...DEFAULT_SHORTCUTS },
  globalShortcuts: { ...DEFAULT_SHORTCUTS },
  globalShortcutsEnabled: false,
};

interface Props {
  onClose: () => void;
  onTogglePomodoro: () => void;
  onToggleMusic: () => void;
  onNextTrack: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
}

export default function GlobalSettings({
  onClose,
  onTogglePomodoro,
  onToggleMusic,
  onNextTrack,
  onVolumeUp,
  onVolumeDown,
}: Props) {
  const [settings, setSettings] = useLocalStorage<GlobalSettingsData>('chillfocus-global-settings', DEFAULT_SETTINGS);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isTauriEnv, setIsTauriEnv] = useState(false);

  useEffect(() => {
    isTauri().then(setIsTauriEnv);
  }, []);

  // Apply minimizeToTray to Tauri backend
  useEffect(() => {
    if (!isTauriEnv) return;
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('set_minimize_to_tray', { enabled: settings.minimizeToTray });
    });
  }, [settings.minimizeToTray, isTauriEnv]);

  // Local shortcuts
  useEffect(() => {
    const actionMap: Record<string, () => void> = {
      togglePomodoro: onTogglePomodoro,
      toggleMusic: onToggleMusic,
      nextTrack: onNextTrack,
      volumeUp: onVolumeUp,
      volumeDown: onVolumeDown,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key;
      for (const [action, shortcut] of Object.entries(settings.localShortcuts)) {
        if (key === shortcut || (e.code === shortcut)) {
          e.preventDefault();
          actionMap[action]?.();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.localShortcuts, onTogglePomodoro, onToggleMusic, onNextTrack, onVolumeUp, onVolumeDown]);

  // Global shortcuts (Tauri only)
  useEffect(() => {
    if (!isTauriEnv || !settings.globalShortcutsEnabled) return;

    let mounted = true;
    const setup = async () => {
      const { register, unregister } = await import('@tauri-apps/plugin-global-shortcut');

      if (!mounted) return;

      const actionMap: Record<string, () => void> = {
        togglePomodoro: onTogglePomodoro,
        toggleMusic: onToggleMusic,
        nextTrack: onNextTrack,
        volumeUp: onVolumeUp,
        volumeDown: onVolumeDown,
      };

      for (const [action, shortcut] of Object.entries(settings.globalShortcuts)) {
        try {
          await unregister(shortcut);
          await register(shortcut, () => {
            actionMap[action]?.();
          });
        } catch { /* shortcut may conflict */ }
      }
    };
    setup();

    return () => {
      mounted = false;
      import('@tauri-apps/plugin-global-shortcut').then(({ unregister }) => {
        for (const shortcut of Object.values(settings.globalShortcuts)) {
          unregister(shortcut).catch(() => {});
        }
      });
    };
  }, [isTauriEnv, settings.globalShortcutsEnabled, settings.globalShortcuts, onTogglePomodoro, onToggleMusic, onNextTrack, onVolumeUp, onVolumeDown]);

  const updateSetting = useCallback(<K extends keyof GlobalSettingsData>(key: K, value: GlobalSettingsData[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, [setSettings]);

  const updateLocalShortcut = useCallback((action: keyof ShortcutConfig, key: string) => {
    setSettings(prev => ({
      ...prev,
      localShortcuts: { ...prev.localShortcuts, [action]: key },
    }));
  }, [setSettings]);

  const updateGlobalShortcut = useCallback((action: keyof ShortcutConfig, key: string) => {
    setSettings(prev => ({
      ...prev,
      globalShortcuts: { ...prev.globalShortcuts, [action]: key },
    }));
  }, [setSettings]);

  const handleForceQuit = useCallback(async () => {
    if (isTauriEnv) {
      const { invoke } = await import('@tauri-apps/api/core');
      invoke('force_quit');
    } else {
      window.close();
    }
  }, [isTauriEnv]);

  const handleKeyCapture = (action: string, scope: 'local' | 'global', e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const key = e.key === ' ' ? 'Space' : e.key;
    if (scope === 'local') updateLocalShortcut(action as keyof ShortcutConfig, key);
    else updateGlobalShortcut(action as keyof ShortcutConfig, key);
    setEditingKey(null);
  };

  const shortcutLabels: Record<keyof ShortcutConfig, string> = {
    togglePomodoro: '暂停/继续番茄钟',
    toggleMusic: '暂停/继续音乐',
    nextTrack: '下一首',
    volumeUp: '增大音量',
    volumeDown: '减小音量',
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>⚙ 设置</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Minimize to tray */}
        {isTauriEnv && (
          <div className={styles.section}>
            <label className={styles.toggleLabel}>
              <span>关闭时最小化到托盘</span>
              <span className={styles.toggleDesc}>点击关闭按钮隐藏到系统托盘而非退出</span>
            </label>
            <button
              className={`${styles.toggle} ${settings.minimizeToTray ? styles.toggleOn : ''}`}
              onClick={() => updateSetting('minimizeToTray', !settings.minimizeToTray)}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
        )}

        {/* Force quit */}
        <div className={styles.section}>
          <button className={styles.quitBtn} onClick={handleForceQuit}>
            退出程序
          </button>
        </div>

        {/* Local shortcuts */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>局部快捷键</h4>
          <p className={styles.sectionDesc}>应用内生效</p>
          {Object.entries(shortcutLabels).map(([action, label]) => (
            <div key={action} className={styles.shortcutRow}>
              <span className={styles.shortcutLabel}>{label}</span>
              <button
                className={`${styles.shortcutKey} ${editingKey === `local-${action}` ? styles.shortcutKeyEditing : ''}`}
                onClick={() => setEditingKey(`local-${action}`)}
                onKeyDown={editingKey === `local-${action}` ? (e) => handleKeyCapture(action, 'local', e) : undefined}
                tabIndex={0}
              >
                {editingKey === `local-${action}` ? '按下按键...' : settings.localShortcuts[action as keyof ShortcutConfig]}
              </button>
            </div>
          ))}
        </div>

        {/* Global shortcuts */}
        {isTauriEnv && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h4 className={styles.sectionTitle}>全局快捷键</h4>
                <p className={styles.sectionDesc}>系统级生效，需手动启用</p>
              </div>
              <button
                className={`${styles.toggle} ${settings.globalShortcutsEnabled ? styles.toggleOn : ''}`}
                onClick={() => updateSetting('globalShortcutsEnabled', !settings.globalShortcutsEnabled)}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
            {settings.globalShortcutsEnabled && Object.entries(shortcutLabels).map(([action, label]) => (
              <div key={action} className={styles.shortcutRow}>
                <span className={styles.shortcutLabel}>{label}</span>
                <button
                  className={`${styles.shortcutKey} ${editingKey === `global-${action}` ? styles.shortcutKeyEditing : ''}`}
                  onClick={() => setEditingKey(`global-${action}`)}
                  onKeyDown={editingKey === `global-${action}` ? (e) => handleKeyCapture(action, 'global', e) : undefined}
                  tabIndex={0}
                >
                  {editingKey === `global-${action}` ? '按下按键...' : settings.globalShortcuts[action as keyof ShortcutConfig]}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
