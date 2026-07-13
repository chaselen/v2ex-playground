# 登录与 Cookie 会话

## 状态分层

登录相关状态分为三层，不能互相替代：

- `LoginCredentialStore` 通过 VS Code `SecretStorage` 持久化 A2/A2O
- `V2exSession` 的 `CookieJar` 保存当前运行时会话，包括服务端下发的内部 Cookie
- `AuthSessionManager` 创建并持有正式业务客户端，同时保存登录凭据是否已经验证，供扩展 UI 判断当前能否执行登录操作

旧版 `globalState['cookie']` 只用于一次性迁移。读取 SecretStorage 时仍会清理残留的旧值，后续不能重新使用 globalState 保存登录凭据。

## 扩展启动

1. `AuthSessionManager.initialize()` 从 SecretStorage 加载 A2/A2O，并创建业务 `V2exClient`
2. 初始化完成后向扩展入口返回已绑定认证回调的业务客户端，不存在需要外部手动绑定客户端的中间状态
3. 启动检查完成前，登录凭据统一视为尚未验证
4. `AuthSessionManager.refreshAuthentication()` 检查实际登录状态
5. 检查成功后标记为已验证并刷新相关 Webview；检查失效时清理运行时会话和持久化凭据

UI 不能通过“是否存在持久化 Cookie”推断已经登录，只能读取 `AuthSessionManager.isAuthenticated()`。

## 手动登录

手动登录是隔离的候选会话事务：

1. 归一化用户输入，只保留 A2/A2O
2. 创建临时 `V2exClient`，不替换业务客户端的 CookieJar
3. 在临时客户端中检查 Cookie，并按需完成 2FA
4. 验证成功后先写入 SecretStorage，再一次性替换业务客户端 Cookie
5. 验证失败、取消或被更新的登录尝试取代时，丢弃临时客户端，不修改当前业务会话

候选登录尝试使用递增版本避免较早请求晚返回后覆盖新账号，凭据写入通过队列串行执行。

## 两步验证

`TwoFactorPanelController` 只负责验证码交互，不直接访问全局 `V2exClient`。调用方必须传入验证码提交函数，使 2FA 始终绑定到触发它的业务会话或候选会话。

同一会话的并发 2FA 请求复用当前面板；其他会话发起验证时会取消旧面板。业务请求等待验证结束后必须再次检查 Cookie 代次，代次变化时不能使用新账号 Cookie 重试旧请求。

2FA 成功是唯一需要从运行时 CookieJar 显式持久化 A2O 的响应更新路径。V2EX 普通响应不会轮换 A2/A2O，因此普通请求的 `Set-Cookie` 只更新运行时 CookieJar，不同步到 SecretStorage。

## 会话切换与登录失效

`V2exSession` 为整体 Cookie 替换维护 `cookieGeneration`。响应处理前以及等待 2FA 后都要检查请求所属代次：

- 当前代次响应可以更新 CookieJar 并进入业务解析
- 旧代次响应抛出 `AuthSessionChangedError`，不能交给业务解析器
- 扩展侧页面加载通过 `ignoreAuthSessionChange()` 静默忽略该错误；认证状态变化会触发新会话刷新
- Webview RPC 将该错误转换为普通的“登录状态已更新，请重试”响应，并跳过异常日志；页面沿用原有错误处理和 loading 收尾，无需感知认证会话错误类型

非 V2EX 请求不绑定 Cookie 代次。例如 SoV2EX 搜索不携带登录 Cookie，切换 V2EX 账号时不应取消其响应。

登录失效时 Session 先清空运行时 Cookie，Client 再更新认证会话版本。Client 只会为当前版本触发失效回调，`AuthSessionManager` 通过统一写入队列顺序清理 SecretStorage，后续登录或退出操作会按队列顺序覆盖最终状态。

## 验证重点

- 普通登录、2FA 登录、取消 2FA 和主动退出
- 旧版 globalState Cookie 向 SecretStorage 的迁移
- 切号时未完成的旧请求不会更新页面或清理新 Cookie
- 等待 2FA 时退出或切号不会重试旧请求
- 并发候选登录只有最新尝试可以提交
- 启动检查完成前 UI 不显示为已验证登录
