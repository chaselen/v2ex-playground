# V2EX Playground

中文名：V2EX 游乐场

一款用于在 VS Code、TRAE、Cursor 等编辑器中浏览 [v2ex.com](https://www.v2ex.com) 的扩展。

无需离开编辑器，即可浏览话题与节点、查看回复、搜索内容、参与互动，并使用签到、收藏、提醒和账户信息等常用功能。适合想专注阅读 V2EX，也适合上班累时短暂放（mō）松（yú）。

- VS Code 扩展地址：[![Marketplace](https://vsmarketplacebadges.dev/version/chaselen.v2ex-playground.svg)](https://marketplace.visualstudio.com/items?itemName=chaselen.v2ex-playground) [![Installs](https://vsmarketplacebadges.dev/installs/chaselen.v2ex-playground.svg)](https://marketplace.visualstudio.com/items?itemName=chaselen.v2ex-playground)
- Open VSX 扩展地址：[![Open VSX](https://img.shields.io/open-vsx/v/chaselen/v2ex-playground?label=Open%20VSX)](https://open-vsx.org/extension/chaselen/v2ex-playground) [![Open VSX Downloads](https://img.shields.io/open-vsx/dt/chaselen/v2ex-playground?label=downloads)](https://open-vsx.org/extension/chaselen/v2ex-playground)
- 仓库地址：[github.com/chaselen/v2ex-playground](https://github.com/chaselen/v2ex-playground)
- 更新日志：[CHANGELOG](https://github.com/chaselen/v2ex-playground/blob/master/CHANGELOG.md)

## 🖼️ 预览

![V2EX Playground 主界面预览](https://files.seeusercontent.com/2026/07/27/Tt8d/pasted-image-1785117251141.webp)

---

## 🧩 支持的编辑器

- [![Visual Studio Code](https://custom-icon-badges.demolab.com/badge/Visual%20Studio%20Code-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com)
- [![TRAE](https://custom-icon-badges.demolab.com/badge/TRAE-000000?logo=trae&logoColor=white)](https://www.trae.cn)
- [![Cursor](https://img.shields.io/badge/Cursor-000000?logo=cursor&logoColor=white)](https://cursor.com)
- [![VSCodium](https://img.shields.io/badge/VSCodium-2F80ED?logo=vscodium&logoColor=white)](https://vscodium.com)、[![Eclipse Theia](https://img.shields.io/badge/Eclipse%20Theia-0B5394?logo=eclipseide&logoColor=white)](https://theia-ide.org) 等支持从 Open VSX 安装扩展的编辑器

---

## ✨ 功能

- 浏览与搜索：首页、节点、关注主题、节点订阅、内容搜索和最近浏览
- 话题阅读：楼中楼、长回复折叠、代码高亮、站内预览和多图浏览
- 创作与互动：发布、编辑、移动主题和添加附言，支持 Markdown、图片上传、草稿保存及回复、收藏、感谢，并可将自己的主题放到首页或下沉
- 用户与账户：查看用户资料和账户余额，管理关注、屏蔽、忽略节点与主题和提醒消息
- 内容分享：生成话题分享图，复制链接、预览和下载图片
- 每日签到：支持自动或手动签到

## 📖 使用须知

### 登录

在侧栏菜单选择「登录V2EX」，打开登录页。已开启两步验证的账号按提示输入两步验证码。

#### 使用账号密码登录

选择「账号密码」，输入用户名或邮箱、密码和图片验证码后登录。扩展仅保存登录会话，不保存密码。

#### 使用 Cookie 登录

先在浏览器访问 V2EX，从开发者工具中复制完整的 Cookie 值，再在扩展登录页选择「Cookie」，粘贴后登录。

> [!WARNING]
> Cookie 等同于登录凭据，请勿分享、公开截图或提交到 GitHub Issues。

![在浏览器开发者工具中查看 V2EX Cookie](https://files.seeusercontent.com/2026/06/24/6cnO/pasted-image-1782269743637.webp)

### 代理访问

如需通过代理访问 V2EX，请使用 VS Code 自带代理设置；扩展本身不提供应用内代理配置。

在 VS Code 图形界面中打开设置，搜索 `http.proxy` 或 `Proxy`，找到 `Http: Proxy` 后填入代理地址，例如 `http://127.0.0.1:7890`。也可以直接在 `settings.json` 中配置：

```json
{
  "http.proxy": "http://127.0.0.1:7890"
}
```

也可以在 Proxifier 等代理软件中添加域名规则，让以下域名走代理：

- `*.v2ex.com`：访问 V2EX
- `i.imgur.com`：加载话题中的 Imgur 图片和回复框内的图片表情
- `api.imgur.com`：上传回复图片

如果 Imgur 无法连接，相关图片和图片表情将无法显示，回复框的选择、粘贴和拖放图片上传功能也不可用；文字浏览和回复不受影响。

## ⚙️ 设置项

| 配置项                          | 说明                           | 默认值 |
| ------------------------------- | ------------------------------ | ------ |
| `v2ex.browse.openInNewTab`      | 始终在新标签页中打开页面       | `true` |
| `v2ex.browse.autoSignIn`        | 自动进行每日签到               | `true` |
| `v2ex.browse.showImagesInTopic` | 查看帖子时显示内容中的图片     | `true` |
| `v2ex.browse.showAvatar`        | 查看帖子时显示作者和回复者头像 | `true` |

---

## 💬 反馈

如果您有任何问题或意见，欢迎在[我的创作帖](https://www.v2ex.com/t/703733)中进行回复，或者提交 [GitHub Issues](https://github.com/chaselen/v2ex-playground/issues)。

## 🙏 致谢

回复框的部分代码设计和交互参考了 [V2EX_Polish](https://github.com/coolpace/V2EX_Polish) 项目。
