import type { WebviewCommonRpcCommands } from '@extension/shared/webview'
import { createVsCodeClient } from './vscode'

/** 站内链接导航使用的 VS Code 通信客户端 */
const vscode = createVsCodeClient<WebviewCommonRpcCommands>()

/** 可用于处理链接点击的事件 */
interface LinkClickEvent {
  /** 点击目标 */
  target: EventTarget | null
  /** 默认行为是否已被阻止 */
  defaultPrevented?: boolean
  /** 阻止默认行为 */
  preventDefault(): void
  /** 停止事件传播 */
  stopPropagation(): void
}

/** 链接导航补充参数 */
export interface LinkNavigationOptions {
  /** 话题标题 fallback */
  topicTitle?: string
  /** 无法从链接解析话题时使用的 fallback */
  fallbackTopic?: {
    /** 话题 id */
    topicId: string | number
    /** 话题标题 */
    title?: string
  }
}

/**
 * 统一处理 Webview 中的站内链接和外部链接点击
 * @param event 点击事件
 * @param options 导航补充参数
 */
export function handleWebviewLinkClick(
  event: LinkClickEvent,
  options: LinkNavigationOptions = {}
): boolean {
  if (event.defaultPrevented) {
    return false
  }

  const element = event.target instanceof Element ? event.target : null
  const anchor = element?.closest<HTMLAnchorElement>('a')

  if (!anchor) {
    return false
  }

  const href = anchor.getAttribute('href') || ''
  const title = anchor.textContent?.trim() || options.topicTitle
  let url: URL | undefined
  try {
    if (href) url = new URL(href, document.baseURI)
  } catch {
    // 无效链接可使用消息携带的话题信息回退
  }

  if (url && ['http:', 'https:'].includes(url.protocol)) {
    event.preventDefault()
    event.stopPropagation()
    vscode.openExternal(url.href, title)
    return true
  }

  // 消息中的空链接或 javascript 占位链接仍使用已知话题信息
  if (anchor.classList.contains('topic-link') && options.fallbackTopic) {
    event.preventDefault()
    event.stopPropagation()
    vscode.openTopic(options.fallbackTopic.topicId, options.fallbackTopic.title || title)
    return true
  }

  return false
}
