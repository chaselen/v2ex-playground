import type { WebviewNavigationRpcCommands } from '@extension/shared/webview'
import { createVsCodeClient } from './vscode'

/** 站内链接导航使用的 VS Code 通信客户端 */
const vscode = createVsCodeClient<WebviewNavigationRpcCommands>()

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

/** Webview 链接导航目标 */
type LinkNavigationTarget =
  | { type: 'topic'; topicId: string | number; title?: string }
  | { type: 'member'; username: string }
  | { type: 'node'; name: string; title: string }
  | { type: 'external'; path: string }

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

  // 先完成目标解析，再统一拦截事件，避免未识别的链接失去默认行为
  const target = resolveLinkNavigationTarget(anchor, options)
  if (!target) {
    return false
  }

  interceptLinkClick(event)
  openLinkNavigationTarget(target)
  return true
}

/**
 * 阻止 Webview 继续处理已接管的链接点击
 * @param event 点击事件
 */
function interceptLinkClick(event: LinkClickEvent) {
  event.preventDefault()
  event.stopPropagation()
}

/**
 * 解析 Webview 链接导航目标
 * @param anchor 链接元素
 * @param options 导航补充参数
 */
function resolveLinkNavigationTarget(
  anchor: HTMLAnchorElement,
  options: LinkNavigationOptions
): LinkNavigationTarget | undefined {
  const href = anchor.getAttribute('href') || ''
  const title = anchor.textContent?.trim()
  const url = resolveLinkUrl(href)
  const internalPath = url && isV2exHostname(url.hostname) ? url.pathname : ''

  // 只匹配 pathname，避免查询参数中的 /t/123 等文本被误判为站内链接
  const topicId = internalPath.match(/^\/t\/(\d+)\/?$/)?.[1]
  if (topicId) {
    return { type: 'topic', topicId, title: title || options.topicTitle }
  }

  const username = extractPathValue(internalPath, 'member')
  if (username) {
    return { type: 'member', username }
  }

  const nodeName = extractPathValue(internalPath, 'go')
  if (nodeName) {
    return { type: 'node', name: nodeName, title: title || nodeName }
  }

  // 部分消息链接没有可解析的 href，需要使用消息数据中的话题信息
  if (anchor.classList.contains('topic-link') && options.fallbackTopic) {
    return {
      type: 'topic',
      topicId: options.fallbackTopic.topicId,
      title: options.fallbackTopic.title || title
    }
  }

  // 未识别为站内目标的有效链接统一交给扩展侧在浏览器中打开
  if (url && url.href !== 'javascript:;') {
    return { type: 'external', path: url.href }
  }

  return undefined
}

/**
 * 打开 Webview 链接导航目标
 * @param target 导航目标
 */
function openLinkNavigationTarget(target: LinkNavigationTarget) {
  switch (target.type) {
    case 'topic':
      vscode.openTopic({ topicId: target.topicId, title: target.title })
      return
    case 'member':
      vscode.openMember({ username: target.username })
      return
    case 'node':
      vscode.openNode({ name: target.name, title: target.title })
      return
    case 'external':
      vscode.openExternal({ path: target.path })
  }
}

/**
 * 解析链接地址
 * @param href 链接地址
 */
function resolveLinkUrl(href: string): URL | undefined {
  try {
    return href ? new URL(href, document.baseURI) : undefined
  } catch {
    return undefined
  }
}

/**
 * 判断是否为 V2EX 域名
 * @param hostname 域名
 */
function isV2exHostname(hostname: string): boolean {
  return hostname === 'v2ex.com' || hostname.endsWith('.v2ex.com')
}

/**
 * 从站内路径中提取并解码参数
 * @param href 链接地址
 * @param segment 路径段
 */
function extractPathValue(href: string, segment: 'member' | 'go'): string {
  const value = href.match(new RegExp(`^/${segment}/([^/]+)/?$`))?.[1]
  if (!value) {
    return ''
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}
