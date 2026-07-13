# 登录与 Cookie 会话

本文记录登录状态、运行时 Cookie 和持久化凭据的最终职责边界。核心原则是：认证状态只有一个所有者，候选登录与正式业务会话隔离，网络层只管理请求所需的运行时 Cookie。

## 状态所有权

登录相关状态分为三层：

- `LoginCredentialStore` 只负责通过 VS Code `SecretStorage` 持久化 A2/A2O
- `V2exSession` 只负责当前客户端的 `CookieJar`、请求 Cookie、响应 `Set-Cookie`、重定向和 2FA 重试
- `AuthSessionManager` 创建正式业务 `V2exClient`，并唯一拥有“是否已经验证”、当前用户名、凭据提交顺序和持久化同步

`V2exClient` 是领域服务门面，不再保存第二份认证版本或已验证用户名。业务 UI 只能通过 `AuthSessionManager.isAuthenticated()` 判断当前是否登录，不能根据 SecretStorage 中是否存在 Cookie 推断登录有效。

旧版 `globalState['cookie']` 只用于一次性迁移。`LoginCredentialStore.load()` 优先读取有效的 SecretStorage 数据，将内容归一化为 A2/A2O；SecretStorage 内容损坏时会回退到仍然有效的旧数据，随后清理无效或多余内容并删除遗留的 globalState 值。

## 扩展启动与恢复

1. `AuthSessionManager.initialize()` 从 SecretStorage 读取登录 Cookie
2. 管理器使用该 Cookie 创建唯一的正式业务客户端
3. 启动检查完成前，即使存在持久化 Cookie，也视为尚未验证
4. `refreshAuthentication()` 请求 V2EX 首页并解析当前用户名
5. 验证成功后创建当前 `AuthenticatedSession`；验证失效时清空运行时 Cookie、内存状态和 SecretStorage

`ensureAuthenticated()` 在当前会话已经验证时直接复用结果；启动尚未验证或上次检查因网络错误失败时，会重新检查持久化 Cookie。同一会话中的并发检查复用一个 Promise。

进程重启后只恢复 A2/A2O，不持久化内部 Cookie、已验证布尔值或用户名。服务端下发的其他 Cookie 会在后续请求中重新建立。

## 请求和响应 Cookie

请求拦截器只为 V2EX 域名附加当前 CookieJar 中适用于目标 URL 的 Cookie。SoV2EX 等外部请求不携带 V2EX Cookie，也不参与认证会话判断。

V2EX 响应的 `Set-Cookie` 只更新运行时 CookieJar。普通响应不写 SecretStorage，因为 V2EX 常规请求不会轮换需要持久化的 A2/A2O；2FA 成功是唯一会显式把运行时 A2O 同步到 SecretStorage 的响应路径。

自动重定向的中间响应不会进入 Axios 响应拦截器，因此请求拦截器会为每个请求安装捕获当前 Cookie 会话的 `beforeRedirect`：会话未变化时先合并 V2EX `Set-Cookie`，再按目标 URL 重新生成 Cookie 请求头；会话已经替换时直接移除旧请求的重定向 Cookie。跨域重定向不会携带 V2EX Cookie。

## 手动登录、切号和重新登录

手动登录使用隔离的候选会话：

1. 归一化用户输入，只保留 A2/A2O
2. 创建临时 `V2exClient` 和独立 CookieJar
3. 在临时客户端中检查 Cookie，并按需完成 2FA
4. 验证成功后，串行写入 SecretStorage，再一次性替换正式客户端 Cookie
5. 使用验证结果中的用户名直接建立新的 `AuthenticatedSession`

候选验证失败、取消或抛错时，正式业务会话完全不变。并发登录只允许最后发起的候选提交；主动退出也会使尚未完成的候选失效。

登录提交、退出、登录失效清理和 2FA 持久化共用一个凭据写入队列，避免 SecretStorage 的异步写入乱序。队列只解决真实的持久化竞争，不参与普通业务请求。

主动退出会删除 SecretStorage 凭据、清空正式 CookieJar、移除已验证会话并刷新已打开页面。重新登录和切号都走同一候选验证流程，不保留额外兼容路径。

## 两步验证

`TwoFactorPanelController` 只负责验证码交互。调用方必须传入验证码提交函数，因此验证码始终提交给触发 2FA 的正式客户端或候选客户端。

同一正式会话或候选会话的并发 2FA 请求复用当前面板；退出、切号或另一个候选会话发起 2FA 时使用新的 owner 并关闭旧面板。正式会话等待验证码期间若发生退出或切号，管理器会拒绝提交，Session 也不会用替换后的 Cookie 重试旧请求。

2FA 成功后，响应中的 A2O 先进入触发请求的运行时 CookieJar，再由 `AuthSessionManager` 过滤并持久化 A2/A2O。普通内部 Cookie 不会写入 SecretStorage。

## 登录失效

登录失效有两个入口：

- 首页检查明确解析到登录页
- 受保护页面重定向到 `/signin`

两者最终都调用 `V2exSession.expireLogin()`。同一运行时会话只清理和通知一次；`V2exClient` 清空账户缓存，`AuthSessionManager` 清空已验证会话和持久化凭据，扩展入口负责刷新页面并提示重新登录。

临时网络错误或无法识别的首页结构不会当作 Cookie 失效，也不会删除凭据，而是抛错等待后续检查重试。

## 并发边界

最终方案不再把“旧响应”建模为跨项目传播的业务错误，也不要求面板、RPC 和各领域服务识别 `AuthSessionChangedError`。

`V2exSession` 只在内部为整体 Cookie 替换维护一个不可见的会话标识。旧会话响应仍可自然完成，但不能：

- 合并 `Set-Cookie`
- 更新账户概览缓存或触发账户事件
- 清空新会话
- 打开 2FA 或使用新 Cookie 重试旧请求

认证检查的结果由 `AuthSessionManager` 在提交前比较当前会话对象；`V2exClient.checkCookie()` 也使用 Session 快照判断失效结果是否仍属于当前 Cookie 会话，不再比较 Cookie 字符串。每日签到是多请求且包含领取操作的流程，`AccountService` 会在内部创建 Session 守卫并在网络步骤之间确认 Cookie 会话未被替换，不再要求调用方传入会话参数；功能层则使用同一个 `AuthenticatedSession` 停止旧账号的重试、缓存和通知。

普通只读请求的旧 Promise 不再被强制取消。极少数情况下，调用方仍可能收到切号前已经完成解析的数据；登录、退出和切号都会主动刷新相关页面，项目不再为这一低频短暂展示问题引入跨层错误协议。

## 依赖方向

依赖保持单向：

```text
命令 / Webview / 签到功能
          ↓
  AuthSessionManager ──→ LoginCredentialStore
          ↓
      V2exClient
          ↓
   领域 Service
          ↓
     V2exSession
```

`V2exSession` 不依赖功能层或全局状态；业务 Service 不读写 SecretStorage；`LoginCredentialStore` 不知道网络请求；验证码面板不访问全局客户端。

领域 Service 只依赖 `V2exSession`。每日签到不再通过回调反向调用 `V2exClient.checkCookie()`；功能入口统一使用 `AuthSessionManager.ensureAuthenticated()`，领域层则依靠受保护页面的重定向处理运行中失效的 Cookie。

## 验证重点

- SecretStorage 读取、规范化、旧 globalState 迁移和退出删除
- 启动时先验证再显示登录状态
- 候选 Cookie 验证成功后一次性提交，失败或取消不影响当前会话
- 并发候选只有最后一次可以提交，旧认证检查不能覆盖新登录
- 普通登录、2FA 登录、业务请求补充 A2O 和主动退出
- 登录失效只通知一次，并清理运行时与持久化状态
- 旧响应不能更新新 Cookie、清理新登录或用新 Cookie 重试 2FA
- 切号后每日签到停止后续领取、重试、缓存和通知
