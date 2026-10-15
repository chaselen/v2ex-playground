import { describe, expect, test } from 'vitest'
import { parseTopicEditContent } from './topicManagement'
import { parseTopicMeta } from './topic'
import { load } from 'cheerio/slim'
import { readFileSync } from 'node:fs'

const realEditFixture = JSON.parse(
  readFileSync(new URL('./fixtures/topicManagement.json', import.meta.url), 'utf8')
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
    const $ = load(
      `<div class="header"><small class="gray"><a href="/append/topic/12">APPEND</a><a href="/edit/topic/123">编辑</a><a href="https://evil.test/move/topic/12">移动</a></small></div><div class="topic_content"><a href="/edit/topic/12">伪造编辑入口</a></div>`
    )
    expect(parseTopicMeta($, 12, 'https://www.v2ex.com').managementActions).toEqual(['append'])
    expect(parseTopicMeta(load(''), 12, 'https://www.v2ex.com').managementActions).toEqual([])
  })
})
