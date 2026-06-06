# ChillFocus 前端 UI 设计详解

> 本文档使用前端设计术语，逐层解析 ChillFocus 的视觉设计决策。

---

## 一、整体设计风格

### 1.1 设计语言

ChillFocus 采用 **暗色模式（Dark Mode）** 为基础的 **现代简约（Minimalism）** 风格，融合 **Glassmorphism（玻璃拟态）** 效果，营造沉浸式的 Lo-fi 专注氛围。

**设计关键词**：沉浸、柔和、层次分明、低干扰

### 1.2 设计风格对照

| 风格特征 | ChillFocus 中的体现 |
|---------|-------------------|
| **暗色模式** | 深色背景 `#0f0f1a`，非纯黑，避免刺眼 |
| **Glassmorphism** | 卡片使用 `backdrop-filter: blur(20px)` + 半透明背景 |
| **Minimalism** | 大留白、精简控件、无多余装饰 |
| **渐变色运用** | Logo 文字、番茄钟背景的动态渐变 |

---

## 二、色彩系统（Color System）

### 2.1 CSS 变量定义

所有颜色通过 CSS 自定义属性（CSS Variables）集中管理，确保全局一致性：

```css
--bg-main:       #0f0f1a           /* 主背景 — 深蓝灰，非纯黑 */
--bg-card:       rgba(255,255,255,0.04)  /* 卡片表面色 — 极低不透明度白 */
--bg-card-hover: rgba(255,255,255,0.07)  /* 卡片悬停态 — 略微提亮 */
--border:        rgba(255,255,255,0.08)  /* 边框色 — 8% 白色，极淡 */
--accent:        #7c5dfa            /* 强调色 — 紫色，品牌主色 */
--accent-glow:   rgba(124,93,250,0.3)    /* 强调色发光 — 用于阴影/光晕 */
--text-primary:  rgba(255,255,255,0.9)   /* 主文字色 — 90% 白，非纯白 */
--text-secondary:rgba(255,255,255,0.45)  /* 次要文字色 — 45% 白 */
```

### 2.2 色彩层次解析

```
层级            颜色                              用途
─────────────────────────────────────────────────────────
背景层          #0f0f1a                           body 背景
表面层          rgba(255,255,255,0.04)            卡片/面板背景
边框层          rgba(255,255,255,0.08)            分割线、边框
主文字          rgba(255,255,255,0.9)             标题、正文
次文字          rgba(255,255,255,0.45)            说明、时间戳
强调色          #7c5dfa                           按钮、选中态、链接
强调色发光      rgba(124,93,250,0.3)              便签图标阴影、光晕
```

**设计意图**：
- 背景不用纯黑 `#000`，用 `#0f0f1a`（深蓝灰），减少 OLED 屏的刺眼感
- 文字不用纯白 `#fff`，用 90% 白，降低长时间阅读的视觉疲劳
- 边框仅 8% 不透明度，保持极简的视觉分隔

### 2.3 Logo 渐变色

```css
background: linear-gradient(135deg, var(--accent), #ff6b9d);
-webkit-background-clip: text;
```

Logo 文字使用从紫色 `#7c5dfa` 到粉色 `#ff6b9d` 的 **135° 线性渐变（Linear Gradient）**，配合 `background-clip: text` 实现文字渐变填充效果，增添品牌辨识度。

---

## 三、排版系统（Typography）

### 3.1 字体选择

```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;
```

选用 **Inter** 作为主字体族（Font Family），这是一款专为屏幕显示设计的无衬线字体（Sans-serif），具备优秀的可读性。备选 `system-ui` → `sans-serif` 确保跨平台回退。

### 3.2 字重（Font Weight）使用

| 字重值 | 用途 | 示例 |
|-------|------|------|
| `200` (Extra Light) | 番茄钟时间数字 | `36px` 大号时间显示 |
| `400` (Regular) | 正文、说明文字 | 轮数文字、次要信息 |
| `500` (Medium) | 阶段标签、按钮文字 | "专注"、"短休息" |
| `600` (Semi Bold) | 模块标题、Logo | "音乐播放器"、"任务列表" |

### 3.3 字号层级

```
36px  超大  →  番茄钟时间（timeText），font-weight: 200
24px  大    →  不存在（避免层级跳跃过大）
20px  中大  →  Logo 文字（logo-text）
15px  中    →  模块标题（title），font-weight: 600
14px  正常  →  阶段标签（phaseLabel），大写 + 3px 字间距
13px  小正  →  设置面板标签、输入框
12px  小    →  次要说明、列表项、时间戳
11px  极小  →  徽标、提示文字、标签
```

### 3.4 特殊排版处理

**阶段标签**：
```css
text-transform: uppercase;   /* 全大写 */
letter-spacing: 3px;         /* 宽字间距 */
color: rgba(255,255,255,0.6);
```
将 "专注"、"短休息" 等文字转为全大写，配合 3px 字间距，营造仪式感。

**时间数字**：
```css
font-variant-numeric: tabular-nums;  /* 等宽数字 */
```
使用 **Tabular Nums（等宽数字）** 确保倒计时数字宽度一致，避免每秒跳动时产生布局偏移（Layout Shift）。

**文字阴影**：
```css
text-shadow: 0 0 30px rgba(255,255,255,0.15);
```
时间文字添加 30px 模糊半径的微弱白色光晕，增强视觉层次。

---

## 四、间距系统（Spacing）

### 4.1 基准单位

项目以 **8px** 为隐式基准单位，所有间距均为 8 的倍数或近似值：

```
4px   → 最小间距（圆点间隙、图标与文字间）
8px   → 紧凑间距（卡片内 padding、列表项 padding）
10px  → 环境音卡片 gap
12px  → 设置面板 padding、输入框 padding
14px  → 模块内 gap（面板内部元素间距）
16px  → 标准间距（控制按钮 gap、header padding、内容区 gap）
18px  → 面板 padding
20px  → 页面级间距（main gap、页面 padding）
24px  → 番茄钟内容 padding、大间距
32px  → 番茄钟顶部 padding、大按钮尺寸
```

### 4.2 Flexbox Gap 模式

项目大量使用 Flexbox 的 `gap` 属性控制子元素间距，避免手动设置 margin：

```css
/* 面板内部 */
.panel { gap: 14px; }

/* 控制按钮组 */
.controls { gap: 16px; }

/* 页面主区域 */
.app-main { gap: 20px; }

/* Logo 内部 */
.logo { gap: 8px; }
```

---

## 五、圆角系统（Border Radius）

### 5.1 圆角层级

| 圆角值 | 用途 | 语义 |
|-------|------|------|
| `50%` | 圆形元素 | 播放按钮、设置按钮、音量按钮、便签操作按钮 |
| `6px` | 小圆角 | 列表删除按钮、小标签 |
| `8px` | 中小圆角 | 输入框、播放列表标签、下拉菜单项 |
| `10px` | 中圆角 | 曲目列表容器、设置面板按钮 |
| `12px` | 中大圆角 | 环境音卡片、便签 |
| `14px` | 大圆角 | 播放列表标签（Tab） |
| `16px` | 面板级 | 侧边面板（task-panel、music-panel） |
| `20px` | 容器级 | 番茄钟容器 |
| `9999px` | 胶囊形 | 播放列表标签（Tab 的 pill 形状） |

### 5.2 圆角设计意图

- **大圆角（16-20px）** 用于容器级元素，传达柔和、友好的视觉感受
- **圆形（50%）** 用于操作按钮，强调可点击性
- **胶囊形** 用于播放列表标签，区分选中/未选中状态

---

## 六、阴影与发光（Shadow & Glow）

### 6.1 便签图标发光

```css
box-shadow: 0 4px 20px rgba(124, 93, 250, 0.4);
```

便签浮动图标使用强调色的 **Glow（发光）** 效果：4px 垂直偏移 + 20px 模糊半径 + 40% 不透明度紫色，使其在暗色背景上醒目突出。

### 6.2 进度环发光

```css
filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
```

SVG 进度环使用 `drop-shadow` 滤镜实现柔和的白色光晕，增强进度感。

### 6.3 便签卡片阴影

```css
/* 默认态 */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

/* 悬停态 — 更深更大的阴影 */
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
```

便签卡片使用黑色阴影营造 **浮起感（Elevation）**，悬停时阴影加深加大，暗示交互反馈。

---

## 七、布局架构（Layout Architecture）

### 7.1 整体页面布局

```
.app
├── .app-header          ← Flexbox row, space-between
├── .app-main            ← Flexbox column, gap: 20px
│   ├── .timer-section   ← 全宽
│   └── .bottom-panels   ← Grid 两栏: 280px | 1fr
│       ├── .task-panel
│       └── .music-panel
└── StickyNotes          ← Fixed overlay 层
```

**关键设计决策**：

| 决策 | 实现 | 原因 |
|------|------|------|
| 页面最大宽度 | `max-width: 1200px` | 内容不无限拉伸，保持可读性 |
| 页面居中 | `margin: 0 auto` | 大屏下内容居中显示 |
| 底部面板 | `Grid 280px 1fr` | 任务列表固定窄宽，音乐播放器自适应 |
| 垂直间距 | Flexbox `gap: 20px` | 模块间统一 20px 间距 |

### 7.2 Grid 双栏布局

```css
.bottom-panels {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 20px;
  align-items: start;
}
```

- 左栏固定 `280px`：任务管理面板，内容紧凑不需要拉伸
- 右栏 `1fr`：音乐播放器 + 环境音，填满剩余空间
- `align-items: start`：两栏高度独立，不强制等高

### 7.3 响应式断点

```css
@media (max-width: 768px) {
  .bottom-panels { grid-template-columns: 1fr; }
  .task-panel, .music-panel { max-height: none; }
}
```

在 `76px` 断点处，双栏 **Grid** 切换为单列，面板移除最大高度限制，变为自然高度。

---

## 八、番茄钟设计（Pomodoro Timer）

### 8.1 容器设计

```css
.container {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- **固定高度 320px**：保证视觉一致性，不随内容变化
- **大圆角 20px**：柔和的容器边界
- **overflow: hidden**：裁剪渐变背景和可视化超出部分
- **Flexbox 居中**：内容垂直水平居中

### 8.2 渐变背景（Gradient Background）

番茄钟背景使用 `radial-gradient`（径向渐变），根据当前阶段和进度动态计算颜色：

```
专注阶段:     冷蓝紫 #1a1a2e  →  暖橙红 #ff6b6b
短休息阶段:   深青 #0f3443    →  薄荷绿 #a3e4d7
长休息阶段:   深绿 #1b4332    →  浅绿 #d8f3dc
```

通过 `lerpColor` 线性插值函数，根据 `progress`（0→1）在起始色和结束色之间平滑过渡。CSS `transition: background 2s ease` 确保颜色切换有 **2 秒的缓入缓出过渡**，避免突兀跳变。

**视觉效果**：随着时间流逝，背景从冷色调逐渐变为暖色调，隐喻"时间在变暖"。

### 8.3 进度环（Progress Ring）

```
┌─────────────────┐
│     ╭─────╮     │
│    ╱   25:00 ╲   │    ← SVG 圆环
│   │    01:30   │   │    ← 圆心：时间 + 轮数
│    ╲  第1/4轮 ╱   │
│     ╰─────╯     │
│                 │
│   ▶  ⏮  ⏭     │    ← 控制按钮
│                 │
│ ▐▐▌▌▐▌▐▌▐▌▐▌▐▌ │    ← 音频可视化（62%高度）
└─────────────────┘
```

**SVG 实现**：

```css
.ring { transform: rotate(-90deg); }  /* 从顶部开始绘制 */
```

通过 `stroke-dasharray`（周长）和 `stroke-dashoffset`（偏移量）控制进度：
- `dasharray = 2π × 90 ≈ 565.49`（圆的周长）
- `dashoffset = 周长 × (1 - progress)`
- CSS `transition: stroke-dashoffset 1s linear` 确保每秒平滑推进

进度环使用 `drop-shadow` 滤镜添加白色光晕，增强视觉层次。

### 8.4 控制按钮

| 按钮 | 尺寸 | 圆角 | 背景 | 语义 |
|------|------|------|------|------|
| **主按钮**（播放/暂停） | 56×56px | 50%（圆形） | 20% 白 + `backdrop-filter: blur(10px)` | Primary action |
| **次按钮**（重置/跳过） | 40×40px | 50%（圆形） | 10% 白 | Secondary action |
| **设置按钮** | 32×32px | 50%（圆形） | 10% 白 | Icon button |

**交互状态**：
```css
/* 悬停 — 背景提亮 + 轻微放大 */
.btnPrimary:hover {
  background: rgba(255,255,255,0.3);
  transform: scale(1.05);
}

/* 过渡 — 所有属性 0.2s 缓入缓出 */
transition: all 0.2s ease;
```

主按钮使用 **Glassmorphism** 效果：半透明白色背景 + `backdrop-filter: blur(10px)` 毛玻璃，与渐变背景产生层次感。

### 8.5 音频可视化

```css
.visualizerWrap {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 62%;
  z-index: 0;
  pointer-events: none;
}
```

可视化区域 **绝对定位（Absolute）** 在容器底部，高度为容器的 62%。`z-index: 0` 确保在内容层（`z-index: 1`）之下，形成内容浮在频谱之上的层次关系。`pointer-events: none` 使其不阻挡交互。

频谱条颜色随阶段变化：
- 专注：紫→红渐变
- 短休息：青→绿渐变
- 长休息：深绿→浅绿渐变

---

## 九、面板设计（Panel Design）

### 9.1 Glassmorphism 卡片

```css
.panel {
  background: var(--bg-card);           /* rgba(255,255,255,0.04) */
  backdrop-filter: blur(20px);          /* 毛玻璃效果 */
  border: 1px solid var(--border);      /* rgba(255,255,255,0.08) */
  border-radius: 16px;                  /* 大圆角 */
  padding: 18px;                        /* 内边距 */
  display: flex;
  flex-direction: column;
  gap: 14px;
}
```

**Glassmorphism 三要素**：
1. **半透明背景**：4% 不透明度白色，透出底层内容
2. **背景模糊**：20px 毛玻璃模糊
3. **微妙边框**：8% 白色边框，增强玻璃质感

### 9.2 面板最大高度

```css
.task-panel  { max-height: 640px; }
.music-panel { max-height: 640px; overflow: visible; }
```

两个面板限制最大高度 640px，防止内容过多时撑开页面。任务面板超出时内部滚动，音乐面板 `overflow: visible` 确保环境音模块始终可见。

---

## 十、音乐播放器设计（Music Player）

### 10.1 控制栏三栏布局

```
┌─────────┬───────────────────┬─────────┐
│  模式    │   ⏮  ▶  ⏭       │  音量    │
│  定时    │                   │         │
│ (左侧)  │    (居中)         │ (右侧)  │
└─────────┴───────────────────┴─────────┘
```

```css
.controls {
  display: flex;
  justify-content: space-between;  /* 三栏分散对齐 */
}
.controlsCenter { justify-content: center; }
```

使用 Flexbox `space-between` 实现三栏分散布局，播放控制按钮居中，模式/定时在左，音量在右。

### 10.2 播放列表标签（Playlist Tabs）

```css
.playlistTab {
  padding: 4px 12px;
  border-radius: 14px;        /* 胶囊形 */
  border: 1px solid var(--border);
  background: var(--bg-card);
}

.playlistTabActive {
  background: var(--accent);   /* 紫色填充 */
  color: #fff;
  border-color: var(--accent);
}
```

标签使用 **Pill（胶囊形）** 圆角 `14px`，选中态切换为强调色填充，形成明确的选中/未选中对比。

### 10.3 曲目列表

```css
.trackListWrap {
  height: 200px;              /* 固定高度 */
  overflow-y: auto;           /* 超出滚动 */
}
```

曲目列表使用 **固定高度 200px**，超出部分内部滚动，不随曲目数量变化。

**回到顶部按钮**：
```css
.backToTopBtn {
  position: sticky;           /* 粘性定位 */
  bottom: 8px;                /* 吸附在滚动容器底部 */
  /* 28px 圆形图标按钮 */
}
```

使用 **Sticky Positioning（粘性定位）** 确保按钮始终吸附在列表底部可见位置。仅在曲目超过 5 首时显示。

### 10.4 下拉菜单（Dropdown）

```css
.dropdown {
  position: absolute;
  background: #1e1e32;
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);  /* 深层浮起阴影 */
}
```

下拉菜单使用较深的背景色 `#1e1e32`（比面板更深），配合 **8px 偏移 + 24px 模糊** 的深层阴影，与面板形成明确的层级关系。

---

## 十一、环境音设计（Ambient Sounds）

### 11.1 网格布局

```css
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);  /* 4列等宽 */
  gap: 6px;
}
```

4 个预设环境音使用 **Grid 四列等宽** 布局，紧凑排列。

### 11.2 激活态反馈

```css
.soundCardActive {
  border-color: var(--accent);                    /* 紫色边框 */
  background: rgba(124, 93, 250, 0.08);          /* 8% 紫色背景 */
}

.soundCardActive .icon {
  transform: scale(1.15);                         /* 图标放大 15% */
}

.soundCardActive .label {
  color: var(--accent);                           /* 文字变紫 */
}
```

激活态通过 **边框变色 + 背景着色 + 图标放大 + 文字变色** 四重反馈，清晰传达当前状态。

---

## 十二、任务管理设计（Task Manager）

### 12.1 优先级色彩编码

```
高优先级:  #ff6b6b (红色)
中优先级:  #ffd43b (黄色)
低优先级:  #69db7c (绿色)
```

使用 **语义化色彩**（红=紧急、黄=注意、绿=轻松）直观传达优先级，通过小圆点（`10px` 圆形）展示。

### 12.2 任务颜色

```css
.item {
  border-left: 3px solid var(--accent);  /* 左侧彩色边框 */
}

.checked {
  background: task-color;  /* 勾选框使用任务颜色填充 */
}
```

每个任务支持 8 种颜色（`#7c5dfa`, `#ff6b9d`, `#ffd43b`, `#ff8787`, `#74c0fc`, `#69db7c`, `#da77f2`, `#ffa94d`），通过 **左侧 3px 彩色边框** 标识。添加任务时可通过色块按钮选择颜色，任务上的色点可循环切换。

### 12.3 完成态样式

```css
.itemDone { opacity: 0.5; }
.itemDone .text { text-decoration: line-through; }
```

完成的任务使用 **50% 不透明度 + 删除线**，降低视觉权重但不完全隐藏，保持上下文可追溯。

### 12.4 渐进式交互

```css
/* 删除按钮默认隐藏，悬停时渐显 */
.deleteBtn { opacity: 0; }
.item:hover .deleteBtn { opacity: 1; }
```

使用 **渐进式披露（Progressive Disclosure）** 模式：操作按钮默认隐藏，仅在悬停时显示，减少界面视觉噪音。

---

## 十三、便签设计（Sticky Notes）

### 13.1 浮动层架构

```
notesLayer (position: fixed, pointer-events: none)
└── note (pointer-events: auto)     ← 浮动便签，viewport 定位

pinnedLayer (position: absolute, pointer-events: none)
└── note (pointer-events: auto)     ← 固定便签，page 定位
```

两层分离渲染：
- **Floating 层**：`position: fixed`，便签不随页面滚动
- **Pinned 层**：`position: absolute`，便签随页面滚动

两层均设置 `pointer-events: none` 确保不阻挡页面其他交互，单个便签 `pointer-events: auto` 恢复交互能力。

### 13.2 便签卡片

```css
.note {
  position: fixed;
  min-width: 80px;
  min-height: 60px;
  border-radius: 8px;
  padding: 8px;
  padding-bottom: 14px;      /* 为底部 resize 手柄留空间 */
  resize: none;              /* 禁用原生 resize */
  overflow: hidden;
}
```

便签使用 **鲜艳的半透明背景色**（`color + 'e6'`，90% 不透明度），在暗色页面上形成 **色彩点缀**，类似实体便利贴的视觉隐喻。

### 13.3 操作按钮

便签操作区包含三个按钮：
- **换色**：`14px` 彩色圆形，点击循环切换 6 种颜色
- **固定**：📌 emoji 按钮，切换浮动/固定状态
- **删除**：× 按钮，hover 时变红（`#ff6b6b`）

三个按钮使用 **渐进式披露**：默认 `opacity: 0`，悬停便签时 `opacity: 1`。

### 13.4 Resize 手柄

```css
.resizeHandle {
  position: absolute;
  bottom: 0; right: 0;
  width: 16px; height: 16px;
  cursor: nwse-resize;
}

.resizeHandle::after {
  /* CSS 伪元素绘制的角标 */
  border-right: 2px solid rgba(0,0,0,0.2);
  border-bottom: 2px solid rgba(0,0,0,0.2);
}
```

自定义 resize 手柄替代浏览器原生实现，通过 `e.stopPropagation()` 与拖拽逻辑分离。角标使用 **CSS 伪元素 `::after`** 绘制两条 L 形线段。

---

## 十四、滚动条设计（Scrollbar）

```css
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--border);           /* rgba(255,255,255,0.08) */
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.15);  /* 悬停提亮 */
}
```

自定义滚动条极窄（`5px`），轨道透明，滑块使用与边框同色的极淡白色，悬停时略微提亮。整体视觉上几乎不可见，不干扰内容阅读。

---

## 十五、过渡与动画（Transition & Animation）

### 15.1 全局过渡策略

项目统一使用 `transition: all 0.2s ease` 作为默认过渡，确保所有交互状态变化都有平滑的 **200ms 缓入缓出** 过渡。

### 15.2 特定过渡

| 元素 | 属性 | 时长 | 缓动 | 目的 |
|------|------|------|------|------|
| 渐变背景 | `background` | `2s` | `ease` | 阶段切换时颜色缓慢过渡 |
| 进度环 | `stroke-dashoffset` | `1s` | `linear` | 每秒匀速推进一格 |
| 按钮悬停 | `transform: scale(1.05)` | `0.2s` | `ease` | 轻微放大反馈 |
| 便签阴影 | `box-shadow` | `0.2s` | `ease` | 悬停时阴影加深 |
| 便签层 | `opacity` | `0.3s` | `ease` | 显隐切换淡入淡出 |
| 设置面板 | `opacity` | `0.2s` | `ease` | 弹出淡入 |
| 下拉菜单 | 无过渡 | — | — | 即时显示 |

### 15.3 脉动动画

```css
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(255,255,255,0.4); }
  50%      { box-shadow: 0 0 18px rgba(255,255,255,0.7); }
}
```

当前轮次的圆点使用 **脉动（Pulse）** 动画：光晕在 8px→18px 之间呼吸式变化，暗示"正在计时"。

---

## 十六、Z-Index 层级管理

```
z-index   元素                   语义
────────────────────────────────────────────
  60      下拉菜单               最高层交互浮层
  50      便签图标               全局操作入口
  40      浮动便签层              便签 overlay（fixed）
   5      固定便签层              便签 overlay（absolute）
   5      设置按钮                容器内交互元素
   2      回到顶部按钮            容器内辅助元素
   1      内容层 (.content)       主要内容
   0      可视化层                底层装饰
  —       背景层                  最底层
```

---

## 十七、响应式设计总结

| 断点 | 变化 |
|------|------|
| `> 768px` | 双栏 Grid 布局，面板 max-height 640px |
| `≤ 768px` | 单列布局，面板移除 max-height，页面 padding 缩小 |
| 番茄钟 | 容器高度 320px → 280px，进度环 200px → 160px，时间字号 36px → 28px |

响应式采用 **Desktop-first** 策略，使用 `max-width` 断点适配小屏。
