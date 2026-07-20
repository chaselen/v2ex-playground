# Repository Guidelines

## 项目结构

VS Code 扩展，入口 `src/extension.ts`。运行时代码在 `src/`，编译输出到 `out/`。

- `src/commands/` — VS Code 命令模块，小驼峰命名（如 `login.ts`、`setting.ts`）；面板类命令可在 `src/extension.ts` 中直接注册并委托给功能模块
- `src/providers/` — 单 WebviewView Provider（`MainViewProvider.ts`），通过 Webview RPC 与前端通信
- `src/controllers/` — 话题、用户、搜索、最近浏览、余额和两步验证等 Webview Panel 控制器及共享输入类型
- `src/core/` — HTTP、日志、图片上传与缓存、Webview RPC 桥接和 HTML 资源转换等基础设施
- `src/v2ex/` — V2EX 请求、HTML 解析、会话、领域类型、领域错误和 Cookie 工具；对外 API 统一从 `src/v2ex/index.ts` 导出
  - `client.ts` — 对外的 `V2exClient` 门面，组合会话与各领域服务
  - `session.ts` — V2EX HTTP、Cookie、重定向、登录失效和两步验证处理
  - `services/` — 账户、认证、用户、节点、搜索和话题等领域请求
  - `parsers/` — V2EX 页面 HTML 解析器；解析规则应保持在对应领域文件中
  - `tests/` — 顶层 V2EX 模块的单元测试和真实网页集成测试；`parsers/`、`services/` 的测试与实现保持同目录
- `src/features/` — 独立功能模块，如每日签到、图片预览、外部链接打开、详情面板导航、最近浏览、登录会话和两步验证
- `src/shared/` — 扩展侧与 Webview 共享的 RPC 契约和类型
- `src/config.ts` / `src/global.ts` — 配置读取和扩展运行时全局状态
- `docs/` — 关键功能的实现说明、设计取舍和边界条件
- `webview/` — React + Vite + Radix Primitives Webview 源码
  - `main.html` / `topic.html` / `member.html` / `balance.html` / `search.html` / `recent-browse.html` / `two-factor.html` — 生产 Webview 的 Vite 多页面入口
  - `theme.html` / `src/views/theme/` — Webview 组件与 VS Code 主题适配回归页
  - `src/views/` — 主面板及各 Webview Panel 页面
  - `src/components/` — 跨页面复用的 Webview UI 组件
  - `src/core/` — Webview 侧 RPC 封装、链接导航和内容增强等无界面基础能力
  - `src/hooks/` — 跨页面复用的 React Hooks
  - `src/styles/` — 全局样式入口、主题映射和跨页面 SCSS mixin
- `html/` — Vite 构建后的 Webview 运行时资源，不手工编辑
- `out/` — esbuild 生成的扩展产物，不手工编辑

## 项目文档

- [登录与 Cookie 会话](docs/auth-session.md) — 登录状态分层、SecretStorage、候选会话、两步验证和并发隔离规则
- [每日签到逻辑](docs/daily-sign-in.md) — 每日签到的数据来源、状态判定、缓存、调度和边界处理
- [帖子回复楼中楼算法](docs/nested-replies.md) — 平铺回复转换为楼中楼结构的推断规则、设计取舍和已知边界
- [话题测试样本](docs/test-topics.md) — 按空状态、富文本、代码块、附言、分页和回复树分类的公开测试帖子
- [内容预览 HTML 契约](docs/reply-preview-html.md) — 原生与 Markdown 预览接口的真实 HTML 输出、过滤规则和渲染约束
- [站内帖子预览](docs/topic-preview.md) — 站内链接预览按钮、统一话题视图、状态隔离和写操作约束
- [Webview RPC 通信](docs/webview-rpc.md) — 消息协议、约定式控制器、事件推送和安全边界
- [Webview UI 与主题](docs/webview-ui.md) — Radix 原语、Lucide 图标、VS Code 语义变量和组件扩展约束
- 修改上述文档涉及的代码逻辑时，必须同步更新对应文档；新增需要长期维护的关键实现规则或设计取舍时，应在 `docs/` 中补充文档，并在此处添加引用
- 文档与代码注释只写结论、设计取舍、边界条件和可复现的踩坑（可注明具体宿主如 Cursor，便于对照复现）；不要写入与 Agent 或同事的讨论过程、迁移对比口吻（如「不再组合…」）、个案调试流水账。TODO 与后续优化方向可以保留；通顺的常用词（如「避免」「设计取舍」）不要机械改写

## 开发命令

- `npm run build:webview` — 使用 Vite 构建 Webview 到 `html/`
- `npm run build:extension` — 使用 esbuild 生产构建扩展到 `out/`
- `npm run build` — 构建 Webview 并生产构建扩展，发布前或跨侧改动时执行
- `npm run check` — 检查扩展侧和 Webview TypeScript 类型
- `npm run check:extension` — 使用 TypeScript 检查扩展侧类型
- `npm run check:extension:watch` — 持续检查扩展侧 TypeScript 类型
- `npm run check:webview` — 使用 TypeScript 检查 Webview 类型
- `npm run check:webview:watch` — 持续检查 Webview TypeScript 类型
- `npm run preview:theme` — 启动 Webview 主题回归页并在浏览器中打开
- `npm test` — 运行 `src/**/*.test.ts` 下的 Vitest 测试；包含会真实访问 V2EX、SoV2EX 等外部服务的 `*.live.test.ts` 集成测试
- `npm test -- <test-files>` — 运行指定的 Vitest 测试文件；开发阶段优先根据改动范围选择直接相关的测试
- `npm run format -- <changed-files>` — 使用 oxfmt 增量格式化
- `npm run format:check -- <changed-files>` — 检查指定文件格式
- `npm run vscode:prepublish` — 发布前执行完整类型检查和生产构建
- `npm run watch` — 同时监听 Webview 和扩展侧构建，并持续检查两侧类型
- `npm run vscode:package` — 生成 `.vsix` 安装包
- `npm run vscode:publish` — 发布到 Marketplace

## 开发环境与格式

项目要求 Node >= 22.18.0。执行 Node、npm 或 npx 命令前需确认当前版本符合 `.nvmrc`；使用 fnm 时可通过 `fnm exec --using 22.18.0 <command>` 确保命令在项目要求的版本下运行。

`.oxfmtrc.json` 使用 2 空格、单引号、无分号、无尾随逗号。修改文件后必须对改动文件运行增量格式化。

## 验证要求

- 修改扩展侧 TypeScript 时运行 `npm run check:extension` 和 `npm run build:extension`
- 修改 Webview 源码时运行 `npm run check:webview` 和 `npm run build:webview`
- 修改共享 RPC 契约、Webview HTML 加载链路、构建配置或会同时影响扩展侧与 Webview 的代码时，运行相关两侧类型检查并执行 `npm run build`
- 仅新增必要的单元测试：优先覆盖复杂业务规则、重要边界条件、已修复的回归问题和需要长期稳定的公开契约；不要为简单透传、日志文案、框架自身行为或无业务价值的实现细节机械补测试
- 开发阶段优先使用 `npm test -- <test-files>` 运行与改动直接相关的测试；涉及共享基础设施、跨领域行为或无法判断影响范围时运行 `npm test`
- 涉及 `src/v2ex/`、Cookie、两步验证或请求解析逻辑时，至少运行对应领域的测试文件；依赖真实页面结构或外部响应格式的行为还需运行相关 `*.live.test.ts`，执行时需保证网络可访问 V2EX、SoV2EX 等对应外部服务
- `V2exClient` 真实网页测试位于 `src/v2ex/tests/`，按领域拆分为 `client.topics.live.test.ts`、`client.members.live.test.ts`、`client.nodes.live.test.ts`、`client.search.live.test.ts`、`client.auth.live.test.ts` 和 `client.account.live.test.ts`；修改对应 service、parser 或门面方法时运行相应文件
- 回复树的真实页面集成测试位于 `src/v2ex/tests/replyTree.live.test.ts`；修改话题回复解析、分页合并或楼中楼算法时需运行该文件
- 发布前或打包前运行 `npm test`、`npm run check` 和 `npm run build`
- 手动验证按改动范围覆盖登录、两步验证、节点刷新、话题打开、用户打开、搜索、最近浏览、设置项和 Webview 行为

## URI 与文件系统

- VS Code API 返回的 URI 不保证使用 `file:` scheme；路径拼接优先使用 `Uri.joinPath()`，文件读写优先使用 `workspace.fs`，不要在远程或虚拟 URI 上使用 `fsPath`
- `Uri.joinPath(context.globalStorageUri, ...)` 可能生成 `vscode-userdata:` URI；`workspace.fs` 可以正常读写该 URI，但 `WebviewPanel.iconPath` 无法正确显示它。**踩坑：** 将全局缓存图片设为面板图标时，用 `workspace.fs.readFile()` 读内容并转为 base64 `data:` URI，不要经 `fsPath` 强转 `file:` URI

## Webview 架构

- Webview 使用 React + Vite 多页面工程，源码在 `webview/`，产物在 `html/`
- UI 交互行为统一使用 Radix Primitives，图标使用 Lucide；业务页面优先复用 `webview/src/components/ui/` 中的主题化组件
- Webview HTML 入口使用 `https://www.v2ex.com/` 作为 `<base>`；扩展侧使用 `src/core/webviewHtml.ts` 读取 Vite 输出 HTML，并将本地 `src` / `href` 转换为 `webview.asWebviewUri(...)`
- 不直接在业务页面拼装重复的 Radix 样式；新增通用控件时先在 `webview/src/components/ui/` 封装语义、无障碍和主题行为

## Webview RPC 与状态同步

- Webview 通过 `webview/src/core/vscode.ts` 中的 Proxy RPC 客户端封装 `acquireVsCodeApi().postMessage`，业务侧使用 `vscode.command(payload)` 调用扩展能力，使用 `vscode.on(event, handler)` 订阅扩展事件
- 扩展侧通过 `src/core/WebviewRpcBridge.ts` 接收 RPC；Controller 或 Provider 实现 `WebviewRpcController<Commands>`，并使用 `rpc_<command>` 方法处理请求，通过 `rpc.post(event, payload)` 向 Webview 发送事件
- RPC 契约使用函数签名定义，集中在 `src/shared/*View.ts` 和 `src/shared/webviewRpc.ts`
- 只有 `rpc_` 前缀的方法可以由 Webview 调用；Panel 生命周期方法使用不带该前缀的常规方法名
- 新增或修改 RPC 命令、事件、请求参数或响应字段时，先更新 `src/shared/` 中的契约，再同步扩展侧处理器和 Webview 调用方；不要绕过 Proxy 客户端直接调用 `postMessage`
- 有状态的 Webview 初始化不能依赖扩展侧在面板创建后单向发送一次状态事件。**踩坑：** 不同宿主（如 Cursor 与 VS Code）在缓存命中、脚本启动或 Webview 上下文重建上的时序可能不同，事件可能早于 React 监听注册而丢失。此类页面应由扩展侧保存最新状态，RPC 契约复用 `WebviewStateRpcCommands<State>` 提供 `ready()` 状态读取，并在 Webview 端复用 `subscribeWebviewState()` 先注册事件监听、再主动读取当前状态；状态事件仅用于后续增量同步

## Webview 样式与主题

- Webview 样式使用 SCSS；`webview/src/styles/index.scss` 只加载公共样式和基础全局规则，VS Code Theme Color 到项目语义变量的映射集中在 `webview/src/styles/_vscode-theme.scss`
- 跨页面共享样式优先通过不直接生成选择器的 SCSS mixin 复用，由页面样式使用 `@use` 和 `@include` 按需引入；话题与用户内容的公共富文本样式集中在 `webview/src/styles/_topic-content.scss`，不要将 `.topic-content` 直接加入全局样式
- 主面板 CSS Modules 的省略文本、空状态和加载状态等重复模式集中在 `webview/src/views/main/components/_mixins.scss`；新增同类样式时优先复用 mixin，保持最终类名由各 CSS Module 管理
- Webview 页面必须适配 [VS Code Color Theme](https://code.visualstudio.com/api/references/theme-color)；颜色在 `webview/src/styles/_vscode-theme.scss` 映射为 `--v2ex-*` 后，共享组件与业务样式只使用 `--v2ex-*`。不要在页面中直接写 `var(--vscode-*)`；例外仅限主题映射文件、theme 回归页 mock，以及宿主区域（如 Side Bar）向 `--v2ex-*` 的上下文重映射
- Tooltip、Popover、ConfirmPopover、DropdownMenu、Dialog 等浮层使用 Radix Portal 挂载到 `document.body`；颜色、边框、焦点和阴影由 `webview/src/components/ui/ui.scss` 统一处理，高对比主题必须依赖 `--vscode-contrastBorder` / `--vscode-contrastActiveBorder`
- 常规语义状态复用 `Badge`、`Tag`、`Alert` 和 `Empty`；不要在业务页面重新实现同类主题映射

## Webview 加载与交互

- Webview 首次打开且尚无可展示内容时，整页或整块内容加载优先复用 `webview/src/components/PageSkeleton.tsx` 中的结构化骨架，不使用居中的 `Spinner` 作为整页 loading；新增页面应为 `PageSkeleton` 增加与真实页面信息层级对应的变体，使标题、头像、工具区、列表或表格等占位结构尽量贴近加载完成后的布局
- 骨架屏必须与真实页面复用或严格对齐容器的最大宽度、外层级、内外间距和响应式断点，尤其避免共享骨架的通用 padding 在窄侧边栏下覆盖页面变体；骨架分割线和边框使用 `--v2ex-*` 语义变量，保留 `prefers-reduced-motion` 和加载状态无障碍语义。已有内容上的刷新、分页、标签切换、上传和按钮提交等局部加载继续使用 `Spinner` 或组件自身的 `loading` 属性
- Tooltip、Popover、ConfirmPopover 组合时在中间保留真实 DOM 元素（如 `span`），避免多个 Radix `asChild` 触发器竞争同一个子节点

## Webview 内容与导航

- 话题页、用户页、“我的”消息等 V2EX HTML 内容使用共享主题化组件作为外层；通过 `dangerouslySetInnerHTML` 渲染的内容统一复用共享链接导航和内容增强逻辑
- 普通业务按钮打开外部链接前使用 `resolveWebviewUrl()` 基于 `document.baseURI` 解析为绝对地址，HTML 内容中的链接交由 `handleWebviewLinkClick()` 统一识别和分发，扩展侧统一复用 `src/features/openExternal.ts`
- HTML 内容中的话题、用户、节点和外部链接统一由 `webview/src/core/linkNavigation.ts` 识别与分发；页面只传入必要的标题或话题 fallback，不在页面内重复路径正则、URL 解码或 RPC 分支
- 内容增强逻辑在 `webview/src/core/contentEnhancement.ts`，负责 HTML 标准化、图片预览、隐藏图片占位，并复用共享链接导航处理内容链接

## Webview 手动验证

- 修改主题变量、公共组件或 Radix 浮层适配时，运行 `npm run preview:theme`，在 `webview/theme.html` 回归检查亮色、暗色、高对比和高对比亮色主题
- 修改有状态 Webview 的初始化、状态同步或面板复用逻辑时，在 VS Code 和 Cursor 中手动验证首次打开、重复打开以及面板隐藏后恢复，确认页面不会因初始化事件丢失而停留在加载状态
- 新增或修改整页骨架屏时，对照加载完成后的真实页面手动验证容器宽度、外间距、内容层级和窄侧边栏响应式布局，并覆盖亮色、暗色和高对比主题；同时确认刷新、分页等已有内容上的局部 loading 不会错误切换为整页骨架
- 修改共享链接导航或 HTML 内容增强逻辑时，手动验证话题、用户、节点、外部链接和图片预览，确认一次点击只触发一种打开行为

## 数据与接口约束

- 不盲猜 V2EX 返回字段、HTML 结构、请求参数或响应格式；修改前先核对现有类型、解析器、测试夹具和实际调用路径
- V2EX HTML 解析以中文页面文案为契约前提；所有用于解析 V2EX HTML 的请求必须保留 `src/v2ex/session.ts` 中的 `Accept-Language: zh-CN,zh;q=0.9`，不得在 service 或业务模块中覆盖为其他语言
- 使用 curl、独立 HTTP 客户端或其他绕过 `V2exSession` 的方式核对真实页面时，也必须显式携带相同的 `Accept-Language` 请求头；只有专门验证多语言响应时才可例外，不能用英文响应直接判断现有中文解析规则失效
- 修改 V2EX 领域数据时，先更新 `src/v2ex/types.ts`，再同步对应的 `src/v2ex/services/`、`src/v2ex/parsers/`、`src/v2ex/client.ts`、共享 RPC 类型和消费方
- 新增 V2EX 能力时，将请求和领域逻辑放入对应的 `src/v2ex/services/`，将 HTML 解析放入 `src/v2ex/parsers/`，再由 `V2exClient` 暴露，并按需从 `src/v2ex/index.ts` 导出；业务模块不直接复制请求或解析逻辑
- HTML 解析规则变化需在对应的解析器测试或相关领域的 `src/v2ex/tests/client.*.live.test.ts` 中补充或更新覆盖；依赖真实页面结构的关键行为应同步更新或新增 `*.live.test.ts` 集成测试

## 代码规范

- 对外接口、关键参数、重要常量和复杂业务逻辑需添加说明；优先使用 JSDoc，避免为显而易见的实现添加注释
- 代码块内部的简短逻辑说明使用 `//`，避免被编辑器识别为变量 JSDoc
- 短中文注释不以句号结尾；完整句子或多行描述不受此限制
- 注释内容同样遵循「项目文档」中的撰写约束：只写结论与可复现信息，不写讨论过程
- 除非需求明确要求，不随意改动 activation events、命令 ID、配置项 key

## 提交

使用 Conventional Commits 风格提交代码，提交信息使用英文（如 `feat: add automatic daily sign-in setting`、`fix: handle empty node list`）。
