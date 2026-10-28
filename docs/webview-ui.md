# Webview UI 与主题

## 主题边界

`webview/src/styles/_vscode-theme.scss` 集中将宿主 Theme Color 映射为 `--v2ex-*`，共享组件和业务样式只消费语义变量。例外为主题回归页的 mock，以及 Side Bar 等宿主区域向语义变量的上下文重映射。

背景与前景必须成对回退。阅读区使用 `editor.background` 时配 `editor.foreground`；侧栏选中态的背景与字色必须采用相同的 active / inactive 回退顺序。Secondary 按钮色只用于该类按钮，不能当作通用浅色表面。

语义状态字色优先使用通用 foreground；`inputValidation.*` 仅作为背景、边框回退，避免部分主题中提示文字失去对比度。高对比 token 仅在高对比主题启用：Trae 等宿主可能注入空值或透明 contrast token，将其放到常规主题回退链最前会导致边框和 Tabs 指示器消失。

## 代码高亮

代码高亮使用 npm 正式版 `vscode-tint`，固定版本并提交 lockfile；依赖放在 `devDependencies`，通过 esbuild / Vite 打包进扩展，不使用 CDN、Git 依赖或本地链接。`tm-grammars` 和 `vscode-oniguruma` 是完整引擎的显式可选 peer 依赖，WASM 通过 Vite `?url` 作为本地资源分发。

扩展宿主通过 `vscode-tint/vscode` 读取当前主题与用户 token 自定义并监听变化；Webview 通过 `/presets/textmate` 创建完整引擎，只提供主题、本地 WASM 和正文时间预算；预设自动配置 grammar、HTML/CSS 标签模板注入，以及延迟加载的 highlight.js 检测器。底层入口仍保留给自定义场景。主题解析、grammar、scope 匹配、metadata 和正则适配由 npm 包维护，项目仅保留 RPC、资源加载、DOM 和渲染生命周期接线。

正文高亮的 TextMate 单行 / 代码块预算为 1000ms / 1500ms，以容纳 HTML 内嵌多语言首次编译；保留库的代码与单行长度上限。显式未知语言、纯文本、超长输入或分词超时使用完整转义文本回退；初始化失败允许后续代码块重新尝试；正常回退原因记录在代码元素的 `data-syntax-highlight-fallback` 中，加载错误不伪装为回退原因。没有声明语言时将自动检测交给引擎，不把上一次检测结果作为显式语言缓存。自动检测为 XML 后，具有明确 HTML 文档标记的内容会细化为 `html`，并使用支持嵌入 CSS / JS 的 HTML grammar。TSX 应显式指定，自动识别仍可能猜错。

主题事件传递完整规则，异步主题更新串行完成后重绘当前代码块，并丢弃过期主题与旧输入的渲染结果。背景与字体仍由宿主语义变量控制，未匹配 token 继承正文色；不包含语言服务的 semantic tokens。RPC 订阅先于初始读取，桥接器销毁时释放宿主监听。

升级 npm 包时运行宿主和 Webview 接线测试、真实 npm 引擎与 WASM 集成测试、两侧类型检查及构建，确认 grammar 动态导入和 WASM 仍进入 `html/`，在宿主验证主题切换和内容重绘。包、grammar 与引擎许可随 `resources/third-party-notices.txt` 分发。

## 宿主与浮层限制

- Chromium 原生日期输入的弹出日历无法跟随宿主主题，日期选择使用共享 DatePicker
- Base UI 浮层使用 Portal，统一消费语义变量；Dialog 内触发的浮层必须高于 Dialog 内容，否则选项会被遮挡，点击落入下层控件
- 浮层触发器的 `render` 元素须将 ref 转发到真实 DOM；ScrollArea 的 `viewportRef` 指向内部滚动容器，作为触发区域时需要真实 DOM 包裹层
- Popover / ConfirmPopover 的按钮提示通过可选 `tooltip` 和 `tooltipProps` 提供；内部通过 Base UI 的 `render` 组合触发器，共享真实按钮、ref 和无障碍描述关联。点击浮层打开或提示缺省时禁用提示，动态增删提示保持触发器结构不变，不在页面添加额外的可聚焦包裹层
- ConfirmPopover 默认在确认后立即关闭，异步反馈由触发按钮的 loading 与页面错误提示承接；需要等待操作完成后关闭时显式设置 `closeImmediately={false}`
- ScrollArea 和 Tabs 内容区可能被键盘聚焦，整页容器不画焦点外框；按钮、链接等交互控件保留焦点描边
- 按钮类控件的焦点描边同时参考最近一次输入方式，避免键盘打开浮层、鼠标关闭后残留 `:focus-visible`。鼠标操作不移除实际焦点，Esc 关闭浮层沿用此前的输入方式，切回键盘导航后恢复提示；文本输入控件仍保留鼠标聚焦提示。重复的输入方式判断集中在 `styles/_focus.scss`，通过共享 mixin 消费
- 非模态浮层通过 Tab 移出或点击外部关闭时保留新的焦点；日期选择、确认或 Esc 关闭时恢复触发按钮。鼠标选择也恢复实际焦点，是否显示描边由输入方式决定。立即关闭的异步确认在请求期间让共享 Button 保留焦点和 Tab 停靠，通过 `aria-disabled` 阻止重复激活；请求结束不再次抢回焦点。等待回调的确认按钮在请求期间保持可聚焦但不可重复激活；Tab 移出、点击外部或 Esc 可收起浮层，请求继续执行，完成后保留用户的新焦点
- 动画遵循 `prefers-reduced-motion`，收起内容使用 `inert` 与无障碍隐藏，避免键盘进入被裁切的链接

## HTML 内容中的用户浮层

正文中的用户链接来自 HTML，采用根节点事件委托与单个浮层，不逐个挂载 React root。完整话题与预览分别维护实例，避免互相抢占状态。

Dialog 等带 transform 的祖先会改变 fixed 定位的包含块，浮层锚点不能直接套用视口矩形。幽灵触发器覆盖链接后会使原生 hover 丢失，悬停标记需保留原链接样式；滚动或尺寸变化时关闭浮层，避免锚点失效。实现见 `MemberQuickInfoHoverLayer.tsx` 与 `memberQuickInfoHover.ts`。

## 布局与验证

骨架与真实页面对齐容器宽度、间距和响应式断点，内嵌骨架由父容器控制外层间距。话题、帮助等正文复用 `_topic-content.scss` 的 article mixin，避免分别维护富文本排版。

共享组件实现、主题映射、浮层或主题页本身发生变化时，运行 `npm run preview:theme`，覆盖亮色、暗色、高对比、高对比亮色，检查文本对比度、交互状态、Portal 浮层和键盘焦点。只改业务页面且未改这些实现时不打开主题回归页。涉及宿主通信时还需验证首次打开与隐藏恢复。
