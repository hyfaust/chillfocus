# ChillFocus 调试经验：播放列表持久化与 Tauri 文件系统

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
