import * as cheerio from 'cheerio/slim'
import { describe, expect, it } from 'vitest'
import { parseReplies, parseTagTopicList, parseTopicMeta } from './topic'

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
      repliedAt: '2026-07-15 09:10:11'
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
          lastReplyUser: 'replier'
        }
      ]
    })
  })
})
