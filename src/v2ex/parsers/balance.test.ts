import * as cheerio from 'cheerio/slim'
import { describe, expect, test } from 'vitest'
import { parseBalance } from './balance'

describe('balance parsers', () => {
  test('parses balance summary, pagination, amounts and description HTML', () => {
    const html = `
      <div id="Main">
        <div class="balance_area">11 <img alt="G"> 21 <img alt="S"> 61 <img alt="B"></div>
        <div class="ps_container">
          <a class="page_current">2</a>
          <input class="page_input" max="313">
        </div>
        <table class="data">
          <tr><td class="h">时间</td></tr>
          <tr>
            <td class="d"><small>2026-06-10 10:43:11 +08:00</small></td>
            <td class="d">创建回复</td>
            <td class="d"><span class="negative"><strong>-5.0</strong></span></td>
            <td class="d">112142.1</td>
            <td class="d"><span>回复 › <a href="/t/1219202">话题</a></span></td>
          </tr>
          <tr>
            <td class="d">2026-06-10 08:44:56 +08:00</td>
            <td class="d">每日登录奖励</td>
            <td class="d"><span class="positive"><strong>9.0</strong></span></td>
            <td class="d">112147.1</td>
            <td class="d">奖励</td>
          </tr>
        </table>
      </div>
    `
    const detail = parseBalance(cheerio.load(html), 2)

    expect(detail).toMatchObject({
      gold: 11,
      silver: 21,
      bronze: 61,
      page: 2,
      totalPage: 313
    })
    expect(detail.transactions).toHaveLength(2)
    expect(detail.transactions[0]).toMatchObject({
      amount: '-5.0',
      direction: 'negative',
      balance: '112142.1'
    })
    expect(detail.transactions[0].descriptionHtml).toContain('href="/t/1219202"')
    expect(detail.transactions[1]).toMatchObject({
      amount: '9.0',
      direction: 'positive'
    })
  })
})
