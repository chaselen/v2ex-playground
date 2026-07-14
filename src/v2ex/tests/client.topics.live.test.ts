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

  test('gets topic detail from a known public topic', async () => {
    const detail = await client.getTopicDetail(703733)

    expect(detail.id).toBe(703733)
    expect(detail.title).toBe('写了一个 VSCode 上可以逛 V2EX 的插件')
    expect(detail.node).toEqual({ name: 'create', title: '分享创造' })
    expect(detail.authorName).toBe('chaselen')
    expect(detail.displayTime).toBe('2020 年 9 月 3 日')
    expect(detail.content).toContain('V2EX Playground')
    expect(detail.replyCount).toBeGreaterThanOrEqual(42)
    expect(detail.replies.length).toBeGreaterThanOrEqual(42)
    expect(detail.replyCurrentPage).toBe(1)
    expect(detail.replies[0]).toMatchObject({
      replyId: '9452335',
      userName: 'polaa',
      floor: '1'
    })
    expectTopicDetail(detail)
  })

  test('gets author PRO badge from a known public topic', async () => {
    const detail = await client.getTopicDetail(443648)

    expect(detail.isAuthorPro).toBe(true)
  })
})

describe('V2exClient authenticated topic requests', () => {
  const authTest = process.env.V2EX_COOKIE ? test : test.skip

  authTest('previews default reply syntax with V2EX_COOKIE', async () => {
    await expect(client.previewReply('1\n2', 'default')).resolves.toBe('1<br />2')
  })

  authTest('previews markdown reply syntax with V2EX_COOKIE', async () => {
    await expect(client.previewReply('`123`', 'markdown')).resolves.toBe(
      '<p><code>123</code></p>\n'
    )
  })
})
