# Webview UI 与主题

## 主题边界

`webview/src/styles/_vscode-theme.scss` 集中将宿主 Theme Color 映射为 `--v2ex-*`，共享组件和业务样式只消费语义变量。例外为主题回归页的 mock，以及 Side Bar 等宿主区域向语义变量的上下文重映射。

背景与前景必须成对回退。阅读区使用 `editor.background` 时配 `editor.foreground`；侧栏选中态的背景与字色必须采用相同的 active / inactive 回退顺序。Secondary 按钮色只用于该类按钮，不能当作通用浅色表面。

语义状态字色优先使用通用 foreground；`inputValidation.*` 仅作为背景、边框回退，避免部分主题中提示文字失去对比度。高对比 token 仅在高对比主题启用：Trae 等宿主可能注入空值或透明 contrast token，将其放到常规主题回退链最前会导致边框和 Tabs 指示器消失。

## 宿主与浮层限制

- Chromium 原生日期输入的弹出日历无法跟随宿主主题，日期选择使用共享 DatePicker
- Base UI 浮层使用 Portal，统一消费语义变量；Dialog 内触发的浮层必须高于 Dialog 内容，否则选项会被遮挡，点击落入下层控件
- 浮层触发器的 `render` 元素须将 ref 转发到真实 DOM；SimpleBar 的 ref 返回滚动实例，作为触发区域时需要真实 DOM 包裹层
- Tooltip、Popover、ConfirmPopover 组合时保留中间真实 DOM，避免多个 `render` 触发器竞争同一节点
- SimpleBar 和 Tabs 内容区可能被键盘聚焦，整页容器不画焦点外框；按钮、链接等交互控件保留焦点描边
- 动画遵循 `prefers-reduced-motion`，收起内容使用 `inert` 与无障碍隐藏，避免键盘进入被裁切的链接

## HTML 内容中的用户浮层

正文中的用户链接来自 HTML，采用根节点事件委托与单个浮层，不逐个挂载 React root。完整话题与预览分别维护实例，避免互相抢占状态。

Dialog 等带 transform 的祖先会改变 fixed 定位的包含块，浮层锚点不能直接套用视口矩形。幽灵触发器覆盖链接后会使原生 hover 丢失，悬停标记需保留原链接样式；滚动或尺寸变化时关闭浮层，避免锚点失效。实现见 `MemberQuickInfoHoverLayer.tsx` 与 `memberQuickInfoHover.ts`。

## 布局与验证

骨架与真实页面对齐容器宽度、间距和响应式断点，内嵌骨架由父容器控制外层间距。话题、帮助等正文复用 `_topic-content.scss` 的 article mixin，避免分别维护富文本排版。

修改共享组件或主题映射后，运行 `npm run preview:theme`，覆盖亮色、暗色、高对比、高对比亮色，检查文本对比度、交互状态、Portal 浮层和键盘焦点。涉及宿主通信时还需验证首次打开与隐藏恢复。
