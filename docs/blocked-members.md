# 屏蔽用户列表

本人用户页通过单卡片分段切换展示「我关注的人(N)」与「我屏蔽的人(N)」，默认落在关注列表。

## 数据来源

屏蔽用户与忽略主题编号都不来自独立列表页，而来自登录后首页脚本：

1. 请求 `/?tab=all`
2. 解析页面中的 `const blocked = [memberId, ...];` 与 `const ignored_topics = [topicId, ...];`
3. 屏蔽列表再对每个 `memberId` 请求 `/api/members/show.json?id={memberId}`，取得 `username` 与头像

未登录、脚本缺失或对应数组为空时，返回空列表。单个成员 API 失败时跳过该编号，不中断整表。

对外入口：

- `V2exClient.getHomeScriptPreferences()` — 一次首页请求同时返回 `blockedMemberIds` 与 `ignoredTopicIds`
- `V2exClient.getIgnoredTopicIds()` — 仅取忽略主题编号
- `V2exClient.getBlockedMembers()` — 屏蔽用户摘要列表（内部同样走首页脚本）

## 展示边界

- 仅本人页加载并展示关系列表；他人页不请求屏蔽数据
- 列表项只提供打开用户页；取消屏蔽仍在对应用户页操作
- 在其他面板屏蔽或取消屏蔽后，已打开的本人页需刷新才会更新屏蔽分段
