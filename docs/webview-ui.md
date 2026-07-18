# Webview UI 与主题

Webview 使用 React、Radix Primitives 和 Lucide。Radix 只负责交互语义、焦点管理、键盘行为和 Portal；所有视觉样式由项目维护，避免组件库色盘与 VS Code Theme Color 之间再增加一层难以维护的映射。

## 组件分层

- `webview/src/components/ui/` 封装 Button、Input、Select、Tabs、Dialog、Popover、Toast 等通用组件
- 共享组件负责统一 DOM 语义、键盘行为和无障碍属性；业务页面只传递领域内容与状态
- 业务页面只组合共享组件和领域组件，不直接复制 Radix Portal、焦点、键盘或浮层定位逻辑
- 图标统一使用 `lucide-react`，装饰图标添加 `aria-hidden="true"`；纯图标按钮必须提供 `aria-label`
- `Button` 禁用态保留当前 Variant 的背景和边框语义，再统一降低透明度；Primary、Secondary、Subtle、Ghost 和 Danger 不应收敛为同一种禁用背景
- `ConfirmPopover` 默认在标题左侧显示警示图标，普通确认使用警告色、危险确认使用危险色；领域操作可通过 `titleIcon` 覆盖图标，传入 `null` 可隐藏
- `Alert` 与 `ConfirmPopover` 的默认状态图标使用实心语义色外形，内部符号使用当前提示或浮层背景色；不要直接填充整个 Lucide 图标而遮住内部符号
- 页面特有的复杂布局可保留在页面 SCSS 中，通用组件状态统一写入 `webview/src/components/ui/ui.scss`
- 领域组件可以封装固定含义的共享控件，例如 `ProTag`；不要为仅改名或透传属性增加包装层
- 命令式通知统一使用 `Toast.info`、`Toast.success`、`Toast.warning` 和 `Toast.error`，每个使用通知的 Webview 入口只挂载一个 `ToastViewport`

## 主题来源

`webview/src/styles/_vscode-theme.scss` 将 VS Code Theme Color 映射为 `--v2ex-*` 语义变量。共享组件只使用这些语义变量，页面只有在表达 VS Code 特有区域（如 Side Bar、Badge、Menu）时才直接读取 `--vscode-*`。

关键规则：

- 文本、背景、输入框、边框、焦点、选择态和语义状态均必须提供 VS Code 变量回退链
- 高对比主题的边框优先使用 `--vscode-contrastBorder`，焦点优先使用 `--vscode-contrastActiveBorder`
- Tooltip、Popover、Select、DropdownMenu、Dialog 和 Toast 的 Portal 内容必须继承同一语义变量，不能使用固定明暗色
- Tooltip、Popover 等浮层箭头必须与浮层使用相同的背景和边框色；箭头只为两条外露斜边描边，不绘制与浮层主体接触的底边，并向主体重叠 `1px` 避免抗锯齿产生可见接缝
- 固定品牌色或实物色仅用于内容本身（例如货币图标）；交互状态色必须来自 VS Code 变量或 `--v2ex-*` 映射
- 公共形状和动效使用 `--v2ex-radius-*`、`--v2ex-motion-*`
- 动画必须在 `prefers-reduced-motion: reduce` 下关闭

## 回归验证

运行 `npm run preview:theme` 打开 `webview/theme.html`。页面集中展示基础组件、表单、分页、浮层、反馈和数据组件。修改共享组件或主题变量后至少检查：

- 亮色、暗色、高对比和高对比亮色下的文本、边框、背景与焦点
- disabled、hover、active 和 selected 状态
- Tooltip、Popover、Select、DropdownMenu、ConfirmPopover、Dialog 和 Toast 的 Portal 内容
- Tabs 指示器、OTP 焦点、菜单键盘导航和 Dialog 焦点管理

涉及真实状态或宿主通信时，还要在扩展宿主中验证 Webview 的首次打开、隐藏恢复和对应业务交互。
