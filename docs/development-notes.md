# ChillFocus 开发笔记

本文档记录 ChillFocus 从 Web 应用演进为 Tauri 桌面应用过程中的关键开发历程、架构决策和经验教训。按时间线组织，涵盖存储架构、权限模型、快捷键系统、窗口管理、便签系统、响应式布局等核心模块。

---

## 一、存储架构演进

### 1.1 Web 端 IndexedDB 存储

**背景**：音乐播放器需要持久化播放列表——关闭应用后重新打开，之前添加的音乐仍然可以播放。

**方案**：本地文件通过 FileReader 读取后存入 IndexedDB，localStorage 保存元数据（fileKey 指向 IndexedDB）。

**遇到的问题**：
- data URL (base64) 存入 state 导致 `JSON.stringify` 溢出
- blob URL 在页面刷新后失效

**解决方案**：
- IndexedDB 存储原始 File 二进制，不存 data URL
- state 中 url 字段留空，播放时从 IndexedDB 按需创建 blob URL（懒加载）
- 导出时剥离所有 URL，只保留 fileKey + sourceFileName

> **教训**：永远不要将大二进制数据放入 React state 或 localStorage。IndexedDB 是浏览器端存储大对象的正确选择。

### 1.2 Tauri 端 filePath 方案（尝试后放弃）

**尝试**：Tauri 的 `dialog.open()` 返回文件绝对路径，存入 `Track.filePath`。播放时用 `fs.readFile(filePath)` 从磁盘读取。

**失败原因**：
1. `fs:read-all` 权限只启用命令，**不添加路径 scope**
2. `fs:default` 只授权 app 专用目录
3. 用户音乐文件在 `C:\Users\...\Music\` 完全没有 scope 覆盖
4. 错误被 catch 静默吞掉，调试困难

**诊断过程**：创建诊断按钮（FsDiagnostics），通过 `dialog.message()` 弹窗显示每步结果，最终定位到 `readFile: forbidden path`。

**修复**：在 `capabilities/default.json` 中添加 `fs:scope-home-recursive`。

**最终决策**：放弃 filePath 作为主要存储，Tauri 端也走 IndexedDB，与 Web 端统一。filePath 保留作为导出/导入时的回退路径。

> **教训**：
> 1. Tauri v2 的 fs 权限模型是"命令 + scope"双层结构，两者缺一不可。
> 2. 在无法使用 F12 的环境中，用原生弹窗（`dialog.message`）是最可靠的调试手段。
> 3. 跨平台项目中，选择两端都支持的存储方案比依赖平台特有能力更可靠。

### 1.3 resolveTrackUrl 优先级链

播放时按以下顺序尝试获取音频 URL：
1. **url 直接可用**：非 blob 的有效 URL（如网络 URL），直接使用
2. **fileKey → IndexedDB**：按 fileKey 从 IndexedDB 取出 File，创建 blob URL
3. **filePath → Tauri fs**：通过 `fs.readFile(filePath)` 从磁盘读取，创建 blob URL
4. **全部失败**：返回空字符串，播放无声

### 1.4 导出/导入的 fileKey 问题

**问题**：导出的 JSON 包含 fileKey，但 fileKey 是随机 ID，只在当前浏览器的 IndexedDB 中有意义。

**解决**：导出时保留多种恢复路径——fileKey（同机器 IndexedDB 可恢复）、filePath（Tauri 磁盘路径）、sourceFileName（用于重新关联时按文件名匹配）。导入后如果都不可用，显示「重新关联文件夹」按钮。

> **教训**：导出数据要包含多种恢复路径，不同环境下有不同的恢复策略。

---

## 二、Tauri 环境检测与 IPC

### 2.1 `window.__TAURI__` 未定义

**现象**：全局快捷键注册代码完全不执行。Tauri 打包后的应用中 `window.__TAURI__` 为 `undefined`。

**根因**：Tauri v1 → v2 的 breaking change：IPC 桥接对象从 `window.__TAURI__` 变为 `window.__TAURI_INTERNALS__`。

**影响范围**：
- `App.tsx` — 全局快捷键注册被跳过
- `utils/tauriFileAccess.ts` — `isTauri()` 首选路径失败（fallback 到动态 import 仍可用）
- `utils/openUrl.ts` — 外部链接打开方式回退到 `window.open`

**修复**：将所有 `(window as any).__TAURI__` 改为 `(window as any).__TAURI_INTERNALS__`。

> **教训**：检测 Tauri v2 环境应使用 `window.__TAURI_INTERNALS__`。

### 2.2 Tauri v2 ACL 权限模型

Tauri v2 的每个 IPC 命令都需要在 `capabilities/default.json` 中显式授权。格式：`core:window:allow-<kebab-case-method-name>`。

**项目中用到的窗口权限**：

```json
"core:window:allow-show",
"core:window:allow-hide",
"core:window:allow-set-focus",
"core:window:allow-close",
"core:window:allow-set-size",
"core:window:allow-set-position",
"core:window:allow-outer-size",
"core:window:allow-outer-position",
"core:window:allow-scale-factor",
"core:window:allow-inner-size",
"core:window:allow-inner-position",
"core:window:allow-is-visible",
"core:window:allow-is-minimized",
"core:window:allow-unminimize"
```

> **教训**：使用新的 Tauri API 时遇到 `not allowed by ACL` 错误，检查 `capabilities/default.json` 是否包含对应的 `allow-*` 权限。

### 2.3 前端 ↔ Rust 状态同步

前端 localStorage 设置与 Rust 侧状态不是自动同步的。任何通过 Tauri command 修改的 Rust 状态（如 `minimizeToTray` 的 `AtomicBool`），都需要在应用启动时从 localStorage 重新同步。

```
前端 localStorage ←→ Tauri command ←→ Rust State
                         ↑
                   启动时必须手动同步
                   设置变更时必须调用 invoke
```

---

## 三、全局快捷键系统

### 3.1 键名格式转换

Web 端 `KeyboardEvent.key` 产生的键名与 Tauri 全局快捷键插件（muda accelerator）期望的格式不同：

| Web 端 (KeyboardEvent.key) | Tauri 端 (muda accelerator) |
|---|---|
| `Space` | `space` |
| `ArrowUp` | `arrowup` |
| `Escape` | `escape` |
| `A` (单字母) | `A`（大写保留） |
| `Ctrl` | `Ctrl`（修饰键保留） |

新增 `convertToTauriShortcut()` 函数在注册前转换键名。

### 3.2 Pressed/Released 双触发

Tauri 的 `register()` 回调在 `Pressed` 和 `Released` 两个状态都会触发。必须在回调中检查 `event.state === 'Pressed'`。

### 3.3 快捷键设置即时生效

**问题**：在设置面板中修改全局快捷键后，新快捷键不工作（App 的 useEffect 不会重新运行）。

**解决**：
1. `GlobalSettings` 在快捷键变更时 `dispatchEvent(new Event('chillfocus-shortcuts-changed'))`
2. `App` 监听该事件，递增 `shortcutVersion` state
3. 全局快捷键 useEffect 依赖 `shortcutVersion`，变更时先注销旧快捷键再注册新快捷键

> **教训**：同一页面内的组件间通信不能依赖 `storage` 事件（只在跨 tab 时触发）。使用自定义 DOM 事件是同页面组件间通信的轻量方案。

### 3.4 组合键检测

**问题**：设置面板中按下 Ctrl 等修饰键时立即完成快捷键捕获，无法等待后续按键。

**修复**：在 `handleKeyCapture` 中忽略修饰键单独按下（`['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)` 时 return），等待实际按键。

---

## 四、快捷键架构重构

### 4.1 闭包过时值问题

**问题**：快捷键回调引用的是组件挂载时的 state 快照，而不是最新值。将 state 加入依赖数组会导致 effect 频繁重建。

**解决**：使用 `useRef` + 每次 render 更新 ref 的模式：

```typescript
const pomodoroRef = useRef(pomodoro);
pomodoroRef.current = pomodoro;

// useEffect 回调中通过 ref 访问最新值
const handleKeyDown = (e: KeyboardEvent) => {
  const p = pomodoroRef.current; // 始终是最新值
};
```

同时将快捷键处理从 `GlobalSettings` 提升到 `App` 层级：
- 局部快捷键：每次 keydown 从 localStorage 实时读取配置，无需重新挂载监听
- 全局快捷键：在 App 层统一注册/注销

> **教训**：当 useEffect 回调需要访问频繁变化的值但又不想让 effect 重新运行时，使用 `useRef` + 每次 render 更新 ref 的模式。

---

## 五、音频播放

### 5.1 暂停/恢复问题

**问题**：播放按钮变成"停止/播放"——暂停后再播放，音乐从头开始。

**根因**：`play()` 函数每次都重新设置 `audio.src`，重新赋值 `src` 会重置播放位置。

**修复**：只在 audio 尚未加载源时才设置 src：

```typescript
if (!audio.src || audio.src === window.location.href) {
  audio.src = url;
}
audio.play();
```

> **教训**：HTMLAudioElement 的 `src` 属性重新赋值会重置播放状态（currentTime 归零）。暂停/恢复应只调用 `audio.play()` / `audio.pause()`。

### 5.2 单曲循环模式

**问题**：单曲循环模式下切歌行为不正确。

**修复**：
- `loop-single` 模式：使用 `audio.loop = true` 实现真正的单曲循环
- `single` 模式：播放完自动停止
- `next()`/`prev()` 手动切歌在 single/loop-single 下也应正常切换（像 sequential 一样）

### 5.3 双提示音系统

番茄钟提示音分为两个独立设置：
- **专注结束**：默认 `focus-end.ogg`（Blue Rag）
- **休息结束**：默认 `notification.mp3`（Nokia 铃声）

各自支持自定义上传，试听按钮始终可用（未自定义时播放默认音效）。

---

## 六、系统托盘

### 6.1 托盘菜单实现

```rust
let _tray = TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .tooltip("ChillFocus")
    .show_menu_on_left_click(false)  // 左键点击显示窗口，右键显示菜单
    .on_tray_icon_event(move |tray, event| { ... })
    .on_menu_event(move |app, event| { ... })
    .build(app)?;
```

菜单项通过 `window.eval("window.__togglePomodoro && window.__togglePomodoro()")` 调用前端暴露的全局函数。

### 6.2 关闭到托盘

Rust 侧 `on_window_event` 监听 `CloseRequested`，根据 `AppState.minimize_to_tray` 的 `AtomicBool` 决定是 `api.prevent_close()` + `hide()` 还是正常关闭。

> **注意**：`menu_on_left_click` 在 Tauri v2 中已废弃，应使用 `show_menu_on_left_click`。

---

## 七、窗口管理

### 7.1 窗口持久化

通过 `onResized` / `onMoved` 事件监听，防抖 500ms 后保存窗口几何信息到 localStorage。

**遇到的三个问题**：

1. **窗口每次恢复后变大**：`outerSize()` 含标题栏装饰，`setSize()` 设内含尺寸。改用 `innerSize()` 保存。
2. **恢复后覆盖保存数据**：`setSize`/`setPosition` 触发 `onResized`/`onMoved`，立即覆盖原始数据。添加 `restoring` 标志位跳过保存。
3. **物理像素 vs 逻辑像素**：`innerSize()` 返回物理像素，保存时需除以 `scaleFactor` 转为逻辑像素。

### 7.2 单实例

使用 `tauri-plugin-single-instance` 插件，重复启动时自动 `show()` + `setFocus()` 已有窗口。Windows 上使用命名互斥锁实现。

### 7.3 显示/隐藏主界面快捷键

通过 `isVisible()` + `isMinimized()` 实现三态切换：

| 状态 | `isVisible()` | `isMinimized()` | 操作 |
|------|:---:|:---:|------|
| 前台可见 | `true` | `false` | `hide()` |
| 托盘隐藏 | `false` | `false` | `show()` + `setFocus()` |
| 最小化 | `true`* | `true` | `unminimize()` + `setFocus()` |

> **关键**：`show()` 只恢复被 `hide()` 隐藏的窗口，对最小化窗口无效。必须先调用 `unminimize()`。

### 7.4 开机自启动

使用 `tauri-plugin-autostart` 插件，通过 `enable()`/`disable()` 控制 Windows 注册表 Run 键。

**启动时隐藏到托盘的区分问题**：子设置「启动时隐藏到托盘」需要只在开机自启动时生效，手动启动不应隐藏。

**解决方案**：启用自启动时，通过 Rust 命令 `set_autostart_flag` 在注册表 Run 键的值末尾追加 `--autostart` 参数。启动时调用 `is_autostart_launch()` 检查 `std::env::args()` 是否包含该参数。

```
注册表 Run 键值：
  启用前：C:\...\ChillFocus.exe
  启用后：C:\...\ChillFocus.exe --autostart

启动判断逻辑：
  startMinimizedToTray && launchAtStartup && isAutoStart → hide()
  手动启动（无 --autostart）→ 正常显示
```

禁用自启动时，`set_autostart_flag` 移除 `--autostart` 参数，同时 `disable()` 移除 Run 键。

---

## 八、便签系统

### 8.1 文字保存与 Resize

**问题**：便签中输入的文字在拖拽缩放容器后丢失。

**根因**：使用非受控 `<textarea>`（`defaultValue` + `onBlur`）。resize 触发 `setNotes` 导致重渲染时，React 可能重建 textarea DOM 元素，`defaultValue` 重置为旧值。

**修复**：改为受控 `<textarea>`（`value={note.text}` + `onChange` 即时更新 state）。每次按键都写入 state，`onBlur` 仅负责退出编辑模式。

> **教训**：当表单元素所在容器可能被外部操作频繁重渲染时，使用受控组件。受控组件的值始终与 state 同步，不会因 DOM 重建而丢失。

### 8.2 便签简化

移除了 `pinned`/浮动双层渲染架构，改为单层 `position: fixed`，所有便签始终可见。移除了「置于顶端」功能。

### 8.3 字体大小调节

每个便签独立的 `fontSize` 字段（8–24px），通过 A-/A+ 按钮调节，持久化到 localStorage。内容超出容器高度时 `overflow-y: auto` 自动出现滚动条。

---

## 九、响应式布局

### 9.1 CSS 响应式防溢出

**问题**：窗口变窄时，任务列表容器出现水平滚动条。

**根因**：Flex/Grid 子元素默认 `min-width: auto`，不会小于内容的固有宽度。

**修复**：关键元素添加 `min-width: 0`，容器添加 `overflow-x: hidden`。

### 9.2 番茄钟 clamp() 缩放

番茄钟所有元素使用 `clamp()` 实现流式缩放，无需依赖媒体查询断点：

```css
.ringWrap { width: clamp(140px, 25vw, 200px); }
.btnPrimary { width: clamp(44px, 6vw, 56px); }
.timeText { font-size: clamp(24px, 4vw, 36px); }
```

### 9.3 断点策略

| 断点 | 变化 |
|------|------|
| `> 1024px` | 双栏 Grid（任务面板 240–320px + 音乐面板 1fr） |
| `≤ 1024px` | 任务面板缩小至 220–280px |
| `≤ 768px` | 单列布局 |

Tauri 窗口最小尺寸 800×650，桌面端 768px 断点永远不会触发（由 1024px 断点覆盖）。

---

## 十、关键经验总结

### 存储架构选择

| 数据类型 | 推荐方案 | 避免 |
|---------|---------|------|
| 小型配置 | localStorage | — |
| 大型二进制 | IndexedDB | localStorage / React state |
| 文件路径 | 平台 API 获取 | 浏览器 File.path（非标准） |

### React 中访问最新值的模式

| 需求 | 方案 |
|------|------|
| 回调中需要最新值但不想重建 effect | `useRef` + 每次 render 更新 |
| 事件处理器需要最新配置 | 每次触发时从 localStorage 读取 |
| 稳定的回调引用 | `useCallback` + ref 间接访问 |

### 组件间通信方案选择

| 场景 | 方案 |
|------|------|
| 父 → 子 | Props |
| 子 → 父 | Callback props |
| 同页面跨组件 | 自定义 DOM 事件 (`dispatchEvent`) |
| 跨 tab / 跨窗口 | `storage` 事件 |
| 全局状态 | Context / 外部 store |

### 受控 vs 非受控表单

| 场景 | 推荐 |
|------|------|
| 容器可能被外部操作重渲染 | 受控（`value` + `onChange`） |
| 表单提交时才需要值 | 非受控（`defaultValue` + `ref`） |
| 需要即时验证/格式化 | 受控 |

### 调试策略

- 浏览器端：F12 DevTools
- Tauri 端：`dialog.message()` 弹窗 + `console.error`
- 跨端问题：在两端分别用诊断按钮验证每一步
- 生产构建调试：临时启用 `devtools` feature（`Cargo.toml` 中 `tauri = { features = ["devtools"] }`）

### 默认音效文件管理

项目内置音效存放在 `public/sounds/`，Vite 构建时自动复制到 `dist/sounds/`。代码中通过 `${import.meta.env.BASE_URL}sounds/xxx` 引用。用户自定义音效通过 blob URL 存储在 localStorage，优先级高于默认文件。

---

## 十一、v1.2.0 功能演进

### 11.1 Tauri 原生文件拖放

**问题**：HTML5 拖放 API 在 Tauri WebView2 中对外部文件不可靠。

**解决**：使用 Tauri 内置的 `tauri://drag-drop` 事件：

```typescript
const { listen } = await import('@tauri-apps/api/event');
await listen<{ paths: string[] }>('tauri://drag-drop', async (event) => {
  const audioPaths = event.payload.paths.filter(p => SUPPORTED_AUDIO_EXTENSIONS.test(p));
  const { readFile } = await import('@tauri-apps/plugin-fs');
  // readFile 读取路径 → File 对象 → onAddTracks
});
```

> **教训**：Tauri 桌面端文件拖放应使用 `tauri://drag-drop` 原生事件，直接提供文件系统路径，支持日文和含空格路径。

### 11.2 backdrop-filter 创建新包含块

**问题**：右键菜单（`position: fixed`）不显示。

**根因**：`.music-panel` 的 `backdrop-filter: blur(20px)` 创建新包含块，`fixed` 定位相对于面板而非视口，被 `overflow: auto` 裁剪。

**解决**：React Portal 渲染到 `document.body`：

```typescript
{contextMenu && createPortal(<div>...</div>, document.body)}
```

> **教训**：`backdrop-filter`、`transform`、`perspective`、`filter` 会创建新包含块，导致 `fixed` 定位失效。Portal 是标准绕过方案。

### 11.3 在资源管理器中打开文件夹

`shell.open()` 和 `open` crate 对 Windows 文件夹路径不可靠。最终用 Rust 原生 `std::process::Command::new("explorer").arg(&path).spawn()`。

> **教训**：Windows 打开文件夹，`explorer.exe` + 原生路径最可靠。

### 11.4 播放状态持久化

新增 `chillfocus-player-state` 存储 `{ trackId, playlistId }`，启动时恢复 `currentTrack`（不自动播放）。`play()`/`next()`/`prev()` 添加 fallback。

> **教训**：桌面应用应持久化播放上下文，不能每次启动从零开始。

### 11.5 播放模式拆分

原 5 种模式拆为 `LoopMode` × `OrderMode` 两个维度，`loadPrefsFromStorage()` 添加旧格式兼容映射。

### 11.6 环境音暂停/继续的状态管理

`useState` 的 `isPaused` 作为 `useCallback` 依赖会导致回调频繁重建。改用 `useRef` 存储暂停状态，`useState` 仅用于 UI。

> **教训**：`useCallback` 内需要读取但不想依赖的值，用 `useRef` 存储。

### 11.7 托盘菜单前端桥接

菜单项通过 `window.eval("window.__fnName()")` 调用前端全局函数。函数用 `useRef` 包装目标，确保访问最新状态。

### 11.8 GitHub Release 更新检查

前端 `fetch` GitHub API 比较版本，`confirm()` 弹窗确认后 `shell.open()` 打开 release 页面。

**Rust dialog 的坑**：`tauri-plugin-dialog` v2 的 `MessageDialogBuilder` 不支持 `ok_button_label`，`blocking_show()` 返回值行为不明确。最终改用前端 `confirm()` + `shell.open()`。

> **教训**：前端原生 API 能完成的功能，优先用前端方案，减少 IPC 和 Rust 依赖。
