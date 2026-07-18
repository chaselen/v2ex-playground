import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import type { ReactElement } from 'react'

interface TopicShareContextMenuProps {
  /** 触发右键菜单的元素 */
  children: ReactElement
  /** 是否禁用右键菜单 */
  disabled?: boolean
  /** 复制链接 */
  onCopyLink: () => void
  /** 复制标题和链接 */
  onCopyTitleLink: () => void
  /** 在浏览器中打开 */
  onViewInBrowser: () => void
}

/** 基于 Radix Context Menu 的话题分享右键菜单 */
export default function TopicShareContextMenu({
  children,
  disabled = false,
  onCopyLink,
  onCopyTitleLink,
  onViewInBrowser
}: TopicShareContextMenuProps) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild disabled={disabled}>
        {children}
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content className="v2ex-menu topic-share-menu" collisionPadding={8}>
          <ContextMenuPrimitive.Item className="v2ex-menu__item" onSelect={onCopyLink}>
            复制链接
          </ContextMenuPrimitive.Item>
          <ContextMenuPrimitive.Item className="v2ex-menu__item" onSelect={onCopyTitleLink}>
            复制标题和链接
          </ContextMenuPrimitive.Item>
          <ContextMenuPrimitive.Separator className="v2ex-menu__separator" />
          <ContextMenuPrimitive.Item className="v2ex-menu__item" onSelect={onViewInBrowser}>
            在浏览器中打开
          </ContextMenuPrimitive.Item>
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  )
}
