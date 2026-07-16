# 每日签到逻辑

本文记录 V2EX 每日签到的当前实现、数据来源、状态判定和边界处理，方便后续排查签到失败、奖励数量错误、凌晨状态异常及自动调度问题。

## 代码位置

- 功能编排、缓存、调度、重试和通知：`src/features/dailySignIn.ts`
- V2EX 签到请求和余额查询：`src/v2ex/services/account.ts`
- `V2exClient` 对外接口：`src/v2ex/client.ts`
- 签到领域类型：`src/v2ex/types.ts`
- 余额页面解析：`src/v2ex/parsers/balance.ts`
- 余额解析测试：`src/v2ex/parsers/balance.test.ts`
- 扩展激活入口：`src/extension.ts`
- 主视图自动签到入口：`src/providers/MainViewProvider.ts`
- Webview 手动签到和状态展示：`webview/src/views/main/tabs/MyTab.tsx`

## 数据来源

签到逻辑使用两个 V2EX 页面：

- `/mission/daily`：判断签到页面当前显示“已领取”还是提供领取按钮，并解析领取请求的 `once` 参数
- `/balance?p=N`：确认最新一条每日登录奖励的日期和铜币数

签到页面是“当前页面状态”的权威来源，余额流水是“奖励实际入账”的权威来源。不能只根据本地日期推断签到页面是否已经进入新周期。

## 领域数据

最新一条签到奖励包含 V2EX 余额流水中的日期和铜币数：

```ts
interface DailySignInReward {
  date: string
  reward: number
}
```

签到状态显式区分页面是否显示已领取，以及是否找到对应奖励：

```ts
interface DailySignInStatus {
  signedIn: boolean
  reward?: DailySignInReward
}
```

`signedIn` 只表示 `/mission/daily` 当前是否显示“已领取”，不直接等价于“当前 V2EX 日期已经签到”。在签到页面尚未刷新时，页面可能仍显示已领取，而最新奖励属于前一个日期。

执行签到返回以下结果：

```ts
type DailyRes = 'success' | 'repetitive' | 'failed'

interface DailySignInResult {
  result: DailyRes
  reward: number
  rewardDate?: string
}
```

- `success`：本次领取后出现了日期更新的签到奖励流水
- `repetitive`：签到页面当前显示已领取；奖励可能属于当前日期，也可能仍属于前一个日期
- `failed`：未登录、页面结构无法识别、请求失败，或领取后没有确认到新奖励流水

## 余额流水解析

### 余额金额

`parseBalance()` 使用 `parseCoinBalance()` 按币种图片的 `alt` 解析余额：

```html
11 <img alt="G" /> 32 <img alt="S" /> 63 <img alt="B" />
```

不能只按文本数字的出现顺序映射金币、银币和铜币，因为余额为零的高位币种可能不会出现在页面中。

### 最新签到奖励

余额流水按时间从新到旧排列。`getDailySignInReward()` 从第 1 页开始，逐页查找第一条满足以下条件的流水：

```text
类型 = 每日登录奖励
方向 = positive
奖励数量 > 0
```

为了避免老账号产生过多请求，最多查询前 5 页。5 页内没有找到时返回 `undefined`。

必须严格匹配“每日登录奖励”，不能将以下相似流水当作签到奖励：

- 每日活跃度奖励
- 连续登录奖励

奖励日期取自流水时间开头的 `YYYY-MM-DD`，奖励数量取自数额列。余额流水当前显示 `+08:00` 时间，因此本地签到完成日期也使用相同的 `+08:00` 日历日期进行比较。

## 签到状态查询

`getDailySignInStatus()` 的流程如下：

1. 请求 `/mission/daily`
2. 页面没有已领取标记时返回 `{ signedIn: false }`
3. 页面显示已领取时查询最新签到奖励
4. 返回 `{ signedIn: true, reward }`

功能层收到状态后，还会比较 `reward.date` 和当前 `+08:00` 日期：

- 日期相同：确认当前日期已经签到，并更新本地缓存
- 日期不同：签到页仍可能处于上一个周期，当前日期不能标记为已签到
- 奖励缺失：只能确认页面显示已领取，不能确认当前日期已经签到

## 执行签到

`AccountService.dailySignIn()` 按以下顺序执行：

1. 记录任务开始时的登录 Cookie；没有登录 Cookie 时返回 `failed`
2. 请求 `/mission/daily`；失效 Cookie 由受保护页面重定向统一清理
3. 查询领取前最新的一条签到奖励
4. 如果页面显示已领取，返回 `repetitive` 及领取前最新奖励
5. 如果页面提供领取按钮，从 `onclick` 中解析 `once`
6. 在领取请求前比较 A2 快照；已经切号或退出时返回 `failed`
7. 请求 `/mission/daily/redeem?once=...`
8. 领取请求返回后再次比较 A2；已经切号或退出时返回 `failed`
9. 再次查询最新签到奖励
10. 最新奖励日期与领取前不同则返回 `success`，否则返回 `failed`

领取前后使用奖励日期确认新流水。每日登录奖励每天最多一条，因此日期变化可以区分本次领取产生的新奖励，即使相邻两天随机到了相同数量的铜币也不会误判。

A2 快照只保护真正产生领取副作用的 `redeem` 前后，不扩展到签到状态查询、余额翻页或全部业务请求。2FA 补充 A2O 不代表账号变化，不会中止当前流程。该快照不能取消已经发送的领取请求，但能避免切号后继续把该请求当作当前账号的成功结果确认。

功能层只在以下情况将当前页面标记为已签到：

- 结果为 `success`
- 结果为 `repetitive`，并且 `rewardDate` 与当前 `+08:00` 日期相同

如果签到页面仍显示上一个周期的已领取状态，返回值仍是 `repetitive`，但 Webview 不会被错误标记为今日已签到。

## 自动签到

自动签到受 `v2ex.browse.autoSignIn` 配置控制，并要求 `V2exClient` 已验证当前用户名。

当前触发入口包括：

- 扩展激活并刷新登录会话后
- 用户登录成功后
- 主 Webview 从隐藏恢复为可见时
- 扩展激活期间每隔 1 小时

定期检查不写死某个刷新时间。V2EX 历史规则曾以 UTC 作为每日边界，但页面行为可能变化；按小时检查可以在签到页实际进入新周期后自然完成领取。

如果激活时的登录会话检查因临时网络问题失败，后续可见性触发或小时调度会在存在 Cookie 但尚无已验证用户名时重新调用 `ensureAuthenticated()`，避免自动签到永久停用。

如果本地缓存已经确认当前账号在当前 `+08:00` 日期完成签到，自动签到会直接返回，不再请求 V2EX。

## 手动签到

Webview 调用 `dailySignIn()` 执行手动签到。手动签到不受自动签到配置控制，但要求 `V2exClient` 已验证当前用户名。

手动和自动签到按任务开始时的用户名复用 `dailySignInTask`：

- 同一账号的自动和手动请求并发时复用正在进行的任务
- 切换到另一个用户名后创建新账号任务，不复用旧账号 Promise
- `AccountService` 只在 `redeem` 前后比较 A2；功能层不传会话版本、对象身份或守卫参数
- 功能层在写缓存、继续重试和发送状态事件或用户提示前比较当前用户名
- 用户名已经变化时，旧任务自然结束，但不会为新账号写缓存、继续重试或发送完成通知
- 当前账号任务完成后清除引用，允许后续重新执行

任务开始时通过 `onDailySignInStatusChanged` 向主 Webview 发送 loading 状态；任务结束时仅在用户名仍为当前账号时发送最终状态，Webview 据此同步按钮 loading 和是否已签到。

## 本地缓存与账号隔离

本地完成记录保存在扩展 `globalState` 的 `lastAutoSignInDate` 中：

```ts
interface DailySignInRecord {
  username: string
  date: string
  reward?: number
}
```

`username` 来自登录会话检查时解析到的当前 V2EX 用户名，按原始大小写存储和精确比较。读取缓存时必须同时匹配用户名和当前 `+08:00` 日期，因此同一天切换账号不会复用另一个账号的签到结果。

`reward` 用于让 Webview 在重新打开后仍能展示当日获得的铜币数。旧版本缓存没有该字段时，状态查询会重新请求签到页和余额流水，确认后补齐奖励缓存。

旧版本保存的日期字符串或 Cookie 指纹结构不会匹配当前结构，会通过 V2EX 页面和余额流水重新确认状态。

插件激活时通过 `V2exClient.refreshAuthentication()` 请求首页。账户概览解析器确认 Cookie 有效并返回用户名，客户端保存该用户名；首页响应仍会独立更新完整账户概览缓存，不需要额外请求用户信息。候选登录已经完成同样的检查，因此 `switchLoginCookie()` 成功后可以直接建立已验证状态，不再重复请求首页。

普通签到入口使用 `V2exClient.ensureAuthenticated()` 复用已验证状态或正在进行的检查，再用 `getAuthenticatedUsername()` 确定缓存和任务所属账号。登录、退出、Cookie 失效或切换账号时不向功能层传播会话对象或专用会话变化错误；受保护页面的登录重定向会统一清理失效登录，公开标签页不受登录检查阻塞。

## 重试和用户提示

自动签到失败后按以下间隔重试：

```text
首次执行
2 秒后第 2 次
5 秒后第 3 次
```

手动签到不自动重试，避免用户点击后等待过久。

提示规则：

- 签到成功：显示 `V2EX 每日签到成功，获得 N 铜币`
- 自动签到重试后仍失败：显示失败提示
- 手动签到失败：显示失败提示
- 失败提示提供“查看日志”操作
- `repetitive` 不显示成功提示，避免重复打扰

异常会写入 V2EX 日志通道。底层异常在功能层转换为 `{ signedIn: false, result: 'failed' }`，保证 Webview loading 状态能够正常结束。

## 状态时序

Webview 首次加载时主动调用 `getDailySignInStatus()`，不能只依赖扩展侧单向发送一次状态事件。自动签到可能早于 React 监听注册，因此状态读取负责初始化，事件只负责后续任务的增量同步。

签到任务执行期间，状态读取返回：

```ts
{
  signedIn: isDailySignedInToday(),
  loading: true
}
```

任务完成后会发送带有最终 `signedIn`、`result`、`reward` 和 `loading: false` 的状态事件。Webview 在已签到状态下展示“今日已签到，获得 N 铜币”；首次状态读取也会从本地记录或 V2EX 状态返回奖励数。

## 已知边界

- 最新签到奖励只扫描余额前 5 页；超过范围时无法取得奖励数量和日期
- 签到页面已领取标记依赖当前 V2EX HTML 结构
- 领取成功以余额中出现新日期的“每日登录奖励”流水为准
- 当前日期按余额页面使用的 `+08:00` 日期计算，而不是运行 VS Code 的系统时区
- 自动检查间隔为 1 小时，页面进入新周期后最多可能延迟约 1 小时自动领取
- 网络失败和页面解析失败目前都统一表现为 `failed`，详细原因需要查看日志
- A2 快照变化只能阻止领取后的继续确认，不能撤回已经发送到 V2EX 的领取请求
- 同一用户名重新换入另一份 A2 时，功能层仍把它视为同一账号；`AccountService` 会停止旧领取流程，但不提供完整请求链隔离

## 验证重点

- 未登录、已领取、首次领取、领取失败和 2FA 后领取
- 领取前后 A2 未变化时正常查询新奖励并返回结果；仅新增 A2O 不会中止流程
- 在 `redeem` 前或等待其返回时切号或退出，流程返回失败，也不为旧用户名写缓存、重试或通知
- 同一用户名的手动与自动签到复用任务，不同用户名的任务和缓存互不复用
- 自动签到网络失败后按既定间隔重试，切换用户名后停止旧任务重试
- Webview 首次状态读取、任务 loading 事件和任务结束事件保持一致
