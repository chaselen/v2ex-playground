import { describe, expect, test } from 'vitest'
import { V2exClient } from '../client'
import { expectNode, expectTopic, expectTopicDetail } from './client.liveTestAssertions'

const client = new V2exClient(process.env.V2EX_COOKIE)

describe.sequential('V2exClient topics', () => {
  test('gets topics by tab and updates the online count', async () => {
    const topics = await client.getTopicListByTab('tech')
    const onlineCount = await client.getOnlineCount()

    expect(topics.length).toBeGreaterThan(0)
    expectTopic(topics[0])
    expect(onlineCount).toEqual(expect.any(Number))
    expect(onlineCount).toBeGreaterThan(0)
  })

  test('gets topics by node', async () => {
    const result = await client.getTopicListByNode('python')

    expect(result.totalPage).toEqual(expect.any(Number))
    expect(result.totalPage).toBeGreaterThanOrEqual(0)
    expect(result.totalCount).toEqual(expect.any(Number))
    expect(result.totalCount).toBeGreaterThan(0)
    expect(result.node).toMatchObject({
      name: 'python',
      title: 'Python',
      avatar: expect.stringMatching(/^https:\/\/cdn\.v2ex\.com\/navatar\//),
      description: expect.stringContaining('Python')
    })
    expectNode(result.node)
    expect(result.list.length).toBeGreaterThan(0)
    expectTopic(result.list[0])
    expect(result.list[0].node).toEqual(result.node)
  })

  test('gets topics by tag', async () => {
    const result = await client.getTopicListByTag('分词')

    expect(result.tag).toBe('分词')
    expect(result.totalCount).toBe(result.list.length)
    expect(result.totalCount).toBeGreaterThan(0)
    expectTopic(result.list[0])
    expect(result.list[0].authorName).toEqual(expect.any(String))
  })

  test('gets topic detail from a known public topic', async () => {
    const detail = await client.getTopicDetail(703733)

    expect(detail.id).toBe(703733)
    expect(detail.title).toBe('写了一个 VSCode 上可以逛 V2EX 的插件')
    expect(detail.node).toEqual({ name: 'create', title: '分享创造' })
    expect(detail.tags).toEqual(expect.any(Array))
    expect(detail.authorName).toBe('chaselen')
    expect(detail.displayTime).toBe('2020 年 9 月 3 日')
    expect(detail.publishedAt).toBe('2020-09-03 08:36:53')
    expect(detail.content).toContain('V2EX Playground')
    expect(detail.replyCount).toBeGreaterThanOrEqual(42)
    expect(detail.replies.length).toBeGreaterThanOrEqual(42)
    expect(detail.replyCurrentPage).toBe(1)
    expect(detail.replies[0]).toMatchObject({
      replyId: '9452335',
      userName: 'polaa',
      repliedAt: '2020-09-03 08:41:14',
      floor: '1'
    })
    expectTopicDetail(detail)
  })

  test('gets author PRO badge from a known public topic', async () => {
    const detail = await client.getTopicDetail(443648)

    expect(detail.isAuthorPro).toBe(true)
  })

  test('gets reply MOD / OP / PRO badges from a known public topic', async () => {
    const detail = await client.getTopicDetail(1228289)

    expect(detail.authorName).toBe('Livid')
    expect(detail.isAuthorPro).toBe(true)

    const authorReply = detail.replies.find(reply => reply.userName === 'Livid')
    expect(authorReply).toMatchObject({
      isMod: true,
      isOp: true,
      isPro: true
    })

    const proReply = detail.replies.find(reply => reply.userName === 'itechify')
    expect(proReply).toMatchObject({
      isMod: false,
      isOp: false,
      isPro: true
    })
  })

  test('gets tags from a known public topic', async () => {
    const detail = await client.getTopicDetail(101091)

    expect(detail.tags).toEqual(['分词', '结果', '库算'])
  })
})

describe('V2exClient authenticated topic requests', () => {
  const authTest = process.env.V2EX_COOKIE ? test : test.skip

  authTest('previews default reply syntax with V2EX_COOKIE', async () => {
    const html = await client.previewReply(
      ['第一行 <标签>', '', '@alice #12 https://www.v2ex.com/t/1', '**粗体**'].join('\n'),
      'default'
    )

    expect(html).toContain('第一行 &lt;标签&gt;<br /><br />')
    expect(html).toContain('href="/member/alice"')
    expect(html).toContain('href="https://www.v2ex.com/t/1"')
    expect(html).toContain('**粗体**')
  })

  authTest('previews markdown reply syntax with V2EX_COOKIE', async () => {
    const html = await client.previewReply(
      [
        '# 标题',
        '',
        '> 引用',
        '',
        '- 列表',
        '',
        '```ts',
        'const value = 1',
        '```',
        '',
        '| A | B |',
        '| - | - |',
        '| 1 | 2 |',
        '',
        '<img src="x" onerror="alert(1)">',
        '<a href="javascript:alert(2)" onclick="alert(3)">危险链接</a>'
      ].join('\n'),
      'markdown'
    )

    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<code class="language-ts">')
    expect(html).toContain('<table>')
    expect(html).toContain('<img class="embedded_image"')
    expect(html).toContain('<a>危险链接</a>')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('javascript:')
  })
})
