import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { isTauri } from '../utils/tauriFileAccess';
import styles from './GlobalSettings.module.css';

export interface ShortcutConfig {
  togglePomodoro: string;
  toggleMusic: string;
  nextTrack: string;
  prevTrack: string;
  volumeUp: string;
  volumeDown: string;
  showWindow: string;
  toggleAmbient: string;
  skipPomodoro: string;
  resetPomodoro: string;
  setModeSequential: string;
  setModeLoopList: string;
  setModeLoopSingle: string;
  setModeShuffle: string;
  setModeSingle: string;
}

export interface GlobalSettingsData {
  minimizeToTray: boolean;
  saveWindowSize: boolean;
  launchAtStartup: boolean;
  startMinimizedToTray: boolean;
  autoCheckUpdate: boolean;
  localShortcuts: ShortcutConfig;
  globalShortcuts: ShortcutConfig;
  globalShortcutsEnabled: boolean;
}

const EMPTY_SHORTCUTS: ShortcutConfig = {
  togglePomodoro: '', toggleMusic: '', nextTrack: '', prevTrack: '',
  volumeUp: '', volumeDown: '', showWindow: '', toggleAmbient: '',
  skipPomodoro: '', resetPomodoro: '',
  setModeSequential: '', setModeLoopList: '', setModeLoopSingle: '', setModeShuffle: '', setModeSingle: '',
};

const DEFAULT_LOCAL_SHORTCUTS: ShortcutConfig = {
  togglePomodoro: 'Space', toggleMusic: 'm', nextTrack: 'n', prevTrack: 'p',
  volumeUp: 'ArrowUp', volumeDown: 'ArrowDown', showWindow: '', toggleAmbient: 'b',
  skipPomodoro: '', resetPomodoro: '',
  setModeSequential: '', setModeLoopList: '', setModeLoopSingle: '', setModeShuffle: '', setModeSingle: '',
};

const DEFAULT_SETTINGS: GlobalSettingsData = {
  minimizeToTray: false,
  saveWindowSize: false,
  launchAtStartup: false,
  startMinimizedToTray: false,
  autoCheckUpdate: true,
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

const shortcutLabels: Record<keyof ShortcutConfig, string> = {
  togglePomodoro: '暂停/继续番茄钟',
  toggleMusic: '暂停/继续音乐',
  nextTrack: '下一首',
  prevTrack: '上一首',
  volumeUp: '增大音量',
  volumeDown: '减小音量',
  showWindow: '显示/隐藏主界面',
  toggleAmbient: '暂停/继续环境音',
  skipPomodoro: '跳过番茄钟',
  resetPomodoro: '重置番茄钟',
  setModeSequential: '切换-顺序播放',
  setModeLoopList: '切换-列表循环',
  setModeLoopSingle: '切换-单曲循环',
  setModeShuffle: '切换-随机播放',
  setModeSingle: '切换-单曲播放',
};

// Default visible actions (always shown)
const defaultActions: (keyof ShortcutConfig)[] = [
  'togglePomodoro', 'toggleMusic', 'nextTrack', 'volumeUp', 'volumeDown', 'showWindow',
];

// Actions that can be added via "+"
const addableActions: (keyof ShortcutConfig)[] = [
  'prevTrack', 'toggleAmbient', 'skipPomodoro', 'resetPomodoro',
  'setModeSequential', 'setModeLoopList', 'setModeLoopSingle', 'setModeShuffle', 'setModeSingle',
];

export default function GlobalSettings({ onClose }: Props) {
  const [settings, setSettings] = useLocalStorage<GlobalSettingsData>('chillfocus-global-settings', DEFAULT_SETTINGS);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isTauriEnv, setIsTauriEnv] = useState(false);
  const [addedActions, setAddedActions] = useState<(keyof ShortcutConfig)[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'found' | 'up-to-date' | 'error'>('idle');
  const [latestVersion, setLatestVersion] = useState('');
  const [releaseUrl, setReleaseUrl] = useState('');

  const CURRENT_VERSION = '1.2.0';

  const checkForUpdates = useCallback(async () => {
    setUpdateStatus('checking');
    try {
      const resp = await fetch('https://api.github.com/repos/hyfaust/chillfocus/releases/latest');
      if (!resp.ok) throw new Error('Failed to fetch');
      const data = await resp.json();
      const tag = data.tag_name?.replace(/^v/, '') || '';
      const url = data.html_url || 'https://github.com/hyfaust/chillfocus/releases';
      setLatestVersion(tag);
      setReleaseUrl(url);
      if (tag && tag !== CURRENT_VERSION) {
        setUpdateStatus('found');
      } else {
        setUpdateStatus('up-to-date');
      }
    } catch {
      setUpdateStatus('error');
    }
  }, []);

  useEffect(() => { isTauri().then(setIsTauriEnv); }, []);

  useEffect(() => {
    if (!isTauriEnv) return;
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('set_minimize_to_tray', { enabled: settings.minimizeToTray });
    });
  }, [settings.minimizeToTray, isTauriEnv]);

  useEffect(() => {
    if (!isTauriEnv) return;
    import('@tauri-apps/plugin-autostart').then(({ enable, disable }) => {
      if (settings.launchAtStartup) {
        enable();
        import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_autostart_flag', { enable: true }));
      } else {
        disable();
        import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_autostart_flag', { enable: false }));
      }
    });
  }, [settings.launchAtStartup, isTauriEnv]);

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
    if (e.key === 'Escape') { setEditingKey(null); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (scope === 'local') updateLocalShortcut(action as keyof ShortcutConfig, '');
      else updateGlobalShortcut(action as keyof ShortcutConfig, '');
      setEditingKey(null);
      return;
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    const combo = formatKeyCombo(e.nativeEvent);
    if (scope === 'local') updateLocalShortcut(action as keyof ShortcutConfig, combo);
    else updateGlobalShortcut(action as keyof ShortcutConfig, combo);
    setEditingKey(null);
  };

  const visibleActions = [...defaultActions, ...addedActions];
  const remainingAddable = addableActions.filter(a => !addedActions.includes(a));

  const renderShortcutRow = (action: keyof ShortcutConfig) => {
    const label = shortcutLabels[action];
    const localCombo = settings.localShortcuts[action];
    const globalCombo = settings.globalShortcuts[action];
    const localEditId = `local-${action}`;
    const globalEditId = `global-${action}`;
    const isLocalEditing = editingKey === localEditId;
    const isGlobalEditing = editingKey === globalEditId;
    const isShowWindow = action === 'showWindow';

    return (
      <div key={action} className={styles.shortcutRow}>
        <span className={styles.shortcutLabel}>{label}</span>
        <div className={styles.shortcutBtns}>
          {isShowWindow ? (
            <span className={styles.shortcutPlaceholder}>\</span>
          ) : (
            <button
              className={`${styles.shortcutKey} ${isLocalEditing ? styles.shortcutKeyEditing : ''}`}
              onClick={() => setEditingKey(localEditId)}
              onKeyDown={isLocalEditing ? (e) => handleKeyCapture(action, 'local', e) : undefined}
              onBlur={() => { if (isLocalEditing) setEditingKey(null); }}
              tabIndex={0}
            >
              {isLocalEditing ? '按下按键...' : localCombo || '未设置'}
            </button>
          )}
        </div>
        <div className={styles.shortcutBtns}>
          <button
            className={`${styles.shortcutKey} ${isGlobalEditing ? styles.shortcutKeyEditing : ''}`}
            onClick={() => setEditingKey(globalEditId)}
            onKeyDown={isGlobalEditing ? (e) => handleKeyCapture(action, 'global', e) : undefined}
            onBlur={() => { if (isGlobalEditing) setEditingKey(null); }}
            tabIndex={0}
          >
            {isGlobalEditing ? '按下按键...' : globalCombo || '未设置'}
          </button>
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

        {isTauriEnv && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.toggleTitle}>关闭时最小化到托盘</span>
                <span className={styles.toggleDesc}>点击关闭按钮隐藏到系统托盘而非退出</span>
              </div>
              <button className={`${styles.toggle} ${settings.minimizeToTray ? styles.toggleOn : ''}`} onClick={() => updateSetting('minimizeToTray', !settings.minimizeToTray)}>
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        )}

        {isTauriEnv && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.toggleTitle}>记住窗口大小和位置</span>
                <span className={styles.toggleDesc}>下次启动时恢复上次关闭时的窗口大小和位置</span>
              </div>
              <button className={`${styles.toggle} ${settings.saveWindowSize ? styles.toggleOn : ''}`} onClick={() => updateSetting('saveWindowSize', !settings.saveWindowSize)}>
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        )}

        {isTauriEnv && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.toggleTitle}>开机自启动</span>
                <span className={styles.toggleDesc}>系统登录时自动启动 ChillFocus</span>
              </div>
              <button className={`${styles.toggle} ${settings.launchAtStartup ? styles.toggleOn : ''}`} onClick={() => updateSetting('launchAtStartup', !settings.launchAtStartup)}>
                <span className={styles.toggleKnob} />
              </button>
            </div>
            {settings.launchAtStartup && (
              <div className={styles.sectionHeader} style={{ marginTop: 10 }}>
                <div>
                  <span className={styles.toggleTitle} style={{ fontSize: 13, opacity: 0.8 }}>↳ 启动时隐藏到托盘</span>
                  <span className={styles.toggleDesc}>自启动后不显示窗口，直接最小化到系统托盘</span>
                </div>
                <button className={`${styles.toggle} ${settings.startMinimizedToTray ? styles.toggleOn : ''}`} onClick={() => updateSetting('startMinimizedToTray', !settings.startMinimizedToTray)}>
                  <span className={styles.toggleKnob} />
                </button>
              </div>
            )}
          </div>
        )}

        <div className={styles.section}>
          <button className={styles.quitBtn} onClick={handleForceQuit}>退出程序</button>
        </div>

        {/* Update check */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.toggleTitle}>自动检查更新</span>
              <span className={styles.toggleDesc}>启动时自动检查是否有新版本 (当前 v{CURRENT_VERSION})</span>
            </div>
            <button className={`${styles.toggle} ${settings.autoCheckUpdate ? styles.toggleOn : ''}`} onClick={() => updateSetting('autoCheckUpdate', !settings.autoCheckUpdate)}>
              <span className={styles.toggleKnob} />
            </button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button className={styles.quitBtn} style={{ flex: 'none', padding: '6px 16px' }} onClick={() => {
              if (isTauriEnv) {
                import('@tauri-apps/plugin-shell').then(({ open }) => open('https://github.com/hyfaust/chillfocus'));
              } else {
                window.open('https://github.com/hyfaust/chillfocus', '_blank');
              }
            }}>
              项目源码
            </button>
            <button className={styles.quitBtn} style={{ flex: 'none', padding: '6px 16px' }} onClick={checkForUpdates} disabled={updateStatus === 'checking'}>
              {updateStatus === 'checking' ? '检查中...' : '检查更新'}
            </button>
            {updateStatus === 'found' && (
              <span style={{ fontSize: 12, color: '#69db7c' }}>
                发现新版本 v{latestVersion} →{' '}
                <button onClick={() => {
                  if (isTauriEnv) {
                    import('@tauri-apps/plugin-shell').then(({ open }) => open(releaseUrl));
                  } else {
                    window.open(releaseUrl, '_blank');
                  }
                }} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>前往下载</button>
              </span>
            )}
            {updateStatus === 'up-to-date' && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>已是最新版本</span>
            )}
            {updateStatus === 'error' && (
              <span style={{ fontSize: 12, color: '#ff6b6b' }}>检查失败，请稍后重试</span>
            )}
          </div>
        </div>

        {/* Merged shortcuts section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h4 className={styles.sectionTitle}>快捷键</h4>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {remainingAddable.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <button className={styles.shortcutAddBtn} onClick={() => setShowAddMenu(!showAddMenu)} title="添加快捷键">+</button>
                  {showAddMenu && (
                    <div className={styles.addMenu}>
                      {remainingAddable.map(action => (
                        <button key={action} className={styles.addMenuItem} onClick={() => {
                          setAddedActions(prev => [...prev, action]);
                          setShowAddMenu(false);
                        }}>
                          {shortcutLabels[action]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {isTauriEnv && (
                <button
                  className={`${styles.toggle} ${settings.globalShortcutsEnabled ? styles.toggleOn : ''}`}
                  onClick={() => updateSetting('globalShortcutsEnabled', !settings.globalShortcutsEnabled)}
                  title="全局快捷键开关"
                >
                  <span className={styles.toggleKnob} />
                </button>
              )}
            </div>
          </div>
          <p className={styles.sectionDesc}>点击按钮后按下新按键或组合键，按 Delete 清除</p>
          {/* Column headers */}
          <div className={styles.shortcutRow} style={{ opacity: 0.5, fontSize: 11 }}>
            <span className={styles.shortcutLabel}>功能</span>
            <div className={styles.shortcutBtns}>局部</div>
            <div className={styles.shortcutBtns}>全局</div>
          </div>
          {visibleActions.map(action => renderShortcutRow(action))}
        </div>
      </div>
    </div>
  );
}
