# Webview UI 与主题

Webview 使用 React、Radix Primitives 和 Lucide。Radix 只负责交互语义、焦点管理、键盘行为和 Portal；所有视觉样式由项目维护，避免组件库色盘与 VS Code Theme Color 之间再增加一层难以维护的映射。

## 组件分层

- `webview/src/components/ui/` 封装 Button、Input、Select、DatePicker、Tabs、Dialog、Popover、Toast 等通用组件
- 日期选择使用主题化 `DatePicker`（Radix Popover + 日历面板），不要使用原生 `input[type=date]`：宿主 Chromium 日历无法跟随 VS Code 主题
- 共享组件负责统一 DOM 语义、键盘行为和无障碍属性；业务页面只传递领域内容与状态
- 业务页面只组合共享组件和领域组件，不直接复制 Radix Portal、焦点、键盘或浮层定位逻辑
- 图标统一使用 `lucide-react`，装饰图标添加 `aria-hidden="true"`；纯图标按钮必须提供 `aria-label`
- `Button` 禁用态保留当前 Variant 的背景和边框语义，再统一降低透明度；Primary、Secondary、Subtle、Ghost 和 Danger 不应收敛为同一种禁用背景
- Secondary 使用 `button.secondaryBackground` / `button.secondaryForeground` 配对，不要用页面前景色配次级按钮底；内容区低强调操作（如话题工具条的刷新/收藏/感谢）优先用 Subtle，避免部分亮色主题下 secondary 过深
- 有背景的交互态必须 fg/bg 同族配对：选中态用 `--v2ex-active-fg` + `--v2ex-active-bg`；Ghost hover 用 `--v2ex-toolbar-hover-bg`（`toolbar.hoverBackground` 优先，回退 `list.hoverBackground`），不要用列表行 `--v2ex-hover-bg`；Ghost 按下不要用 `active-bg` 配页面字色，应使用中性 `--v2ex-light-button-active-bg`
- `--v2ex-hover-bg` 留给列表/树/菜单项等「行 hover」（`list.hoverBackground` 优先）；工具栏式透明 action 用 `--v2ex-toolbar-hover-bg`
- 不要把 `button.secondaryBackground` 映射成「浅主色 / 通用表面」类 token；低强调表面统一用 `--v2ex-light-button-*` 或 `--v2ex-link-soft-*`
- Tabs 未选中 hover 使用 `--v2ex-toolbar-hover-bg`（透明 chrome，不要用列表行 `--v2ex-hover-bg`）；选中指示器使用 `--v2ex-tab-indicator`（优先 `panelTitle.activeBorder`，回退 `--v2ex-progress-base`），与宿主底部 Panel 当前标题下划线同色；高对比主题优先 `contrastActiveBorder`
- Progress 填充使用略浅的 `--v2ex-progress-fg`（`color-mix` 将 `--v2ex-progress-base` 与页面背景混合）；轨道用中性 `--v2ex-progress-track-bg`，不要复用 secondary 按钮背景
- 主面板 `main.scss` 可重映射 Side Bar 相关 `--v2ex-*`，但不得把 `--vscode-contrastBorder` 重新插回常规主题边框回退链；侧栏选中态 bg/fg 须同序回退（inactive → active → hover / 页面字色）
- `ConfirmPopover` 默认在标题左侧显示警示图标，普通确认使用警告色、危险确认使用危险色；领域操作可通过 `titleIcon` 覆盖图标，传入 `null` 可隐藏
- `Alert` 与 `ConfirmPopover` 的默认状态图标使用实心语义色外形，内部符号使用当前提示或浮层背景色；不要直接填充整个 Lucide 图标而遮住内部符号
- 少量互斥视图或内容筛选的紧凑切换使用 `RadioGroup variant="segmented"`，外层使用低强调混合背景，选中项回到 Webview 页面背景，以便在亮色主题形成灰底白色选中项、暗色主题形成亮底深色选中项；组件保留 RadioGroup 的方向键与焦点语义。选项的悬浮状态标识通过 `RadioGroupItem` 的 `badge` 和 `badgeVariant` 传入，不在业务页面自行定位。具有独立面板语义和键盘导航需求的内容分组继续使用 Tabs；普通表单选项继续使用默认单选样式
- 横向 Tabs 在窄容器中通过 `TabsList overflowNavigation` 启用自动溢出导航；组件使用 ResizeObserver 检测可用宽度，仅在溢出时显示左右按钮，切换活动项时自动将其滚入可视区域
- 页面特有的复杂布局可保留在页面 SCSS 中，通用组件状态统一写入 `webview/src/components/ui/ui.scss`
- 领域组件可以封装固定含义的共享控件，例如 `ProTag`；不要为仅改名或透传属性增加包装层
- 命令式通知统一使用 `Toast.info`、`Toast.success`、`Toast.warning` 和 `Toast.error`，每个使用通知的 Webview 入口只挂载一个 `ToastViewport`

## 主题来源

`webview/src/styles/_vscode-theme.scss` 是 **唯一** 将 VS Code Theme Color 映射为 `--v2ex-*` 语义变量的全局入口。共享组件、页面样式和业务 CSS Modules **优先且默认只使用** `--v2ex-*`，不要直接写 `var(--vscode-*)`。

允许直接读取 `--vscode-*` 的例外：

1. `_vscode-theme.scss` 内的映射定义本身
2. `webview/theme.html` 回归页中模拟宿主 Theme Color 的 mock 赋值
3. 宿主区域上下文重映射：例如主面板 `main.scss` 将 Side Bar 相关 token 再映射到 `--v2ex-*` 后，子样式仍只消费 `--v2ex-*`

新增颜色时先补 `--v2ex-*` 映射，再在消费方引用；同一 `--vscode-*` 在页面中出现两次以上时，应升为语义变量。

关键规则：

- 文本、背景、输入框、边框、焦点、选择态和语义状态的 VS Code 回退链集中写在 `_vscode-theme.scss`
- 页面底为 `editor.background`（`--v2ex-webview-bg`）时，长文阅读正文用 `--v2ex-content-fg`（`editor.foreground`，回退 `foreground`），与底同族配对；通用 UI chrome / 控件文案继续用 `--v2ex-webview-fg`（`foreground`）。话题页、话题预览、用户页默认继承 `--v2ex-content-fg`；侧栏主面板内容字仍用 `--v2ex-main-content-fg`（可回退到侧栏重映射后的 `--v2ex-webview-fg`）
- 选中态 `--v2ex-active-bg` / `--v2ex-active-fg` 必须同序回退（全局：active → inactive → hover/页面字色；主面板侧栏列表：inactive → active → hover/页面字色），禁止 bg 走 inactive 而 fg 直接落到页面字色
- 语义状态字色（`--v2ex-info-fg` / `warning-fg` / `danger-fg` / `success-fg`）优先通用 foreground（如 `textLink`、`errorForeground`、`editorWarning.foreground`、`testing.iconPassed`、`charts.*`）；`inputValidation.*` 只作 bg/border 回退，不要当 Alert 通用字色优先源
- Badge 缺省回退主按钮色（`badge.*` → primary button），不要回退 `danger`；Tag 字色用 `--v2ex-webview-fg`（UI chip），不要用 `--v2ex-content-fg`
- 高对比主题：`body.vscode-high-contrast` / `body.vscode-high-contrast-light` 才启用 contrast 色；常规主题不要把 `--vscode-contrastBorder` / `--vscode-contrastActiveBorder` 放在回退链最前（含页面级重映射，如图片预览边框、主面板边框），避免部分宿主（如 Trae）注入空值或透明值导致边框与 Tabs 指示器消失。仅高对比才需要描边的控件使用 `var(--v2ex-hc-border, transparent)`（该变量只在高对比主题定义）
- Tooltip、Popover、Select、DropdownMenu、Dialog 和 Toast 的 Portal 内容必须继承同一语义变量，不能使用固定明暗色
- Tooltip / 浮层：`--v2ex-tooltip-bg` / `--v2ex-tooltip-fg`；菜单：`--v2ex-menu-*`；箭头必须与浮层使用相同的背景和边框色；箭头只为两条外露斜边描边，不绘制与浮层主体接触的底边，并向主体重叠 `1px` 避免抗锯齿产生可见接缝
- 固定品牌色或实物色仅用于内容本身（例如货币图标）；交互状态色必须来自 `--v2ex-*`
- 公共形状和动效使用 `--v2ex-radius-xs|sm|md|lg`、`--v2ex-motion-*`；宿主字体使用 `--v2ex-font-family` / `--v2ex-font-size`；代码块使用 `--v2ex-code-bg` / `--v2ex-code-font-family`
- 链接色的弱强调衍生使用 `--v2ex-link-soft-*`（背景、边框、ring、fill），不要在业务页重复 `color-mix(var(--v2ex-link-fg) …)`
- 业务 SCSS 直接写 `var(--v2ex-*)`，不要再包一层 `$muted-color` / `$panel-border` 之类的 SCSS 别名
- 动画必须在 `prefers-reduced-motion: reduce` 下关闭

## 回归验证

运行 `npm run preview:theme` 打开 `webview/theme.html`。页面集中展示基础组件、表单、分页、浮层、反馈和数据组件。修改共享组件或主题变量后至少检查：

- 亮色、暗色、高对比和高对比亮色下的文本、边框、背景与焦点
- disabled、hover、active 和 selected 状态
- Tooltip、Popover、Select、DropdownMenu、ConfirmPopover、Dialog 和 Toast 的 Portal 内容
- Tabs 指示器、OTP 焦点、菜单键盘导航和 Dialog 焦点管理

涉及真实状态或宿主通信时，还要在扩展宿主中验证 Webview 的首次打开、隐藏恢复和对应业务交互。
