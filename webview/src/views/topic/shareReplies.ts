import type { TopicReply, ReplyThreadStyle } from '@extension/v2ex/types'
import { buildReplyTree, flattenReplyTree } from './replyTree'

/** 分组模式按根楼层选择并完整保留后代，其余模式按原始楼层范围选择 */
export function selectShareReplies(
  replies: TopicReply[],
  mode: ReplyThreadStyle,
  floorLimit: number
): TopicReply[] {
  if (mode === 'c' || mode === 'd') {
    return flattenReplyTree(
      buildReplyTree(replies).filter(reply => Number(reply.floor) <= floorLimit)
    ).sort((a, b) => Number(a.floor) - Number(b.floor))
  }
  return replies.filter(reply => Number(reply.floor) <= floorLimit)
}
