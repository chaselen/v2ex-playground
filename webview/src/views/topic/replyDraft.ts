import type { TopicReply } from '@extension/v2ex/types'

/** 回复框草稿，正文与明确回复目标一起保存 */
export interface ReplyDraft {
  content: string
  parent?: Pick<TopicReply, 'replyId' | 'userName' | 'floor' | 'content'>
  /** 官网“回复 N 人”提示会在编辑正文时继续跟随提及数量 */
  multipleRecipients?: boolean
}

/** 比较草稿正文与回复目标，区分后续编辑和同一草稿的重新挂载 */
export function isSameReplyDraft(a: ReplyDraft, b: ReplyDraft): boolean {
  return (
    a.content === b.content &&
    Boolean(a.multipleRecipients) === Boolean(b.multipleRecipients) &&
    a.parent?.replyId === b.parent?.replyId &&
    a.parent?.userName === b.parent?.userName &&
    a.parent?.floor === b.parent?.floor &&
    a.parent?.content === b.parent?.content
  )
}

/** 官网提及去重规则，不区分用户名大小写 */
export function countReplyRecipients(content: string): number {
  return new Set((content.match(/@[\w-]+/g) || []).map(at => at.toLowerCase())).size
}

/** 与官网一致：仅有提及时，多用户提及改为回复主题；开始写正文后保留目标 */
export function selectReplyDraft(draft: ReplyDraft, reply: TopicReply): ReplyDraft {
  const mention = `@${reply.userName} `
  const parent = {
    replyId: reply.replyId,
    userName: reply.userName,
    floor: reply.floor,
    content: reply.content
  }
  if (!draft.content) return { content: mention, parent }
  if (draft.content === mention) {
    return draft.parent?.replyId === reply.replyId ? { content: '' } : { content: mention, parent }
  }
  const content = `${draft.content}\n${mention}`
  if (/^\s*(@[\w-]+\s*)+$/.test(draft.content)) {
    const multipleRecipients = countReplyRecipients(content) > 1
    return { content, parent: multipleRecipients ? undefined : parent, multipleRecipients }
  }
  return { ...draft, content }
}
