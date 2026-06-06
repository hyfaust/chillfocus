# ChillFocus — 项目架构与技术文档

## 项目概述

ChillFocus 是一款 Web 端专注力助手应用，采用现代简约 / Lo-fi 风格。核心功能包括番茄钟、音乐播放器、环境音、任务管理和便签。

**在线运行**：`npm run dev` → `http://localhost:5173/`

---

## 技术栈

| 层面 | 技术 | 用途 |
|------|------|------|
| 框架 | React 18 + TypeScript | 组件化开发，类型安全 |
| 构建 | Vite 8 | 快速 HMR，ESM 原生支持 |
| 样式 | CSS Modules | 样式隔离，避免全局污染 |
| 音频 | Web Audio API | 白噪音合成、音频可视化（AnalyserNode） |
| 渲染 | Canvas API | 音频频谱条动画，60fps |
| 存储 | localStorage | 所有用户数据持久化 |

---

## 项目结构

```
chillfocus/
├── index.html                    # 入口 HTML
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
├── package.json                  # 依赖与脚本
├── public/
│   └── sounds/                   # ChillPulse 真实环境音文件
│       ├── rain.ogg
│       ├── fireplace.ogg
│       ├── forest.ogg
│       └── wind.ogg
└── src/
    ├── main.tsx                  # React 入口
    ├── App.tsx                   # 根组件，组合所有模块
    ├── App.css                   # 全局布局样式
    ├── index.css                 # CSS 变量、暗色主题
    ├── types/
    │   └── index.ts              # 全局类型定义
    ├── utils/
    │   ├── timeUtils.ts          # 时间格式化、ID 生成
    │   ├── notificationSound.ts  # Web Audio API 合成提示音
    │   └── noiseGenerator.ts     # 白噪音合成（已弃用，保留备用）
    ├── hooks/
    │   ├── usePomodoro.ts        # 番茄钟状态机
    │   ├── useAudioPlayer.ts     # 音频播放核心逻辑
    │   ├── useAudioVisualizer.ts # 频谱可视化 hook
    │   └── useLocalStorage.ts    # localStorage 通用 hook
    └── components/
        ├── PomodoroTimer.tsx      # 番茄钟 UI（进度环 + 控制）
        ├── GradientBackground.tsx # 随时间变化的渐变色背景
        ├── AudioVisualizer.tsx    # Canvas 频谱可视化
        ├── PomodoroSettings.tsx   # 番茄钟设置面板
        ├── ImageCropper.tsx       # 背景图片裁剪器
        ├── MusicPlayer.tsx        # 音乐播放器（多列表 + 控制）
        ├── AmbientSounds.tsx      # 环境音面板
        ├── TaskManager.tsx        # 任务管理面板
        └── StickyNotes.tsx        # 浮动便签系统
```

---

## 核心模块架构

### 1. 番茄钟（PomodoroTimer）

#### 状态管理：`usePomodoro` hook

```
状态机:  focus → short-break → focus → ... → long-break → focus
              ↑                                    ↑
         每轮结束                              4轮后
```

**核心状态**：
- `phase`: 当前阶段（focus / short-break / long-break）
- `timeLeft`: 剩余秒数
- `isRunning`: 是否正在计时
- `currentRound`: 当前轮次
- `settings`: 用户配置（持久化到 localStorage）

**关键实现**：
- 使用 `setInterval` 驱动倒计时，每秒更新 `timeLeft`
- 阶段切换时播放提示音（默认 Web Audio 合成 / 自定义音频）
- `autoLoop` 模式：阶段结束后自动开始下一阶段，不暂停
- 设置变更时实时更新当前计时（如果未在运行）

#### 渐变背景：`GradientBackground`

使用 CSS `radial-gradient` + `lerpColor` 线性插值，根据 `progress`（0→1）在起始色和结束色之间平滑过渡：

| 阶段 | 起始色系 | 结束色系 |
|------|---------|---------|
| 专注 | 冷蓝紫 #1a1a2e | 暖橙红 #ff6b6b |
| 短休息 | 深青 #0f3443 | 薄荷绿 #a3e4d7 |
| 长休息 | 深绿 #1b4332 | 浅绿 #d8f3dc |

#### 进度环

SVG 圆环，通过 `stroke-dasharray` 和 `stroke-dashoffset` 控制进度。圆心显示时间和轮数。

#### 音频可视化

可视化组件定位为 `.container` 的直接子元素（非 `.content`），使用 `position: absolute; bottom: 0; height: 62%` 确保始终从容器底部开始，不受内容布局影响。

---

### 2. 音乐播放器（MusicPlayer）

#### 状态管理：`useAudioPlayer` hook

**核心状态**：
- `playlists`: 播放列表数组
- `activePlaylistId`: 当前激活列表
- `currentTrack`: 当前播放曲目
- `playMode`: 播放模式
- `playTimer`: 定时播放状态

**播放模式**：

| 模式 | 图标 | 行为 |
|------|------|------|
| `sequential` | ↻ | 顺序播放，到末尾停止 |
| `loop-list` | 🔁 | 列表循环 |
| `loop-single` | 🔂 | 单曲循环（audio.loop） |
| `shuffle` | ⤮ | 随机播放（洗牌索引） |
| `single` | 1️⃣ | 单曲播放，播完停止 |

**自动播放实现**：

`audio` 元素的 `ended` 事件监听器中直接操作音频元素：
```
onEnded → 查找下一首 → audio.src = nextTrack.url → audio.play()
```
不依赖 setState 后的渲染周期，确保无缝衔接。

**Shuffle 实现**：
- 生成洗牌索引数组（Fisher-Yates 洗牌算法）
- 切换到 shuffle 模式时，将当前曲目交换到索引 0
- 维护 `shuffleIndex` 指针

**定时播放**：
- `setInterval` 每秒倒计时
- `waitForTrackEnd` 模式：计时结束后等待当前曲目播放完毕再停止
- 使用 `stateRef` 持有最新状态，避免闭包陈旧值

**文件存储策略**：
- 本地文件通过 `FileReader.readAsDataURL` 转为 base64 data URL
- 导出时保留 data URL，移除 blob URL 和 filePath
- 导入时 data URL 可直接作为音频源播放
- `sourceFileName` 作为备用匹配键，支持 `reassociateFiles` 重关联

**导入/导出格式**（JSON）：
```json
{
  "version": 2,
  "type": "chillfocus-playlist",
  "playlist": {
    "id": "...",
    "name": "我的播放列表",
    "tracks": [
      {
        "name": "歌曲名",
        "url": "data:audio/mpeg;base64,AAAA...",
        "sourceFileName": "song.mp3",
        "duration": 180.5
      }
    ]
  }
}
```

---

### 3. 音频可视化（AudioVisualizer）

#### 数据流

```
HTMLAudioElement
    ↓
MediaElementAudioSourceNode
    ↓
AnalyserNode (fftSize=256, smoothingTimeConstant=0.8)
    ↓
getByteFrequencyData() → 128 个频率 bin (0-255)
    ↓
Canvas 绘制 64 根频谱条
```

#### 渲染逻辑

- `requestAnimationFrame` 驱动 60fps 渲染
- 每根频谱条高度 = `dataArray[i * step] / 255 * canvasHeight`
- 颜色从底部到顶部线性渐变，颜色随番茄钟阶段变化
- 使用 `roundRect` 绘制圆角矩形

#### 空闲态

无音频播放时，用 `Math.sin(Date.now()/3000 + i*0.15)` 生成微弱波浪动画。

#### HiDPI 支持

Canvas 尺寸乘以 `devicePixelRatio`，CSS 尺寸保持不变，通过 `ctx.scale()` 缩放。

---

### 4. 环境音（AmbientSounds）

#### 音频源

| 类型 | 来源 | 实现 |
|------|------|------|
| 预设（雨声/壁炉/森林/风声） | ChillPulse 真实音频文件 | `<audio>` 元素，`loop: true` |
| 自定义 | 本地上传 / URL 导入 | 同上 |

#### 循环保障

```javascript
audio.loop = true;
audio.addEventListener('ended', () => {
  audio.currentTime = 0;
  audio.play();
});
```

双重保障：`loop` 属性 + `ended` 事件兜底。

#### 混合播放

每个环境音独立的 `<audio>` 元素和 `GainNode`，可同时播放多种环境音并独立控制音量。

---

### 5. 任务管理（TaskManager）

#### 数据结构

```typescript
interface Task {
  id: string;
  text: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  createdAt: number;
}
```

#### 功能

- 添加、编辑（双击）、删除、勾选完成
- 优先级切换（点击圆点，循环 high → medium → low）
- 按完成状态和优先级排序
- `localStorage` 持久化

---

### 6. 便签系统（StickyNotes）

#### 设计方案

- **浮动层**：`position: fixed; inset: 0; pointer-events: none`，不阻挡其他模块交互
- **单个便签**：`pointer-events: auto`，可正常操作
- **图标**：左下角固定图标，拖拽到任意位置创建便签
- **显隐切换**：有便签时单击图标切换所有便签的显示/隐藏

#### 拖拽创建

```
图标 dragStart → 设置 dataTransfer → document drop → 获取坐标 → 创建便签
```

#### 拖拽移动

`mousedown` 记录起始位置，`mousemove` 计算偏移更新坐标，`mouseup` 移除监听器。

#### 拉伸

专用 resize 手柄（右下角），`e.stopPropagation()` 阻止冒泡到拖拽处理器。

#### 数据持久化

便签的 `x, y, w, h, text, color` 全部存储在 localStorage。

---

## 全局类型定义

```typescript
// 播放模式
type PlayMode = 'sequential' | 'loop-list' | 'loop-single' | 'shuffle' | 'single';

// 番茄钟阶段
type TimerPhase = 'focus' | 'short-break' | 'long-break';

// 曲目
interface Track {
  id: string;
  name: string;
  url: string;           // blob URL / data URL / 网络 URL
  filePath?: string;      // Electron 环境下的文件路径
  sourceFileName?: string; // 原始文件名，用于重关联
  duration: number;
}

// 播放列表
interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

// 番茄钟设置
interface PomodoroSettings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  roundsBeforeLongBreak: number;
  notificationSound: string;   // data URL 或 空（使用默认）
  backgroundImage: string;     // data URL 或 空
  autoLoop: boolean;
  hideTimeDisplay: boolean;
  hideVisualization: boolean;
}

// 定时播放
interface PlayTimer {
  duration: number;
  remaining: number;
  waitForTrackEnd: boolean;
  active: boolean;
}
```

---

## 样式架构

### CSS 变量系统

```css
:root {
  --bg-main: #0f0f1a;           /* 主背景 */
  --bg-card: rgba(255,255,255,0.04); /* 卡片背景 */
  --border: rgba(255,255,255,0.08);  /* 边框 */
  --accent: #7c5dfa;            /* 主题色 */
  --text-primary: rgba(255,255,255,0.9);
  --text-secondary: rgba(255,255,255,0.45);
}
```

### 布局

```
┌──────────────────────────────────────┐
│  Header (logo)                       │
├──────────────────────────────────────┤
│  PomodoroTimer (320px 固定高度)       │
│  ├ GradientBackground (absolute)     │
│  ├ SettingsBtn (absolute top-right)  │
│  ├ Content (centered)                │
│  │  ├ PhaseLabel                     │
│  │  ├ ProgressRing                   │
│  │  └ Controls                       │
│  └ AudioVisualizer (absolute 62%)    │
├──────────────────┬───────────────────┤
│  TaskManager     │  MusicPlayer      │
│  (280px, 640px)  │  (flex, 640px)    │
│                  │  ├ PlaylistTabs   │
│                  │  ├ NowPlaying     │
│                  │  ├ Controls       │
│                  │  ├ TrackList      │
│                  │  ├ AmbientSounds  │
│                  └───────────────────┤
├──────────────────────────────────────┤
│  StickyNotes (fixed overlay)         │
│  StickyNotesIcon (fixed bottom-left) │
└──────────────────────────────────────┘
```

### 响应式

- `max-width: 768px`：底部面板改为单列布局
- 番茄钟容器高度从 320px 降为 280px
- 进度环从 200px 降为 160px

---

## 数据持久化

所有用户数据通过 `useLocalStorage` hook 存储在浏览器 localStorage 中：

| Key | 数据 | 说明 |
|-----|------|------|
| `chillfocus-tasks` | Task[] | 任务列表 |
| `chillfocus-notes` | StickyNote[] | 便签（含位置、大小、颜色） |
| `chillfocus-pomodoro-settings` | PomodoroSettings | 番茄钟配置 |

播放列表数据存储在组件 state 中（含 data URL），刷新页面后需要重新添加。

---

## 开发命令

```bash
npm run dev      # 启动开发服务器 (http://localhost:5173/)
npm run build    # TypeScript 检查 + Vite 生产构建
npm run lint     # ESLint 检查
npm run preview  # 预览生产构建
```

---

## 已知限制

1. **大文件内存**：本地音乐以 data URL (base64) 存储在 state 中，大量大文件可能导致内存压力
2. **播放列表持久化**：刷新页面后播放列表丢失（data URL 在 state 中，未写入 localStorage）
3. **浏览器兼容**：`roundRect` 需要较新浏览器；OGG 格式在 Safari 中可能不支持
4. **提示音**：默认提示音使用 Web Audio API 合成，需要用户交互后才能播放（浏览器 autoplay 策略）
