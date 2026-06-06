# ChillFocus

[English](README.md) | [简体中文](README_zh.md)

---

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg)](https://vite.dev)

> 一款 Web 端专注力助手应用，集成番茄钟、音乐播放器（含音频可视化）、环境音、任务管理和浮动便签等功能，采用现代 Lo-fi 美学设计。

## 目录

- [功能特性](#功能特性)
- [在线体验](#在线体验)
- [环境要求](#环境要求)
- [安装](#安装)
- [使用方法](#使用方法)
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
- 可自定义提示音和背景图片（内置图片裁剪工具）
- 「无时间显示」模式，沉浸式专注
- 可开关的音频可视化叠加层（占容器高度 62%）

### 🎵 音乐播放器
- 多播放列表支持：创建、重命名、删除、导出/导入
- 5 种播放模式：顺序播放、列表循环、单曲循环、随机播放、单曲播放
- 定时播放功能，支持「等待当前曲目结束」选项
- 基于 Web Audio API `AnalyserNode` + Canvas 的音频频谱可视化（60fps）
- 支持本地文件上传和 URL 添加曲目
- 拖拽文件导入
- 播放列表通过 localStorage + IndexedDB 持久化（音频文件以二进制存储）

### 🌧️ 环境音
- 4 种内置真实环境音：雨声、壁炉、森林、风声
- 自定义音效上传（本地文件或 URL），独立音量控制
- 所有环境音可混合同时播放
- 播放状态和音量跨会话持久化

### ✅ 任务管理
- 添加、编辑（双击）、删除、勾选完成
- 三级优先级标记（高/中/低）
- 8 色调色板，可视化分类
- 按完成状态和优先级排序
- localStorage 持久化

### 📝 浮动便签
- 拖拽图标到页面任意位置创建便签
- 单击图标切换所有便签的显示/隐藏
- 固定/浮动切换 — 固定便签随页面滚动，浮动便签保持固定
- 通过自定义角标手柄调整大小（宽高均可）
- 颜色循环切换（6 种颜色）
- localStorage 持久化

### 🎨 音频可视化
- 64 根频谱条，Canvas 渲染
- 颜色主题随番茄钟阶段自适应
- 无音频播放时显示柔和的空闲波浪动画

## 在线体验

```bash
npm run dev
# 打开 http://localhost:5173/
```

## 环境要求

| 依赖   | 版本   | 必需 |
|--------|--------|------|
| Node.js | >= 18 | 是   |
| npm     | >= 9  | 是   |

## 安装

```bash
git clone <repository-url>
cd chillfocus
npm install
```

## 使用方法

### 启动开发服务器

```bash
npm run dev
```

### 生产构建

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

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
│   └── favicon.svg              # 应用图标
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
│   │   └── timeUtils.ts         # 时间格式化与 ID 生成
│   ├── hooks/
│   │   ├── usePomodoro.ts       # 番茄钟状态机
│   │   ├── useAudioPlayer.ts    # 音频播放引擎（播放列表、模式、定时）
│   │   ├── useAudioVisualizer.ts# AnalyserNode + Canvas 频谱渲染
│   │   └── useLocalStorage.ts   # 通用 localStorage Hook
│   └── components/
│       ├── PomodoroTimer.tsx     # 番茄钟 UI（进度环）
│       ├── GradientBackground.tsx# 动态径向渐变背景
│       ├── AudioVisualizer.tsx   # Canvas 频谱条
│       ├── PomodoroSettings.tsx  # 设置面板（滑块、开关）
│       ├── ImageCropper.tsx      # 拖拽裁剪图片工具
│       ├── MusicPlayer.tsx       # 全功能音乐播放器
│       ├── AmbientSounds.tsx     # 环境音混音器
│       ├── TaskManager.tsx       # 任务列表（优先级、颜色）
│       └── StickyNotes.tsx       # 浮动/固定便签系统
├── ARCHITECTURE.md              # 技术架构文档
├── UI-DESIGN.md                 # UI 设计系统文档
├── DESIGN-GLOSSARY.md           # 前端设计术语参考
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 技术架构

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

### 音频管线

```
HTMLAudioElement → MediaElementAudioSourceNode → AnalyserNode → destination
                                                       ↓
                                              getByteFrequencyData（128 个频率 bin）
                                                       ↓
                                              Canvas：64 根渐变频谱条 @ 60fps
```

### 支持的音频格式

`mp3`、`wav`、`ogg`、`flac`、`aac`、`m4a`、`opus`、`webm`、`weba`

导入时通过共享白名单验证格式。不支持的格式（如 APE）会被静默忽略。

### 设计系统

- **主题**：暗色模式 + Glassmorphism（玻璃拟态）面板
- **字体**：Inter（200–600 字重），倒计时使用等宽数字
- **间距**：8px 基准单位网格
- **颜色**：强调色紫色 `#7c5dfa`，卡片表面 `rgba(255,255,255,0.04)`，边框 `rgba(255,255,255,0.08)`
- **响应式**：桌面优先，768px 单断点

详见 [UI-DESIGN.md](UI-DESIGN.md) 和 [DESIGN-GLOSSARY.md](DESIGN-GLOSSARY.md)。

## 构建与测试

```bash
# 类型检查
npx tsc --noEmit

# 生产构建（类型检查 + Vite 打包）
npm run build

# 代码检查
npm run lint
```

构建输出：`dist/`（JS 约 254 KB gzip，CSS 约 29 KB gzip）

## 许可证

本项目基于 [GNU 通用公共许可证 v3.0](LICENSE) 授权。
