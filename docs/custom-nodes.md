# 自定义节点

## 节点全量列表

添加自定义节点时，扩展通过 `GET /api/nodes/all.json` 获取全量节点，而不是解析 `/planes` HTML。

- 映射字段：`name`、`title`、`stars` → `collectCount`；图标优先使用 `avatar_mini`（其次 `avatar_normal` / `avatar_large`）
- 默认占位图（路径含 `node_default`）不写入 `avatar`
- 协议相对地址（如 `//cdn.v2ex.com/...`）会规范化为绝对 `https` URL
- `NodeService` 进程内缓存全量列表；同会话重复打开添加面板不会重复请求
- 全量列表契约由 `src/v2ex/tests/client.nodes.live.test.ts` 对真实 `/api/nodes/all.json` 覆盖；节点页 HTML 解析仍用 `node.test.ts` 的本地夹具

## QuickPick 选择

添加入口使用 VS Code QuickPick：

- 列表项展示节点标题
- `description` 含节点 `name`、收藏人数（`$(bookmark) {collectCount}`），已添加项附加 `$(check) 已添加`
- 支持按标题与 `description` 搜索

## 存储

自定义节点保存在 `globalState` 的 `nodes` 键中，至少包含 `name` 与 `title`；添加时若 API 提供了图标，会一并写入 `avatar`。

## 主面板节点图标

「自定义」与「收藏节点」列表在节点名前展示图标：

- 头像地址按节点 `name` 拼代理 URL：`https://img.fuyou.tech/v2ex/node/{name}?size=normal`（约 48px，列表显示 16px，照顾 Retina），不直连 `cdn.v2ex.com`（Webview 下部分资源会 403）
- 收藏列表仍以 `/my/nodes` 为准；头像不依赖 `getAllNodes()`
- Webview `<img>` 使用 `referrerPolicy="no-referrer"`；不做扩展侧磁盘缓存
- 图标使用 `--v2ex-media-plate-bg` 中性灰底板（兼顾白前景透明图），不加外框；`object-fit: contain`，并用双边 `drop-shadow` 勾边
- 加载失败时显示空占位，保持行对齐；首页分类不展示节点图
