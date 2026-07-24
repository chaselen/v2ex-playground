# 话题分享图

## 内容范围

话题页可以生成 PNG 长图。分享内容包含主题标题、作者信息、正文、可选附言、可选第一页回复、话题链接和可选二维码，不包含其他页回复或回复操作按钮。启用第一页回复后可以单独选择普通列表或楼中楼模式，默认值跟随主题页当前模式，但不会反向修改主题页；楼中楼模式复用主题页的回复树推断结果与嵌套视觉层级。

正文、附言和回复必须复用 `EnhancedHtmlContent` 与话题页的 `topic-content` 样式。代码高亮属于异步渐进增强，生成图片前必须等待当前卡片内的代码块处理完成。

分享弹窗使用固定视口高度，卡片预览区通过 SimpleBar 独立滚动，右侧分享设置与操作按钮不随长卡片滚动。窄布局下设置区固定在预览区下方，预览区继续承担滚动。

## 图片加载

第三方图片不能依赖 Webview CORS。扩展侧负责下载图片、校验实际文件类型，并通过 `cacheRemoteImageFile()` 写入 `globalStorageUri/topic-share-images`。缓存文件保留七天，单张图片失败不能中断其他图片或整张分享图。

话题面板只将分享图缓存目录加入 `localResourceRoots`。扩展侧使用 `webview.asWebviewUri()` 将缓存文件转换为 Webview 资源 URI，RPC 默认只返回原始地址到资源 URI 的映射，避免传输和长期保存大体积 base64 字符串。不要为了分享图放宽整个全局存储目录的访问范围。

预览阶段使用资源 URI。生成前，Webview 临时读取卡片中的资源 URI 并转换为 data URL，移除 `img[srcset]` 与 `picture source[srcset]`，并确保截图 DOM 中不保留 HTTP(S) 图片地址，避免截图引擎从 Webview Origin 重新请求第三方图片。若 React 尚未提交资源 URI，或预下载失败导致 DOM 中仍是原始 HTTP(S) 地址，Webview 不得尝试读取该地址，应直接通过同一 RPC 请求 `dataUrl` 格式。扩展侧从已有缓存文件生成内容，缓存不存在时允许重新下载；单张图片仍然失败则使用透明占位图。截图结束后恢复资源 URI 和响应式图片属性，data URL 不进入 React 长期状态。

## PNG 生成与保存

Webview 使用 SnapDOM 生成 PNG Blob。截图引擎按需加载，普通话题浏览不加载相关代码。输出优先使用 2 倍 DPR，仅在光栅高度将超过 30000px 时才根据卡片高度动态降低，兼顾长回复列表的文字清晰度与 Chromium Canvas 单边尺寸限制；字体不重复嵌入。传给截图引擎的图片已经内联，关闭其二次图片压缩，避免部分格式在克隆阶段解码失败。

复制图片直接使用 Clipboard API。保存图片时 Webview 将最终 PNG Blob 转为 base64，通过 RPC 交给扩展侧；扩展侧校验 PNG 签名后使用 `workspace.fs` 写入用户选择的 URI。
