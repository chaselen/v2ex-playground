# Repository Guidelines

## 项目结构

VS Code 扩展，入口 `src/extension.ts`。运行时代码在 `src/`，编译输出到 `out/`。

- `src/commands/` — VS Code 命令模块，小驼峰命名（`login.ts`、`search.ts`、`setting.ts`）
- `src/providers/` — 单 WebviewView Provider（`MainViewProvider.ts`），通过 Webview RPC 与前端通信
- `src/controllers/` — 话题和用户详情 Webview Panel 控制器及共享输入类型
- `src/core/http.ts` — HTTP 客户端（axios）
- `src/core/WebviewRpcBridge.ts` — 扩展侧 Webview RPC 桥接
- `src/core/webviewHtml.ts` — Vite Webview HTML 资源路径转换
- `src/v2ex/` — V2EX 请求、HTML 解析、领域类型和领域错误，统一从 `src/v2ex/index.ts` 导出
- `src/features/` — 独立功能模块，如每日签到、图片预览、外部链接打开和详情面板导航
- `src/shared/` — 扩展侧与 Webview 共享的 RPC 契约、类型和 Cookie 工具
- `src/config.ts` / `src/global.ts` — 配置读取和扩展运行时全局状态
- `webview/` — React + Vite + Semi Design Webview 源码
  - `main.html` / `topic.html` / `member.html` / `balance.html` — 生产 Webview 的 Vite 多页面入口
  - `theme.html` / `src/theme/` — Semi 与 VS Code 主题适配回归页
  - `src/main/` — 主面板 WebviewView
  - `src/topic/` — 帖子详情 Webview Panel
  - `src/member/` — 用户详情 Webview Panel
  - `src/balance/` — 账户余额 Webview Panel
  - `src/shared/` — Webview 侧 RPC 封装、链接导航、公共样式和内容增强逻辑
- `html/` — Vite 构建后的 Webview 运行时资源，不手工编辑
- `out/` — esbuild 生成的扩展产物，不手工编辑

## 构建与开发

- `npm run build:webview` — 使用 Vite 构建 Webview 到 `html/`
- `npm run build:extension` — 使用 esbuild 生产构建扩展到 `out/`
- `npm run build` — 构建 Webview 并生产构建扩展。修改后**必须执行**
- `npm run check` — 检查扩展侧和 Webview TypeScript 类型
- `npm run check:extension` — 使用 TypeScript 检查扩展侧类型
- `npm run check:extension:watch` — 持续检查扩展侧 TypeScript 类型
- `npm run check:webview` — 使用 TypeScript 检查 Webview 类型
- `npm run check:webview:watch` — 持续检查 Webview TypeScript 类型
- `npm test` — 运行 `src/**/*.test.ts` 下的 Vitest 测试
- `npm run format -- <changed-files>` — 使用 oxfmt 增量格式化
- `npm run format:check -- <changed-files>` — 检查指定文件格式
- `npm run vscode:prepublish` — 发布前执行完整类型检查和生产构建
- `npm run watch` — 同时监听 Webview 和扩展侧构建，并持续检查两侧类型
- `npm run vscode:package` — 生成 `.vsix` 安装包
- `npm run vscode:publish` — 发布到 Marketplace

`.oxfmtrc.json` 使用 2 空格、单引号、无分号、无尾随逗号。修改文件后必须对改动文件运行增量格式化。

验证要求：

- 所有代码改动至少运行 `npm run build`
- 修改扩展侧 TypeScript 时运行 `npm run check:extension`
- 修改 Webview 源码或共享 RPC 契约时运行 `npm run check:webview`
- 涉及 `src/v2ex/`、`src/shared/cookie.ts`、Cookie 或请求解析逻辑时运行 `npm test`
- 手动验证按改动范围覆盖登录、节点刷新、话题打开、用户打开、搜索、设置项和 Webview 行为

## Webview 架构

- Webview 使用 React + Vite 多页面工程，源码在 `webview/`，产物在 `html/`
- UI 框架使用 `@douyinfe/semi-ui`，主面板优先使用 Tabs、Tree、Dropdown、Button、Spin、Badge 等组件
- Webview 样式使用 SCSS；`webview/src/shared/styles.scss` 只负责加载公共样式和基础全局规则，VS Code 到 Semi 的主题 token 映射集中在 `webview/src/shared/_vscode-semi-theme.scss`
- 跨页面共享样式优先通过不直接生成选择器的 SCSS mixin 复用，由页面样式使用 `@use` 和 `@include` 按需引入；话题与用户内容的公共富文本样式集中在 `webview/src/shared/_topic-content.scss`，不要将 `.topic-content` 直接加入全局样式
- 主面板 CSS Modules 的省略文本、空状态和加载状态等重复模式集中在 `webview/src/main/components/_mixins.scss`；新增同类样式时优先复用 mixin，保持最终类名由各 CSS Module 管理
- Webview 页面必须适配 [VS Code Color Theme](https://code.visualstudio.com/api/references/theme-color)，样式优先使用官方 Theme Color CSS 变量（`var(--vscode-*)`）；Semi 组件应优先通过 `webview/src/shared/_vscode-semi-theme.scss` 中的 [Design Token](https://semi.design/zh-CN/basic/tokens) 映射适配
- 无法通过 Semi Design Token 表达的兼容样式集中在 `webview/src/shared/_semi-overrides.scss`，不要在页面样式中新增全局 `.semi-*` 覆盖
- 话题页、用户页、“我的”消息和余额页使用 Semi Design 外层组件，V2EX 返回的 HTML 内容通过 `dangerouslySetInnerHTML` 渲染；HTML 中的链接点击统一复用 `webview/src/shared/linkNavigation.ts`，图片预览和隐藏图片等富文本增强复用 `webview/src/shared/contentEnhancement.ts`
- Webview 通过 `webview/src/shared/vscode.ts` 中的 Proxy RPC 客户端封装 `acquireVsCodeApi().postMessage`，业务侧使用 `vscode.command(payload)` 调用扩展能力，使用 `vscode.on(event, handler)` 订阅扩展事件
- 扩展侧通过 `src/core/WebviewRpcBridge.ts` 接收 RPC；创建桥接器时传入完整且类型安全的处理器映射，通过 `rpc.post(event, payload)` 向 Webview 发送事件
- RPC 契约使用函数签名定义，集中在 `src/shared/commonView.ts`、`src/shared/mainView.ts`、`src/shared/topicView.ts`、`src/shared/memberView.ts`、`src/shared/balanceView.ts` 和 `src/shared/webviewRpc.ts`
- 新增或修改 RPC 命令、事件、请求参数或响应字段时，先更新 `src/shared/` 中的契约，再同步扩展侧处理器和 Webview 调用方；不要绕过 Proxy 客户端直接调用 `postMessage`
- Webview HTML 入口使用 `https://www.v2ex.com/` 作为 `<base>`；普通业务按钮打开外部链接前使用 `resolveWebviewUrl()` 基于 `document.baseURI` 解析为绝对地址，HTML 内容中的链接交由 `handleWebviewLinkClick()` 统一识别和分发，扩展侧统一复用 `src/features/openExternal.ts`
- 扩展侧使用 `src/core/webviewHtml.ts` 读取 Vite 输出 HTML，并将本地 `src` / `href` 转换为 `webview.asWebviewUri(...)`
- HTML 内容中的话题、用户、节点和外部链接统一由 `webview/src/shared/linkNavigation.ts` 识别与分发；页面只传入必要的标题或话题 fallback，不在页面内重复路径正则、URL 解码或 RPC 分支
- 内容增强逻辑在 `webview/src/shared/contentEnhancement.ts`，负责 HTML 标准化、图片预览、隐藏图片占位，并复用共享链接导航处理内容链接

## Semi Design 注意事项

- React 19 下使用 Semi Design 时，所有 Webview 入口必须在引入 Semi 组件前引入 `@douyinfe/semi-ui/react19-adapter`，否则 Toast、Modal 等静态渲染能力可能报 `createRoot is not available`
- Vite 使用 `@douyinfe/semi-vite-plugin` 并开启 `cssLayer`，确保项目兼容覆盖稳定优先于 Semi 组件样式
- Tooltip、Popover、Popconfirm 都会劫持子元素事件，互相组合时不要直接嵌套；按 Semi 官方 Tooltip 文档，在中间加一层真实 DOM 元素（如 `span`），例如 `Popconfirm > span > Tooltip > Button`
- Tooltip、Popover、Popconfirm 等浮层使用 Semi 默认 Portal 并挂载到 `document.body`；暗色/高对比主题适配优先使用 token，必要的全局浮层兼容覆盖写入 `webview/src/shared/_semi-overrides.scss`
- 常规语义状态优先直接使用 Semi `Badge` 和 `Tag`；只有需要统一采用 VS Code Badge Theme Color 或中性标签配色时，才使用 `webview/src/shared/SemiVscode.tsx` 中的 `VscodeBadge` 和 `VscodeTag`
- 修改主题 token、Semi 兼容覆盖或公共组件适配时，使用 `webview/theme.html` 回归检查亮色、暗色和高对比主题

修改 Webview 文件后，需运行 `npm run check:webview` 和 `npm run build`，并手动验证 Webview 渲染。

修改共享链接导航或 HTML 内容增强逻辑时，需手动验证话题、用户、节点、外部链接和图片预览，确认一次点击只触发一种打开行为。

## 数据与接口约束

- 不盲猜 V2EX 返回字段、HTML 结构、请求参数或响应格式；修改前先核对现有类型、解析器、测试夹具和实际调用路径
- 修改 V2EX 领域数据时，先更新 `src/v2ex/types.ts`，再同步 `src/v2ex/client.ts`、共享 RPC 类型和消费方
- 新增 V2EX 能力统一放入 `V2exClient`，并从 `src/v2ex/index.ts` 导出；业务模块不直接复制请求或解析逻辑
- HTML 解析规则变化需在 `src/v2ex/client.test.ts` 中补充或更新覆盖

## 代码规范

- 函数、关键参数、重要常量和核心业务逻辑需加注释，定义处优先使用 JSDoc
- 代码块内部的简短逻辑说明使用 `//`，避免被编辑器识别为变量 JSDoc
- 短中文注释不以句号结尾；完整句子或多行描述不受此限制
- 除非需求明确要求，不随意改动 activation events、命令 ID、配置项 key
- Node >= 22.18.0

## 提交

使用 `feat:` / `fix:` 等前缀的简短提交信息（如 `feat: 新增自动签到配置项`、`fix: 修复空节点列表处理`）
