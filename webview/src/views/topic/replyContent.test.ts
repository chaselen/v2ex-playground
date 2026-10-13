import { describe, expect, it } from 'vitest'
import { getReplyDisplayContent } from './replyContent'

const parent = { userName: 'alice', floor: '12' }

describe('getReplyDisplayContent', () => {
  it.each([
    ['@alice #12 同意', '#12 同意'],
    ['@alice 同意', '同意'],
    ['@alice#12 同意', '#12 同意'],
    ['@alice\u00a0#12\u00a0同意', '#12\u00a0同意'],
    ['@alice&nbsp;#12&#160;同意', '#12&#160;同意'],
    ['@<a href="/member/alice" class="dark">alice</a> #12 同意', '#12 同意'],
    ["@<a href='https://www.v2ex.com/member/alice'>alice</a> 同意", '同意'],
    ['<p>@<a href="/member/alice">alice</a> #12 同意</p>', '<p>#12 同意</p>'],
    ['@alice #12<br />同意<br>第二行', '#12<br />同意<br>第二行'],
    ['@alice<br />同意<br>第二行', '同意<br>第二行'],
    ['@alice #12 同意 @bob #3 的说法', '#12 同意 @bob #3 的说法'],
    ['@alice #12 <img src="a.png">', '#12 <img src="a.png">'],
    ['@alice #12 <strong>同意</strong>', '#12 <strong>同意</strong>']
  ])('隐藏匹配的开头用户名并保留楼层及正文：%s', (content, expected) => {
    expect(getReplyDisplayContent(content, parent)).toBe(expected)
  })

  it.each([
    '@bob #12 同意',
    '@alice2 #12 同意',
    '@alice #123 同意',
    '@alice #1 同意',
    '@alice #12abc 同意',
    '正文 @alice #12 同意',
    '@alice @bob #12 同意',
    '@alice #12 @bob #3 同意',
    '@alice',
    '@alice #12',
    '<p>@alice #12 </p>',
    '@alice #12<br>',
    '<pre>@alice #12 示例代码</pre>',
    '<blockquote>@alice #12 引用内容</blockquote>',
    '@<a href="https://example.com/member/alice">alice</a> #12 同意',
    '@<a href="/member/bob">alice</a> #12 同意',
    '@<a data-href="/member/alice">alice</a> #12 同意'
  ])('保留不匹配、歧义或纯引用内容：%s', content => {
    expect(getReplyDisplayContent(content, parent)).toBe(content)
  })

  it('普通列表和根回复保持原始 HTML', () => {
    const content = '@<a href="/member/alice">alice</a> #12 同意'
    expect(getReplyDisplayContent(content)).toBe(content)
  })
})
