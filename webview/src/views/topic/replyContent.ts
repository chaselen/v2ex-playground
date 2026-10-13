import { getMemberUsernameFromHref } from '../../core/memberLink'
import type { TopicReply } from '@extension/v2ex/types'

/** V2EX 原生回复与 Markdown 段落中可安全识别的开头用户引用 */
const LEADING_REFERENCE =
  /^(\s*(?:<p\b[^>]*>\s*)?)@(?:([a-zA-Z0-9_-]+)|<a\b([^>]*)>([a-zA-Z0-9_-]+)<\/a>)(?![a-zA-Z0-9_-])/i

/** HTML 中引用之间的空白，兼容 V2EX 的不换行空格 */
const LEADING_SPACE = /^(?:\s|&nbsp;|&#160;|&#xA0;)*/i

/**
 * 隐藏嵌套回复开头指向直接父回复的 @用户名，保留楼层引用，仅转换展示 HTML
 *
 * 楼层不匹配、开头多人引用、只有引用或无法安全识别的富文本结构保留原文。
 * 不传父回复时用于普通列表及根回复，正文中的其他引用保持完整。
 */
export function getReplyDisplayContent(
  content: string,
  parent?: Pick<TopicReply, 'userName' | 'floor'>
): string {
  if (!parent) return content

  const match = content.match(LEADING_REFERENCE)
  if (!match || (match[2] || match[4]) !== parent.userName) return content

  if (match[4]) {
    const href = match[3].match(/(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
    if (
      !href ||
      getMemberUsernameFromHref(href[1] ?? href[2] ?? href[3], 'https://www.v2ex.com/') !==
        parent.userName
    ) {
      return content
    }
  }

  const displayRemainder = content.slice(match[0].length).replace(LEADING_SPACE, '')
  let remainder = displayRemainder
  if (remainder.startsWith('#')) {
    const floor = remainder.match(/^#(\d+)(?![a-zA-Z0-9_-])/)
    if (!floor || floor[1] !== parent.floor) return content
    remainder = remainder.slice(floor[0].length).replace(LEADING_SPACE, '')
  }

  // 开头连续引用多人时保留完整寻址信息；纯引用回复不能变成空白
  if (remainder.startsWith('@') || /^(?:\s|<br\s*\/?>|<\/p>)*$/i.test(remainder)) {
    return content
  }

  return match[1] + displayRemainder.replace(/^(?:\s|<br\s*\/?>)+/i, '')
}
