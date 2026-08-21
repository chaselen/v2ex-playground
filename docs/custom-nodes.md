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
