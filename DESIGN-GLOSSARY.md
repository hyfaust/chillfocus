# 前端设计术语速查手册

> 方便你与 AI 精准沟通 UI/UX 设计意图的参考文档。

---

## 一、布局（Layout）

### 1.1 布局模型

| 术语 | 说明 | 示例 |
|------|------|------|
| **Flexbox** | 一维弹性布局，沿主轴排列子元素 | 导航栏、控制按钮组 |
| **Grid** | 二维网格布局，同时控制行和列 | 整体页面骨架、仪表盘 |
| **Flow（文档流）** | 元素按 HTML 顺序自然排列 | 正文段落 |
| **Absolute（绝对定位）** | 脱离文档流，相对最近的定位祖先定位 | 弹窗、浮层、角标 |
| **Fixed（固定定位）** | 脱离文档流，相对视口定位，不随滚动 | 顶部导航栏、悬浮按钮 |
| **Sticky（粘性定位）** | 正常文档流中滚动到阈值后"粘住" | 回到顶部按钮、表头吸顶 |

### 1.2 布局概念

| 术语 | 说明 |
|------|------|
| **Container** | 包裹内容的外层容器，通常控制最大宽度 |
| **Viewport（视口）** | 浏览器可见区域，`100vw` = 视口宽度 |
| **Above the fold** | 首屏可见区域，无需滚动即可看到的内容 |
| **Responsive（响应式）** | 布局随屏幕尺寸自适应调整 |
| **Breakpoint（断点）** | 响应式切换的屏幕宽度阈值（如 768px、1024px） |
| **Sidebar（侧边栏）** | 页面侧方的辅助导航或功能区域 |
| **Hero section** | 页面顶部的大面积视觉展示区域 |
| **Sticky header** | 滚动时固定在顶部的导航头 |
| **Full-bleed** | 内容撑满整个视口宽度，无留白 |

### 1.3 Flexbox 常用属性速查

```
主轴方向:  flex-direction: row | column
对齐:      justify-content: flex-start | center | flex-end | space-between | space-around
交叉轴:    align-items: flex-start | center | flex-end | stretch
换行:      flex-wrap: wrap | nowrap
间距:      gap: 16px
弹性:      flex: 1 (填满剩余空间)
```

---

## 二、间距与尺寸（Spacing & Sizing）

### 2.1 间距术语

| 术语 | 说明 | CSS 属性 |
|------|------|---------|
| **Padding（内边距）** | 元素边框到内容之间的距离 | `padding` |
| **Margin（外边距）** | 元素边框到相邻元素之间的距离 | `margin` |
| **Gap（间隙）** | Flex/Grid 子元素之间的统一间距 | `gap` |
| **Gutter（沟槽）** | Grid 列与列之间的间距 | `column-gap` |
| **Inset（内缩）** | 四个方向同时设置内边距的简写 | `inset: 0`（四边为0） |
| **Offset（偏移）** | 元素相对于原始位置的位移 | `transform: translate()` |

### 2.2 尺寸单位

| 单位 | 说明 | 用途 |
|------|------|------|
| `px` | 像素，绝对单位 | 精确控制边框、阴影 |
| `em` | 相对于父元素字体大小 | 字体相关的缩放 |
| `rem` | 相对于根元素字体大小 | 全局一致的间距/字体 |
| `%` | 相对于父元素尺寸 | 流式布局宽度 |
| `vw/vh` | 视口宽度/高度的 1% | 全屏布局 |
| `fr` | Grid 弹性比例单位 | 网格列宽分配 |
| `ch` | 字符 "0" 的宽度 | 文本容器宽度 |
| `clamp()` | 响应式尺寸函数 | `clamp(12px, 2vw, 18px)` |

---

## 三、排版（Typography）

### 3.1 字体属性

| 术语 | 说明 | 示例 |
|------|------|------|
| **Font family（字体族）** | 字体名称，可设多个备选 | `'Inter', sans-serif` |
| **Font weight（字重）** | 字体粗细 | `200`(极细) `400`(正常) `600`(半粗) `800`(特粗) |
| **Font size（字号）** | 文字大小 | `14px`, `1.25rem` |
| **Line height（行高）** | 每行文字的高度 | `1.5`（1.5倍行距） |
| **Letter spacing（字间距）** | 字符之间的水平距离 | `0.5px`, `3px` |
| **Word spacing（词间距）** | 单词之间的距离 | 一般不手动设置 |
| **Font style** | 字体样式 | `normal` / `italic`(斜体) |

### 3.2 文本属性

| 术语 | 说明 |
|------|------|
| **Text align** | 水平对齐：`left` / `center` / `right` / `justify` |
| **Text decoration** | 装饰线：`underline`(下划线) / `line-through`(删除线) / `none` |
| **Text transform** | 大小写：`uppercase`(全大写) / `lowercase` / `capitalize`(首字母大写) |
| **Text overflow** | 溢出处理：`ellipsis`(省略号) / `clip`(裁剪) |
| **Truncate（截断）** | 单行文本溢出显示省略号 |
| **Line clamp（行钳制）** | 多行文本限制行数后显示省略号 |
| **Tabular nums** | 等宽数字，适合倒计时、表格 | `font-variant-numeric: tabular-nums` |

### 3.3 排版层级

```
Display (展示标题)  →  大号、醒目，用于 hero 区域
H1 (一级标题)       →  页面主标题
H2 (二级标题)       →  模块标题
H3 (三级标题)       →  子模块标题
Body (正文)         →  常规阅读文字
Caption (说明文字)   →  辅助说明、时间戳
Overline (上划线)    →  分类标签、小标题
```

---

## 四、颜色（Color）

### 4.1 颜色术语

| 术语 | 说明 |
|------|------|
| **Primary（主色）** | 品牌核心色，用于主要按钮、链接 |
| **Secondary（辅色）** | 辅助强调色 |
| **Accent（强调色）** | 用于高亮、选中状态的点缀色 |
| **Background（背景色）** | 页面/卡片背景 |
| **Surface（表面色）** | 卡片、面板等浮层的背景色 |
| **On-surface（表面上文字色）** | 在表面上显示的文字颜色 |
| **Foreground（前景色）** | 文字、图标等前景内容的颜色 |
| **Muted / Subtle** | 降低饱和度或亮度的颜色，用于次要信息 |
| **Tint（色调）** | 在颜色中加入白色 |
| **Shade（暗调）** | 在颜色中加入黑色 |
| **Opacity（透明度）** | `0`(完全透明) ~ `1`(完全不透明) |

### 4.2 颜色表示法

| 格式 | 示例 | 说明 |
|------|------|------|
| HEX | `#7c5dfa` | 6位十六进制 |
| HEX+Alpha | `#7c5dfa80` | 8位，末尾两位为透明度 |
| RGB | `rgb(124, 93, 250)` | 红绿蓝三通道 |
| RGBA | `rgba(124, 93, 250, 0.5)` | 带透明度 |
| HSL | `hsl(253, 95%, 67%)` | 色相/饱和度/亮度 |
| OKLCH | `oklch(0.6 0.2 280)` | 现代感知均匀色彩空间 |

### 4.3 暗色模式设计要点

```
背景色:    不要用纯黑 #000，用深灰 #0f0f1a 或 #121212
文字色:    不要用纯白 #fff，用 rgba(255,255,255,0.9) 降低刺眼感
次要文字:  rgba(255,255,255,0.45) ~ 0.6
边框:      rgba(255,255,255,0.08) ~ 0.12
卡片背景:  rgba(255,255,255,0.04) ~ 0.06
强调色:    暗色模式下适当提高亮度和饱和度
```

---

## 五、圆角与阴影（Radius & Shadow）

### 5.1 圆角（Border Radius）

| 术语 | 数值参考 | 适用场景 |
|------|---------|---------|
| **Sharp（无圆角）** | `0px` | 表格、严肃风格 |
| **Subtle（微圆角）** | `4px` | 输入框、小按钮 |
| **Medium（中圆角）** | `8px ~ 12px` | 卡片、面板 |
| **Large（大圆角）** | `16px ~ 20px` | 大卡片、模态框 |
| **Pill（胶囊形）** | `9999px` | 标签、药丸按钮 |
| **Circle（圆形）** | `50%` | 头像、图标按钮 |

### 5.2 阴影（Box Shadow）

```
/* 轻微浮起 */
box-shadow: 0 1px 3px rgba(0,0,0,0.1);

/* 标准卡片 */
box-shadow: 0 4px 12px rgba(0,0,0,0.15);

/* 深层浮起（模态框） */
box-shadow: 0 12px 40px rgba(0,0,0,0.25);

/* 内阴影（凹陷效果） */
box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);

/* 发光效果 */
box-shadow: 0 0 20px rgba(124,93,250,0.4);
```

阴影参数说明：
- 第1个值：水平偏移
- 第2个值：垂直偏移
- 第3个值：模糊半径
- 第4个值（可选）：扩展半径
- 颜色值

---

## 六、边框与分割（Border & Divider）

| 术语 | 说明 | 示例 |
|------|------|------|
| **Border（边框）** | 元素边框线 | `border: 1px solid rgba(255,255,255,0.08)` |
| **Border style** | 实线 `solid` / 虚线 `dashed` / 点线 `dotted` |
| **Divider（分割线）** | 内容区域之间的视觉分隔 | 通常是 `1px` 的横线 |
| **Outline（轮廓）** | 不占空间的外围线，用于焦点状态 | `outline: 2px solid var(--accent)` |
| **Ring（环）** | 焦点环，类似 outline 但更醒目 | Tailwind 的 `ring` |
| **Stroke（描边）** | SVG 图形的边线 | `stroke="currentColor"` |

---

## 七、效果（Effects）

### 7.1 模糊与透明

| 术语 | CSS | 说明 |
|------|-----|------|
| **Backdrop blur（毛玻璃）** | `backdrop-filter: blur(12px)` | 背景模糊，需配合半透明背景 |
| **Blur（模糊）** | `filter: blur(4px)` | 元素本身模糊 |
| **Glassmorphism（玻璃拟态）** | 半透明 + 模糊 + 边框 | 现代卡片风格 |
| **Opacity（不透明度）** | `opacity: 0.8` | 整个元素的透明度 |

### 7.2 渐变（Gradient）

| 类型 | CSS | 说明 |
|------|-----|------|
| **Linear gradient（线性渐变）** | `linear-gradient(135deg, #a, #b)` | 沿直线方向渐变 |
| **Radial gradient（径向渐变）** | `radial-gradient(circle, #a, #b)` | 从中心向外扩散 |
| **Conic gradient（锥形渐变）** | `conic-gradient(#a, #b, #a)` | 绕中心旋转渐变 |
| **Gradient stop（色标）** | `linear-gradient(#a 0%, #b 50%, #c 100%)` | 控制渐变位置 |

### 7.3 动画与过渡

| 术语 | 说明 | CSS |
|------|------|-----|
| **Transition（过渡）** | 属性变化时的平滑过渡 | `transition: all 0.2s ease` |
| **Transform（变换）** | 位移、旋转、缩放、倾斜 | `transform: scale(1.05)` |
| **Animation（动画）** | 关键帧驱动的复杂动画 | `@keyframes` + `animation` |
| **Easing（缓动）** | 动画的速度曲线 | `ease`(默认) / `linear` / `ease-in-out` / `cubic-bezier()` |
| **Spring（弹簧）** | 弹性回弹效果 | JS 动画库中的 spring |
| **Keyframe（关键帧）** | 动画的中间状态节点 | `@keyframes pulse { 0%{...} 50%{...} 100%{...} }` |

### 7.4 常见缓动函数

```
ease:           慢→快→慢（默认，最自然）
ease-in:        慢→快
ease-out:       快→慢
ease-in-out:    慢→快→慢（比 ease 更对称）
linear:         匀速
cubic-bezier(): 自定义贝塞尔曲线
```

---

## 八、交互状态（Interactive States）

| 状态 | 说明 | 视觉变化参考 |
|------|------|-------------|
| **Default（默认）** | 未交互的初始状态 | — |
| **Hover（悬停）** | 鼠标悬停 | 背景变亮/变暗、阴影加深、cursor 变化 |
| **Active / Pressed（按下）** | 鼠标按下瞬间 | 缩小 `scale(0.95)`、颜色变深 |
| **Focus（聚焦）** | 键盘 Tab 或点击后获得焦点 | outline 环、ring 发光 |
| **Disabled（禁用）** | 不可交互 | `opacity: 0.5`、`cursor: not-allowed` |
| **Selected（选中）** | 当前选中的项目 | 强调色背景/边框 |
| **Dragged（拖拽中）** | 正在被拖拽 | 半透明、阴影加大 |
| **Loading（加载中）** | 数据加载中 | 骨架屏、spinner |

---

## 九、常见 UI 组件术语

### 9.1 基础组件

| 术语 | 说明 |
|------|------|
| **Button（按钮）** | 可点击的操作元素 |
| **Icon button（图标按钮）** | 只含图标的按钮，通常圆形 |
| **Ghost button（幽灵按钮）** | 透明背景 + 边框的按钮 |
| **FAB（浮动操作按钮）** | 悬浮在页面上的圆形主操作按钮 |
| **Input（输入框）** | 文本输入 |
| **Textarea（文本域）** | 多行文本输入 |
| **Select / Dropdown（下拉选择）** | 下拉菜单选择器 |
| **Toggle / Switch（开关）** | 二选一的滑动开关 |
| **Checkbox（复选框）** | 多选 |
| **Radio button（单选按钮）** | 单选 |
| **Slider（滑块）** | 拖拽选择数值范围 |
| **Badge（徽标）** | 数字或状态标记，常挂在图标上 |
| **Tooltip（工具提示）** | 悬停时弹出的提示文字 |
| **Tag / Chip（标签）** | 小型信息标签，可带关闭按钮 |

### 9.2 容器组件

| 术语 | 说明 |
|------|------|
| **Card（卡片）** | 带圆角和阴影的内容容器 |
| **Panel（面板）** | 功能区域的容器 |
| **Modal / Dialog（模态框）** | 覆盖在页面上的弹窗，需用户操作后关闭 |
| **Drawer（抽屉）** | 从侧边滑出的面板 |
| **Popover（气泡弹出）** | 点击触发的浮层 |
| **Toast / Snackbar（轻提示）** | 自动消失的简短消息 |
| **Accordion（手风琴）** | 可折叠展开的内容区域 |
| **Tabs（选项卡）** | 切换不同内容面板 |
| **Toolbar（工具栏）** | 操作按钮的水平集合 |
| **Sheet（底部弹出面板）** | 从底部滑出的面板 |

### 9.3 导航组件

| 术语 | 说明 |
|------|------|
| **Navbar / Header（导航栏）** | 顶部导航 |
| **Breadcrumb（面包屑）** | 层级路径导航 |
| **Pagination（分页）** | 页码导航 |
| **Sidebar navigation（侧边导航）** | 垂直导航菜单 |
| **Tab bar（标签栏）** | 底部/顶部标签切换栏 |
| **Back-to-top（回到顶部）** | 快速滚动回页面顶部 |

### 9.4 数据展示

| 术语 | 说明 |
|------|------|
| **List（列表）** | 有序/无序数据列表 |
| **Table（表格）** | 行列数据展示 |
| **Avatar（头像）** | 用户头像 |
| **Thumbnail（缩略图）** | 小尺寸预览图 |
| **Progress bar（进度条）** | 线性进度指示 |
| **Progress ring（进度环）** | 环形进度指示 |
| **Skeleton screen（骨架屏）** | 加载时的占位灰色块 |
| **Spinner / Loader（加载指示器）** | 旋转的加载动画 |
| **Empty state（空状态）** | 无数据时的占位提示 |

---

## 十、视觉层次与排版节奏

### 10.1 视觉层次（Visual Hierarchy）

```
大小:     大元素 → 先被看到
颜色:     高对比/强调色 → 先被看到
位置:     左上角 → 先被看到（LTR 语言）
粗细:     粗体 → 先被看到
间距:     更多留白 → 更重要
```

### 10.2 排版节奏（Vertical Rhythm）

保持垂直方向上的一致间距，常用 `8px` 作为基准单位：

```
8px  → 最小间距（图标与文字之间）
16px → 紧凑间距（列表项之间）
24px → 标准间距（段落之间）
32px → 宽松间距（模块之间）
48px → 大区块间距
64px+ → 页面级分隔
```

---

## 十一、响应式设计术语

| 术语 | 说明 |
|------|------|
| **Mobile-first（移动优先）** | 先设计移动端，再用 `min-width` 扩展到大屏 |
| **Desktop-first（桌面优先）** | 先设计桌面端，再用 `max-width` 适配小屏 |
| **Fluid（流式）** | 宽度用百分比，随窗口缩放 |
| **Adaptive（自适应）** | 在特定断点切换布局 |
| **Container query（容器查询）** | 根据父容器尺寸而非视口尺寸调整样式 |

### 常见断点参考

```
手机竖屏:    < 640px    (sm)
手机横屏:    640~768px  (md)
平板:        768~1024px (lg)
笔记本:      1024~1280px (xl)
桌面:        1280~1536px (2xl)
大屏:        > 1536px   (3xl)
```

---

## 十二、可访问性（Accessibility / A11y）

| 术语 | 说明 |
|------|------|
| **Contrast ratio（对比度）** | 文字与背景的亮度比，WCAG 要求至少 4.5:1 |
| **ARIA** | 无障碍富互联网应用属性，辅助屏幕阅读器 |
| **Focus visible** | 键盘用户能看到当前焦点所在位置 |
| **Screen reader（屏幕阅读器）** | 为视障用户朗读页面内容的软件 |
| **Semantic HTML** | 使用语义化标签（`<nav>`, `<main>`, `<aside>`） |
| **Alt text** | 图片替代文字 |
| **Skip link** | 跳过导航直接到内容的快捷链接 |

---

## 十三、性能相关术语

| 术语 | 说明 |
|------|------|
| **Lazy loading（懒加载）** | 按需加载，进入视口才加载图片/组件 |
| **Code splitting（代码分割）** | 按路由/功能拆分 JS 包 |
| **Tree shaking（摇树）** | 移除未使用的代码 |
| **SSR（服务端渲染）** | 在服务器上渲染 HTML |
| **SSG（静态生成）** | 构建时生成静态 HTML |
| **Hydration（注水）** | SSR 后在客户端激活交互 |
| **CLS（累积布局偏移）** | 页面加载时元素意外移动的程度 |
| **FPS（帧率）** | 每秒渲染帧数，60fps 为流畅标准 |

---

## 十四、设计风格术语

| 风格 | 特征 | 典型应用 |
|------|------|---------|
| **Minimalism（极简）** | 大留白、少色彩、精简元素 | Apple 产品页 |
| **Glassmorphism（玻璃拟态）** | 毛玻璃效果、半透明层叠 | macOS、iOS 控制中心 |
| **Neumorphism（新拟态）** | 柔和阴影模拟凸起/凹陷 | 智能家居控制面板 |
| **Flat design（扁平化）** | 无阴影无渐变、纯色块 | Windows Metro |
| **Material Design** | Google 的设计系统，强调光影层次 | Android 应用 |
| **Lo-fi / Retro** | 怀旧、低保真质感 | Lofi.co、ChillPulse |
| **Skeuomorphism（拟物）** | 模拟真实物体外观 | iOS 6 之前的图标 |
| **Brutalism（粗野主义）** | 大胆排版、高对比、打破常规 | 艺术/设计类网站 |
| **Dark mode（暗色模式）** | 深色背景、低亮度 | 代码编辑器、夜间使用 |

---

## 十五、与 AI 沟通的常用描述词对照

| 你说 | AI 理解为 |
|------|----------|
| "紧凑一点" | 减小 padding/gap/margin |
| "留白多一些" | 增大间距、减小内容密度 |
| "更醒目" | 增大字号、加粗字重、提高颜色对比度 |
| "柔和" | 降低饱和度、增大圆角、使用轻阴影 |
| "卡片感" | 圆角 + 背景色 + 阴影 |
| "磨砂玻璃" | `backdrop-filter: blur()` + 半透明背景 |
| "呼吸灯效果" | `animation` + `box-shadow` 发光脉动 |
| "呼吸感" | 缓慢的 scale/opacity 动画循环 |
| "毛玻璃" | Glassmorphism 风格 |
| "悬浮感" | 较大阴影 + 略微上移 |
| "沉浸式" | 全屏背景、隐藏边框、内容铺满 |
| "渐入渐出" | `opacity` 从 0→1→0 的 transition |
| "弹性" | `cubic-bezier` 或 spring 动画 |
| "骨架屏" | 加载时的灰色占位矩形动画 |
| "吸顶" | `position: sticky; top: 0` |
| "磨砂按钮" | `backdrop-filter: blur()` + 透明背景按钮 |
| "发光" | `box-shadow: 0 0 Npx rgba(color)` |
| "流动感" | gradient 动画 或 SVG 路径动画 |
| "渐变流动" | `@keyframes` 移动 `background-position` |
