import * as cheerio from 'cheerio/slim'
import { describe, expect, it } from 'vitest'
import { parseReplies, parseTopicMeta } from './topic'

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
