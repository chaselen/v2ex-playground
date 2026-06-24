# V2EX Playground

中文名：V2EX 游乐场

上班累的时候用来放（mō）松（yú）的 VSCode 插件。

[![Marketplace](https://vsmarketplacebadges.dev/version/chaselen.v2ex-playground.svg)](https://marketplace.visualstudio.com/items?itemName=chaselen.v2ex-playground)
[![Installs](https://vsmarketplacebadges.dev/installs/chaselen.v2ex-playground.svg)](https://marketplace.visualstudio.com/items?itemName=chaselen.v2ex-playground)

- 仓库地址：[github.com](https://github.com/chaselen/v2ex-playground)
- 插件地址：[marketplace.visualstudio.com](https://marketplace.visualstudio.com/items?itemName=chaselen.v2ex-playground)
- 更新日志：[CHANGELOG](https://github.com/chaselen/v2ex-playground/blob/master/CHANGELOG.md)

---

## 功能

- [x] 话题浏览：查看首页、自定义节点、收藏节点和节点主题
- [x] 话题详情：阅读主题内容和回复，支持分页、图片预览、隐藏和下载
- [x] 互动操作：回复话题、收藏话题、感谢主题或回复，并复制标题、链接或用浏览器打开
- [x] 个人中心：查看账户概览、账户余额、收藏主题、特别关注和提醒消息
- [x] 用户详情：查看用户资料、主题和回复
- [x] 搜索：按关键词、用户和节点查找话题
- [x] 签到：自动或手动完成每日签到，并查看签到状态

## 使用须知

### 登录 Cookie

插件通过 V2EX Cookie 识别登录状态：

- 未开启两步验证的账号：只需要填写 `A2`
- 已开启两步验证的账号：从 `v1.11.0` 开始支持，可以同时填写 `A2` 和 `A2O`；如果只填写 `A2`，插件会弹出两步验证页面，完成验证后继续登录

登录时可先在浏览器访问 V2EX，再从开发者工具中复制完整的 Cookie 值，也可以只复制包含 `A2` 和 `A2O` 的部分。

![查看 Cookie](https://files.seeusercontent.com/2026/06/24/6cnO/pasted-image-1782269743637.webp)

### 代理访问

插件不再提供应用内自定义代理配置。如需通过代理访问 V2EX，可优先使用 VS Code 自带代理设置。

在 VS Code 图形界面中打开设置，搜索 `http.proxy` 或 `Proxy`，找到 `Http: Proxy` 后填入代理地址，例如 `http://127.0.0.1:7890`。也可以直接在 `settings.json` 中配置：

```json
{
  "http.proxy": "http://127.0.0.1:7890"
}
```

也可以在 Proxifier 等代理软件中添加域名规则，让 `v2ex.com` 和 `*.v2ex.com` 走代理。

## 设置项

| 配置项                          | 说明                     | 默认值 |
| ------------------------------- | ------------------------ | ------ |
| `v2ex.browse.openInNewTab`      | 始终在新标签页中打开页面 | `true` |
| `v2ex.browse.autoSignIn`        | 自动进行每日签到         | `true` |
| `v2ex.browse.showImagesInTopic` | 查看帖子时显示图片       | `true` |

---

## 反馈

如果您有任何问题或意见，欢迎在[我的创作帖](https://www.v2ex.com/t/703733)中进行回复，或者提交 [issues](https://github.com/chaselen/v2ex-playground/issues)。

## 预览

![预览1.jpg](https://files.seeusercontent.com/2026/06/04/4cWg/pasted-image-1780563531661.webp)
