# 登录与 Cookie 会话

本文记录扩展的登录状态、运行时 Cookie 和持久化凭据边界。`V2exClient` 是唯一认证门面：调用方只通过少量登录 API 使用会话、Cookie、凭据存储和两步验证能力。

## 职责边界

认证相关职责分为三层：

- `V2exClient` 唯一拥有当前已验证用户名、登录检查、候选 Cookie 切换、退出、登录失效清理和登录凭据持久化时序
- `V2exSession` 负责 V2EX HTTP 请求、运行时 CookieJar、响应 `Set-Cookie`、重定向识别和请求遇到 2FA 后的重试
- `LoginCredentialStore` 负责通过 VS Code `SecretStorage` 读取和保存登录凭据，并迁移旧版 `globalState['cookie']`

`LoginCredentialStore` 通过最小的 `LoginCookieStore` 接口注入，只提供 `load()` 和 `save(cookie)`。两步验证 UI 通过 `onTwoFactorRequired(verification)` 注入，客户端只向其提供 `verification.submitCode(code)`。因此客户端不依赖 VS Code 扩展上下文、Webview Controller 或全局状态，`TwoFactorPanelController` 也不读取全局客户端。

领域 Service 只依赖 `V2exSession`，不读写 SecretStorage，也不维护登录状态。认证状态仅由 `V2exClient` 维护。

## 对外认证 API

扩展功能通过 `V2exClient` 使用以下 API：

- `isAuthenticated()`：当前是否已有经过验证的登录账号
- `hasLoginSession()`：当前是否已有经过验证的账号或仍持有待验证登录凭据，仅用于决定登录态 UI
- `getAuthenticatedUsername()`：取得当前已验证用户名，未登录时返回空值
- `getLoginCookie()`：取得当前可持久化的 A2/A2O，用于登录输入框回显等必要场景
- `ensureAuthenticated()`：已有已验证用户名时直接返回，否则检查当前登录 Cookie；并发调用复用正在进行的检查
- `refreshAuthentication()`：主动重新请求首页检查当前 Cookie
- `switchLoginCookie(cookie)`：在隔离的候选会话中验证 Cookie，成功后再切换当前账号
- `logout()`：清空运行时登录状态和持久化凭据

`switchLoginCookie()` 返回 `authenticated`、`canceled` 或 `invalid`：分别表示已经提交新账号、验证码流程被取消或候选被其他认证操作取代，以及输入无法规范化或 Cookie 已失效。

命令、Webview、签到和面板控制器不直接替换 Session Cookie，不执行底层 Cookie 检查或验证码提交，也不保存第二份“是否登录”状态。

## 启动与登录检查

扩展入口通过 `V2exClient.create({ loginCookieStore, ...options })` 创建客户端。该异步工厂先从凭据存储读取登录 Cookie，再用它建立正式业务 Session。启动检查完成前，存在持久化 Cookie 不代表已经登录；UI 只能以 `isAuthenticated()` 或 `getAuthenticatedUsername()` 的结果为准。

`refreshAuthentication()` 请求 V2EX 首页并解析当前用户名。明确解析到未登录状态时进入统一的登录失效清理；网络错误或无法识别的页面结构会继续抛错，不会删除凭据。`ensureAuthenticated()` 用于普通受保护功能，避免每次调用都重复检查首页。

启动检查因临时网络错误失败时，主面板和话题页可以在仍有登录 Cookie 的前提下保留登录态 UI，避免把“尚未验证”错误展示为“未登录”。受保护数据读取仍通过 `ensureAuthenticated()` 验证，话题写操作则以服务端响应为准；服务端明确重定向到 `/signin` 时继续走统一的登录失效清理。

进程重启后只恢复 A2/A2O，不持久化已验证用户名、布尔状态或 CookieJar 中的内部 Cookie。V2EX 后续响应会重新建立运行时所需的其他 Cookie。

## Cookie 的运行时与持久化

CookieJar 保存当前进程中的完整 V2EX Cookie。请求只向适用的 V2EX 地址附加 Cookie；SoV2EX 等外部地址不携带 V2EX Cookie。V2EX 响应和自动重定向中的 `Set-Cookie` 更新运行时 CookieJar，跨域重定向不会带出 V2EX Cookie。

SecretStorage 只持久化规范化后的 A2/A2O：

- 用户输入可以是完整 Cookie、A2/A2O 片段或单独的 A2 值，提交前统一规范化
- 普通响应中的内部 Cookie 只保留在运行时，不写入 SecretStorage
- 2FA 成功且触发请求重试成功后，新的 A2O 已写入 CookieJar，再显式保存当前登录 Cookie
- 退出或登录失效时删除 SecretStorage 中的凭据

`LoginCredentialStore.load()` 优先使用有效的 SecretStorage 数据。旧版 `globalState['cookie']` 只参与一次迁移；读取后会清理遗留值，损坏或包含多余字段的数据也会按 A2/A2O 重新规范化。

### 两步验证 A2O 的作用域

持久化 Cookie 恢复到 CookieJar 时，A2/A2O 使用 V2EX 服务端的 `Domain=.v2ex.com; Path=/` 作用域。

**踩坑：** 如果在 `https://www.v2ex.com` 上仅写入 `A2O=value`，CookieJar 会创建 host-only 的 `www.v2ex.com` Cookie。V2EX `/2fa` 成功响应下发的 `A2O` 使用 `Domain=.v2ex.com; Path=/`，两者作用域不同而会同时存在。持久化时应取最后一个（最新写入的）认证值，并在下次恢复时采用服务端作用域，才能让后续 `Set-Cookie` 正确覆盖旧值。

## 登录、切号与候选会话

`switchLoginCookie()` 将登录或切号作为一个隔离的候选事务：

1. 规范化用户输入，只保留 A2/A2O
2. 创建具有独立 CookieJar 的候选 Session
3. 在候选 Session 中检查首页，并按需完成 2FA
4. 验证成功后保存候选 Session 的 A2/A2O
5. 一次性替换正式 Session Cookie，并记录候选检查得到的用户名

候选 Cookie 无效、用户取消 2FA 或验证抛错时，当前业务 Session、用户名和持久化凭据保持不变。候选提交前会确认正式认证状态仍与开始验证时一致；其他登录切换或主动退出已经生效时，该候选返回取消，不能覆盖较新的状态。

候选隔离保证尚未确认的新 Cookie 不会污染当前账号。登录成功后调用方继续使用现有 `V2exClient`，无需重新绑定各领域 Service。

## 两步验证

候选登录的验证码提交始终绑定到候选 Session；正式业务请求触发的验证码提交始终绑定到正式 Session。调用验证码 UI 时传入实际的提交函数，UI 不自行查找 `G.V2ex`。

同一验证流程可以复用已打开的面板；另一个流程开始时可以替换旧面板。用户取消时保留原登录状态，并由触发请求按既有错误路径结束。

正式业务请求完成 2FA 且原请求重试成功后，客户端会把运行时 CookieJar 中更新后的 A2/A2O 保存到 SecretStorage。普通 `Set-Cookie` 不触发持久化写入。

## 登录失效与退出

登录失效主要来自两类信号：

- 首页检查明确得到未登录结果
- 受保护页面重定向到 `/signin`

它们最终进入同一个清理流程：清空正式 Session Cookie、已验证用户名和持久化 A2/A2O，再通知扩展刷新相关页面并提示重新登录。清理过程是幂等的；同一轮并发失败可以复用或等待正在进行的清理，不应重复删除凭据或重复发送失效通知。

`logout()` 属于主动操作：调用开始时先使尚未提交的候选登录失效，持久化凭据删除成功后再清空运行时状态。SecretStorage 删除失败时保留当前运行时登录，避免本次运行与重启后的状态相互矛盾。退出完成后，后续业务请求以未登录状态执行。

## 并发边界

普通业务请求在切换 Cookie 前已经发出时，允许其自然完成。`V2exSession` 不记录每个普通请求属于哪一份登录 Cookie，这类响应仍按常规路径解析，并可能更新运行时 Cookie 或触发登录失效处理。

**有意不覆盖的范围：** 不为在途请求建立通用的请求身份追踪、跨层会话错误或取消协议，也不保证旧 Promise 都会被拒绝。切号、登录和退出后会主动刷新相关页面。代价是极少数竞态中可能出现短暂旧数据或额外刷新。

只在实际存在写操作或状态提交的地方增加窄保护：

- 候选登录验证成功后才允许提交正式 Cookie
- 登录失效清理保持幂等
- 每日签到只在领取请求前后比较 A2 快照，避免切号过程中继续确认一次领取操作；同账号补充 A2O 不视为切号
- 签到功能只在写缓存、继续重试和发送通知前比较当前用户名

这些保护不扩展为所有请求的通用隔离机制。若未来出现可稳定复现的数据破坏，再在具体副作用边界补充约束。

## 依赖方向

依赖保持单向：

```text
登录凭据存储接口 ─┐
两步验证交互接口 ─┼→ V2exClient → 领域 Service → V2exSession
命令 / Webview / 签到功能 ┘
```

扩展入口负责把 `LoginCredentialStore`、两步验证 UI、日志和登录失效后的界面刷新回调注入客户端。`V2exClient` 负责认证规则，`V2exSession` 负责网络和 Cookie，外部调用方不参与内部状态协调。

## 验证重点

- SecretStorage 读取、A2/A2O 规范化、旧 globalState 迁移和退出删除
- 启动时先验证 Cookie，再向 UI 暴露已登录用户名
- `ensureAuthenticated()` 复用有效结果和并发检查，`refreshAuthentication()` 强制检查
- 候选 Cookie 成功后一次性提交，失败或取消不改变当前账号
- 并发候选只有一个可以提交，退出或其他切换生效后旧候选不能覆盖当前状态
- 候选登录 2FA 与正式业务 2FA 分别使用正确的 Session
- 正式业务 2FA 成功且重试原请求后持久化更新的 A2O，普通响应不持久化内部 Cookie
- 首页检查和受保护页面重定向触发的登录失效只清理、通知一次
- 普通在途请求可以自然完成，不要求通过全局会话守卫取消
- 在签到发起 `redeem` 前或等待其返回时切号，流程返回失败；旧用户名任务不更新缓存、不重试、不通知
