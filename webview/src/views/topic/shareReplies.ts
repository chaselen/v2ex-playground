import type { TopicReply } from '@extension/v2ex/types'
import { buildReplyTree, type ReplyViewMode, type TopicReplyNode } from './replyTree'

/** 按顶层楼层上限选择分享回复，嵌套回复始终随父回复完整保留 */
export function selectShareReplies(
  replies: TopicReply[],
  mode: ReplyViewMode,
  floorLimit: number,
  extractText?: (content: string) => string
): TopicReplyNode[] {
  const nodes =
    mode === 'nested'
      ? buildReplyTree(replies, extractText)
      : replies.map<TopicReplyNode>(reply => ({ ...reply, children: [] }))
  return nodes.filter(reply => Number(reply.floor) <= floorLimit)
}
