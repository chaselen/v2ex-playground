import { load } from 'cheerio/slim'
import { describe, expect, test } from 'vitest'
import { parseNotifications } from './notification'
import { readFileSync } from 'node:fs'

describe('notification parser', () => {
  test('保留摘要与附带 HTML，提取主题编号和分页', () => {
    const result = parseNotifications(
      load(`
      <div id="Main"><div class="box"><div class="header"><span class="fr"><strong class="gray">21</strong></span></div>
      <div class="ps_container"><input class="page_input" max="3"></div>
      <div id="notifications">
        <div class="cell" id="n_42">
          <a href="/member/alice"><img class="avatar" src="/alice.png" alt="alice">alice</a>
          <span class="gray">回复了 <a class="topic-link" href="/t/123#reply2">主题</a></span>
          <span class="snow">刚刚</span><div class="payload"><p>回复内容</p></div>
        </div>
        <div class="cell" id="n_invalid"></div>
      </div></div></div>
    `)
    )
    expect(result).toMatchObject({ totalPage: 3, totalCount: 21 })
    expect(result.list).toHaveLength(1)
    expect(result.list[0]).toEqual({
      id: 42,
      avatar: '/alice.png',
      username: 'alice',
      memberPath: '/member/alice',
      summaryHtml: expect.stringContaining('<a class="topic-link" href="/t/123#reply2">'),
      topicId: 123,
      topicTitle: '主题',
      topicPath: '/t/123#reply2',
      time: '刚刚',
      payloadHtml: expect.stringMatching(/^<p>.*<\/p>$/)
    })
    expect(load(result.list[0].summaryHtml).text()).toBe('回复了 主题')
    expect(load(result.list[0].payloadHtml).text()).toBe('回复内容')
  })

  test('无主题链接的通知保留摘要并回退到头像用户名', () => {
    const result = parseNotifications(
      load(`
      <div id="notifications"><div class="cell" id="n_1">
        <img class="avatar" alt="bob"><span class="gray">系统消息</span>
      </div></div>
    `)
    )
    expect(result.list[0]).toMatchObject({
      username: 'bob',
      summaryHtml: expect.any(String),
      topicId: undefined,
      topicPath: undefined
    })
    expect(load(result.list[0].summaryHtml).text()).toBe('系统消息')
  })

  test('空列表使用默认分页和计数', () => {
    expect(parseNotifications(load('<div id="notifications"></div>'))).toEqual({
      totalPage: 1,
      totalCount: 0,
      list: []
    })
  })
})

test('parses anonymized live gray summaries and isolates payload lookalikes', () => {
  const html = readFileSync(new URL('./fixtures/notifications.html', import.meta.url), 'utf8')
  const $ = load(html)
  const original = parseNotifications($)
  expect(original.totalCount).toBe(1234)
  expect(original.list).toHaveLength(2)
  expect(original.list[0]).toMatchObject({
    id: 1,
    username: 'sample',
    avatar: '/sample.png',
    topicId: 123,
    topicTitle: 'Sample topic',
    time: 'Sample time'
  })
  expect(load(original.list[0].summaryHtml).text()).toContain('Sample topic')
  $('#notifications .cell').wrap('<section></section>')
  $('#notifications').append(
    '<div class="cell" id="n_1.5"></div><div class="cell" id="n_1e2"></div>'
  )
  $('.payload')
    .prepend(`<div class="cell" id="n_999"><a href="/member/fake">fake</a><span class="snow">fake time</span></div>
    <div class="ps_container"><input class="page_input" max="9999"></div>
    <div class="header"><div class="fr"><strong class="gray">9999</strong></div></div>`)
  $('body').prepend(
    '<aside class="header"><div class="fr"><strong class="gray">9999</strong></div></aside>'
  )
  const changed = parseNotifications($)
  expect(changed.totalCount).toBe(original.totalCount)
  expect(changed.totalPage).toBe(original.totalPage)
  expect(changed.list.map(({ payloadHtml, ...item }) => item)).toEqual(
    original.list.map(({ payloadHtml, ...item }) => item)
  )
})
