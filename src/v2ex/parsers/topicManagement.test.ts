import { describe, expect, test } from 'vitest'
import { parseTopicEditContent } from './topicManagement'
import { parseTopicMeta } from './topic'
import { load } from 'cheerio/slim'

// 中文编辑页的实际字段；原始正文可能包含被 HTML 转义的 Markdown 或 HTML
const editForm = `<form method="post" action="/edit/topic/12" id="topic_form">
  <textarea name="title" id="topic_title">标题 &amp; 示例</textarea>
  <textarea name="content" id="topic_content">**正文**\n&lt;b&gt;原文&lt;/b&gt;</textarea>
  <select name="syntax"><option value="0">Default</option><option value="1" selected>Markdown</option></select>
</form>`

describe('topic edit content', () => {
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
