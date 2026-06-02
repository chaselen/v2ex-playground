# Repository Guidelines

## 项目结构

VS Code 扩展，入口 `src/extension.ts`。运行时代码在 `src/`，编译输出到 `out/`。

- `src/commands/` — 命令模块，小驼峰命名（`search.ts`、`topicItemClick.ts`）
- `src/providers/` — 单 WebviewView Provider（`MainViewProvider.ts`），通过 Webview RPC 与前端通信
- `src/controllers/` — Webview Panel 控制器（`TopicPanelController.ts`）
- `src/core/http.ts` — HTTP 客户端（axios）
- `src/core/WebviewRpcBridge.ts` — 扩展侧 Webview RPC 桥接
- `src/core/webviewHtml.ts` — Vite Webview HTML 资源路径转换
- `src/v2ex/` — V2EX API 封装、领域类型和领域错误，统一从 `src/v2ex/index.ts` 导出
- `src/features/` — 独立功能模块，如图片预览
- `src/shared/` — 扩展侧与 Webview 共享类型
- `src/config.ts` / `src/global.ts` — 配置读取和扩展运行时全局状态
- `webview/` — React + Vite + Semi Design Webview 源码
  - `main.html` / `topic.html` — Vite 多页面入口
  - `src/main/` — 主面板 WebviewView
  - `src/topic/` — 帖子详情 Webview Panel
  - `src/shared/` — Webview 侧 RPC 封装、公共样式和内容增强逻辑
- `html/` — Vite 构建后的 Webview 运行时资源，不手工编辑

## 构建与开发

- `npm run build:webview` — 使用 Vite 构建 Webview 到 `html/`
- `npm run check:webview` — 使用 TypeScript 检查 Webview 类型
- `npm run typecheck` — 使用 TypeScript 检查扩展侧类型
- `npm run test:v2ex` — 运行 V2EX 模块相关 Vitest 测试
- `npm run compile` — 构建 Webview 并编译扩展 TypeScript 到 `out/`。修改后**必须执行**
- `npm run vscode:prepublish` — 发布前执行扩展侧类型检查、Webview 构建和生产构建
- `npm run watch` — 同时监听 Webview 和扩展侧编译
- `npm run package` — 生成 `.vsix` 安装包
- `npm run publish` — 发布到 Marketplace

格式化：`npx -y prettier --write <changed-files>`（`.prettierrc`：2 空格、单引号、无分号、无尾随逗号）

已有 V2EX 模块测试，涉及 `src/v2ex/`、Cookie 或请求解析逻辑时需运行 `npm run test:v2ex`。`npm run compile` 是最低验证；修改 Webview 源码时还需运行 `npm run check:webview`。手动验证：登录、节点刷新、帖子打开、搜索、设置项、Webview 行为。

## Webview 架构

- Webview 使用 React + Vite 多页面工程，源码在 `webview/`，产物在 `html/`
- UI 框架使用 `@douyinfe/semi-ui`，主面板优先使用 Tabs、Tree、Dropdown、Button、Spin、Badge 等组件
- Webview 样式使用 SCSS，公共主题变量在 `webview/src/shared/styles.scss`
- Webview 页面必须适配 [VS Code Color Theme](https://code.visualstudio.com/api/references/theme-color)，样式优先使用官方 Theme Color CSS 变量（`var(--vscode-*)`），必要时先在 `webview/src/shared/styles.scss` 定义 [Semi Design token](https://semi.design/zh-CN/basic/tokens) 映射，再写页面样式
- 帖子页使用 Semi Design 外层组件，V2EX 返回的正文、附言和回复内容继续通过 `dangerouslySetInnerHTML` 渲染
- Webview 通过 `WebviewRpcBridge` 封装 `acquireVsCodeApi().postMessage` 与扩展通信，RPC 类型集中在 `src/shared/mainView.ts`、`src/shared/topicView.ts` 和 `src/shared/webviewRpc.ts`
- 扩展侧使用 `src/core/webviewHtml.ts` 读取 Vite 输出 HTML，并将本地 `src` / `href` 转换为 `webview.asWebviewUri(...)`
- 帖子内容增强逻辑在 `webview/src/shared/topicContent.ts`，负责图片预览、隐藏图片占位和站内话题跳转

## Semi Design 注意事项

- React 19 下使用 Semi Design 时，所有 Webview 入口必须在引入 Semi 组件前引入 `@douyinfe/semi-ui/react19-adapter`，否则 Toast、Modal 等静态渲染能力可能报 `createRoot is not available`
- Tooltip、Popover、Popconfirm 都会劫持子元素事件，互相组合时不要直接嵌套；按 Semi 官方 Tooltip 文档，在中间加一层真实 DOM 元素（如 `span`），例如 `Popconfirm > span > Tooltip > Button`
- Tooltip、Popover、Popconfirm 等浮层渲染到 portal，暗色/高对比主题适配需优先在 `webview/src/shared/styles.scss` 覆盖全局浮层类，并使用 `var(--vscode-*)` 颜色

修改 Webview 文件后，需运行 `npm run check:webview` 和 `npm run compile`，并手动验证 Webview 渲染。

## 代码规范

- 函数、关键参数、重要常量和核心业务逻辑需加注释，优先 JSDoc。短中文注释不以句号结尾
- 除非需求明确要求，不随意改动 activation events、命令 ID、配置项 key
- Node >= 22.18.0

## 提交

使用 `feat:` / `fix:` 等前缀的简短提交信息（如 `feat: 新增自动签到配置项`、`fix: 修复空节点列表处理`）
