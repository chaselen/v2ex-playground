import { ClipboardCopy, ExternalLink, Link } from 'lucide-react'
import type { WebviewCommonRpcCommands } from '@extension/shared/webview'
import { createVsCodeClient } from '@/core/vscode'
import type { ContextMenuItem } from './ui'

const vscode = createVsCodeClient<WebviewCommonRpcCommands>()

/** 生成站点链接操作，话题可额外提供标题供复制 */
export function getLinkMenuItems(url?: string, title?: string): ContextMenuItem[] {
  if (!url) return []
  const items: ContextMenuItem[] = [
    {
      key: 'copy-link',
      label: '复制链接',
      icon: <Link />,
      onSelect: () => vscode.copyText(url)
    }
  ]
  if (title !== undefined) {
    items.push({
      key: 'copy-title-link',
      label: '复制标题和链接',
      icon: <ClipboardCopy />,
      onSelect: () => vscode.copyTitleLink(url, title)
    })
  }
  items.push({
    key: 'view-in-browser',
    label: '在浏览器中打开',
    icon: <ExternalLink />,
    separatorBefore: title !== undefined,
    onSelect: () => vscode.openInBrowser(url)
  })
  return items
}
