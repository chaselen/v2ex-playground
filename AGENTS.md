# Repository Guidelines

## 项目结构

VS Code 扩展，入口 `src/extension.ts`。运行时代码在 `src/`，编译输出到 `out/`。

- `src/commands/` — 命令模块，小驼峰命名（`search.ts`、`topicItemClick.ts`）
- `src/providers/` — 单 WebviewView Provider（`MainViewProvider.ts`），通过 postMessage 与前端通信
- `src/controllers/` — Webview Panel 控制器（`TopicPanelController.ts`）
- `src/http.ts` / `src/v2ex.ts` — HTTP 客户端（axios）和 V2EX API 封装
- `src/config.ts` / `src/type.ts` / `src/error.ts` / `src/global.ts` — 配置、类型、错误类、全局状态
- `html/` — Webview 页面资源
  - `main.html` / `main.js` / `main.less` — 主面板 WebviewView（Tab + Tree 布局）
  - `topic.html` / `topic.js` / `topic.less` — 帖子详情 Webview Panel
- `html/lib/` — 第三方库（`vue.global.prod.js`、`less.min.js`、`vscode-elements.js`、`codicon.css`、`codicon.ttf`、`email-decode.min.js`）

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

- `html/main.html` / `html/main.js` / `html/main.less` — 主面板 WebviewView。使用 vscode-elements 组件（Tabs + Tree 布局），Vue 3 Options API
- `html/topic.html` / `html/topic.js` / `topic.less` — 帖子详情 Webview Panel。结构：HTML 模板直接写在 `#app` 内（Vue 直接 DOM 模板），`<script src>` 加载 Vue/Less/email-decode/topic.js
- `html/topic.js` — Vue 3 应用（Options API，全局 build），通过 `acquireVsCodeApi().postMessage` 与扩展通信
- `html/topic.less` — 帖子页样式，使用 VS Code 主题变量（`var(--vscode-*)`）,主题变量列表可参考 [VS Code 官方文档](https://code.visualstudio.com/api/references/theme-color)
- `html/main.less` — 主面板样式，flex 布局控制 Tabs 和面板高度
- `html/common.css` — 通用基础样式
- `html/lib/codicon.css` — Codicon 图标字体，引入时须带 `id="vscode-codicon-stylesheet"`
- `tsconfig.webview.json` — 为 `html/topic.js` 和 `html/main.js` 提供类型检查，包含 `global.d.ts`
- `global.d.ts` — 同时被扩展和 Webview 的 tsconfig 引用，声明 `Vue`、`acquireVsCodeApi`

修改 Webview 文件后，需同时运行 `npm run compile`（扩展侧）并手动验证 Webview 渲染。

## vscode-elements 组件库

主面板（`html/main.html`）使用 **vscode-elements**（v2.5.1）作为 UI 框架，替代原生 VS Code TreeView。
文档：https://vscode-elements.github.io/

源码在 `html/lib/vscode-elements.js`，从 npm 包 `@vscode-elements/elements` 打包而来。

### 关键组件

| 组件 | 标签 | 用途 |
|------|------|------|
| Tabs | `<vscode-tabs>` | 三个标签页切换（首页/自定义/收藏） |
| Tree | `<vscode-tree>` | 树形列表容器 |
| TreeItem | `<vscode-tree-item>` | 节点/话题行，`branch` 属性为分支节点 |
| Badge | `<vscode-badge>` | 回复数角标，`variant="counter"` |
| Icon | `<vscode-icon>` | 操作图标（刷新、删除），需引入 codicon.css |
| ProgressRing | `<vscode-progress-ring>` | 加载中旋转动画 |
| ContextMenu | `<vscode-context-menu>` | 右键菜单 |
| Button | `<vscode-button>` | 添加节点按钮 |

### 关键要点

- **Codicon 图标**：必须引入 `codicon.css`（带 `id="vscode-codicon-stylesheet"`）并确保 `codicon.ttf` 同目录，否则图标不显示
- **click.capture**：`vscode-tree-item` 内部 Shadow DOM 的 `_handleContentClick` 中调用了 `t.stopPropagation()`，所有点击事件必须用 `@click.capture` / `@contextmenu.capture` 才能被捕获
- **expand-mode**：只能设为 `'singleClick'`（默认）或 `'doubleClick'`，不可设为 `'none'`
- **展开/折叠**：组件内部管理 `open` 状态，Vue 不应绑定 `:open` 也不应设置 `node.expanded`，只需在 `onNodeClick` 中处理数据加载
- **缩进**：通过 `indent` 属性控制（默认 8px，项目中设为 4px）
- **branch 属性**：布尔属性，存在即为 true，控制是否显示展开箭头
- **slot 机制**：操作按钮使用 `slot="actions"`，角标使用 `slot="decoration"`
- **通信**：前端通过 `acquireVsCodeApi().postMessage()` 发送消息，扩展侧在 `MainViewProvider._onDidReceiveMessage` 中处理

## 代码规范

- 函数、关键参数、重要常量和核心业务逻辑需加注释，优先 JSDoc。短中文注释不以句号结尾
- 除非需求明确要求，不随意改动 activation events、命令 ID、配置项 key
- Node >= 20

## 提交

使用 `feat:` / `fix:` 等前缀的简短提交信息（如 `feat: 新增自动签到配置项`、`fix: 修复空节点列表处理`）
