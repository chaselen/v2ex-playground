import { useEffect, useState, type RefObject } from 'react'
import MemberQuickInfoPopover from './MemberQuickInfoPopover'
import {
  MEMBER_QUICK_INFO_HOVER_ATTR,
  resolveTopicContentMemberAnchor,
  type TopicContentMemberAnchor
} from './memberQuickInfoHover'
import type { MemberQuickInfo, TopicMemberRelationTarget } from '@extension/shared/webview'

export interface MemberQuickInfoHoverLayerProps {
  /** 话题详情根节点，用于限定事件委托范围 */
  container: HTMLElement | null
  /** 页面滚动容器；滚动时关闭浮层，避免锚点矩形失效 */
  scrollContainerRef?: RefObject<HTMLElement | null>
  /** 话题或回复页变化时关闭浮层 */
  dismissKey: string
  /** 加载用户快速信息 */
  loadMemberInfo: (username: string) => Promise<MemberQuickInfo>
  /** 屏蔽用户 */
  blockMember: (target: TopicMemberRelationTarget) => Promise<void>
  /** 取消屏蔽用户 */
  unblockMember: (target: TopicMemberRelationTarget) => Promise<void>
  /** 打开完整用户资料 */
  openMember: (username: string) => void
}

/**
 * 为 HTML 内容中的用户链接提供单例用户快速信息浮层
 *
 * 正文、附言、回复仍是 innerHTML，不能逐个包成 React 树。在详情根节点上委托 pointerover，用一个幽灵触发器对齐当前链接。
 */
export default function MemberQuickInfoHoverLayer({
  container,
  scrollContainerRef,
  dismissKey,
  loadMemberInfo,
  blockMember,
  unblockMember,
  openMember
}: MemberQuickInfoHoverLayerProps) {
  /** 当前悬停的内容区用户链接 */
  const [hoverTarget, setHoverTarget] = useState<TopicContentMemberAnchor>()

  useEffect(() => {
    setHoverTarget(undefined)
  }, [dismissKey])

  useEffect(() => {
    if (!hoverTarget) {
      return
    }

    const { anchor } = hoverTarget
    anchor.setAttribute(MEMBER_QUICK_INFO_HOVER_ATTR, '')
    return () => {
      anchor.removeAttribute(MEMBER_QUICK_INFO_HOVER_ATTR)
    }
  }, [hoverTarget])

  useEffect(() => {
    if (!container) {
      return
    }

    const root = container

    /**
     * 将当前指针下的内容区用户链接设为浮层锚点
     * @param event 指针事件
     */
    function handlePointerOver(event: PointerEvent) {
      const nextTarget = resolveTopicContentMemberAnchor(event.target)
      if (!nextTarget || !root.contains(nextTarget.anchor)) {
        return
      }

      setHoverTarget(current => {
        if (current?.anchor === nextTarget.anchor && current.username === nextTarget.username) {
          return current
        }

        return nextTarget
      })
    }

    root.addEventListener('pointerover', handlePointerOver)
    return () => root.removeEventListener('pointerover', handlePointerOver)
  }, [container])

  useEffect(() => {
    if (!hoverTarget) {
      return
    }

    /** 滚动或窗口尺寸变化后锚点矩形失效，直接关闭 */
    function dismiss() {
      setHoverTarget(undefined)
    }

    const scrollParent = scrollContainerRef?.current
    scrollParent?.addEventListener('scroll', dismiss, { passive: true })
    window.addEventListener('resize', dismiss)
    return () => {
      scrollParent?.removeEventListener('scroll', dismiss)
      window.removeEventListener('resize', dismiss)
    }
  }, [hoverTarget, scrollContainerRef])

  if (!hoverTarget) {
    return null
  }

  return (
    <MemberQuickInfoPopover
      username={hoverTarget.username}
      anchor={hoverTarget.anchor}
      loadMemberInfo={loadMemberInfo}
      blockMember={blockMember}
      unblockMember={unblockMember}
      openMember={openMember}
      onAnchorDismiss={() => setHoverTarget(undefined)}
    />
  )
}
