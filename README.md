# V2EX Playground

中文名：V2EX 游乐场

上班累的时候用来放（mō）松（yú）的 VSCode 插件。

[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/chaselen.v2ex-playground.svg?label=Marketplace&style=for-the-badge&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=chaselen.v2ex-playground)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/chaselen.v2ex-playground.svg?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=chaselen.v2ex-playground)

- 仓库地址：[github.com](https://github.com/chaselen/v2ex-playground)
- 插件地址：[marketplace.visualstudio.com](https://marketplace.visualstudio.com/items?itemName=chaselen.v2ex-playground)
- 更新日志：[CHANGELOG](https://github.com/chaselen/v2ex-playground/blob/master/CHANGELOG.md)

---

## 功能

- [x] 浏览首页各标签下的话题
- [x] 自定义节点话题查看
- [x] 收藏节点话题查看
- [x] 自定义话题浏览页面，页面样式跟随主题变化
- [x] 话题回复
- [x] 复制话题标题、链接、使用浏览器打开
- [x] 自动签到领取奖励
- [x] 话题收藏、话题感谢
- [x] 话题搜索
- [x] 感谢回复者
- [x] 话题图片预览、隐藏和下载

---

## 设置项

- `v2ex.browse.openInNewTab`：始终在新标签页中打开帖子，默认 `true`
- `v2ex.browse.autoSignIn`：登录后自动进行每日签到，默认 `true`
- `v2ex.browse.showImagesInTopic`：查看帖子时显示图片，默认 `true`

## 代理说明

插件不再提供应用内自定义代理配置。如需通过代理访问 V2EX，可优先使用 VS Code 自带代理设置。

在 VS Code 图形界面中打开设置，搜索 `http.proxy` 或 `Proxy`，找到 `Http: Proxy` 后填入代理地址，例如 `http://127.0.0.1:7890`。也可以直接在 `settings.json` 中配置：

```json
{
  "http.proxy": "http://127.0.0.1:7890"
}
```

也可以在 Proxifier 等代理软件中添加域名规则，让 `v2ex.com` 和 `*.v2ex.com` 走代理。

---

## 反馈

如果您有任何问题或意见，欢迎在[我的创作帖](https://www.v2ex.com/t/703733)中进行回复，或者提交 [issues](https://github.com/chaselen/v2ex-playground/issues)。

## 预览

![预览1.jpg](https://files.seeusercontent.com/2026/05/26/jY3c/pasted-image-1779785248512.webp)
