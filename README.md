# ChillFocus

[English](README.md) | [简体中文](README_zh.md)

---

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg)](https://vite.dev)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131.svg)](https://tauri.app)

> A cross-platform focus and productivity app — available as a web app and a native desktop application via Tauri. Featuring a Pomodoro timer, music player with audio visualization, ambient sounds, task management, and floating sticky notes — all wrapped in a modern lo-fi aesthetic.

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

### Pomodoro Timer
- Configurable focus, short break, and long break durations
- SVG progress ring with smooth animation
- Dynamic gradient background that transitions from cool to warm tones as time passes
- Auto-loop mode — automatically starts the next phase without manual intervention
- "Hide time display" mode for distraction-free focus
- "Hide visualization" toggle to hide the audio spectrum overlay
- Custom background images with a built-in drag-to-crop image cropper
- Default notification sound (Nokia ringtone mp3) with customizable alternatives

### Music Player
- 5 playback modes: Sequential, Loop List, Loop Single, Shuffle, Single
- Timed playback with optional "wait for current track to finish"
- Multiple playlists with create, rename, delete, and export/import support
- Local file upload and URL-based track addition
- Audio spectrum visualization using Web Audio API `AnalyserNode` + Canvas (60fps)
- Drag-and-drop file import
- Playlist metadata in localStorage + audio file binaries in IndexedDB

### Audio Visualization
- 64-bar frequency spectrum rendered on Canvas
- Color theme adapts to the current Pomodoro phase
- Graceful idle animation when no audio is playing

### Ambient Sounds
- 4 built-in real-world soundscapes: Rain, Fireplace, Forest, Wind
- Custom sound upload (local file or URL) with independent volume control
- All sounds loop continuously and can be mixed simultaneously
- Playing state, volume, and active selections persist across sessions

### Task Management
- Add, edit (double-click), delete, and check off tasks
- 3-level priority markers (High / Medium / Low)
- 8-color palette for visual categorization
- Sorted by completion status and priority
- localStorage persistence

### Floating Sticky Notes
- Drag the icon to any position on the page to create a note
- Click the icon to toggle show/hide all notes
- Pin/unpin notes — pinned notes scroll with the page, floating notes stay fixed
- Resizable via custom corner handle (both width and height)
- 6-color cycling palette
- Dual-layer rendering: floating (fixed) and pinned (scrolls with page)
- localStorage persistence

### Desktop-Only Features (Tauri)

#### System Tray
- Minimize to system tray on window close (configurable in Settings)
- Left-click tray icon to show/focus the window
- Right-click tray icon for quick menu: show window, toggle Pomodoro, toggle music, quit
- "Force quit" button in Settings to exit completely

#### Global Shortcuts
- System-wide hotkeys that work when the app is in the background
- Configurable per-action: toggle Pomodoro, toggle music, next track, volume up/down
- Enable/disable toggle in Settings
- Auto-re-register when shortcuts are changed in Settings
- Key format auto-conversion from web key names to Tauri's native format

#### Responsive Layout
- Fluid grid layout with breakpoints at 1024px and 768px
- Task list and music player scale proportionally with window width
- Single-column layout on narrow screens

## Demo

### Web

```bash
npm run dev
# Open http://localhost:5173/
```

### Desktop (Tauri)

```bash
npm run tauri dev
```

## Prerequisites

| Dependency       | Version | Required          |
|------------------|---------|-------------------|
| Node.js          | >= 18   | Yes               |
| npm              | >= 9    | Yes               |
| Rust & Cargo     | latest  | Tauri desktop only|

## Installation

### Web

```bash
git clone <repository-url>
cd chillfocus
npm install
npm run dev
```

### Desktop (Tauri)

Download the latest release `.zip` from the Releases page, extract it, and run the executable directly. No installation required.

To build from source:

```bash
git clone <repository-url>
cd chillfocus
npm install
npm run tauri build
```

The output binary will be in `src-tauri/target/release/` (or the platform-specific bundle directory).

## Usage

### Start Web Development Server

```bash
npm run dev
```

### Start Desktop Development Server

```bash
npm run tauri dev
```

### Build for Production

```bash
# Web
npm run build

# Desktop
npm run tauri build
```

### Preview Production Build (Web)

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
│   │   └── notification.mp3     # Default phase notification sound (Nokia ringtone)
│   ├── icons.svg                # SVG icon sprite
│   └── favicon.svg              # App icon
├── src/
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root component — layout composition
│   ├── App.css                  # Global layout styles
│   ├── index.css                # CSS variables, dark theme, scrollbar
│   ├── assets/
│   │   ├── hero.png             # Hero image
│   │   ├── react.svg            # React logo
│   │   └── vite.svg             # Vite logo
│   ├── types/
│   │   └── index.ts             # Global type definitions
│   ├── utils/
│   │   ├── audioStore.ts        # IndexedDB wrapper for audio file storage
│   │   ├── audioFormats.ts      # Supported audio format whitelist
│   │   ├── notificationSound.ts # Web Audio API notification synthesis
│   │   ├── noiseGenerator.ts    # Ambient noise synthesis (legacy)
│   │   ├── tauriFileAccess.ts   # Tauri filesystem abstraction (read/write files on desktop)
│   │   ├── openUrl.ts           # Cross-platform URL opener (Tauri shell / window.open fallback)
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
│       ├── StickyNotes.tsx       # Floating/sticky note system
│       └── GlobalSettings.tsx    # Settings: tray, shortcuts, force quit
├── src-tauri/                   # Tauri desktop shell
│   ├── src/
│   │   ├── main.rs              # Tauri entry point
│   │   └── lib.rs               # Tauri plugin registration and commands
│   ├── capabilities/            # Tauri permission manifests
│   ├── icons/                   # App icons for all platforms
│   ├── tauri.conf.json          # Tauri configuration
│   ├── Cargo.toml               # Rust dependencies
│   └── build.rs                 # Tauri build script
├── docs/
│   ├── ARCHITECTURE.md          # Technical architecture document
│   ├── UI-DESIGN.md             # UI design system documentation
│   ├── DESIGN-GLOSSARY.md       # Frontend design terminology reference
│   └── DEBUG-LESSONS.md         # Debugging experience and lessons
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Technical Architecture

### Dual-Platform File Access

ChillFocus runs on both Web and Desktop (Tauri) with a unified data layer:

| Platform | File Storage | Metadata Storage | File Path Access |
|----------|-------------|------------------|------------------|
| Web      | IndexedDB   | localStorage     | Not available    |
| Desktop  | IndexedDB   | localStorage     | Via `tauriFileAccess.ts` (Tauri `fs` plugin) |

- `tauriFileAccess.ts` provides a cross-platform abstraction: on Tauri it reads/writes files via the native filesystem plugin and stores the `filePath` in IndexedDB; on Web it falls back to IndexedDB blob storage.
- `openUrl.ts` opens external links via `@tauri-apps/plugin-shell` on desktop, or `window.open` on Web.

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

### Audio Format Whitelist

`mp3`, `wav`, `ogg`, `flac`, `aac`, `m4a`, `opus`, `webm`, `weba`

Formats are validated at import time via a shared whitelist in `audioFormats.ts`. Unsupported formats (e.g., APE) are silently rejected. This whitelist is applied consistently across Web and Desktop platforms.

### Design System

- **Theme**: Dark mode with Glassmorphism panels
- **Font**: Inter (200–600 weights), tabular-nums for timers
- **Spacing**: 8px base unit grid
- **Colors**: Purple accent `#7c5dfa`, card surface `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.08)`
- **Responsive**: Desktop-first, breakpoints at 1024px and 768px

See [UI-DESIGN.md](docs/UI-DESIGN.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md), and [DESIGN-GLOSSARY.md](docs/DESIGN-GLOSSARY.md) for complete documentation.

## Build & Test

```bash
# Type check
npx tsc --noEmit

# Production build — Web (type check + Vite bundle)
npm run build

# Production build — Desktop (type check + Vite bundle + Tauri bundle)
npm run tauri build

# Development — Web
npm run dev

# Development — Desktop (hot-reload)
npm run tauri dev

# Lint
npm run lint
```

Web build output: `dist/`

Desktop build output: `src-tauri/target/release/` and platform-specific bundles in `src-tauri/target/release/bundle/`

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
