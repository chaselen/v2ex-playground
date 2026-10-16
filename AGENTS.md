# Repository Guidelines

## 项目结构与职责

VS Code 扩展入口为 `src/extension.ts`，Webview 使用 React + Vite 多页面工程。

| 路径                                 | 职责                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| `src/commands/`                      | VS Code 命令，小驼峰命名；面板命令可在入口注册并委托功能模块       |
| `src/providers/`                     | 主侧栏 WebviewView Provider                                        |
| `src/controllers/`                   | Webview Panel 控制器与共享输入类型                                 |
| `src/core/`                          | HTTP、日志、图片缓存、RPC 桥接与 HTML 资源转换                     |
| `src/v2ex/`                          | V2EX 会话、领域服务、HTML 解析、类型与错误；统一从 `index.ts` 导出 |
| `src/features/`                      | 登录、签到、导航、最近浏览等功能编排                               |
| `src/shared/`                        | 扩展侧与 Webview 共享的 RPC 契约和类型                             |
| `src/config.ts` / `src/global.ts`    | 配置读取与扩展运行时状态                                           |
| `webview/src/views/`                 | 主面板与各独立页面，HTML 入口在 `webview/` 根目录                  |
| `webview/src/components/` / `hooks/` | 共享组件与 Hooks                                                   |
| `webview/src/core/` / `styles/`      | RPC、导航、内容增强与公共样式                                      |
| `webview/theme.html`                 | 组件与主题回归页                                                   |
| `docs/`                              | 外部契约、设计取舍、已知边界与回归样本                             |
| `html/` / `out/`                     | Vite / esbuild 构建产物，不手工编辑                                |

`src/v2ex/client.ts` 管理会话与认证，并通过 `topics`、`members`、`nodes`、`account`、`search`、`help` 暴露领域 API；认证服务和领域内部生命周期操作不对外公开。`session.ts` 负责 HTTP、Cookie、重定向和认证处理；请求与领域逻辑放在 `services/`，HTML 解析放在 `parsers/`。`links.ts` 集中不依赖会话的站点判断、路径解析与链接生成函数，外部通过 `index.ts` 使用。业务模块不复制请求或解析逻辑。

## 环境与常用命令

- 使用 npm 和 `package-lock.json`；Node 需满足 `.nvmrc` 与 `package.json` 的版本要求（当前最低 22.18.0）。执行 Node、npm、npx 前确认版本，可用 `fnm exec --using 22.18.0 <command>`
- 依赖统一放在 `devDependencies`；运行时依赖由构建工具打包，扩展不分发 `node_modules`
- 格式以 `.oxfmtrc.json` 为准；修改后只格式化涉及文件，并检查 diff

| 命令                                        | 用途                                                              |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `npm run watch`                             | 监听两侧构建与类型检查                                            |
| `npm run check:extension` / `check:webview` | 对应侧类型检查；`npm run check` 检查两侧                          |
| `npm run build:extension` / `build:webview` | 对应侧生产构建；`npm run build` 构建两侧                          |
| `npm test -- <test-files>`                  | 指定 Vitest 测试；`npm test` 包含真实访问外部服务的 live 测试     |
| `npm run test:unit`                         | 运行非 live 测试，不访问真实外部服务                              |
| `npm run test:live`                         | 运行 live 测试，需网络可达；部分用例需要登录 Cookie，包含真实签到 |
| `npm run format -- <changed-files>`         | 增量格式化；`format:check` 检查格式                               |
| `npm run preview:theme`                     | 打开主题回归页                                                    |
| `npm run vscode:prepublish`                 | 完整类型检查与生产构建，不包含测试                                |
| `npm run vscode:package` / `vscode:publish` | 打包 VSIX / 发布 Marketplace                                      |

## 修改与验证

- 保留已有未提交改动，不覆盖或清理无关内容
- 除非需求明确要求，不改 activation events、命令 ID 或配置项 key
- 扩展侧 TypeScript 改动运行对应类型检查与构建；Webview 源码改动同理。共享 RPC、HTML 加载链路、构建配置或跨侧改动运行 `npm run check` 和 `npm run build`
- 按需选择测试范围，优先只运行本次改动可能影响的模块及其直接依赖方的相关测试；不因涉及共享代码、RPC 或跨侧改动就默认运行全量测试
- 影响范围不明时，先检查调用链和现有测试，再确定验证范围；仅在影响确实广泛、定向测试发现跨模块问题或用户明确要求时扩大测试范围
- 验证按本次改动的实际影响选择，不为每次页面改动默认打开 `webview/theme.html` 或运行 `npm run preview:theme`。主题回归页的运行条件见「Webview UI、主题与导航」
- 同一任务中已经通过、且后续修改不影响其覆盖范围或结论的类型检查、测试、构建和手动验证不再重复执行
- live 测试仅在改动依赖真实页面、外部接口或格式契约时按相关领域运行，不为普通 UI 或 RPC 接线改动运行全量 live 测试。发布或打包前仍运行 `npm test`、`npm run check`、`npm run build`
- 测试覆盖复杂业务规则、重要边界、回归问题与公开契约，不为简单透传、日志文案或框架行为机械补测试
- `src/v2ex/`、Cookie、两步验证及解析改动至少运行对应领域测试；依赖真实页面或外部格式时还需运行相关 live 测试并确保网络可达
- 门面真实页面测试为 `src/v2ex/tests/client.<领域>.live.test.ts`；service、parser 测试通常与实现同目录。回复解析、分页合并或楼中楼算法变化还需运行 `src/v2ex/tests/replyTree.live.test.ts`
- 手动验证按实际影响覆盖登录、两步验证、节点、话题、用户、搜索、最近浏览、设置及 Webview 行为；最终说明执行的验证和未验证项
- 真实发帖仅在必要时进行，必须发往[沙盒节点](https://www.v2ex.com/go/sandbox)，遵循[官方节点说明](https://www.v2ex.com/help/node)

## 数据与接口

- 不猜测字段、类型、HTML 结构、参数或错误格式；先核对现有类型、解析器、夹具与调用路径
- HTML 解析以中文页面为契约，保留 `Accept-Language: zh-CN,zh;q=0.9`。curl 等独立核对请求也必须携带该头，专门验证多语言时除外
- 领域数据变化先更新 `src/v2ex/types.ts`，再同步 service、parser、门面、共享契约和消费方；新增能力按需从 `src/v2ex/index.ts` 导出
- 解析规则变化同步更新测试；依赖真实结构的关键行为须有相关 live 测试覆盖

## 类型归属与复用

- 新增类型前检查现有声明、生产方和消费方。领域模型放在 `src/v2ex/types.ts`；扩展与 Webview 共用的应用数据（如草稿、浏览记录、签到状态）按业务归入 `src/shared/` 独立模块；页面 RPC 请求、响应和事件放在 `*View.ts`；组件 Props、局部状态、第三方响应结构及内部选项就近声明
- 类型归属由数据语义和职责决定，不只看当前消费页面。独立的 core / feature 能力不依赖页面类型；两侧共用的输入与状态放到无宿主运行时依赖的共享模块。面向 Webview 的适配逻辑可以使用页面契约，Webview 不通过导入 feature / controller 获取类型
- 数据语义和结构均一致时直接复用领域或共享类型，不复制一份仅增加 `Webview` 前缀的声明，也不保留只返回原对象的转换函数。扁平化字段、补充已读状态或存在其他展示转换时，保留独立视图模型与实际转换
- 字段相同不代表同一契约；创建请求、编辑初始化数据等语义不同的类型保持独立。提取公共类型前核对必选性、空值、默认值及字段含义，不为合并而放宽约束；仅换名且没有独立语义的别名不保留
- 普通函数、方法和 RPC 的参数形式以调用处的可读性与业务语义为准，不按字段数量机械拆分。ID、名称、页码等含义清楚的一两个简单参数优先直接声明（如 `deleteNotification(notificationId: number)`），避免额外包装或按函数名反推参数类型。布尔行为开关即使只有一个，也可保留具名选项对象（如 `{ force: true }`、`{ loadImages: false }`），让调用处明确表达意图；参数较多、结构复杂或传递完整业务数据时使用对象。是否提取独立类型另按复用需求和可读性判断；React Props 等框架约定及事件 payload 保持各自契约
- 类型继承、`Pick` 和索引访问用于表达真实的字段归属与约束关系，不以减少行数为目标。不因多个列表或页面状态长得相似就引入通用分页、通用状态或大型集中类型文件
- 调整共享类型时检查完整调用链，包括 RPC 契约、Controller / Provider、feature 返回值、持久化数据和 Webview 组件回调；同步导出入口并移除失效声明，避免只整合中间层、遗漏两端的重复类型。验证范围遵循「修改与验证」

## URI 与资源

- VS Code URI 不保证为 `file:`；路径拼接使用 `Uri.joinPath()`，文件读写优先使用 `workspace.fs`，不在远程或虚拟 URI 上使用 `fsPath`
- `globalStorageUri` 可能为 `vscode-userdata:`，可通过 `workspace.fs` 读写，但不能直接作为面板图标。缓存图标须读取为 base64 data URI，不经 `fsPath` 强转 file URI
- Webview HTML 使用 `https://www.v2ex.com/` 作为 base；通过 `src/core/webviewHtml.ts` 将构建产物的本地资源地址转换为 `webview.asWebviewUri(...)`

## Webview RPC 与状态

- 契约集中在 `src/shared/*View.ts` 与 `webviewRpc.ts`。先改契约，再同步扩展处理器和 Webview 调用，不绕过 `webview/src/core/vscode.ts` 的 Proxy 客户端直接发送业务消息
- Controller / Provider 实现 `WebviewRpcController<Commands>`；仅 `rpc_<command>` 方法可调用，生命周期方法不使用该前缀。事件通过桥接器 `rpc.post()` 推送
- 有状态页面保存扩展侧最新状态，组合 `WebviewStateRpcCommands<State>` 提供 `ready()`；Webview 使用 `subscribeWebviewState()` 先订阅再读取，避免初始化事件早到丢失或旧读取覆盖新事件
- 修改初始化、状态同步或面板复用时，在 VS Code 和 Cursor 中验证首次打开、重复打开、隐藏恢复

## Webview UI、主题与导航

- 修改 Base UI 组件前，通过[官方文档索引](https://base-ui.com/llms.txt)查阅相关组件与组合规则，并结合项目安装版本的类型定义核对 API
- 交互使用 Base UI，图标使用 Lucide；优先复用 `components/ui/` 与 Badge、Tag、Alert、Empty 等语义组件。通用控件统一封装无障碍、主题和交互，不在页面复制 Base UI 样式
- 样式使用 SCSS。主题映射集中于 `styles/_vscode-theme.scss`，业务与共享组件只用 `--v2ex-*`；直接读取 `--vscode-*` 仅限映射文件、主题 mock 和宿主区域向语义变量的重映射
- `styles/index.scss` 仅加载公共样式和全局规则；富文本复用 `_topic-content.scss`，主侧栏重复模式复用 `views/main/components/_mixins.scss`。跨页面样式优先用不直接生成选择器的 mixin，不把 `.topic-content` 加入全局样式
- 浮层通过 Base UI Portal 挂到 `document.body`，主题与层级集中在 `components/ui/ui.scss`。高对比描边由主题映射处理；组合多个 `render` 触发器时保留中间真实 DOM
- 首次无内容加载使用 `PageSkeleton`，与真实容器、层级、间距和断点对齐，保留无障碍与减少动效支持；已有内容上的局部加载使用 Spinner 或组件 loading。话题刷新等既有整块骨架行为按对应页面设计处理
- 主题回归页仅在本次改动共享组件实现、主题映射、浮层或 `webview/theme.html` 时运行，覆盖亮色、暗色、高对比与高对比亮色。只改业务页面且未改这些实现时不打开该页。骨架变化还需对照真实内容检查窄侧栏布局及局部加载
- HTML 内容统一复用共享主题化外层、链接导航与内容增强，不在页面重复路径正则、URL 解码或 RPC 分支
- 业务按钮链接通过 `resolveWebviewUrl()` 解析；HTML 链接交给 `handleWebviewLinkClick()` / `core/linkNavigation.ts`；扩展侧统一使用 `src/features/openExternal.ts`
- HTML 标准化、图片预览与隐藏图片占位由 `core/contentEnhancement.ts` 处理。修改共享导航或增强时验证话题、用户、节点、外部链接与图片，一次点击只触发一种打开行为

## 注释与文档维护

- 对外 API、关键参数、重要常量和复杂规则优先用 JSDoc 说明意图与约束，类型由 TypeScript 表达；代码块内用 `//`，不为显而易见的实现添加注释
- 短语式中文注释通常不加句号，保留有效注释，同步更新因改动失效的说明
- 文档记录代码难以表达的外部契约、设计取舍、边界和可复现踩坑，不维护方法清单、布局尺寸或逐步调用流程。普通功能优先使用代码注释和测试，不按功能机械新建文档
- 仅在改动影响已有文档结论时同步更新；新增确需长期维护的文档后加入下方索引。文档与注释不记录讨论过程、迁移对比或个案调试流水账；可保留 TODO 与后续优化方向

## 项目文档

- [登录与 Cookie 会话](docs/auth-session.md) — 登录状态分层、SecretStorage、候选会话、两步验证和并发隔离规则
- [每日签到逻辑](docs/daily-sign-in.md) — 每日签到的数据来源、状态判定、缓存、调度和边界处理
- [帖子回复楼中楼算法](docs/nested-replies.md) — 平铺回复转换为楼中楼结构的推断规则、设计取舍和已知边界
- [话题测试样本](docs/test-topics.md) — 按空状态、富文本、代码块、附言、分页和回复树分类的公开测试帖子
- [内容预览 HTML 契约](docs/reply-preview-html.md) — 原生与 Markdown 预览接口的真实 HTML 输出、过滤规则和渲染约束
- [话题分享图](docs/topic-share-image.md) — 长图渲染、本地图片缓存、Webview 资源授权和回退规则
- [主题写操作接口契约](docs/topic-write-contract.md) — 发布、编辑、移动与附言的请求差异、权限与成功判据
- [Webview RPC 通信](docs/webview-rpc.md) — 消息协议、约定式控制器、事件推送和安全边界
- [Webview UI 与主题](docs/webview-ui.md) — Base UI、Lucide 图标、VS Code 语义变量和组件扩展约束

## 提交

仅在用户明确要求时提交。使用英文 Conventional Commits，例如 `fix: handle empty node list`。
