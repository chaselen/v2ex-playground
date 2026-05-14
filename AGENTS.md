# Repository Guidelines

## 项目结构

VS Code 扩展，入口 `src/extension.ts`。运行时代码在 `src/`，编译输出到 `out/`。

- `src/commands/` — 命令模块，小驼峰命名（`search.ts`、`topicItemClick.ts`）
- `src/providers/` — 树视图 Provider，PascalCase 命名（`ExploreProvider.ts`）。继承 `BaseProvider.ts`
- `src/controllers/` — Webview Panel 控制器（`TopicPanelController.ts`）
- `src/http.ts` — HTTP 客户端（axios），统一处理请求、重定向和 Cookie
- `src/config.ts` / `src/type.ts` / `src/error.ts` / `src/global.ts` — 配置、类型、错误类、全局状态
- `html/` — Webview 页面资源。`topic.html` 是帖子详情页，通过 Vue 3 + Less 渲染
- `html/lib/` — 第三方库（`vue.global.prod.js`、`less.min.js`、`email-decode.min.js`）

## 构建与开发

- `npm run compile` — 编译 TypeScript 到 `out/`。修改后**必须执行**
- `npm run watch` — 监听并持续编译
- `npm run package` — 生成 `.vsix` 安装包
- `npm run publish` — 发布到 Marketplace

格式化：`npx -y prettier --write <changed-files>`（`.prettierrc`：2 空格、单引号、无分号、无尾随逗号）

无自动化测试，`npm run compile` 是最低验证。手动验证：登录、节点刷新、帖子打开、搜索、设置项、Webview 行为。

## ena模板引擎

Webview 页面（`html/*.html`）使用 **eta**（v4）模板引擎，`<%= %>` 分隔符（与 Vue 的 `{{ }}` 不冲突）。

```ts
// src/v2ex.ts - renderPage()
const eta = new Eta({ useWith: true })
eta.renderString(readFileSync(templatePath, 'utf-8'), data)
```

关键点：

- **`useWith: true` 必须设置**，否则模板中裸变量（如 `<%= contextPath %>`）会报 `ReferenceError`。eta v3+ 默认 `useWith: false`，要求 `it.` 前缀
- `renderPage()` 每次创建新 Eta 实例（调用频率低，无性能问题）
- `contextPath` 仅用于 `<link>` / `<script>` 的资源路径，不传入 Vue 侧。Vue 侧不需要也不应消费 `contextPath`
- 模板数据只传入 Eta 渲染，JS 侧通过 `postMessage` / `vsPostMessage` 与扩展通信

## Webview 架构

- `html/topic.html` — 帖子详情 Webview。结构：HTML `<script type="text/x-template">` 定义 Vue 模板，`<script src>` 加载 Vue/Less/email-decode/topic.js
- `html/topic.js` — Vue 3 应用（Options API，全局 build），通过 `acquireVsCodeApi().postMessage` 与扩展通信
- `html/topic.less` — 帖子页样式，使用 VS Code 主题变量（`var(--vscode-*)`）,主题变量列表可参考 [VS Code 官方文档](https://code.visualstudio.com/api/references/theme-color)
- `html/common.css` — 通用基础样式
- `tsconfig.webview.json` — 为 `html/topic.js` 提供类型检查，包含 `global.d.ts`
- `global.d.ts` — 同时被扩展和 Webview 的 tsconfig 引用，声明 `Vue`、`acquireVsCodeApi`

修改 Webview 文件后，需同时运行 `npm run compile`（扩展侧）并手动验证 Webview 渲染。

## 代码规范

- 函数、关键参数、重要常量和核心业务逻辑需加注释，优先 JSDoc。短中文注释不以句号结尾
- 除非需求明确要求，不随意改动 activation events、命令 ID、配置项 key
- Node >= 20

## 提交

使用 `feat:` / `fix:` 等前缀的简短提交信息（如 `feat: 新增自动签到配置项`、`fix: 修复空节点列表处理`）
