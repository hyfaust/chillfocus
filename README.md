# ChillFocus

[English](README.md) | [简体中文](README_zh.md)

---

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg)](https://vite.dev)

> A web-based focus and productivity app featuring a Pomodoro timer, music player with audio visualization, ambient sounds, task management, and floating sticky notes — all wrapped in a modern lo-fi aesthetic.

## Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Technical Architecture](#technical-architecture)
- [Build & Test](#build--test)
- [License](#license)

## Features

### 🍅 Pomodoro Timer
- Configurable focus, short break, and long break durations
- SVG progress ring with smooth animation
- Dynamic gradient background that transitions from cool to warm tones as time passes
- Auto-loop mode — automatically starts the next phase without manual intervention
- Customizable notification sounds and background images (with built-in image cropper)
- "Hide time display" mode for distraction-free focus
- Toggleable audio visualization overlay (62% of container height)

### 🎵 Music Player
- Multiple playlists with create, rename, delete, and export/import support
- 5 playback modes: Sequential, Loop List, Loop Single, Shuffle, Single
- Timed playback with optional "wait for current track to finish"
- Audio spectrum visualization using Web Audio API `AnalyserNode` + Canvas (60fps)
- Local file upload and URL-based track addition
- Drag-and-drop file import
- Playlist persistence via localStorage + IndexedDB (audio files stored as binary blobs)

### 🌧️ Ambient Sounds
- 4 built-in real-world soundscapes: Rain, Fireplace, Forest, Wind
- Custom sound upload (local file or URL) with independent volume control
- All sounds can be mixed and played simultaneously
- Playing state and volume persist across sessions

### ✅ Task Management
- Add, edit (double-click), delete, and check off tasks
- 3-level priority markers (High / Medium / Low)
- 8-color palette for visual categorization
- Sorted by completion status and priority
- localStorage persistence

### 📝 Floating Sticky Notes
- Drag the icon to any position on the page to create a note
- Click the icon to toggle show/hide all notes
- Pin/unpin notes — pinned notes scroll with the page, floating notes stay fixed
- Resizable via custom corner handle (both width and height)
- Color cycling (6 colors)
- localStorage persistence

### 🎨 Audio Visualization
- 64-bar frequency spectrum rendered on Canvas
- Color theme adapts to the current Pomodoro phase
- Graceful idle animation when no audio is playing

## Demo

```bash
npm run dev
# Open http://localhost:5173/
```

## Prerequisites

| Dependency | Version | Required |
|------------|---------|----------|
| Node.js    | >= 18   | Yes      |
| npm        | >= 9    | Yes      |

## Installation

```bash
git clone <repository-url>
cd chillfocus
npm install
```

## Usage

### Start Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Project Structure

```
chillfocus/
├── public/
│   ├── sounds/                  # Built-in audio assets
│   │   ├── rain.ogg             # Rain soundscape
│   │   ├── fireplace.ogg        # Fireplace crackling
│   │   ├── forest.ogg           # Forest with birds and river
│   │   ├── wind.ogg             # Outdoor wind ambience
│   │   └── notification.mp3     # Default phase notification sound
│   └── favicon.svg              # App icon
├── src/
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root component — layout composition
│   ├── App.css                  # Global layout styles
│   ├── index.css                # CSS variables, dark theme, scrollbar
│   ├── types/
│   │   └── index.ts             # Global type definitions
│   ├── utils/
│   │   ├── audioStore.ts        # IndexedDB wrapper for audio file storage
│   │   ├── audioFormats.ts      # Supported audio format whitelist
│   │   ├── notificationSound.ts # Web Audio API notification synthesis
│   │   ├── noiseGenerator.ts    # Ambient noise synthesis (legacy)
│   │   └── timeUtils.ts         # Time formatting and ID generation
│   ├── hooks/
│   │   ├── usePomodoro.ts       # Pomodoro state machine
│   │   ├── useAudioPlayer.ts    # Audio playback engine (playlists, modes, timer)
│   │   ├── useAudioVisualizer.ts# AnalyserNode + Canvas spectrum renderer
│   │   └── useLocalStorage.ts   # Generic localStorage hook
│   └── components/
│       ├── PomodoroTimer.tsx     # Timer UI with progress ring
│       ├── GradientBackground.tsx# Dynamic radial gradient background
│       ├── AudioVisualizer.tsx   # Canvas-based frequency bars
│       ├── PomodoroSettings.tsx  # Settings modal with sliders and toggles
│       ├── ImageCropper.tsx      # Drag-to-crop image tool
│       ├── MusicPlayer.tsx       # Full-featured music player
│       ├── AmbientSounds.tsx     # Ambient sound mixer
│       ├── TaskManager.tsx       # Task list with priorities and colors
│       └── StickyNotes.tsx       # Floating/sticky note system
├── ARCHITECTURE.md              # Technical architecture document
├── UI-DESIGN.md                 # UI design system documentation
├── DESIGN-GLOSSARY.md           # Frontend design terminology reference
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Technical Architecture

### Data Persistence

| Data | Storage | Key |
|------|---------|-----|
| Task list | localStorage | `chillfocus-tasks` |
| Sticky notes | localStorage | `chillfocus-notes` |
| Pomodoro settings | localStorage | `chillfocus-pomodoro-settings` |
| Playlist structure | localStorage | `chillfocus-playlists` |
| Player prefs (volume, mode) | localStorage | `chillfocus-player-prefs` |
| Custom ambient sounds | localStorage | `chillfocus-custom-sounds` |
| Ambient volumes | localStorage | `chillfocus-ambient-volumes` |
| Active ambient sounds | localStorage | `chillfocus-ambient-active` |
| Audio file binaries | IndexedDB | `chillfocus-audio` / `files` |

### Audio Pipeline

```
HTMLAudioElement → MediaElementAudioSourceNode → AnalyserNode → destination
                                                       ↓
                                              getByteFrequencyData (128 bins)
                                                       ↓
                                              Canvas: 64 gradient bars @ 60fps
```

### Supported Audio Formats

`mp3`, `wav`, `ogg`, `flac`, `aac`, `m4a`, `opus`, `webm`, `weba`

Formats are validated at import time via a shared whitelist. Unsupported formats (e.g., APE) are silently rejected.

### Design System

- **Theme**: Dark mode with Glassmorphism panels
- **Font**: Inter (200–600 weights), tabular-nums for timers
- **Spacing**: 8px base unit grid
- **Colors**: Purple accent `#7c5dfa`, card surface `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.08)`
- **Responsive**: Desktop-first, single breakpoint at 768px

See [UI-DESIGN.md](UI-DESIGN.md) and [DESIGN-GLOSSARY.md](DESIGN-GLOSSARY.md) for complete documentation.

## Build & Test

```bash
# Type check
npx tsc --noEmit

# Production build (type check + Vite bundle)
npm run build

# Lint
npm run lint
```

Build output: `dist/` (~254 KB JS gzip'd, ~29 KB CSS gzip'd)

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
