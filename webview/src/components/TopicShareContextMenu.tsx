import { ClipboardCopy, ExternalLink, Link } from 'lucide-react'
import type { ReactElement } from 'react'
import { ContextMenu, type ContextMenuItem } from '@/components/ui'

interface TopicShareContextMenuProps {
  /** 触发右键菜单的元素 */
  children: ReactElement
  /** 是否使用适合侧边栏的紧凑宽度 */
  compact?: boolean
  /** 是否禁用右键菜单 */
  disabled?: boolean
  /** 复制链接 */
  onCopyLink: () => void
  /** 复制标题和链接 */
  onCopyTitleLink: () => void
  /** 在浏览器中打开 */
  onViewInBrowser: () => void
}

/** 配置复制与外部打开操作的话题分享右键菜单 */
export default function TopicShareContextMenu({
  children,
  compact = false,
  disabled = false,
  onCopyLink,
  onCopyTitleLink,
  onViewInBrowser
}: TopicShareContextMenuProps) {
  const items: ContextMenuItem[] = [
    {
      key: 'copy-link',
      label: '复制链接',
      icon: <Link />,
      onSelect: onCopyLink
    },
    {
      key: 'copy-title-link',
      label: '复制标题和链接',
      icon: <ClipboardCopy />,
      onSelect: onCopyTitleLink
    },
    {
      key: 'view-in-browser',
      label: '在浏览器中打开',
      icon: <ExternalLink />,
      separatorBefore: true,
      onSelect: onViewInBrowser
    }
  ]

  return (
    <ContextMenu disabled={disabled} items={items} size={compact ? 'compact' : 'comfortable'}>
      {children}
    </ContextMenu>
  )
}
