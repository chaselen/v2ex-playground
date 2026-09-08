import { getMemberUsernameFromHref } from '@/core/memberLink'

/** 已由 React 包上用户快速信息的触发器 */
export const MEMBER_QUICK_INFO_TRIGGER_ATTR = 'data-member-quick-info-trigger'

/** 内容区用户链接正由幽灵触发器接管悬停 */
export const MEMBER_QUICK_INFO_HOVER_ATTR = 'data-member-quick-info-hover'

/** 话题 HTML 内容中的用户链接选择范围 */
const TOPIC_CONTENT_SELECTOR = '.topic-content'

/** 话题 HTML 内容中可展示用户快速信息的成员链接 */
export interface TopicContentMemberAnchor {
  /** 原生用户链接 */
  anchor: HTMLAnchorElement
  /** 用户名 */
  username: string
}

/**
 * 解析话题 HTML 内容中可展示用户快速信息的成员链接
 *
 * 只接受 `.topic-content` 内的 `/member/{username}` 链接，排除作者名 / 头像上已有的 React 触发器，以及收起回复中的 inert 内容。
 *
 * @param target 指针事件目标
 */
export function resolveTopicContentMemberAnchor(
  target: EventTarget | null
): TopicContentMemberAnchor | undefined {
  if (!(target instanceof Element)) {
    return undefined
  }

  const anchor = target.closest<HTMLAnchorElement>('a')
  if (!anchor?.closest(TOPIC_CONTENT_SELECTOR) || anchor.closest('[inert]')) {
    return undefined
  }

  if (anchor.closest(`[${MEMBER_QUICK_INFO_TRIGGER_ATTR}]`)) {
    return undefined
  }

  const username = getMemberUsernameFromHref(anchor.getAttribute('href') || '', document.baseURI)
  if (!username) {
    return undefined
  }

  return { anchor, username }
}
