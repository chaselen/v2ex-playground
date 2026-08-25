# V2EX 内容预览 HTML 契约

本文记录 `POST /preview/default` 与 `POST /preview/markdown` 的真实输出特征，供话题正文、回复和回复预览的渲染实现参考。最后核对日期为 2026-07-23，请求使用登录 Cookie 及 `Accept-Language: zh-CN,zh;q=0.9`。

预览接口只返回 HTML 片段，不返回 JSON，也不提供统一的根元素。探测仅调用预览接口，不会发布内容。

## 原生格式

代表性输入：

```text
第一行 <标签> & "引号"
第二行  两个空格

@alice #12 https://www.v2ex.com/t/1

**粗体** *斜体* ~~删除线~~ `inline <code>`
```

输出结构：

```html
第一行 &lt;标签&gt; &amp; "引号"<br />第二行 两个空格<br /><br />@<a
  target="_blank"
  href="/member/alice"
  rel="nofollow noopener"
  >alice</a
>
#12
<a target="_blank" href="https://www.v2ex.com/t/1">https://www.v2ex.com/t/1</a><br /><br />**粗体**
*斜体* ~~删除线~~ `inline &lt;code&gt;`
```

视频链接输入：

```text
https://youtu.be/YhxnffqiegU
```

输出结构：

```html
<div class="embedded_video_wrapper">
  <iframe
    src="https://www.youtube.com/embed/YhxnffqiegU"
    class="embedded_video"
    allowfullscreen=""
    type="text/html"
    id="ytplayer"
    frameborder="0"
  ></iframe>
</div>
```

关键规则：

- HTML 特殊字符会被转义，换行转换为 `<br />`，空行转换为连续两个 `<br />`
- `@用户名` 转换为 `/member/{username}` 链接，普通 URL 自动转换为链接
- `#楼层` 只保留文本，不会单独生成锚点
- Markdown 标记不解析，原样显示
- 直接图片 URL 可能生成 `a > img.embedded_image`，因此原生输出也需要图片增强与隐藏图片处理
- YouTube 和 Vimeo 链接会自动展开为嵌入视频；YouTube 输出使用 `.embedded_video_wrapper > iframe.embedded_video` 结构

视频自动展开能力也记录在 V2EX 官方的 [Markdown 语法帮助](https://www.v2ex.com/help/markdown) 中，属于“V2EX 原生格式”的链接展开规则。

回复提交使用原生格式；`TopicPanelController` 通过 `previewContent` 以 `reply` 目标固定请求 `default`。新主题正文使用同一方法的 `topic` 目标，并额外提交 `topic_content=1`。在确认提交接口支持 Markdown 之前，不要增加回复预览格式切换。

## Markdown 格式

Markdown 输入会生成无外层容器的语义 HTML：

| 输入特征         | 输出结构                                      |
| ---------------- | --------------------------------------------- |
| 标题             | `h1` 至 `h6`                                  |
| 段落             | `p`                                           |
| 粗体、斜体、删除 | `strong`、`em`、`del`                         |
| 引用             | `blockquote > p`                              |
| 列表             | `ul`、`ol`、`li`，支持嵌套                    |
| 围栏代码块       | `pre > code.language-{language}`              |
| 图片             | `img.embedded_image`                          |
| 表格             | `table > thead/tbody > tr > th/td`            |
| 链接             | `a[rel="nofollow"]`，站内相对链接保持相对地址 |

例如：

```html
<pre><code class="language-ts">const value = '&lt;tag&gt;'
</code></pre>
<p>
  <a href="/t/1" rel="nofollow">站内链接</a>
  <img
    alt="图片"
    class="embedded_image"
    loading="lazy"
    referrerpolicy="no-referrer"
    rel="noreferrer"
    src="https://i.imgur.com/example.png"
  />
</p>
<table>
  <thead>
    <tr>
      <th>A</th>
      <th>B</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>2</td>
    </tr>
  </tbody>
</table>
```

Markdown 段落中的单个普通换行保留为源码换行，浏览器按空白折叠规则显示为空格；不能给内容容器添加 `white-space: pre-wrap`，否则会改变服务端预期排版。

## 服务端过滤

真实探测结果表明 Markdown 渲染器会过滤危险属性和协议：

- `<img src="x" onerror="alert(1)">` 保留为图片，但移除 `onerror`
- `<a href="javascript:alert(1)" onclick="alert(2)">危险链接</a>` 输出为 `<a>危险链接</a>`
- `script`、`iframe`、`details` 等不允许的原始标签会被转义
- `b` 等允许的简单格式标签可能原样保留

当前 Webview 将 V2EX 返回的片段交给 `EnhancedHtmlContent` 渲染，再统一绑定站内导航、图片预览、隐藏图片和代码高亮。客户端不应重新解析 Markdown，也不应通过字符串替换改变服务端 HTML 结构。

## 样式与回归重点

- `.topic-content` 必须同时支持无根的原生片段和 Markdown 块级节点
- 首尾块级元素不保留多余外边距，嵌套列表避免继承顶层列表的底部间距
- `pre > code.language-*` 保留空白和横向滚动，并由内容增强逻辑渐进加载语法高亮
- Markdown 表格需支持窄面板横向滚动，并区分表头与斑马纹行
- `strong` 与服务端允许的原始 `b` 应保持一致的前景色
- 图片无论来自原生自动链接还是 Markdown，都复用同一套图片预览与显示设置；关闭正文图片显示时，原始 `img` 必须保持不可见，只保留“查看图片”占位按钮
- 原生格式自动展开的视频 iframe 由内容增强转换为单行占位，只保留来源和浏览器打开入口
- 未收录的外链图片在加载后若宽高均不超过 32px 且接近方形，按内联图片表情展示，避免普通图片的块级间距撑高单行回复
- 话题页从普通图片打开预览时，默认按上述图片表情标记过滤预览序列；直接预览图片表情时默认展示完整序列，过滤状态可在工具栏切换。过滤不基于文件名或普通缩略图尺寸，避免误排除正文图片

真实接口断言位于 `src/v2ex/tests/client.topics.live.test.ts`。接口输出可能随 V2EX 服务端升级变化，断言应验证关键结构与过滤规则，避免锁定完整 HTML 字符串。
