# V2EX 综合渲染测试帖（正文素材）

已发布样本：[https://www.v2ex.com/t/1230900](https://www.v2ex.com/t/1230900)（**需登录**访问；见 `docs/test-topics.md`）。

发帖说明（不要整段贴进正文，仅供你本地参考；下列为当时发帖约定，便于复刻或补发）：

- 创作新主题时语法选择 **Markdown**
- 节点建议：`create` / `share` / `v2ex` 等允许测试的节点
- 标题建议：`[测试] V2EX Playground 综合内容渲染样本`
- 发帖后可用附言补 1～2 条（测附言标题、时间、内容增强）
- 下列站内链接取自 `docs/test-topics.md`，用于测「预览」按钮与导航
- YouTube 裸链在 **原生格式** 下更稳定展开为 iframe；Markdown 下至少应渲染为可点链接。若需强制测视频占位，可另开原生格式短帖只贴 `https://youtu.be/YhxnffqiegU`
- 图片使用公开图床 URL；若被墙或失效，发帖前可换成 `i.v2ex.co` 上传图

---

## 下面开始是可复制正文

---

这是一篇综合内容渲染测试帖，覆盖标题、列表、表格、代码、链接、图片、长 URL 与危险文本转义等常见场景。请勿点击正文中的可疑外链。

## 1. 标题层级

# H1 一级标题

## H2 二级标题

### H3 三级标题

#### H4 四级标题

##### H5 五级标题

###### H6 六级标题

## 2. 强调与行内元素

普通段落：这里有 **粗体**、_斜体_、_**粗斜体**_、~~删除线~~，以及行内代码 `const x = 1` 和行内含尖括号的代码 `inline <code>`。

同时出现 HTML 特殊字符：`<标签>`、`&`、`"引号"`、`@用户名` 混排。

键盘说明：复制可用 `Ctrl+C` / `Cmd+C`，路径示例 `/t/1` 与 `~/project`。

## 3. 列表

### 无序与嵌套

- 一级 A
- 一级 B
  - 二级 B1
  - 二级 B2
    - 三级 B2a
    - 三级 B2b
- 一级 C：带 `行内代码` 与 [外链](https://www.example.com)

### 有序与嵌套

1. 安装依赖
2. 运行检查
   1. `npm run lint`
   2. `npm run test`
3. 打开页面做回归

### 列表中的段落与代码

- 列表项可以包含多段说明

  这是同一列表项里缩进的第二段，用于检查列表内段落间距。

- 列表内代码块：

  ```js
  console.log('code inside list item')
  ```

## 4. 引用与分隔线

> 这是一层引用，里面有 **粗体** 和 `code`。
>
> 引用的第二段。

> 外层引用
>
> > 嵌套引用第二层
> >
> > > 嵌套引用第三层

上方分隔线前内容。

---

下方分隔线后内容。

## 5. 站内链接

- 综合内容样本：https://www.v2ex.com/t/652995
- 项目介绍与图片：https://www.v2ex.com/t/703733
- Markdown 表格样本：https://www.v2ex.com/t/1146436
- 代码 Python：https://www.v2ex.com/t/684748
- 代码 JS（无回复）：https://www.v2ex.com/t/739699
- 无正文高回复：https://www.v2ex.com/t/1101218
- 无回复普通正文：https://www.v2ex.com/t/61465
- 两页回复：https://www.v2ex.com/t/1149556
- 回复树样本：https://www.v2ex.com/t/1030787
- 相对站内路径写法：[/t/703733](/t/703733)
- 成员页：[Livid](https://www.v2ex.com/member/Livid)
- 节点页：[create](https://www.v2ex.com/go/create)

@Livid 这种 @提及 在 Markdown 中可能保持文本或转链接，用于对照原生格式差异。

## 6. 外部链接与超长 URL

普通外链：

- [Markdown Guide](https://www.markdownguide.org/basic-syntax/)
- [GitHub GFM Spec](https://github.github.com/gfm/)
- [example.com](https://www.example.com)

超长 URL（检查换行与横向滚动，**不要打开**）：

https://www.example.com/very/long/path/segment/segment/segment/segment/segment/segment/segment/segment/query?token=abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789&redirect=https%3A%2F%2Fwww.example.com%2Fcallback%2Fwith%2Fmany%2Fnested%2Fparts%2Fand%2Fextra%3D1&utm_source=render_test&utm_medium=manual&utm_campaign=long_url_wrap_check

带 title 的链接：[悬停看 title](https://www.v2ex.com 'V2EX 首页')

## 7. 图片

Markdown 图片（检查预览、隐藏图片占位、窄面板排版；可切换「查看帖子时显示图片」）：

![测试图 1 宽图](https://picsum.photos/seed/md-test-1/800/240)

![测试图 2 方图](https://picsum.photos/seed/md-test-2/200/200)

![测试图 3 竖图](https://picsum.photos/seed/md-test-3/240/360)

行内小图 / 表情尺寸对照（若渲染为 img，检查是否按小图内联处理）：

![tiny](https://picsum.photos/seed/md-test-tiny/16/16)

图片链接（可点击跳转）：

[![badge-like](https://picsum.photos/seed/md-test-badge/120/40)](https://www.v2ex.com)

同一段混排文字与图片：前面文字 ![inline](https://picsum.photos/seed/md-test-inline/48/48) 后面继续文字。

## 8. 嵌入视频（链接）

YouTube 短链：

https://youtu.be/YhxnffqiegU

YouTube 完整观看页：

https://www.youtube.com/watch?v=YhxnffqiegU

## 9. 表格（至少两个）

### 表 1：对齐与基础单元格

| 左对齐        |  居中  | 右对齐 | 说明                         |
| ------------- | :----: | -----: | ---------------------------- |
| A1            |   B1   |    100 | 普通文本                     |
| A2 较长单元格 |   B2   |    200 | 含 `code`                    |
| **粗体**      | _斜体_ |    999 | [链接](https://www.v2ex.com) |

### 表 2：窄面板横向滚动压力

| Feature  | Desktop | Mobile |  API   |  Parser  | Theme Light | Theme Dark | Theme HC | Notes        |
| -------- | :-----: | :----: | :----: | :------: | :---------: | :--------: | :------: | ------------ |
| 站内预览 |   yes   |  yes   |  read  |   link   |     ok      |     ok     |    ok    | 弹层 + 骨架  |
| 代码高亮 |   n/a   |  yes   |  html  | pre/code |     ok      |     ok     |    ok    | 语法着色     |
| 图片隐藏 | setting |  yes   |  img   | enhance  |     ok      |     ok     |    ok    | 占位按钮     |
| 视频占位 |   n/a   |  yes   | iframe | enhance  |     ok      |     ok     |    ok    | 不加载播放器 |
| 表格滚动 |   n/a   |  yes   | table  |    md    |     ok      |     ok     |    ok    | 斑马纹/表头  |

## 10. 代码块矩阵

### 10.1 显式 Python

```python
# language-python：关键字 / 字符串 / 注释着色
def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print(fib(10))
```

### 10.2 显式 JavaScript（含大小写对照）

```JavaScript
// 语言名大小写：JavaScript
function sum(list) {
  return list.reduce((acc, n) => acc + n, 0)
}

const value = sum([1, 2, 3])
console.log(`sum=${value}`)
```

```js
// 短语言名 js
const nested = { a: 1, b: { c: 'text' } }
```

### 10.3 TypeScript

```ts
interface Topic {
  id: number
  title: string
}

export function pickTitle(topic: Topic): string {
  return topic.title.trim()
}
```

### 10.4 无语言 / 疑似 Shell（自动识别）

```
#!/usr/bin/env bash
set -euo pipefail
npm run lint
npm test -- tests/topics.test.ts
echo "done"
```

### 10.5 第二个无语言块（多个裸代码块）

```
export APP_TOKEN=...
curl -sS -H 'Accept-Language: zh-CN,zh;q=0.9' https://www.example.com/api/items/1
```

### 10.6 长行 JavaScript（横向滚动）

```javascript
const veryLongLine =
  'https://www.example.com/api/v1/topics?page=1&pageSize=100&sort=created_desc&include=author,node,replies&fields=id,title,content_rendered,created,last_modified,url,and_even_more_query_parameters_to_force_horizontal_scroll_in_code_block_1234567890'
function pad(n) {
  return String(n).padStart(2, '0')
}
console.log(veryLongLine, pad(7))
```

### 10.7 行内代码 vs 块级代码

段落中的行内代码不应语法高亮：`function notHighlighted() { return 1 }`，而上方块级应高亮。

### 10.8 声明为 text / plaintext / 未知语言

```text
this is language=text, should stay plain
SELECT * FROM topics; -- not sql highlight if forced text
```

```plaintext
language=plaintext keep as-is
```

```not-a-real-lang
unknown language class; client may nohighlight
const still = 'source-like'
```

### 10.9 XML / HTML / CSS / script 危险文本（只应作为代码展示）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<root>
  <item id="1">&lt;script&gt;alert(1)&lt;/script&gt;</item>
  <link href="https://www.example.com/x?a=1&amp;b=2" />
</root>
```

```html
<!DOCTYPE html>
<html>
  <body>
    <img src="x" onerror="alert(1)" alt="filtered" />
    <a href="javascript:alert(1)" onclick="alert(2)">危险链接</a>
    <script>
      document.write('should not execute')
    </script>
    <iframe src="https://example.com"></iframe>
  </body>
</html>
```

```css
.button {
  color: #3366ff;
  background: url('javascript:alert(1)');
  border: 1px solid rgba(0, 0, 0, 0.12);
}
```

```
<script>alert('bare fence without language')</script>
<img src=x onerror=alert(1)>
```

### 10.10 Diff

```diff
- const title = $('.header h1').text()
+ const title = $('.header h1').text().trim()
  return { title }
```

### 10.11 JSON / SQL / bash 补充

```json
{
  "itemId": 42,
  "features": ["preview", "highlight", "table"],
  "nested": { "ok": true }
}
```

```sql
SELECT id, title, created
FROM posts
WHERE category = 'share'
ORDER BY created DESC
LIMIT 10;
```

```bash
npm test -- tests/replies.test.ts
```
