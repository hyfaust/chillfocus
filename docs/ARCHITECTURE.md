# ChillFocus — 项目架构与技术文档

## 项目概述

ChillFocus 是一款专注力助手应用，采用现代简约 / Lo-fi 风格，同时支持 **Web 端**和 **Tauri 桌面端**。核心功能包括番茄钟、音乐播放器、环境音、任务管理和便签。

- **Web 端**：`npm run dev` → `http://localhost:5173/`
- **桌面端**：`npx tauri dev` → 原生窗口（1368×912）

---

## 技术栈

| 层面 | 技术 | 用途 |
|------|------|------|
| 框架 | React 19 + TypeScript 6 | 组件化开发，类型安全 |
| 构建 | Vite 8 | 快速 HMR，ESM 原生支持 |
| 样式 | CSS Modules | 样式隔离，避免全局污染 |
| 音频 | Web Audio API | 音频可视化（AnalyserNode）、提示音合成 |
| 渲染 | Canvas API | 音频频谱条动画，60fps |
| 存储 | localStorage | 轻量元数据持久化 |
| 存储 | IndexedDB | 音频文件二进制持久化 |
| 桌面 | Tauri v2 | Rust 后端 + 系统 WebView |
| Tauri 插件 | dialog, fs, shell, log, global-shortcut, single-instance | 原生对话框、文件读取、外链跳转、日志、全局快捷键、单实例 |

---

## 项目结构

```
chillfocus/
├── index.html                    # 入口 HTML
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
├── package.json                  # 依赖与脚本
├── LICENSE                       # GPL v3 许可证
├── README.md                     # 英文文档
├── README_zh.md                  # 中文文档
├── ARCHITECTURE.md               # 本文档
├── UI-DESIGN.md                  # UI 设计详解
├── DESIGN-GLOSSARY.md            # 设计术语手册
├── public/
│   ├── favicon.svg               # 应用图标（渐变音符）
│   └── sounds/                   # 内置音频资源
│       ├── rain.ogg              # 雨声（ChillPulse）
│       ├── fireplace.ogg         # 壁炉（ChillPulse）
│       ├── forest.ogg            # 森林（ChillPulse）
│       ├── wind.ogg              # 风声（ChillPulse）
│       └── notification.mp3      # 默认阶段提示音
├── src/
│   ├── main.tsx                  # React 入口
│   ├── App.tsx                   # 根组件，组合所有模块
│   ├── App.css                   # 全局布局样式
│   ├── index.css                 # CSS 变量、暗色主题
│   ├── types/
│   │   └── index.ts              # 全局类型定义
│   ├── utils/
│   │   ├── audioStore.ts         # IndexedDB 音频文件存储封装
│   │   ├── audioFormats.ts       # 支持的音频格式白名单
│   │   ├── tauriFileAccess.ts    # Tauri 原生文件对话框 + fs 读取
│   │   ├── openUrl.ts            # Tauri shell.open 外链跳转
│   │   ├── timeUtils.ts          # 时间格式化、ID 生成
│   │   ├── notificationSound.ts  # Web Audio API 合成提示音（备用）
│   │   └── noiseGenerator.ts     # 白噪音合成（已弃用）
│   ├── hooks/
│   │   ├── usePomodoro.ts        # 番茄钟状态机（单一持久化 interval）
│   │   ├── useAudioPlayer.ts     # 音频播放核心（IndexedDB + filePath 双路径）
│   │   ├── useAudioVisualizer.ts # AnalyserNode + Canvas 频谱可视化 hook
│   │   └── useLocalStorage.ts    # localStorage 通用 hook
│   └── components/
│       ├── PomodoroTimer.tsx      # 番茄钟 UI（进度环 + 控制）
│       ├── GradientBackground.tsx # 随时间变化的渐变色背景
│       ├── AudioVisualizer.tsx    # Canvas 频谱可视化
│       ├── PomodoroSettings.tsx   # 番茄钟设置面板
│       ├── ImageCropper.tsx       # 背景图片裁剪器（3.75:1 固定比例）
│       ├── MusicPlayer.tsx        # 音乐播放器（多列表 + 控制）
│       ├── AmbientSounds.tsx      # 环境音面板
│       ├── TaskManager.tsx        # 任务管理面板
│       ├── StickyNotes.tsx        # 浮动便签系统（字体可调、可滚动）
│       └── GlobalSettings.tsx     # 全局设置（托盘、快捷键、窗口记忆）
└── src-tauri/
    ├── Cargo.toml               # Rust 依赖
    ├── tauri.conf.json           # Tauri 配置（1368×912 窗口）
    ├── capabilities/
    │   └── default.json          # 权限：dialog, fs, shell, global-shortcut, window API
    ├── src/
    │   └── lib.rs                # 注册 Tauri 插件
    └── icons/                    # 应用图标
```

---

## 双端文件访问架构

应用同时运行在浏览器和 Tauri 桌面端，文件访问路径不同但统一由 `resolveTrackUrl` 消费：

```
┌─ Web 端 ──────────────────────────────────────────────┐
│  <input type="file">                                   │
│       ↓                                                │
│  File 对象                                             │
│       ↓                                                │
│  IndexedDB 存储 (fileKey)                              │
│       ↓                                                │
│  播放时：URL.createObjectURL(file)                     │
└────────────────────────────────────────────────────────┘

┌─ Tauri 端 ────────────────────────────────────────────┐
│  dialog.open() → 文件路径字符串                         │
│       ↓                                                │
│  fs.readFile(path) → Uint8Array                        │
│       ↓                                                │
│  同时存储 IndexedDB (fileKey) + 保留 filePath           │
└────────────────────────────────────────────────────────┘

resolveTrackUrl 优先级：
  url > fileKey (IndexedDB) > filePath (Tauri fs) > 失败
```

### 关键模块

| 模块 | 职责 |
|------|------|
| `tauriFileAccess.ts` | 检测 Tauri 环境 → 调用 `dialog.open()` → `fs.readFile()` 返回 `Uint8Array` |
| `openUrl.ts` | Tauri 环境下调用 `shell.open()` 跳转外部链接（浏览器端回退 `window.open`） |
| `audioStore.ts` | IndexedDB 封装，存取音频 `File` / `Uint8Array`，按 `fileKey` 读写 |

---

## 核心模块架构

### 1. 番茄钟（PomodoroTimer）

#### 状态管理：`usePomodoro` hook

```
状态机:  focus → short-break → focus → ... → long-break → focus
              ↑                                    ↑
         每轮结束                              N轮后
```

**核心状态**：
- `phase`: 当前阶段（focus / short-break / long-break）
- `timeLeft`: 剩余秒数
- `isRunning`: 是否正在计时
- `currentRound`: 当前轮次
- `settings`: 用户配置（持久化到 localStorage）

**关键实现**：
- **单一持久化 interval**：effect 内创建一次 `setInterval`，永不重建。通过 `isRunningRef` 和 `settingsRef` 检查最新状态，避免闭包陈旧值和 effect 重建竞态
- **默认提示音**：使用 `/sounds/notification.mp3`，支持自定义上传
- **autoLoop 模式**：阶段结束后 `isRunning` 保持 `true`，自动开始下一阶段
- **hideTimeDisplay**：隐藏进度环、时间和轮数，内容靠顶部显示
- **hideVisualization**：隐藏底部频谱动画

#### 渐变背景：`GradientBackground`

使用 CSS `radial-gradient` + `lerpColor` 线性插值，根据 `progress`（0→1）在起始色和结束色之间平滑过渡：

| 阶段 | 起始色系 | 结束色系 |
|------|---------|---------|
| 专注 | 冷蓝紫 #1a1a2e | 暖橙红 #ff6b6b |
| 短休息 | 深青 #0f3443 | 薄荷绿 #a3e4d7 |
| 长休息 | 深绿 #1b4332 | 浅绿 #d8f3dc |

支持自定义背景图片，半透明叠加在渐变色上（`opacity: 0.35`）。图片通过 `ImageCropper` 组件以 3.75:1 固定比例裁剪后以 data URL 存储。

#### 进度环

SVG 圆环，`stroke-dasharray` + `stroke-dashoffset` 控制进度。圆心显示时间和轮数。`hideTimeDisplay` 模式下整个环不渲染。

#### 音频可视化

可视化组件是 `.container` 的直接子元素（非 `.content`），`position: absolute; bottom: 0; height: 62%` 确保始终从容器底部开始，不受内容布局影响。

---

### 2. 音乐播放器（MusicPlayer）

#### 状态管理：`useAudioPlayer` hook

**核心状态**：
- `playlists`: 播放列表数组（持久化到 localStorage）
- `activePlaylistId`: 当前激活列表
- `currentTrack`: 当前播放曲目
- `playMode`: 播放模式（持久化到 localStorage）
- `volume`: 音量（持久化到 localStorage）
- `playTimer`: 定时播放状态

**播放模式**：

| 模式 | 行为 |
|------|------|
| `sequential` | 顺序播放，到末尾停止 |
| `loop-list` | 列表循环 |
| `loop-single` | 单曲循环（audio.loop） |
| `shuffle` | 随机播放（Fisher-Yates 洗牌索引） |
| `single` | 单曲播放，播完停止 |

**自动播放实现**：

`audio` 元素的 `ended` 事件监听器中直接操作音频元素（不依赖 setState 渲染周期）：
```
onEnded → resolveTrackUrl → audio.src = url → audio.play()
```

#### 文件存储架构

```
localStorage (chillfocus-playlists)
└── 播放列表结构 + 曲目元数据 (name, fileKey, filePath, sourceFileName, duration)
    ↓ fileKey / filePath
IndexedDB (chillfocus-audio / files)       ← fileKey 路径
Tauri fs.readFile(path)                    ← filePath 路径
    ↓ 播放时
URL.createObjectURL(file) → audio.src
```

**懒加载**：state 中不持有 blob URL。播放时通过 `resolveTrackUrl` 按优先级（url → fileKey → filePath）解析实际资源。

**导入/导出**：
- **导出**：`sanitizeTrack` 保留 `fileKey`、`filePath`、`sourceFileName`，剥离 `url`（太大）
- **导入（同机器）**：`fileKey` 直接从 IndexedDB 恢复音频；`filePath` 在 Tauri 下可从磁盘直接读取
- **导入（跨机器）**：显示「重新关联文件夹」按钮，使用 `webkitdirectory` 递归扫描，按 `sourceFileName` 自动匹配

**Tauri 模式**：添加音乐时使用原生文件对话框（`tauriFileAccess.ts`），体验更接近桌面应用。

**定时播放**：
- `setInterval` 每秒倒计时
- `waitForTrackEnd` 模式：计时结束后等待当前曲目播放完毕再停止

---

### 3. 音频可视化（AudioVisualizer）

#### 数据流

```
HTMLAudioElement → MediaElementAudioSourceNode → AnalyserNode → destination
                                                       ↓
                                              getByteFrequencyData (128 bins)
                                                       ↓
                                              Canvas 绘制 64 根频谱条
```

- `requestAnimationFrame` 驱动 60fps
- 颜色随番茄钟阶段变化（紫红/青蓝/绿）
- 空闲态：`Math.sin()` 生成微弱波浪动画
- HiDPI：Canvas 尺寸 × `devicePixelRatio`

---

### 4. 环境音（AmbientSounds）

**音频源**：4 个 ChillPulse 真实音频文件（rain / fireplace / forest / wind）+ 自定义上传（本地文件 / URL）

**循环保障**：`audio.loop = true` + `ended` 事件兜底双重保障

**持久化**：

| 数据 | 存储 | Key |
|------|------|-----|
| 自定义音效元数据 | localStorage | `chillfocus-custom-sounds` |
| 各音效音量 | localStorage | `chillfocus-ambient-volumes` |
| 正在播放的音效 ID 数组 | localStorage | `chillfocus-ambient-active` |
| 自定义音频文件 | IndexedDB | `chillfocus-audio` / `files` |

**恢复流程**：页面加载 → 解析 IndexedDB 自定义音效 → 读取 active IDs → 自动恢复播放

---

### 5. 任务管理（TaskManager）

#### 数据结构

```typescript
interface Task {
  id: string;
  text: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  color: string;      // 8 色调色板
  createdAt: number;
}
```

- 三级优先级 + 8 色可视化分类
- 左侧 3px 彩色边框标识颜色，勾选框使用任务颜色
- 按完成状态和优先级排序
- localStorage 持久化

---

### 6. 便签系统（StickyNotes）

**单层渲染**：所有便签使用 `position: fixed`，通过 `z-index` 控制堆叠顺序。

**交互**：
- 拖拽创建、拖拽移动
- 自定义 resize 手柄（宽高均可），使用 `mousedown` / `mousemove`（非 HTML5 Drag API，兼容 Tauri WebView）
- `pointer-events: none` 不阻挡页面交互
- 颜色循环、显隐切换
- 字体大小调节（A-/A+ 按钮，8–24px）
- 内容超出容器高度时 `overflow-y: auto` 自动出现滚动条

**文本编辑**：使用受控 `<textarea>`（`value={note.text}` + `onChange`），每次按键即时更新 state 并持久化，彻底避免 resize 后文字丢失的闭包陷阱。

**持久化**：`x, y, w, h, text, color, fontSize` 全部存储在 localStorage。

---

### 7. 全局设置（GlobalSettings）

管理桌面端专属功能的配置：

| 功能 | 实现 |
|------|------|
| 最小化到托盘 | 前端启动时从 localStorage 读取，调用 `invoke('set_minimize_to_tray')` 同步到 Rust 侧 `AtomicBool` |
| 全局快捷键 | `ShortcutConfig` 定义 6 个动作；`convertToTauriShortcut()` 转换键名格式；`dispatchEvent('chillfocus-shortcuts-changed')` 通知 App 层重新注册 |
| 窗口记忆 | 监听 `onResized`/`onMoved` 防抖保存 `innerSize`/`outerPosition` 到 localStorage；启动时用 `LogicalSize`/`LogicalPosition` 恢复 |

---

## 全局类型定义

```typescript
type PlayMode = 'sequential' | 'loop-list' | 'loop-single' | 'shuffle' | 'single';
type TimerPhase = 'focus' | 'short-break' | 'long-break';

interface Track {
  id: string;
  name: string;
  url: string;             // blob URL（懒加载）/ 网络 URL
  fileKey?: string;        // IndexedDB 键
  filePath?: string;       // Tauri 文件路径
  sourceFileName?: string; // 原始文件名，用于重关联
  duration: number;
}

interface PomodoroSettings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  roundsBeforeLongBreak: number;
  notificationSound: string;       // 专注结束提示音（URL 或空=默认）
  breakNotificationSound: string;  // 休息结束提示音（URL 或空=默认）
  backgroundImage: string;         // data URL 或空
  autoLoop: boolean;
  hideTimeDisplay: boolean;
  hideVisualization: boolean;
}
```

---

## 音频格式白名单

`mp3`, `wav`, `ogg`, `flac`, `aac`, `m4a`, `opus`, `webm`, `weba`

导入时通过 `audioFormats.ts` 白名单过滤，不支持的格式被静默忽略。

---

## 数据持久化总览

| 数据 | 存储 | Key |
|------|------|-----|
| 任务列表 | localStorage | `chillfocus-tasks` |
| 便签 | localStorage | `chillfocus-notes` |
| 番茄钟设置 | localStorage | `chillfocus-pomodoro-settings` |
| 播放列表结构 | localStorage | `chillfocus-playlists` |
| 播放器偏好 | localStorage | `chillfocus-player-prefs` |
| 自定义环境音 | localStorage | `chillfocus-custom-sounds` |
| 环境音音量 | localStorage | `chillfocus-ambient-volumes` |
| 活跃环境音 | localStorage | `chillfocus-ambient-active` |
| 全局设置 | localStorage | `chillfocus-global-settings` |
| 窗口几何 | localStorage | `chillfocus-window-geometry` |
| 音频文件二进制 | IndexedDB | `chillfocus-audio` / `files` |

---

## 开发命令

```bash
# Web 端
npm run dev          # 启动开发服务器 (http://localhost:5173/)
npm run build        # TypeScript 检查 + Vite 生产构建
npm run lint         # ESLint 检查

# Tauri 桌面端
npx tauri dev        # 启动 Tauri 开发模式（编译 Rust + WebView）
npx tauri build      # Tauri 生产构建（生成安装包）
```

---

## 已知限制

| 类别 | 说明 |
|------|------|
| 浏览器兼容 | OGG 格式在 Safari 中可能不支持 |
| Autoplay 策略 | 环境音恢复播放和提示音需要用户先与页面交互 |
| IndexedDB 容量 | 音频文件以原始大小存储，大量大文件可能占用较多磁盘空间 |
| 跨机器导入 | filePath 在不同机器上失效，需手动重新关联 |
