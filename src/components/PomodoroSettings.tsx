import { useRef, useState } from 'react';
import type { PomodoroSettings } from '../types';
import ImageCropper from './ImageCropper';
import styles from './PomodoroSettings.module.css';

interface Props {
  settings: PomodoroSettings;
  onUpdate: (partial: Partial<PomodoroSettings>) => void;
  onClose: () => void;
}

export default function PomodoroSettingsPanel({ settings, onUpdate, onClose }: Props) {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const focusAudioRef = useRef<HTMLInputElement>(null);
  const breakAudioRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    if (imgInputRef.current) imgInputRef.current.value = '';
  };

  const handleNotifSoundUpload = (key: 'notificationSound' | 'breakNotificationSound', ref: React.RefObject<HTMLInputElement | null>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onUpdate({ [key]: url });
    if (ref.current) ref.current.value = '';
  };

  const minutes = (seconds: number) => Math.floor(seconds / 60);

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.panel} onClick={e => e.stopPropagation()}>
          <div className={styles.header}>
            <h3>番茄钟设置</h3>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>

          <div className={styles.section}>
            <label className={styles.label}>
              专注时间
              <span className={styles.value}>{minutes(settings.focusDuration)} 分钟</span>
            </label>
            <input type="range" min={60} max={120 * 60} step={60} value={settings.focusDuration}
              onChange={e => onUpdate({ focusDuration: parseInt(e.target.value) })} className={styles.slider} />
          </div>

          <div className={styles.section}>
            <label className={styles.label}>
              短休息时间
              <span className={styles.value}>{minutes(settings.shortBreakDuration)} 分钟</span>
            </label>
            <input type="range" min={60} max={30 * 60} step={60} value={settings.shortBreakDuration}
              onChange={e => onUpdate({ shortBreakDuration: parseInt(e.target.value) })} className={styles.slider} />
          </div>

          <div className={styles.section}>
            <label className={styles.label}>
              长休息时间
              <span className={styles.value}>{minutes(settings.longBreakDuration)} 分钟</span>
            </label>
            <input type="range" min={60} max={60 * 60} step={60} value={settings.longBreakDuration}
              onChange={e => onUpdate({ longBreakDuration: parseInt(e.target.value) })} className={styles.slider} />
          </div>

          <div className={styles.section}>
            <label className={styles.label}>
              长休息间隔轮数
              <span className={styles.value}>{settings.roundsBeforeLongBreak} 轮</span>
            </label>
            <input type="range" min={2} max={8} step={1} value={settings.roundsBeforeLongBreak}
              onChange={e => onUpdate({ roundsBeforeLongBreak: parseInt(e.target.value) })} className={styles.slider} />
          </div>

          <div className={styles.section}>
            <label className={styles.toggleLabel}>
              <span>自动循环</span>
              <span className={styles.toggleDesc}>阶段结束后自动开始下一阶段</span>
            </label>
            <button
              className={`${styles.toggle} ${settings.autoLoop ? styles.toggleOn : ''}`}
              onClick={() => onUpdate({ autoLoop: !settings.autoLoop })}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>

          <div className={styles.section}>
            <label className={styles.toggleLabel}>
              <span>无时间显示</span>
              <span className={styles.toggleDesc}>隐藏进度环、时间和轮数</span>
            </label>
            <button
              className={`${styles.toggle} ${settings.hideTimeDisplay ? styles.toggleOn : ''}`}
              onClick={() => onUpdate({ hideTimeDisplay: !settings.hideTimeDisplay })}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>

          <div className={styles.section}>
            <label className={styles.toggleLabel}>
              <span>隐藏音频可视化</span>
              <span className={styles.toggleDesc}>不显示底部频谱动画</span>
            </label>
            <button
              className={`${styles.toggle} ${settings.hideVisualization ? styles.toggleOn : ''}`}
              onClick={() => onUpdate({ hideVisualization: !settings.hideVisualization })}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>

          <div className={styles.section}>
            <label className={styles.label}>专注结束提示音</label>
            <div className={styles.fileRow}>
              <button className={styles.fileBtn} onClick={() => focusAudioRef.current?.click()}>
                {settings.notificationSound ? '更换提示音' : '选择音频文件'}
              </button>
              {settings.notificationSound && (
                <button className={styles.clearBtn} onClick={() => onUpdate({ notificationSound: '' })}>清除</button>
              )}
              <input ref={focusAudioRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleNotifSoundUpload('notificationSound', focusAudioRef)} />
            </div>
            <span className={styles.hint}>
              {settings.notificationSound ? '已自定义' : '使用默认提示音'}
            </span>
            {settings.notificationSound && (
              <button className={styles.previewBtn} onClick={() => {
                const a = new Audio(settings.notificationSound);
                a.volume = 0.6;
                a.play().catch(() => {});
              }}>▶ 试听</button>
            )}
          </div>

          <div className={styles.section}>
            <label className={styles.label}>休息结束提示音</label>
            <div className={styles.fileRow}>
              <button className={styles.fileBtn} onClick={() => breakAudioRef.current?.click()}>
                {settings.breakNotificationSound ? '更换提示音' : '选择音频文件'}
              </button>
              {settings.breakNotificationSound && (
                <button className={styles.clearBtn} onClick={() => onUpdate({ breakNotificationSound: '' })}>清除</button>
              )}
              <input ref={breakAudioRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleNotifSoundUpload('breakNotificationSound', breakAudioRef)} />
            </div>
            <span className={styles.hint}>
              {settings.breakNotificationSound ? '已自定义' : '使用默认提示音'}
            </span>
            {settings.breakNotificationSound && (
              <button className={styles.previewBtn} onClick={() => {
                const a = new Audio(settings.breakNotificationSound);
                a.volume = 0.6;
                a.play().catch(() => {});
              }}>▶ 试听</button>
            )}
          </div>

          <div className={styles.section}>
            <label className={styles.label}>自定义背景图片</label>
            <div className={styles.fileRow}>
              <button className={styles.fileBtn} onClick={() => imgInputRef.current?.click()}>
                {settings.backgroundImage ? '更换背景' : '选择图片'}
              </button>
              {settings.backgroundImage && (
                <button className={styles.clearBtn} onClick={() => onUpdate({ backgroundImage: '' })}>清除</button>
              )}
              <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgImageUpload} />
            </div>
            {settings.backgroundImage && (
              <div className={styles.imgPreview}>
                <img src={settings.backgroundImage} alt="背景预览" />
              </div>
            )}
          </div>
        </div>
      </div>

      {cropSrc && (
        <ImageCropper
          src={cropSrc}
          onCrop={(dataUrl) => {
            onUpdate({ backgroundImage: dataUrl });
            setCropSrc(null);
          }}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </>
  );
}
