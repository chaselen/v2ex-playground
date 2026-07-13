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
- Webview 手动签到和状态展示：`webview/src/main/tabs/MyTab.tsx`

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

1. 调用 `checkCookie()` 确认登录状态并取得当前用户名
2. 查询领取前最新的一条签到奖励
3. 请求 `/mission/daily`
4. 如果页面显示已领取，返回 `repetitive` 及领取前最新奖励
5. 如果页面提供领取按钮，从 `onclick` 中解析 `once`
6. 请求 `/mission/daily/redeem?once=...`
7. 再次查询最新签到奖励
8. 最新奖励日期与领取前不同则返回 `success`，否则返回 `failed`

领取前后使用奖励日期确认新流水。每日登录奖励每天最多一条，因此日期变化可以区分本次领取产生的新奖励，即使相邻两天随机到了相同数量的铜币也不会误判。

功能层只在以下情况将当前页面标记为已签到：

- 结果为 `success`
- 结果为 `repetitive`，并且 `rewardDate` 与当前 `+08:00` 日期相同

如果签到页面仍显示上一个周期的已领取状态，返回值仍是 `repetitive`，但 Webview 不会被错误标记为今日已签到。

## 自动签到

自动签到受 `v2ex.browse.autoSignIn` 配置控制，并要求存在登录 Cookie。

当前触发入口包括：

- 扩展激活并刷新登录会话后
- 用户登录成功并刷新登录会话后
- 主 Webview 从隐藏恢复为可见时
- 扩展激活期间每隔 1 小时

定期检查不写死某个刷新时间。V2EX 历史规则曾以 UTC 作为每日边界，但页面行为可能变化；按小时检查可以在签到页实际进入新周期后自然完成领取。

如果激活时的登录会话检查因临时网络问题失败，后续可见性触发或小时调度会在存在 Cookie 但尚无已验证用户名时重新执行 `checkCookie()`，避免自动签到永久停用。

如果本地缓存已经确认当前账号在当前 `+08:00` 日期完成签到，自动签到会直接返回，不再请求 V2EX。

## 手动签到

Webview 调用 `dailySignIn()` 执行手动签到。手动签到不受自动签到配置控制，但要求存在登录 Cookie。

手动和自动签到按“认证会话版本 + 用户名”复用 `dailySignInTask`：

- 同一账号的自动和手动请求并发时复用正在进行的任务
- 切换账号后立即创建新账号任务，不复用旧账号 Promise
- 会产生领取操作的签到请求链在网络步骤之间检查认证会话版本
- 旧账号任务不重试、不更新签到缓存，也不发送状态事件或用户提示
- 当前账号任务完成后清除引用，允许后续重新执行

任务开始和结束时通过 `onDailySignInStatusChanged` 向主 Webview 发送状态，Webview 据此同步按钮 loading 和是否已签到。

## 本地缓存与账号隔离

本地完成记录保存在扩展 `globalState` 的 `lastAutoSignInDate` 中：

```ts
interface DailySignInRecord {
  username: string
  date: string
}
```

`username` 来自登录会话检查时解析到的当前 V2EX 用户名，按原始大小写存储和精确比较。读取缓存时必须同时匹配用户名和当前 `+08:00` 日期，因此同一天切换账号不会复用另一个账号的签到结果。

旧版本保存的日期字符串或 Cookie 指纹结构不会匹配当前结构，会通过 V2EX 页面和余额流水重新确认状态。

插件激活和登录成功后会通过 `checkCookie()` 请求首页。`checkCookie()` 使用账户概览解析器确认 Cookie 有效并显式返回用户名，`V2exClient` 只在认证会话版本未变化时保存该用户名；首页响应仍会独立更新完整账户概览缓存，不需要额外请求用户信息。

登录会话检查结果和进行中的任务都按认证会话版本隔离。`refreshLoginSession()` 和 `ensureLoginSession()` 直接复用 `checkCookie()` 的结果：插件激活、登录成功和“我的”账户概览主动刷新，收藏节点、主题、提醒及签到请求复用当前版本的检查结果，不按时间重复请求首页。登录、退出、Cookie 失效或切换账号会增加版本，旧版本任务即使稍后完成也不会覆盖新账号状态；会话层也会忽略旧 Cookie 代次的响应和重定向 Cookie，避免旧请求清理或污染新账号。受保护页面的登录重定向会统一清理当前失效会话，公开标签页不受登录检查阻塞。

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

任务完成后会发送带有最终 `signedIn`、`result`、`reward` 和 `loading: false` 的状态事件。

## 已知边界

- 最新签到奖励只扫描余额前 5 页；超过范围时无法取得奖励数量和日期
- 签到页面已领取标记依赖当前 V2EX HTML 结构
- 领取成功以余额中出现新日期的“每日登录奖励”流水为准
- 当前日期按余额页面使用的 `+08:00` 日期计算，而不是运行 VS Code 的系统时区
- 自动检查间隔为 1 小时，页面进入新周期后最多可能延迟约 1 小时自动领取
- 网络失败和页面解析失败目前都统一表现为 `failed`，详细原因需要查看日志
