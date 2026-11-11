import { cloneElement, useState, type HTMLAttributes, type ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { Copy, Download, ExternalLink, Image, Link } from 'lucide-react'
import { ContextMenu, type ContextMenuItem, type ContextMenuProps, Toast } from './ui'
import { copyImageToClipboard } from '@/core/imageClipboard'
import { createVsCodeClient } from '@/core/vscode'
import type { WebviewCommonRpcCommands } from '@extension/shared/webview'

interface PageContextMenuProps extends Omit<ContextMenuProps, 'children' | 'items'> {
  /** 触发区域；需将事件属性透传至 DOM */
  children: ReactElement<HTMLAttributes<HTMLElement>>
  /** 调用方提供的业务菜单项 */
  items?: ContextMenuItem[]
  /** 禁用调用方的业务菜单，不影响文字选区复制 */
  disabled?: boolean
  /** 显示地址经过缓存替换时，提供链接操作使用的原始地址 */
  getImageUrl?: (image: HTMLImageElement) => string | undefined
  /** 空白处没有可用菜单项时，阻止宿主菜单 */
  suppressEmptyMenu?: boolean
}

const vscode = createVsCodeClient<WebviewCommonRpcCommands>()

/** 编辑控件保留宿主的剪切、复制、粘贴等操作 */
const editableSelector = 'input, textarea, select, [role="textbox"]'

/** 编辑区保留宿主菜单；普通内容提供选区复制及调用方配置的菜单 */
export default function PageContextMenu({
  children,
  disabled,
  items = [],
  getImageUrl,
  suppressEmptyMenu,
  ...props
}: PageContextMenuProps) {
  const [context, setContext] = useState<{
    nativeMenu: boolean
    selectionText: string
    image: HTMLImageElement | null
  }>({ nativeMenu: false, selectionText: '', image: null })
  const pageItems = disabled ? [] : items
  const contentItems: ContextMenuItem[] = []
  if (context.selectionText && !context.image) {
    contentItems.push({
      key: 'copy-selection',
      label: '复制',
      icon: <Copy />,
      onSelect: () => void vscode.copyText(context.selectionText)
    })
  }
  if (context.image) {
    const image = context.image
    contentItems.push({
      key: 'copy-image',
      label: '复制图片',
      icon: <Image />,
      onSelect: async () => {
        let notification: ReturnType<typeof Toast.progress> | undefined
        let progress = 20
        const progressTimer = window.setTimeout(() => {
          notification = Toast.progress('正在复制图片…', progress)
        }, 350)
        try {
          await copyImageToClipboard(
            image,
            src => vscode.loadImageDataUrl(src),
            () => {
              progress = 80
              notification?.update(progress)
            }
          )
          const feedback = notification ?? Toast
          feedback.success('图片已复制')
        } catch (error) {
          const feedback = notification ?? Toast
          feedback.error(`复制图片失败：${error instanceof Error ? error.message : String(error)}`)
        } finally {
          window.clearTimeout(progressTimer)
          notification = undefined
        }
      }
    })
    const imageUrl = getImageUrl?.(image) || image.currentSrc || image.src
    if (/^https?:\/\//.test(imageUrl)) {
      const { hostname } = new URL(imageUrl)
      if (!hostname.endsWith('.vscode-resource.vscode-cdn.net')) {
        contentItems.push({
          key: 'copy-image-link',
          label: '复制图片链接',
          icon: <Link />,
          onSelect: () => vscode.copyText(imageUrl)
        })
        contentItems.push({
          key: 'download-image',
          label: '下载图片',
          icon: <Download />,
          onSelect: () => vscode.downloadImage(imageUrl)
        })
        contentItems.push({
          key: 'open-image',
          label: '在浏览器中打开',
          icon: <ExternalLink />,
          onSelect: () => vscode.openInBrowser(imageUrl)
        })
      }
    }
  }
  const menuItems = contentItems.length ? contentItems : pageItems

  return (
    <ContextMenu
      {...props}
      items={menuItems}
      disabled={context.nativeMenu || menuItems.length === 0}
    >
      {cloneElement(children, {
        onContextMenu: event => {
          children.props.onContextMenu?.(event)
          if (
            suppressEmptyMenu &&
            !context.nativeMenu &&
            menuItems.length === 0 &&
            event.target instanceof Node &&
            event.currentTarget.contains(event.target)
          ) {
            event.preventDefault()
          }
        },
        onContextMenuCapture: event => {
          children.props.onContextMenuCapture?.(event)
          const target = event.target instanceof Element ? event.target : null
          const trigger = event.currentTarget
          // Portal 中的事件沿 React 树传播，但不属于当前 DOM 触发区域
          if (!target || !trigger.contains(target)) return
          const editableContent = target.closest('[contenteditable]')
          const element = target instanceof HTMLElement ? target : editableContent
          const nativeMenu = Boolean(
            event.defaultPrevented ||
            target.closest(editableSelector) ||
            (element instanceof HTMLElement && element.isContentEditable)
          )
          // 菜单打开和焦点变化可能清空选区，需在捕获阶段保存原始文本
          const selectionText = nativeMenu
            ? ''
            : target.ownerDocument.getSelection()?.toString() || ''
          // 宿主在 window 冒泡阶段显示菜单；同步禁用也会移除 Base UI 的
          // document 默认行为拦截，不能用 stopPropagation() 替代
          const targetImage = nativeMenu ? null : target.closest('img')
          const image = targetImage instanceof HTMLImageElement ? targetImage : null
          flushSync(() => setContext({ nativeMenu, selectionText, image }))
        }
      })}
    </ContextMenu>
  )
}
