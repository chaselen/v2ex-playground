import * as cheerio from 'cheerio/slim'
import { describe, expect, it } from 'vitest'
import { parseReplies, parseTagTopicList, parseTopicMeta, parseTopicInfo } from './topic'

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
