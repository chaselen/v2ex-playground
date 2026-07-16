import type { TopicDetail } from '@extension/v2ex/types'

/**
 * 合并写操作结果并保留用户已经切换到的回复页
 * @param currentTopic 当前展示的话题详情
 * @param nextTopic 写操作返回的话题详情
 * @param requestReplyPage 写操作发起时的回复页
 */
export function mergeTopicMutationResult(
  currentTopic: TopicDetail,
  nextTopic: TopicDetail,
  requestReplyPage: number
): TopicDetail | undefined {
  if (String(currentTopic.id) !== String(nextTopic.id)) {
    return undefined
  }

  if (currentTopic.replyCurrentPage === requestReplyPage) {
    return nextTopic
  }

  return {
    ...nextTopic,
    replyCurrentPage: currentTopic.replyCurrentPage,
    replies: currentTopic.replies
  }
}
