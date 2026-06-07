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

const EMPTY_SHORTCUTS: ShortcutConfig = {
  togglePomodoro: '',
  toggleMusic: '',
  nextTrack: '',
  volumeUp: '',
  volumeDown: '',
};

const DEFAULT_LOCAL_SHORTCUTS: ShortcutConfig = {
  togglePomodoro: 'Space',
  toggleMusic: 'm',
  nextTrack: 'n',
  volumeUp: 'ArrowUp',
  volumeDown: 'ArrowDown',
};

const DEFAULT_SETTINGS: GlobalSettingsData = {
  minimizeToTray: false,
  localShortcuts: { ...DEFAULT_LOCAL_SHORTCUTS },
  globalShortcuts: { ...EMPTY_SHORTCUTS },
  globalShortcutsEnabled: false,
};

interface Props {
  onClose: () => void;
}

function formatKeyCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Super');
  const key = e.key;
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key);
  }
  return parts.join('+');
}

export default function GlobalSettings({ onClose }: Props) {
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

  // Notify App when global shortcuts change
  useEffect(() => {
    window.dispatchEvent(new Event('chillfocus-shortcuts-changed'));
  }, [settings.globalShortcuts, settings.globalShortcutsEnabled]);

  const updateSetting = useCallback(<K extends keyof GlobalSettingsData>(key: K, value: GlobalSettingsData[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, [setSettings]);

  const updateLocalShortcut = useCallback((action: keyof ShortcutConfig, combo: string) => {
    setSettings(prev => ({ ...prev, localShortcuts: { ...prev.localShortcuts, [action]: combo } }));
  }, [setSettings]);

  const updateGlobalShortcut = useCallback((action: keyof ShortcutConfig, combo: string) => {
    setSettings(prev => ({ ...prev, globalShortcuts: { ...prev.globalShortcuts, [action]: combo } }));
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
    // Escape cancels editing
    if (e.key === 'Escape') { setEditingKey(null); return; }
    // Ignore modifier-only keys — wait for the actual key in the combo
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    const combo = formatKeyCombo(e.nativeEvent);
    if (scope === 'local') updateLocalShortcut(action as keyof ShortcutConfig, combo);
    else updateGlobalShortcut(action as keyof ShortcutConfig, combo);
    setEditingKey(null);
  };

  const clearShortcut = (action: string, scope: 'local' | 'global') => {
    if (scope === 'local') updateLocalShortcut(action as keyof ShortcutConfig, '');
    else updateGlobalShortcut(action as keyof ShortcutConfig, '');
    setEditingKey(null);
  };

  const shortcutLabels: Record<keyof ShortcutConfig, string> = {
    togglePomodoro: '暂停/继续番茄钟',
    toggleMusic: '暂停/继续音乐',
    nextTrack: '下一首',
    volumeUp: '增大音量',
    volumeDown: '减小音量',
  };

  const renderShortcutRow = (action: string, label: string, scope: 'local' | 'global', combo: string) => {
    const editId = `${scope}-${action}`;
    const isEditing = editingKey === editId;
    return (
      <div key={action} className={styles.shortcutRow}>
        <span className={styles.shortcutLabel}>{label}</span>
        <div className={styles.shortcutBtns}>
          <button
            className={`${styles.shortcutKey} ${isEditing ? styles.shortcutKeyEditing : ''}`}
            onClick={() => setEditingKey(editId)}
            onKeyDown={isEditing ? (e) => handleKeyCapture(action, scope, e) : undefined}
            onBlur={() => { if (isEditing) setEditingKey(null); }}
            tabIndex={0}
          >
            {isEditing ? '按下按键...' : combo || '未设置'}
          </button>
          {combo && (
            <button className={styles.shortcutClear} onClick={() => clearShortcut(action, scope)} title="清除">×</button>
          )}
        </div>
      </div>
    );
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
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.toggleTitle}>关闭时最小化到托盘</span>
                <span className={styles.toggleDesc}>点击关闭按钮隐藏到系统托盘而非退出</span>
              </div>
              <button
                className={`${styles.toggle} ${settings.minimizeToTray ? styles.toggleOn : ''}`}
                onClick={() => updateSetting('minimizeToTray', !settings.minimizeToTray)}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        )}

        {/* Force quit */}
        <div className={styles.section}>
          <button className={styles.quitBtn} onClick={handleForceQuit}>退出程序</button>
        </div>

        {/* Local shortcuts */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>局部快捷键</h4>
          <p className={styles.sectionDesc}>应用内生效，点击按钮后按下新按键或组合键，点 × 清除</p>
          {Object.entries(shortcutLabels).map(([action, label]) =>
            renderShortcutRow(action, label, 'local', settings.localShortcuts[action as keyof ShortcutConfig])
          )}
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
            {settings.globalShortcutsEnabled && Object.entries(shortcutLabels).map(([action, label]) =>
              renderShortcutRow(action, label, 'global', settings.globalShortcuts[action as keyof ShortcutConfig])
            )}
          </div>
        )}
      </div>
    </div>
  );
}
