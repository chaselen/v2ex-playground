import { describe, expect, it } from 'vitest'
import { getMemberUsernameFromHref } from './memberLink'

describe('getMemberUsernameFromHref', () => {
  const baseUrl = 'https://www.v2ex.com/t/100'

  it.each([
    ['/member/alice', 'alice'],
    ['/member/alice/', 'alice'],
    ['/member/Alice_01', 'Alice_01'],
    ['https://v2ex.com/member/bob', 'bob'],
    ['https://www.v2ex.com/member/bob/', 'bob'],
    ['https://cn.v2ex.com/member/carol', 'carol'],
    ['/member/%E7%94%A8%E6%88%B7', '用户']
  ])('从用户链接 %s 提取用户名', (href, expected) => {
    expect(getMemberUsernameFromHref(href, baseUrl)).toBe(expected)
  })

  it.each([
    '/member/alice/replies',
    '/go/python',
    '/t/123',
    'https://example.com/member/alice',
    'javascript:;',
    ''
  ])('忽略非用户主页链接 %s', href => {
    expect(getMemberUsernameFromHref(href, baseUrl)).toBe('')
  })
})
