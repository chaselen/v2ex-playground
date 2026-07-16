# 站内帖子预览

## 功能范围

话题正文、附言和回复中的 V2EX 站内话题链接会显示“预览”按钮。点击后使用 Semi `Modal` 加载目标话题，预览内容与完整话题页共用同一个视图，包括正文、附言、评论分页、楼中楼、回复框、收藏和感谢操作。

预览弹窗使用 Semi `Modal` 自带的标题和底部操作区，“进入主题”为确认操作，“关闭”为取消操作。弹窗使用 `centered` 消除 Semi 默认的 80px 纵向外边距，最大宽度为 1040px，并在窄窗口下保留 24px 的两侧安全边距；最大高度为 800px，并在矮窗口下保留 24px 的上下安全边距。标题和底部操作区固定可见，只有话题正文区域滚动。预览与完整话题页一样显示悬浮操作区，并通过 `floatingActionsContainer` 将按钮 Portal 到 Modal 正文定位容器内，避免使用视口定位后显示到弹窗外侧。

预览内容位于 Modal Portal 中，必须在弹窗内部单独组合 `TopicShareContextMenu`。主话题和预览共用 `copyTopicLink`、`copyTopicTitleLink`、`viewTopicInBrowser` 等显式携带话题 id 的分享命令。

预览不会写入最近浏览记录；只有点击“进入主题”后才按普通话题面板处理导航和阅读记录。

## 共享视图

`webview/src/views/topic/TopicDetailView.tsx` 是完整话题内容和交互的唯一入口，普通话题页与预览弹窗都使用该组件。它直接渲染标题、正文、附言、评论树和分页，并组合主题工具栏、收藏、感谢、回复操作和悬浮按钮。`ReplyComposer.tsx` 自行管理回复编辑、预览、上传、提交和重置状态。

不要在 `TopicApp.tsx` 或 `TopicPreviewModal.tsx` 中复制话题详情结构或操作按钮。

`TopicDetailView` 提供以下显示控制属性，新增同类展示差异时优先扩展该组件，不创建另一套详情视图：

- `showReplyComposer`
- `showFloatingActions`
- `showTopicToolbar`
- `showReplyViewSwitch`
- `showReplyActions`
- `initialReplyViewMode`

登录、刷新、收藏、感谢、回复、用户和节点导航、评论翻页等通用操作集中在 `useTopicDetailController`。普通话题页与预览弹窗分别提供当前详情实例的数据适配器，再将生成的单个 `controller` 属性传给 `TopicDetailView`；详情视图不识别主面板或预览来源，也不直接负责 RPC 状态分流。

普通话题页和预览弹窗刷新时都切换为话题骨架屏。预览数据适配器负责将刷新状态同步给 Modal；刷新失败后恢复原有话题内容并显示错误提示，不停留在骨架状态。

## 状态与操作隔离

普通话题页由 `TopicPanelController` 保存当前面板状态；预览弹窗独立保存被预览话题的状态。两者可以渲染同一个 `TopicDetailView`，但不能共享 `TopicDetail` 状态实例。

收藏、感谢主题、感谢回复和提交回复共用一套无视图状态的操作命令，`TopicActionTarget` 只携带 `topicId` 和当前回复页。命令始终返回目标回复页的最新 `TopicDetail`，对应详情实例的 controller 决定如何应用结果；预览适配器只更新仍处于活动状态的同一话题，避免异步响应覆盖后来打开的预览。

当操作目标与当前主面板话题相同时，`TopicPanelController` 同步主面板详情，但保留主面板自己的回复页。该同步由受影响的话题 id 决定，不依赖操作来自主页面还是预览框；预览操作本身仍不会写入最近浏览记录。

主面板与预览弹窗可以同时挂载两个详情实例。回复翻页只应用最新请求结果；写操作返回时如果用户已经切换回复页，只更新最新话题状态并保留当前页的回复列表。回复模式切换使用实例级 RadioGroup 名称，回复框的文件拖放则由单一全局监听器定位实际目标，避免两个实例互相截获事件。

## 链接识别

站内话题链接识别集中在 `webview/src/core/topicLink.ts`。只接受 `v2ex.com` 及其子域名下的 `/t/<数字 id>` 路径，允许查询参数和评论锚点。内容增强只负责添加按钮和转发目标话题 id，不直接加载话题数据。

预览按钮和站内链接导航属于 `dangerouslySetInnerHTML` 渲染完成后的运行时 DOM 增强。`EnhancedHtmlContent` 必须在每次 React 提交后幂等同步这些增强，避免父组件重渲染重写 HTML 后丢失按钮或事件监听。
