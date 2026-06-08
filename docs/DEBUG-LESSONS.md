# ChillFocus 调试经验与开发教训

## 背景

ChillFocus 的音乐播放器需要实现播放列表的持久化——关闭应用后重新打开，之前添加的音乐仍然可以播放。这在 Web 端和 Tauri 桌面端面临完全不同的挑战。

## 第一阶段：Web 端 IndexedDB 存储

### 方案

本地文件通过 FileReader 读取后存入 IndexedDB，localStorage 保存元数据（fileKey 指向 IndexedDB）。

### 问题

- data URL (base64) 存入 state 导致 JSON.stringify 溢出
- blob URL 在页面刷新后失效

### 解决

- IndexedDB 存储原始 File 二进制，不存 data URL
- state 中 url 字段留空，播放时从 IndexedDB 按需创建 blob URL（懒加载）
- 导出时剥离所有 URL，只保留 fileKey + sourceFileName

### 教训

**永远不要将大二进制数据放入 React state 或 localStorage。IndexedDB 是浏览器端存储大对象的正确选择。**

## 第二阶段：Tauri 端 filePath 方案（失败）

### 方案

Tauri 的 `dialog.open()` 返回文件绝对路径，存入 Track.filePath。播放时用 `fs.readFile(filePath)` 从磁盘读取。

### 问题

1. `fs:read-all` 权限只启用命令，**不添加路径 scope**
2. `fs:default` 只授权 app 专用目录
3. 用户音乐文件在 `C:\Users\...\Music\` 完全没有 scope 覆盖
4. 错误被 catch 静默吞掉，调试困难（Tauri 中无法打开 F12）

### 诊断过程

创建了两个诊断按钮（FsDiagnostics、ImportDiagnostics），通过 `dialog.message()` 弹窗显示每步结果：

- ✅ Tauri modules loaded
- ❌ readFile: forbidden path

### 解决

在 capabilities/default.json 中添加 `fs:scope-home-recursive`，授权整个用户主目录的递归读取。

### 教训

1. **Tauri v2 的 fs 权限模型是"命令 + scope"双层结构。`fs:read-all` 只开放命令，scope 必须单独配置。**
2. **在无法使用 F12 的环境中，用原生弹窗（dialog.message）是最可靠的调试手段。**
3. **永远不要静默吞掉错误——至少要 console.error，最好用用户可见的方式展示。**

## 第三阶段：统一 IndexedDB 方案（最终方案）

### 决策

放弃 filePath 方案，Tauri 端也走 IndexedDB：

- `selectAudioFiles()` 通过 `fs.readFile(path)` 读取文件
- 构造 `File` 对象（`new File([data], fileName)`）
- 通过 `onAddTracks()` 存入 IndexedDB
- 重启后从 IndexedDB 读取，与 Web 端完全一致

### 为什么放弃 filePath

- fs scope 配置复杂，不同 Tauri 版本行为可能变化
- 用户移动/重命名文件后路径失效
- IndexedDB 方案更可靠，与 Web 端统一

### filePath 的保留价值

尽管不再作为主要存储，filePath 仍保留在 Track 中：

- 导出 JSON 包含 filePath
- 同机器导入时，如果 IndexedDB 数据丢失，filePath 可作为回退
- 跨机器导入时 filePath 无效，需重新关联

### resolveTrackUrl 优先级链
播放时按以下顺序尝试获取音频 URL：
1. **url 直接可用**：非 blob 的有效 URL（如网络 URL），直接使用
2. **fileKey → IndexedDB**：按 fileKey 从 IndexedDB 取出 File，创建 blob URL
3. **filePath → Tauri fs**：通过 `fs.readFile(filePath)` 从磁盘读取，创建 blob URL
4. **全部失败**：返回空字符串，播放无声

### 教训

**跨平台项目中，选择两端都支持的存储方案（IndexedDB）比依赖平台特有能力（Tauri fs）更可靠。平台特有能力作为增强而非基础。**

## 第四阶段：导出/导入的 fileKey 问题

### 问题

导出的 JSON 包含 fileKey，但 fileKey 是随机 ID，只在当前浏览器的 IndexedDB 中有意义。导入到新环境后 fileKey 找不到对应数据。

### 解决

- 导出时保留 fileKey（同机器导入可直接恢复）
- 导出时保留 filePath（Tauri 环境下可从磁盘读取）
- 导出时保留 sourceFileName（用于重新关联时按文件名匹配）
- 导入后如果 fileKey 和 filePath 都不可用，显示「重新关联文件夹」按钮

### sanitizeTrack 导出策略
导出时对每个 track 执行 `sanitizeTrack`：
- **剥离**：`url`（blob URL 临时有效，导出后无意义）
- **保留**：`fileKey`（同机器 IndexedDB 可恢复）、`filePath`（Tauri 磁盘路径）、`sourceFileName`（原始文件名，用于重新关联）、`name`、`duration`
- **导入时**：`importOne` 生成新 id，保留 fileKey 和 filePath。同机器导入时 fileKey 命中 IndexedDB 直接可用；跨机器时 filePath 作为回退（Tauri）；都不可用时需用户重新关联文件夹

### 教训

**导出数据要包含多种恢复路径（fileKey + filePath + sourceFileName），不同环境下有不同的恢复策略。**

## 关键经验总结

### 1. 存储架构选择

| 数据类型 | 推荐方案 | 避免 |
|---------|---------|------|
| 小型配置 | localStorage | — |
| 大型二进制 | IndexedDB | localStorage / React state |
| 文件路径 | 平台 API 获取 | 浏览器 File.path（非标准） |

### 2. Tauri 权限模型

```
permissions: ["fs:read-all"]           // 只启用命令
permissions: ["fs:read-all", "fs:scope-home-recursive"]  // 命令 + 路径权限
```

两者缺一不可。

### 3. 调试策略

- 浏览器端：F12 DevTools
- Tauri 端：`dialog.message()` 弹窗 + `console.error`
- 跨端问题：在两端分别用诊断按钮验证每一步

### 4. 错误处理

- 永远不要 `catch {}` 空捕获
- 至少 `catch (err) { console.error(err) }`
- 用户可见的错误展示比日志更有效

### 5. 双端兼容设计

```
Web:  <input type="file"> → File → IndexedDB
Tauri: dialog.open() → fs.readFile() → File → IndexedDB
                                        ↓
                          统一的 addTracksToPlaylist(File[], paths?)
```

共享上层逻辑，平台差异封装在底层工具函数中。

---

## 第五阶段：Tauri 全局快捷键系统

### 问题 1：`window.__TAURI__` 未定义

**现象**：全局快捷键注册代码完全不执行，`console.warn('[GS] Not Tauri env')` 在 Tauri 打包后的应用中反复输出。

**根因**：Tauri v1 使用 `window.__TAURI__` 注入 IPC 桥接，但 **Tauri v2 改为 `window.__TAURI_INTERNALS__`**。项目中所有检查 `window.__TAURI__` 的地方全部返回 `false`。

**影响范围**：
- `App.tsx` — 全局快捷键注册被跳过
- `utils/tauriFileAccess.ts` — `isTauri()` 首选路径失败（fallback 到动态 import 仍可用）
- `utils/openUrl.ts` — 外部链接打开方式回退到 `window.open`

**修复**：将所有 `(window as any).__TAURI__` 改为 `(window as any).__TAURI_INTERNALS__`。

**教训**：
> **Tauri v1 → v2 的 breaking change 之一：IPC 桥接对象从 `window.__TAURI__` 变为 `window.__TAURI_INTERNALS__`。检测 Tauri 环境应使用后者。**

### 问题 2：全局快捷键键名格式不匹配

**现象**：环境检测通过后，`register()` 调用不报错但快捷键不触发。

**分析**：Web 端 `KeyboardEvent.key` 产生的键名与 Tauri 全局快捷键插件期望的格式不同：

| Web 端 (KeyboardEvent.key) | Tauri 端 (muda accelerator) |
|---|---|
| `Space` | `space` |
| `ArrowUp` | `arrowup` |
| `Escape` | `escape` |
| `A` (单字母) | `A`（大写保留） |
| `Ctrl` | `Ctrl`（修饰键保留） |

**修复**：新增 `convertToTauriShortcut()` 函数，在注册前转换键名：

```typescript
function convertToTauriShortcut(combo: string): string {
  const parts = combo.split('+').map(s => s.trim());
  const keyMap: Record<string, string> = {
    space: 'space', arrowup: 'arrowup', arrowdown: 'arrowdown',
    arrowleft: 'arrowleft', arrowright: 'arrowright',
    escape: 'escape', enter: 'enter', backspace: 'backspace',
    delete: 'delete', tab: 'tab', home: 'home', end: 'end',
    pageup: 'pageup', pagedown: 'pagedown',
  };
  return parts.map((part, i) => {
    if (i < parts.length - 1) return part; // 修饰键保持原样
    const lower = part.toLowerCase();
    return keyMap[lower] || (part.length === 1 ? part : lower);
  }).join('+');
}
```

**教训**：
> **Web 端的 `KeyboardEvent.key` 和 Tauri 的 muda accelerator 使用不同的键名约定。非字母特殊键在 Tauri 端必须为小写（`space`、`arrowup`），单字母键保持大写（`A`）。注册全局快捷键前必须做格式转换。**

### 问题 3：快捷键按下和释放各触发一次

**现象**：每次按快捷键执行两次操作。

**根因**：Tauri 的 `register()` 回调在 `Pressed` 和 `Released` 两个状态都会触发。

**修复**：在回调中过滤状态：

```typescript
await register(tauriKey, (event) => {
  if (event.state !== 'Pressed') return;
  actionMap[action]?.();
});
```

**教训**：
> **Tauri v2 的 `ShortcutEvent` 包含 `state: 'Pressed' | 'Released'`。全局快捷键回调必须检查 `event.state`，通常只在 `'Pressed'` 时执行操作。**

### 问题 4：快捷键设置后不生效

**现象**：在设置面板中修改全局快捷键后，新快捷键不工作。

**根因**：全局快捷键在 App 组件挂载时注册一次，设置面板修改的是 localStorage，App 的 useEffect 不会重新运行。

**修复**：
1. `GlobalSettings` 在快捷键变更时 `dispatchEvent(new Event('chillfocus-shortcuts-changed'))`
2. `App` 监听该事件，递增 `shortcutVersion` state
3. 全局快捷键 useEffect 依赖 `shortcutVersion`，变更时先注销旧快捷键再注册新快捷键

**教训**：
> **同一页面内的组件间通信不能依赖 `storage` 事件（只在跨 tab 时触发）。使用自定义 DOM 事件（`dispatchEvent` / `addEventListener`）是同页面组件间通信的轻量方案。**

---

## 第六阶段：快捷键架构重构

### 问题：快捷键回调引用过时的 state

**现象**：快捷键执行的操作使用的是组件挂载时的 state 快照，而不是最新值。

**根因**：`useEffect` 的闭包捕获了当时的 `pomodoro` 和 `player` 对象。由于快捷键设置依赖数组包含这些对象，每次 state 变化都会重新注册监听器，导致频繁的 addEventListener/removeEventListener 循环。

**修复**：使用 `useRef` 模式保持回调稳定：

```typescript
const pomodoroRef = useRef(pomodoro);
pomodoroRef.current = pomodoro;
const playerRef = useRef(player);
playerRef.current = player;

// useEffect 回调中通过 ref 访问最新值
const handleKeyDown = (e: KeyboardEvent) => {
  const p = pomodoroRef.current; // 始终是最新值
  if (p.isRunning) p.pause(); else p.start();
};
```

同时将快捷键处理从 `GlobalSettings` 提升到 `App` 层级：
- 局部快捷键：每次 keydown 从 localStorage 实时读取配置，无需重新挂载监听
- 全局快捷键：在 App 层统一注册/注销

**教训**：
> **当 useEffect 回调需要访问频繁变化的值但又不想让 effect 重新运行时，使用 `useRef` + 每次 render 更新 ref 的模式。这避免了"依赖数组膨胀导致 effect 频繁重建"的问题。**

---

## 第七阶段：音频暂停/恢复

### 问题：播放按钮变成"停止/播放"而非"暂停/播放"

**现象**：点击暂停后再点击播放，音乐从头开始而不是从暂停位置恢复。

**根因**：`play()` 函数每次都重新设置 `audio.src`：

```typescript
// 问题代码
audio.src = url;  // 重新设置 src 会重置播放位置
audio.play();
```

**修复**：只在 audio 尚未加载源时才设置 src：

```typescript
if (!audio.src || audio.src === window.location.href) {
  audio.src = url;
}
audio.play();
```

**教训**：
> **HTMLAudioElement 的 `src` 属性重新赋值会重置播放状态（currentTime 归零）。暂停/恢复应只调用 `audio.play()` / `audio.pause()`，不要重新设置 src。**

---

## 第八阶段：响应式布局

### 问题：任务列表出现水平滚动条

**现象**：窗口变窄时，任务列表容器出现水平滚动条，任务项溢出。

**根因**：CSS Flexbox/Grid 布局中，子元素默认 `min-width: auto`，即不会小于内容的固有宽度。当容器变窄时，子元素（如任务项的 checkbox + 文本 + 按钮）无法收缩，导致溢出。

**修复**：

```css
.container { overflow-x: hidden; min-width: 0; }
.item { min-width: 0; }
.addRow { min-width: 0; }
.input { flex: 1; min-width: 0; }
```

同时在 `.panel` 上添加 `overflow-x: hidden`。

**教训**：
> **Flex/Grid 子元素在容器变窄时可能无法收缩，因为默认 `min-width: auto`。需要显式设置 `min-width: 0` 来允许收缩。配合 `overflow-x: hidden` 防止溢出产生滚动条。这是 CSS 布局中最常见的响应式陷阱之一。**

---

## 更新后的关键经验总结

### 1. Tauri v2 环境检测

```typescript
// ❌ Tauri v1（已废弃）
if (window.__TAURI__) { ... }

// ✅ Tauri v2
if (window.__TAURI_INTERNALS__) { ... }
```

### 2. 全局快捷键完整流程

```
用户设置快捷键（如 "Ctrl+Space"）
    ↓
GlobalSettings 写入 localStorage
    ↓
dispatchEvent('chillfocus-shortcuts-changed')
    ↓
App 监听事件 → shortcutVersion++
    ↓
useEffect 重新运行 → convertToTauriShortcut("Ctrl+Space") → "Ctrl+space"
    ↓
register("Ctrl+space", handler) → 仅 event.state === 'Pressed' 时执行
```

### 3. 组件间通信方案选择

| 场景 | 方案 |
|------|------|
| 父 → 子 | Props |
| 子 → 父 | Callback props |
| 同页面跨组件 | 自定义 DOM 事件 (`dispatchEvent`) |
| 跨 tab / 跨窗口 | `storage` 事件 |
| 全局状态 | Context / 外部 store |

### 4. React 中访问最新值的模式

| 需求 | 方案 |
|------|------|
| 回调中需要最新值但不想重建 effect | `useRef` + 每次 render 更新 |
| 事件处理器需要最新配置 | 每次触发时从 localStorage 读取 |
| 稳定的回调引用 | `useCallback` + ref 间接访问 |

### 5. CSS 响应式防溢出清单

- Flex/Grid 子元素：加 `min-width: 0`
- 容器：加 `overflow-x: hidden`
- 文本截断：`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
- 弹性宽度：`flex: 1; min-width: 0` 代替固定 `max-width`

---

## 第九阶段：便签文字保存与 Resize

### 问题：Resize 后文字丢失

**现象**：便签中输入的文字在拖拽缩放容器后丢失，退回编辑前的状态。

**根因**：使用非受控 `<textarea>`（`defaultValue` + `onBlur` 读取 `e.target.value`）。当 `updateNoteSize` 触发 `setNotes` 导致重渲染时，React 的协调器可能重建 textarea DOM 元素，`defaultValue` 重置为旧的 `note.text`，用户输入丢失。

**修复**：改为受控 `<textarea>`（`value={note.text}` + `onChange` 即时更新 state）：

```tsx
<textarea
  value={note.text}
  onChange={(e) => updateNoteText(note.id, e.target.value)}
  onBlur={() => setEditingId(null)}
/>
```

每次按键都通过 `updateNoteText` 将文本写入 state（进而写入 localStorage），`onBlur` 仅负责退出编辑模式。无论 resize 触发多少次重渲染，textarea 的值始终与 state 同步。

**教训**：
> **当表单元素所在容器可能被外部操作频繁重渲染时，使用受控组件（`value` + `onChange`）而非非受控组件（`defaultValue` + `onBlur`）。受控组件的值始终与 state 同步，不会因 DOM 重建而丢失。**

---

## 第十阶段：Tauri 窗口 API 权限（ACL）

### 问题：`set_size` / `set_position` 命令被拒绝

**现象**：调用 `win.setSize()` 和 `win.setPosition()` 时报错 `Command plugin:window|set_size not allowed by ACL`。

**根因**：Tauri v2 的权限模型要求每个窗口 API 都需要在 `capabilities/default.json` 中显式声明。

**修复**：添加以下权限：

```json
"core:window:allow-set-size",
"core:window:allow-set-position",
"core:window:allow-outer-size",
"core:window:allow-outer-position",
"core:window:allow-scale-factor",
"core:window:allow-inner-size",
"core:window:allow-inner-position"
```

**教训**：
> **Tauri v2 的每个 IPC 命令都需要在 capabilities 中显式授权。使用新的 Tauri API 时，如果遇到 `not allowed by ACL` 错误，检查 `capabilities/default.json` 是否包含对应的 `allow-*` 权限。**

---

## 第十一阶段：窗口持久化

### 问题 1：窗口每次恢复后变大

**现象**：保存窗口大小 → 关闭 → 重启 → 窗口变大 → 再关闭 → 再重启 → 更大，逐次膨胀。

**根因**：`outerSize()` 返回的尺寸**包含窗口标题栏和装饰**，但 `setSize()` 设置的是**内含尺寸**（不含装饰）。每次保存 outerSize → 恢复 setSize，标题栏高度被累加。

**修复**：保存时使用 `innerSize()`（内含尺寸），与 `setSize()` 对齐：

```typescript
const size = await win.innerSize();   // 不含标题栏
const pos = await win.outerPosition(); // 位置用 outer
```

### 问题 2：恢复后立即覆盖保存数据

**现象**：恢复窗口大小后，`onResized` 事件触发，debounce 500ms 后将恢复后的尺寸写入 localStorage，覆盖了原始保存数据。

**修复**：添加 `restoring` 标志位，恢复期间跳过保存：

```typescript
let restoring = false;
// Restore:
restoring = true;
await win.setSize(...);
await win.setPosition(...);
setTimeout(() => { restoring = false; }, 1000);
// Save:
if (restoring) return; // 跳过
```

### 问题 3：物理像素 vs 逻辑像素

**现象**：在 150% DPI 缩放下，保存的尺寸值是物理像素（如 2052×1449），恢复时用 `LogicalSize` 解释为逻辑像素，导致窗口尺寸错误。

**修复**：保存时通过 `scaleFactor` 转换为逻辑像素：

```typescript
const factor = await win.scaleFactor();
const w = Math.round(physSize.width / factor);
const h = Math.round(physSize.height / factor);
```

**教训**：
> **窗口持久化的完整检查清单：**
> 1. **用 `innerSize()` 保存**，避免标题栏装饰累加
> 2. **物理→逻辑转换**：`innerSize()` 返回物理像素，除以 `scaleFactor` 得到逻辑像素
> 3. **防恢复覆盖**：添加 `restoring` 标志位，恢复期间跳过 save 回调
> 4. **ACL 权限**：确保 `setSize`、`setPosition`、`innerSize`、`outerPosition`、`scaleFactor` 都已授权

---

## 第十二阶段：Tauri 最小化到托盘启动同步

### 问题：最小化到托盘设置在启动后不生效

**现象**：用户启用「关闭时最小化到托盘」后关闭应用，重启后点击关闭按钮，窗口直接关闭而非最小化。

**根因**：Rust 侧的 `AppState.minimize_to_tray` 是 `AtomicBool`，默认 `false`。`set_minimize_to_tray` 命令只在 `GlobalSettings` 组件渲染时调用。应用启动时 GlobalSettings 未渲染，Rust 侧标志始终为 `false`。

**修复**：在 `App.tsx` 的启动 `useEffect` 中，从 localStorage 读取设置并同步到 Rust 侧：

```typescript
useEffect(() => {
  if (!isTauriEnv()) return;
  const raw = localStorage.getItem('chillfocus-global-settings');
  if (!raw) return;
  const s = JSON.parse(raw);
  import('@tauri-apps/api/core').then(({ invoke }) => {
    invoke('set_minimize_to_tray', { enabled: !!s.minimizeToTray });
  });
}, []);
```

**教训**：
> **前端 localStorage 设置与 Rust 侧状态不是自动同步的。任何通过 Tauri command 修改的 Rust 状态，都需要在应用启动时从 localStorage 重新同步。**

---

## 第十三阶段：Tauri 单实例

### 实现

使用 `tauri-plugin-single-instance` 插件，注册时提供回调：

```rust
.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}))
```

重复启动时自动将已有窗口显示到前台，不创建新窗口。

**注意**：`tauri-plugin-single-instance` 在 Windows 上使用命名互斥锁（named mutex）实现。开发模式（`tauri dev`）和生产模式使用不同的互斥锁名称，不会互相干扰。

---

## 更新后的关键经验总结

### 6. Tauri v2 ACL 权限清单

使用新的 Tauri API 遇到 `not allowed by ACL` 时，在 `capabilities/default.json` 中添加对应权限。格式：`core:window:allow-<kebab-case-method-name>`。

### 7. 受控 vs 非受控表单

| 场景 | 推荐 |
|------|------|
| 容器可能被外部操作重渲染 | 受控（`value` + `onChange`） |
| 表单提交时才需要值 | 非受控（`defaultValue` + `ref`） |
| 需要即时验证/格式化 | 受控 |
| 大量独立输入框、性能敏感 | 非受控 |

### 8. 前端 ↔ Rust 状态同步

```
前端 localStorage ←→ Tauri command ←→ Rust State
                         ↑
                   启动时必须手动同步
                   设置变更时必须调用 invoke
```
