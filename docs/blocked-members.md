# 屏蔽用户与忽略主题

本人用户页通过单卡片分段切换展示「我关注的人(N)」与「我屏蔽的人(N)」，默认落在关注列表。内容标签区在本人页额外提供「已忽略(N)」，展示当前账号忽略的主题。

## 数据来源

屏蔽用户与忽略主题编号都不来自独立列表页，而来自登录后页面注入的脚本：

1. 请求任一会注入该脚本的登录态页面（实现上使用 `/?tab=all`）
2. 解析页面中的 `const blocked = [memberId, ...];` 与 `const ignored_topics = [topicId, ...];`
3. 屏蔽列表再对每个 `memberId` 请求 `/api/members/show.json?id={memberId}`，取得 `username` 与头像
4. 忽略主题列表由本人页控制器按展示顺序分页后，对当前页 `topicId` 请求 `/api/topics/show.json?id={topicId}`，映射为列表用的 `Topic`

未登录、脚本缺失或对应数组为空时，返回空列表。单个成员 / 主题 API 失败时跳过该编号，不中断整表。

脚本中的 `blocked` / `ignored_topics` 均为先操作在前（先屏蔽 / 先忽略在前）。本人页「已忽略」展示与分页前会反转为**新忽略在前**；屏蔽用户分段目前保持站点原始顺序。

**数量口径：**「我屏蔽的人(N)」取补齐后的 `blockedMembers.length`，不是脚本里的 `blocked` 原始长度。成员 API 返回 `Object Not Found`（如已注销账号）或请求失败时会跳过该编号，因此展示人数可能少于脚本中的屏蔽编号数。「已忽略(N)」取 `ignoredTopicIds.length`（脚本编号长度）；打不开的主题只影响列表项，不减少标签计数。

对外入口：

- `V2exClient.getBlockedAndIgnoredIds()` — 一次请求同时返回 `blockedMemberIds` 与 `ignoredTopicIds`（站点原始顺序：先屏蔽 / 先忽略在前）
- `V2exClient.getBlockedMembersAndIgnoredTopicIds()` — 一次请求返回屏蔽用户摘要与忽略主题编号；`blockedMembers` 可能短于 `blockedMemberIds`
- `V2exClient.getIgnoredTopicIds()` — 仅取忽略主题编号（先忽略在前）
- `V2exClient.getBlockedMembers()` — 屏蔽用户摘要列表（先屏蔽在前；查不到的编号已跳过）
- `V2exClient.getTopicsByIds(topicIds)` — 按给定编号补齐主题摘要，保持入参顺序

应用层分页（默认每页 20）与「已忽略」的新忽略在前排序由 `MemberPanelController` 负责，不放入 `v2ex/services`。

## 展示边界

- 仅本人页加载并展示关系列表与「已忽略」标签；他人页不请求屏蔽 / 忽略数据
- 「我屏蔽的人(N)」与列表同源，均为可解析出资料的屏蔽用户；与脚本 `blocked` 原始数量可能不一致
- 「已忽略(N)」中的数量取自忽略主题编号列表长度；打开该标签或翻页时优先复用本人页已缓存的编号，只请求当前页主题详情 API；整页刷新才会重新读取页面脚本
- 忽略主题列表复用与其他主题标签相同的 `TopicListItem` 与分页控件；因主题来自不同作者，该标签额外显示作者
- 列表项可打开用户页，也可直接取消关注 / 取消屏蔽；RPC 仅传 `memberId`，复用已有 `unfollow` / `unblock` 接口，成功后刷新本人页关系列表
- 话题详情与站内话题预览中的用户快速资料浮层，在可读取用户关系状态时提供确认后的屏蔽 / 取消屏蔽操作；本人资料不显示该操作，扩展侧也会拒绝对本人的关系更新；RPC 传递用户编号与用户名，成功后更新浮层状态并清理用户资料缓存
- 已忽略列表可直接取消忽略；RPC 仅传 `topicId`，复用 `cancelIgnoreTopic`，成功后从本地编号列表移除并刷新当前页
- 在其他面板屏蔽、取消屏蔽或忽略主题后，已打开的本人页需刷新才会更新对应分段 / 标签计数
