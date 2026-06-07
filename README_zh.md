# ChillFocus

[English](README.md) | [简体中文](README_zh.md)

---

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg)](https://vite.dev)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131.svg)](https://tauri.app)

> 一款跨平台专注力助手应用，支持浏览器 Web 端和 Tauri 桌面端。集成番茄钟、音乐播放器（含音频可视化）、环境音、任务管理和浮动便签等功能，采用现代 Lo-fi 美学设计。

## 目录

- [功能特性](#功能特性)
- [安装](#安装)
- [项目结构](#项目结构)
- [技术架构](#技术架构)
- [构建与测试](#构建与测试)
- [许可证](#许可证)

## 功能特性

### 🍅 番茄钟
- 可自定义专注、短休息、长休息时长
- SVG 进度环，平滑动画过渡
- 动态渐变背景，随时间从冷色调过渡到暖色调
- 自动循环模式 — 阶段结束后自动开始下一阶段，无需手动操作
- 自定义背景图片（内置图片裁剪工具）和提示音（默认/自定义均可）
- 「无时间显示」模式，沉浸式专注
- 可隐藏音频可视化叠加层

### 🎵 音乐播放器
- 5 种播放模式：顺序播放、列表循环、单曲循环、随机播放、单曲播放
- 定时播放功能，支持「等待当前曲目结束」选项
- 多播放列表支持：创建、重命名、删除、导出/导入
- 本地文件上传和 URL 添加曲目，拖拽文件导入
- 音频频谱可视化（Web Audio API AnalyserNode + Canvas，60fps）
- 播放列表通过 localStorage + IndexedDB 持久化（音频文件以二进制 blob 存储）

### 🎨 音频可视化
- 64 根频谱条，Canvas 实时渲染
- 颜色主题随番茄钟阶段自适应变化
- 无音频播放时显示柔和的空闲动画

### 🌧️ 环境音
- 4 种内置真实环境音：雨声、壁炉、森林、风声
- 自定义音效上传（本地文件或 URL），独立音量控制
- 所有环境音可混合同时播放，循环播放
- 播放状态、音量和活跃选择跨会话持久化

### ✅ 任务管理
- 添加、编辑（双击）、删除、勾选完成
- 三级优先级标记（高/中/低）
- 8 色调色板，可视化分类
- 按完成状态和优先级排序
- localStorage 持久化

### 📝 便签
- 拖拽图标到页面任意位置创建便签
- 单击图标切换所有便签的显隐
- 浮动/固定双层渲染 — 固定便签随页面滚动，浮动便签保持固定
- 通过自定义角标手柄调整大小（宽高均可）
- 颜色循环切换（6 种颜色）
- localStorage 持久化

## 安装

### 环境要求

| 依赖   | 版本   | 必需 |
|--------|--------|------|
| Node.js | >= 18 | 是   |
| npm     | >= 9  | 是   |
| Rust & Cargo | latest | 仅桌面端 |

### Web 端

```bash
git clone <repository-url>
cd chillfocus
npm install
npm run dev
```

开发服务器启动后访问 `http://localhost:5173/`。

### 桌面端（Tauri）

从 Releases 页面下载 `ChillFocus-v0.1.0-win64.zip`，解压后双击 `app.exe` 即可运行。

系统要求：Windows 10 及以上版本。

## 项目结构

```
chillfocus/
├── public/
│   ├── sounds/                  # 内置音频资源
│   │   ├── rain.ogg             # 雨声环境音
│   │   ├── fireplace.ogg        # 壁炉噼啪声
│   │   ├── forest.ogg           # 森林（鸟鸣与溪流）
│   │   ├── wind.ogg             # 户外风声
│   │   └── notification.mp3     # 默认阶段提示音
│   ├── favicon.svg              # 应用图标
│   └── icons.svg                # 图标集
├── src/
│   ├── main.tsx                 # React 入口
│   ├── App.tsx                  # 根组件 — 布局组合
│   ├── App.css                  # 全局布局样式
│   ├── index.css                # CSS 变量、暗色主题、滚动条
│   ├── types/
│   │   └── index.ts             # 全局类型定义
│   ├── utils/
│   │   ├── audioStore.ts        # IndexedDB 音频文件存储封装
│   │   ├── audioFormats.ts      # 支持的音频格式白名单
│   │   ├── notificationSound.ts # Web Audio API 提示音合成
│   │   ├── noiseGenerator.ts    # 环境噪音合成（旧版）
│   │   ├── openUrl.ts           # 跨平台 URL 打开工具
│   │   ├── tauriFileAccess.ts   # Tauri 桌面端文件访问适配层
│   │   └── timeUtils.ts         # 时间格式化与 ID 生成
│   ├── hooks/
│   │   ├── usePomodoro.ts       # 番茄钟状态机
│   │   ├── useAudioPlayer.ts    # 音频播放引擎（播放列表、模式、定时）
│   │   ├── useAudioVisualizer.ts# AnalyserNode + Canvas 频谱渲染
│   │   └── useLocalStorage.ts   # 通用 localStorage Hook
│   ├── components/
│   │   ├── PomodoroTimer.tsx        # 番茄钟 UI（进度环）
│   │   ├── GradientBackground.tsx   # 动态径向渐变背景
│   │   ├── AudioVisualizer.tsx      # Canvas 频谱条
│   │   ├── PomodoroSettings.tsx     # 设置面板（滑块、开关）
│   │   ├── ImageCropper.tsx         # 拖拽裁剪图片工具
│   │   ├── MusicPlayer.tsx          # 全功能音乐播放器
│   │   ├── AmbientSounds.tsx        # 环境音混音器
│   │   ├── TaskManager.tsx          # 任务列表（优先级、颜色）
│   │   └── StickyNotes.tsx          # 浮动/固定便签系统
│   └── assets/
│       └── hero.png                 # 首屏展示图
├── src-tauri/                       # Tauri 桌面端配置与原生代码
│   ├── src/
│   │   ├── lib.rs                   # Tauri 插件与命令注册
│   │   └── main.rs                  # 桌面端入口
│   ├── capabilities/                # Tauri 权限声明
│   ├── icons/                       # 桌面端应用图标
│   ├── Cargo.toml                   # Rust 依赖配置
│   ├── tauri.conf.json              # Tauri 构建配置
│   └── build.rs                     # 构建脚本
├── docs/
│   ├── ARCHITECTURE.md              # 技术架构文档
│   ├── UI-DESIGN.md                 # UI 设计系统文档
│   ├── DESIGN-GLOSSARY.md           # 前端设计术语参考
│   └── DEBUG-LESSONS.md             # 调试经验与教训
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 技术架构

### 双端文件访问

Web 端通过 `<input type="file">` 和 `URL.createObjectURL` 访问本地文件；Tauri 桌面端通过 Rust 后端的 `tauriFileAccess.ts` 适配层直接读写本地文件系统，实现无缝的跨平台文件操作。

### 数据持久化

| 数据 | 存储方式 | Key |
|------|---------|-----|
| 任务列表 | localStorage | `chillfocus-tasks` |
| 便签 | localStorage | `chillfocus-notes` |
| 番茄钟设置 | localStorage | `chillfocus-pomodoro-settings` |
| 播放列表结构 | localStorage | `chillfocus-playlists` |
| 播放器偏好（音量、模式） | localStorage | `chillfocus-player-prefs` |
| 自定义环境音 | localStorage | `chillfocus-custom-sounds` |
| 环境音音量 | localStorage | `chillfocus-ambient-volumes` |
| 活跃环境音状态 | localStorage | `chillfocus-ambient-active` |
| 音频文件二进制 | IndexedDB | `chillfocus-audio` / `files` |

### 音频格式白名单

`mp3`、`wav`、`ogg`、`flac`、`aac`、`m4a`、`opus`、`webm`、`weba`

导入时通过共享白名单（`audioFormats.ts`）验证格式，Web 端和桌面端统一校验。不支持的格式（如 APE）会被静默拒绝。

详见 [UI-DESIGN.md](docs/UI-DESIGN.md)、[ARCHITECTURE.md](docs/ARCHITECTURE.md) 和 [DESIGN-GLOSSARY.md](docs/DESIGN-GLOSSARY.md)。

## 构建与测试

### Web 端

```bash
# 类型检查
npx tsc --noEmit

# 生产构建（类型检查 + Vite 打包）
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

构建输出：`dist/`（JS 约 254 KB gzip，CSS 约 29 KB gzip）

### 桌面端（Tauri）

```bash
# 开发模式（前端热重载 + Tauri 桌面窗口）
npm run tauri dev

# 生产构建（生成安装包/可执行文件）
npm run tauri build
```

## 许可证

本项目基于 [GNU 通用公共许可证 v3.0](LICENSE) 授权。
