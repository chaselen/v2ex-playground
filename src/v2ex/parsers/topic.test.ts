import * as cheerio from 'cheerio/slim'
import { describe, expect, it, test } from 'vitest'
import {
  parseReplies,
  parseTopicListCells,
  parseTagTopicList,
  parseTopicMeta,
  parseTopicInfo,
  parseTopicEditContent,
  parseTopicManagement
} from './topic'
import { readFileSync } from 'node:fs'

describe('topic outdated notice parsing', () => {
  it('从主题容器读取旧帖提醒，与正文和附言分离', () => {
    const notice = '这是一个创建于 2234 天前的主题，其中的信息可能已经有所发展或是发生改变。'
    const $ = cheerio.load(`
      <div id="Main">
        <div class="box">
          <div class="header"><h1>旧主题</h1></div>
          <div class="outdated"> ${notice} </div>
          <div class="cell"><div class="topic_content">Topic body</div></div>
          <div class="subtle">
            <span class="fade">第 1 条附言 · 2020 年 9 月 3 日</span>
            <div class="topic_content">Supplement</div>
          </div>
        </div>
      </div>
    `)

    expect(parseTopicMeta($, 703733, 'https://www.v2ex.com')).toMatchObject({
      outdatedNotice: notice,
      content: 'Topic body',
      appends: [{ content: 'Supplement' }]
    })
  })

  it.each(['', '<div class="outdated"> </div>'])(
    '源站未提供有效提醒时不从正文或其他区域提取',
    noticeHtml => {
      const $ = cheerio.load(`
        <div class="outdated">侧栏提示</div>
        <div id="Main">
          <div class="box">
            ${noticeHtml}
            <div class="cell"><div class="topic_content"><div class="outdated">正文引用</div></div></div>
          </div>
          <div class="box"><div class="outdated">回复引用</div></div>
        </div>
      `)

      expect(parseTopicMeta($, 1, 'https://www.v2ex.com').outdatedNotice).toBeUndefined()
    }
  )
})

describe('topic icon parsing', () => {
  test('prefers the node navatar when the site icon is also present', () => {
    const $ = cheerio.load(`
      <head>
        <link rel="icon" href="/static/icon-192.png">
        <link rel="shortcut icon" href="//cdn.v2ex.com/navatar/94f6/d7e0/300_xxlarge.png">
      </head>
      <div class="header"><h1>话题</h1><div class="gray"><span title="2026-07-15 08:58:03 +08:00">刚刚</span></div></div>
    `)

    expect(parseTopicMeta($, 1, 'https://www.v2ex.com').topicIcon).toBe(
      'https://cdn.v2ex.com/navatar/94f6/d7e0/300_xxlarge.png'
    )
  })

  test('keeps the site icon when node favicon is disabled', () => {
    const $ = cheerio.load(`
      <head><link rel="icon" href="/static/icon-192.png"></head>
      <div class="header"><h1>话题</h1><div class="gray"><span title="2026-07-15 08:58:03 +08:00">刚刚</span></div></div>
    `)

    expect(parseTopicMeta($, 1, 'https://www.v2ex.com').topicIcon).toBe(
      'https://www.v2ex.com/static/icon-192.png'
    )
  })
})

describe('topic time parsing', () => {
  it('格式化发帖时间', () => {
    const $ = cheerio.load(`
      <div id="Main">
        <div class="box">
          <div class="header">
            <h1>测试话题</h1>
            <a href="/go/test">测试节点</a>
            <div class="gray">
              <a href="/member/tester">tester</a>
              · <span title="2026-07-15 08:58:03 +08:00">1 小时前</span>
              · 10 次点击
            </div>
          </div>
        </div>
        <div class="box"><div class="cell"><span class="gray">0 条回复</span></div></div>
      </div>
    `)

    expect(parseTopicMeta($, 1, 'https://www.v2ex.com')).toMatchObject({
      displayTime: '1 小时前',
      publishedAt: '2026-07-15 08:58:03'
    })
  })

  it('格式化回复时间', () => {
    const $ = cheerio.load(`
      <div id="Main">
        <div class="box"></div>
        <div class="box">
          <div class="cell"><span class="gray">1 条回复</span></div>
          <div id="r_123" class="cell">
            <a class="dark">replier</a>
            <span class="ago" title="2026-07-15 09:10:11 +08:00">10 分钟前</span>
            <span class="no">1</span>
            <div class="reply_content">回复内容</div>
          </div>
        </div>
      </div>
    `)

    expect(parseReplies($)[0]).toMatchObject({
      time: '10 分钟前',
      repliedAt: '2026-07-15 09:10:11',
      isMod: false,
      isOp: false,
      isPro: false
    })
  })

  it('解析回复用户 MOD / OP / PRO 标签', () => {
    const $ = cheerio.load(`
      <div id="Main">
        <div class="box"></div>
        <div class="box">
          <div class="cell"><span class="gray">3 条回复</span></div>
          <div id="r_1" class="cell">
            <strong><a href="/member/itechify" class="dark">itechify</a></strong>
            <div class="badges"><div class="badge pro">PRO</div></div>
            <span class="ago" title="2026-07-19 02:45:39 +08:00">2 天前</span>
            <span class="no">1</span>
            <div class="reply_content">仅 PRO</div>
          </div>
          <div id="r_2" class="cell">
            <strong><a href="/member/Livid" class="dark">Livid</a></strong>
            <div class="badges">
              <div class="badge mod">MOD</div>
              <div class="badge op">OP</div>
              <div class="badge pro">PRO</div>
            </div>
            <span class="ago" title="2026-07-19 10:07:40 +08:00">2 天前</span>
            <span class="no">3</span>
            <div class="reply_content">MOD OP PRO</div>
          </div>
          <div id="r_3" class="cell">
            <strong><a href="/member/nobody" class="dark">nobody</a></strong>
            <div class="badges"></div>
            <span class="ago" title="2026-07-19 11:00:00 +08:00">2 天前</span>
            <span class="no">4</span>
            <div class="reply_content">无标签</div>
          </div>
        </div>
      </div>
    `)

    const replies = parseReplies($)
    expect(replies).toHaveLength(3)
    expect(replies[0]).toMatchObject({
      userName: 'itechify',
      isMod: false,
      isOp: false,
      isPro: true
    })
    expect(replies[1]).toMatchObject({
      userName: 'Livid',
      isMod: true,
      isOp: true,
      isPro: true
    })
    expect(replies[2]).toMatchObject({
      userName: 'nobody',
      isMod: false,
      isOp: false,
      isPro: false
    })
  })
})

describe('topic tag parsing', () => {
  it('解析帖子详情标签', () => {
    const $ = cheerio.load(`
      <div id="Main">
        <div class="box">
          <div class="header">
            <h1>测试话题</h1>
            <a href="/go/test">测试节点</a>
            <div class="gray">
              <a href="/member/tester">tester</a>
              · <span title="2026-07-15 08:58:03 +08:00">1 小时前</span>
              · 10 次点击
            </div>
          </div>
        </div>
        <div class="box">
          <div class="cell">
            <a href="/tag/TypeScript" class="tag">TypeScript</a>
            <a href="/tag/VS%20Code" class="tag">VS Code</a>
          </div>
        </div>
      </div>
    `)

    expect(parseTopicMeta($, 1, 'https://www.v2ex.com').tags).toEqual(['TypeScript', 'VS Code'])
  })

  it('解析标签主题列表', () => {
    const $ = cheerio.load(`
      <div id="Main">
        <div class="box">
          <div class="header">测试标签</div>
          <div class="cell item">
            <a href="/member/author"><img class="avatar" src="https://cdn.v2ex.com/avatar/author.png" alt="author" /></a>
            <a class="topic-link" href="/t/123#reply2">测试主题</a>
            <a class="node" href="/go/programmer">程序员</a>
            <span class="topic_info">
              <strong><a href="/member/author">author</a></strong>
              <span title="2026-07-15 08:58:03 +08:00">1 小时前</span>
              最后回复来自 <strong><a href="/member/replier">replier</a></strong>
            </span>
            <a class="count_livid">2</a>
          </div>
        </div>
      </div>
    `)

    expect(parseTagTopicList($, '测试标签')).toEqual({
      tag: '测试标签',
      totalCount: 1,
      list: [
        {
          id: 123,
          title: '测试主题',
          node: { name: 'programmer', title: '程序员' },
          authorName: 'author',
          authorAvatar: 'https://cdn.v2ex.com/avatar/author.png',
          replies: 2,
          displayTime: '1 小时前',
          publishedAt: '2026-07-15 08:58:03',
          lastReplyUser: 'replier'
        }
      ]
    })
  })
})

describe('topic ignore state parsing', () => {
  it.each([
    ['忽略主题', false, true],
    ['取消忽略', true, true],
    ['', false, false]
  ])('parses %s as isIgnored=%s', (action, isIgnored, canIgnore) => {
    const $ = cheerio.load(`
      <div id="Main">
        <div class="box">
          <div class="header">
            <h1>测试话题</h1>
            <a href="/go/test">测试节点</a>
            <div class="gray">
              <a href="/member/tester">tester</a>
              · <span title="2026-07-15 08:58:03 +08:00">1 小时前</span>
              · 10 次点击
            </div>
          </div>
          <div class="topic_buttons">
            <div class="topic_stats">10 次点击</div>
            <a class="tb" href="/favorite/topic/1?once=token">加入收藏</a>
            <a class="tb" href="#;">${action}</a>
            <div id="topic_thank"><a class="tb" href="#;">感谢</a></div>
          </div>
        </div>
        <div class="box"><div class="cell"><span class="gray">0 条回复</span></div></div>
      </div>
    `)

    expect(parseTopicMeta($, 1, 'https://www.v2ex.com').isIgnored).toBe(isIgnored)
    expect(parseTopicMeta($, 1, 'https://www.v2ex.com').canIgnore).toBe(canIgnore)
  })
})

describe('parseTopicInfo', () => {
  it('保留源站信息顺序、实体和完整时间', () => {
    const html = `<div id="Main"><div class="topic_content"><table>
      <tr><td>ID</td><td>703733</td></tr>
      <tr><td>创建者</td><td><a href="/member/chaselen">chaselen</a></td></tr>
      <tr><td>创建时间</td><td>2020-09-03 08:36:53 +08:00 · 2020 年 9 月 3 日</td></tr>
      <tr><td>查看人数</td><td>2772</td></tr>
      <tr><td>是否处于置顶状态</td><td>否</td></tr>
    </table></div></div>`
    expect(parseTopicInfo(html, 703733).fields).toEqual([
      { label: 'ID', value: '703733' },
      { label: '创建者', value: 'chaselen' },
      { label: '创建时间', value: '2020-09-03 08:36:53 +08:00 · 2020 年 9 月 3 日' },
      { label: '查看人数', value: '2772' },
      { label: '是否处于置顶状态', value: '否' }
    ])
  })

  it.each([
    '<div id="Main">请先登录</div>',
    '<div id="Main"><div class="topic_content">主题正文</div></div>',
    '<div id="Main"><div class="topic_content"><table><tr><td>ID</td><td>1</td></tr></table></div></div>'
  ])('拒绝登录页、详情页和其他主题信息', html => {
    expect(() => parseTopicInfo(html, 703733)).toThrow('访问权限')
  })
})

const realEditFixture = JSON.parse(
  readFileSync(new URL('./fixtures/topicContent.json', import.meta.url), 'utf8')
)

// 中文编辑页的实际字段；原始正文可能包含被 HTML 转义的 Markdown 或 HTML
const editForm = `<form method="post" action="/edit/topic/12" id="topic_form">
  <textarea name="title" id="topic_title">标题 &amp; 示例</textarea>
  <textarea name="content" id="topic_content">**正文**\n&lt;b&gt;原文&lt;/b&gt;</textarea>
  <select name="syntax"><option value="0">Default</option><option value="1" selected>Markdown</option></select>
</form>`

describe('topic edit content', () => {
  // 期望值已与真实编辑页浏览器 textarea.value 核对，不由被测解析器生成
  test.each(['markdown', 'default'] as const)(
    'restores browser editor values from the captured %s form',
    syntax => {
      expect(parseTopicEditContent(realEditFixture.forms[syntax], realEditFixture.topicId)).toEqual(
        { ...realEditFixture.expected, syntax }
      )
    }
  )

  test('reads raw title, content and syntax without requiring once', () => {
    expect(parseTopicEditContent(editForm, 12)).toEqual({
      title: '标题 & 示例',
      content: '**正文**\n<b>原文</b>',
      syntax: 'markdown'
    })
    expect(
      parseTopicEditContent(
        editForm
          .replace('value="0"', 'value="0" selected')
          .replace('value="1" selected', 'value="1"'),
        12
      ).syntax
    ).toBe('default')
  })

  test.each([
    { name: 'empty text', raw: '', expected: '' },
    { name: 'surrounding whitespace', raw: '  正文\n\n', expected: '  正文\n\n' },
    { name: 'escaped HTML', raw: '&lt;b&gt;原文&lt;/b&gt;', expected: '<b>原文</b>' },
    { name: 'literal HTML', raw: '<b>原文</b>', expected: '<b>原文</b>' },
    {
      name: 'literal comments and scripts',
      raw: '<!--注释--><script>alert(1)</script>',
      expected: '<!--注释--><script>alert(1)</script>'
    },
    { name: 'comparison operators', raw: 'a < b && c > d', expected: 'a < b && c > d' },
    {
      name: 'named and numeric entities',
      raw: '&amp; &quot; &apos; &copy; &nbsp; &#65; &#x1F600;',
      expected: '& " \' © \u00A0 A 😀'
    },
    {
      name: 'legacy and unknown entities',
      raw: '&copy abc &unknown;',
      expected: '© abc &unknown;'
    },
    { name: 'one decoding pass', raw: '&amp;lt;b&amp;gt; &amp;#10;', expected: '&lt;b&gt; &#10;' },
    { name: 'escaped closing tag', raw: '&lt;/textarea&gt;后文', expected: '</textarea>后文' },
    {
      name: 'line ending normalization',
      raw: '首行\r\n第二行\r第三行',
      expected: '首行\n第二行\n第三行'
    },
    { name: 'initial newline', raw: '\n\n正文', expected: '\n正文' },
    { name: 'initial CRLF', raw: '\r\n正文', expected: '正文' },
    { name: 'initial encoded LF', raw: '&#10;正文', expected: '正文' },
    { name: 'encoded CR', raw: '&#13;正文', expected: '\r正文' },
    { name: 'literal null', raw: 'a\0b', expected: 'a\uFFFDb' },
    { name: 'invalid numeric entities', raw: '&#0; &#x80;', expected: '\uFFFD €' }
  ])('restores textarea semantics for $name', ({ raw, expected }) => {
    const html = `<form method="post" action="/edit/topic/12">
      <textarea name="title">${raw}</textarea>
      <textarea name="content">${raw}</textarea>
      <select name="syntax"><option value="1" selected>Markdown</option></select>
    </form>`

    expect(parseTopicEditContent(html, 12)).toEqual({
      title: expected,
      content: expected,
      syntax: 'markdown'
    })
  })

  test('rejects expired permissions, mismatched topics and incomplete content', () => {
    expect(() =>
      parseTopicEditContent(
        '<div id="Main"><div class="inner">你不能编辑这个主题。</div></div>',
        12
      )
    ).toThrow('你不能编辑这个主题')
    expect(() => parseTopicEditContent(editForm, 13)).toThrow('无法读取主题原文')
    expect(() =>
      parseTopicEditContent(editForm.replace('name="content"', 'name="other"'), 12)
    ).toThrow('无法读取主题原文')
    expect(() =>
      parseTopicEditContent(editForm.replace('value="1" selected', 'value="unknown" selected'), 12)
    ).toThrow('无法读取主题原文')
  })

  test('exposes only exact server management links for the current topic', () => {
    const $ = cheerio.load(
      `<div class="header"><small class="gray"><a href="/append/topic/12">APPEND</a><a href="/edit/topic/123">编辑</a><a href="https://evil.test/move/topic/12">移动</a></small></div><div class="topic_content"><a href="/edit/topic/12">伪造编辑入口</a></div>`
    )
    expect(parseTopicMeta($, 12, 'https://www.v2ex.com').contentActions).toEqual(['append'])
    expect(parseTopicMeta(cheerio.load(''), 12, 'https://www.v2ex.com').contentActions).toEqual([])
  })
})

describe('server placement links', () => {
  function page(script: string, wrapper = true, label = '放到首页 ↑') {
    const link = `<a onclick="${script.replaceAll('"', '&quot;')}">${label}</a>`
    return cheerio.load(
      wrapper
        ? `<div id="Main"><div class="box"><div class="inner"><div class="fr">${link}</div></div></div></div>`
        : `<div class="topic_content">${link}</div>`
    )
  }
  const script =
    "if (confirm('你确认要消耗 700 铜币将此主题放到首页？')) { location.href = '/t/12/boost?once=123'; }"

  test('exposes only the operation path and confirmation from the management bar', () => {
    expect(parseTopicManagement(page(script), 12)).toEqual({
      boost: {
        path: '/t/12/boost',
        confirmation: '你确认要消耗 700 铜币将此主题放到首页？'
      }
    })
    expect(parseTopicMeta(page(script), 12, 'https://www.v2ex.com').managementActions).toEqual([
      'boost'
    ])
    expect(parseTopicManagement(page(script, false), 12)).toEqual({})
    expect(parseTopicManagement(page(script), 123)).toEqual({})
    expect(parseTopicManagement(page(script, true, '报告这个主题'), 12)).toEqual({})
    expect(parseTopicManagement(page(script, true, '下沉 ↓'), 12)).toEqual({})
  })

  test.each(['', '?once=', '?once=expired', '?once=123&extra=1', '?other=value#section'])(
    'ignores the page query when identifying the operation path: %s',
    query => {
      const $ = page(script.replace('?once=123', query))
      expect(parseTopicManagement($, 12).boost).toEqual({
        path: '/t/12/boost',
        confirmation: '你确认要消耗 700 铜币将此主题放到首页？'
      })
    }
  )

  test.each([
    script.replace('/t/12/boost', 'https://evil.test/t/12/boost'),
    script.replace('/t/12/boost', '/report/topic/12'),
    script.replace('700 铜币', '一些铜币')
  ])('rejects invalid paths or missing confirmation', value => {
    expect(parseTopicManagement(page(value), 12)).toEqual({})
  })
})

// 按钮文字与路径共同识别入口，不依赖脚本语句格式
describe('placement script formatting', () => {
  test.each([
    `if(confirm("你确认要消耗 700 铜币将此主题放到首页？")){location.href="/t/12/boost?once=123"}`,
    `confirm ('你确认要消耗 700 铜币将此主题放到首页？') && window.location.assign('/t/12/boost?once=123');`,
    `if (window.confirm(\n  '你确认要消耗 700 铜币将此主题放到首页？'\n)) {\n window.location.href = '/t/12/boost?once=123'\n}`,
    `showConfirmation('你确认要消耗 700 铜币将此主题放到首页？', '/t/12/boost?once=123');`,
    `const target = '/t/12/boost?once=123'; if (confirm('你确认要消耗 700 铜币将此主题放到首页？')) location.replace(target);`
  ])('identifies the labeled boost link regardless of the surrounding code', script => {
    const $ = cheerio.load(
      `<div id="Main"><div class="box"><div class="inner"><div class="fr"><a onclick="${script.replaceAll('"', '&quot;')}">放到首页</a></div></div></div></div>`
    )
    expect(parseTopicManagement($, 12)).toEqual({
      boost: {
        path: '/t/12/boost',
        confirmation: '你确认要消耗 700 铜币将此主题放到首页？'
      }
    })
  })

  test('identifies fade by its exact path', () => {
    const $ = cheerio.load(
      `<div id="Main"><div class="box"><div class="inner"><div class="fr"><a onclick="confirm('你确认要将此主题下沉 10 天？') &amp;&amp; location.assign('/fade/topic/12?once=456')">下沉</a></div></div></div></div>`
    )
    expect(parseTopicManagement($, 12)).toEqual({
      fade: { path: '/fade/topic/12', confirmation: '你确认要将此主题下沉 10 天？' }
    })
  })
})

test('keeps content capabilities separate from display management capabilities', () => {
  const $ =
    cheerio.load(`<div class="header"><small class="gray"><a href="/append/topic/12">APPEND</a></small></div>
    <div id="Main"><div class="box"><div class="inner"><div class="fr">
      <a onclick="confirm('你确认要将此主题下沉 10 天？') &amp;&amp; location.assign('/fade/topic/12')">下沉</a>
    </div></div></div></div>`)
  const topic = parseTopicMeta($, 12, 'https://www.v2ex.com')
  expect(topic.contentActions).toEqual(['append'])
  expect(topic.managementActions).toEqual(['fade'])
})

describe('topic list author avatars', () => {
  it.each([
    ['alt="author"', 'author'],
    ['', 'fallbackAuthor']
  ])('从头像提取作者名，缺少 alt 时回退到文字链接：%s', (alt, authorName) => {
    const $ = cheerio.load(`
      <div class="cell">
        <a href="/member/author"><img class="avatar" src="author.png" ${alt} /></a>
        <a class="topic-link" href="/t/123">测试主题</a>
        <span class="topic_info">
          <strong><a href="/member/author">fallbackAuthor</a></strong>
          最后回复来自 <strong><a href="/member/replier">replier</a></strong>
        </span>
      </div>
    `)
    expect(parseTopicListCells($, $('.cell'))[0]).toMatchObject({
      authorName,
      authorAvatar: 'author.png',
      lastReplyUser: 'replier'
    })
  })

  it('不把节点图片当作作者头像，兼容不含头像的列表', () => {
    const $ = cheerio.load(`
      <div class="cell">
        <a class="topic-link" href="/t/123">无作者头像</a>
        <a class="node" href="/go/test"><img class="avatar" src="node.png" /></a>
        <span class="topic_info"><strong><a href="/member/author">author</a></strong></span>
      </div>
    `)
    expect(parseTopicListCells($, $('.cell'))[0]).toMatchObject({
      authorName: 'author',
      authorAvatar: undefined
    })
  })
})
