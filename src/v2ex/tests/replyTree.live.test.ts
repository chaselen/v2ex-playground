import { load } from 'cheerio/slim'
import { describe, expect, it } from 'vitest'
import { buildReplyTree, type TopicReplyNode } from '../../../webview/src/topic/replyTree'
import { V2exClient } from '../client'
import type { TopicReply } from '../types'

const client = new V2exClient()

/** 使用与 Webview 等价的 HTML 纯文本作为算法输入 */
function extractText(content: string): string {
  return load(content).text()
}

/** 将回复树展开，验证构建过程没有丢失或复制回复 */
function flatten(nodes: TopicReplyNode[]): TopicReplyNode[] {
  return nodes.flatMap(node => [node, ...flatten(node.children)])
}

/** 获取回复树的最大层级，根节点为第一层 */
function maxDepth(nodes: TopicReplyNode[]): number {
  if (!nodes.length) {
    return 0
  }
  return Math.max(...nodes.map(node => 1 + maxDepth(node.children)))
}

/** 查找指定回复的直接父楼层 */
function findParentFloor(nodes: TopicReplyNode[], replyFloor: string): string | undefined {
  for (const node of nodes) {
    if (node.children.some(child => child.floor === replyFloor)) {
      return node.floor
    }
    const nestedParentFloor = findParentFloor(node.children, replyFloor)
    if (nestedParentFloor) {
      return nestedParentFloor
    }
  }
  return undefined
}

/** 校验真实回复能够无损构建为一棵或多棵回复树 */
function expectLosslessTree(replies: TopicReply[], tree: TopicReplyNode[]) {
  const flattened = flatten(tree)
  expect(flattened).toHaveLength(replies.length)
  expect(new Set(flattened.map(reply => reply.replyId)).size).toBe(replies.length)
  expect(new Set(flattened.map(reply => reply.floor)).size).toBe(replies.length)
}

describe.concurrent('buildReplyTree live V2EX topics', () => {
  it('1030787：正确处理多人引用后的单个楼层号', async () => {
    const topic = await client.getTopicDetail(1030787)
    const tree = buildReplyTree(topic.replies, extractText)

    expect(topic.replies.length).toBeGreaterThanOrEqual(90)
    expectLosslessTree(topic.replies, tree)
    expect(findParentFloor(tree, '58')).toBe('55')
    expect(maxDepth(tree)).toBeGreaterThanOrEqual(5)
  })

  it('1149556：高回复数低引用帖子保持无损', async () => {
    const [firstPage, secondPage] = await Promise.all([
      client.getTopicDetail(1149556, 1),
      client.getTopicDetail(1149556, 2)
    ])

    for (const topic of [firstPage, secondPage]) {
      const tree = buildReplyTree(topic.replies, extractText)
      expectLosslessTree(topic.replies, tree)
    }
    expect(firstPage.replies.length + secondPage.replies.length).toBeGreaterThanOrEqual(180)
  })

  it('95398：只有用户名的连续对话可以形成多层结构', async () => {
    const topic = await client.getTopicDetail(95398)
    const tree = buildReplyTree(topic.replies, extractText)

    expect(topic.replies.length).toBeGreaterThanOrEqual(60)
    expectLosslessTree(topic.replies, tree)
    expect(maxDepth(tree)).toBeGreaterThanOrEqual(4)
  })

  it('919083：混合正确楼层、错误楼层和多人引用时保持无损', async () => {
    const topic = await client.getTopicDetail(919083)
    const tree = buildReplyTree(topic.replies, extractText)

    expect(topic.replies.length).toBeGreaterThanOrEqual(90)
    expectLosslessTree(topic.replies, tree)
    expect(maxDepth(tree)).toBeGreaterThanOrEqual(3)
  })
})
