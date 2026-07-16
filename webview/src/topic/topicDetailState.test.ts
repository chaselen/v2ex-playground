import { describe, expect, it } from 'vitest'
import { mergeTopicMutationResult } from './topicDetailState'
import type { TopicDetail } from '@extension/v2ex/types'

describe('mergeTopicMutationResult', () => {
  it('当前回复页未变化时直接应用操作结果', () => {
    const currentTopic = createTopic(1, 1, ['current'])
    const nextTopic = createTopic(1, 1, ['next'])

    expect(mergeTopicMutationResult(currentTopic, nextTopic, 1)).toBe(nextTopic)
  })

  it('用户已翻页时保留当前回复页和回复列表', () => {
    const currentTopic = createTopic(1, 2, ['page-2'])
    const nextTopic = createTopic(1, 1, ['page-1'])
    nextTopic.isCollected = true

    expect(mergeTopicMutationResult(currentTopic, nextTopic, 1)).toMatchObject({
      isCollected: true,
      replyCurrentPage: 2,
      replies: ['page-2']
    })
  })

  it('忽略其他话题的操作结果', () => {
    expect(
      mergeTopicMutationResult(createTopic(1, 1, []), createTopic(2, 1, []), 1)
    ).toBeUndefined()
  })
})

/** 创建测试所需的最小话题详情 */
function createTopic(id: number, replyCurrentPage: number, replies: unknown[]): TopicDetail {
  return {
    id,
    replyCurrentPage,
    replies
  } as TopicDetail
}
