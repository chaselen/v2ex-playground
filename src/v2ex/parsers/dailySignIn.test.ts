import { load } from 'cheerio/slim'
import { describe, expect, test } from 'vitest'
import { parseDailySignInPage } from './dailySignIn'

describe('daily sign-in page parser', () => {
  test('已领取标记优先于页面中残留的领取按钮', () => {
    expect(
      parseDailySignInPage(
        load(`
      <span class="gray"><li class="fa fa-ok-sign"></li>每日登录奖励已领取</span>
      <input value="领取 10 铜币" onclick="location.href = '/mission/daily/redeem?once=123'">
    `)
      )
    ).toEqual({ signedIn: true })
  })

  test('从领取按钮提取当前 once', () => {
    expect(
      parseDailySignInPage(
        load(`
      <input value="领取 10 铜币" onclick="location.href = '/mission/daily/redeem?once=123'">
    `)
      )
    ).toEqual({ signedIn: false, once: '123' })
  })

  test.each([
    '<h1>登录</h1>',
    '<input value="领取 10 铜币">',
    '<input value="领取 10 铜币" onclick="location.href = \'/mission/daily/redeem?once=invalid\'">',
    '<input value="其他操作" onclick="location.href = \'/mission/daily/redeem?once=123\'">'
  ])('缺少已领取标记和有效领取入口时不产生令牌：%s', html => {
    expect(parseDailySignInPage(load(html))).toEqual({ signedIn: false, once: undefined })
  })
})
