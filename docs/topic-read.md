# 话题已读状态

已读与最近浏览共用 `globalState` key `topicReadRecords`（用户级，同配置多窗口共用落盘数据；保留 30 天、最多 2000 条）。打开话题详情后写入。

同窗口通过进程内 `onTopicRead` 推送 `topicRead`，主面板立刻标记。列表刷新、展开或翻页时用 `isTopicRead()` 带上 `isRead`。

每个窗口有独立 Extension Host，`onTopicRead` 不能跨窗口；VS Code 也不给 `globalState` 变更事件。设计取舍：不做实时广播。窗口重新获得焦点，或主面板重新可见时，重读 `globalState`，把当前已读 id 再走一遍现有 `topicRead`。只补已读；另一窗口删除/清空最近浏览后，这边已加载列表不会立刻改回未读，刷新或重新展开后会对齐。主面板尚未 `ready` 或不可见时不推。
