import type { WebviewCommonRpcCommands } from '@extension/shared/webview'
import { handleWebviewLinkClick } from './linkNavigation'
import { getV2exTopicId } from './topicLink'
import { isApplePlatform } from './platform'
import { createVsCodeClient, resolveWebviewUrl } from './vscode'
import {
  detectCompactImageEmoticon,
  isImageEmoticonSrc,
  normalizeImageEmoticonSrc
} from './imageEmoticons'
import { decodeCloudflareEmails } from './cloudflareEmail'
import { getEmbeddedVideoInfo } from './embeddedVideo'
import type { OpenImagePreview } from '@/components/ImagePreviewProvider'

/** 内容增强功能使用的 VS Code 通信客户端 */
const vscode = createVsCodeClient<WebviewCommonRpcCommands>()

/** 支持直接预览的图片后缀 */
const SUPPORT_IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'])

/** 隐藏图片占位按钮 id 计数 */
let hiddenImagePlaceholderCount = 0

/** 打开站内话题预览 */
export type OpenTopicPreview = (topicId: string) => void

/** HTML 规范化选项 */
interface NormalizeHtmlOptions {
  /** 是否加载内容中的图片 */
  loadImages?: boolean
}

/**
 * 获取图片在 Webview 中实际展示的地址
 * @param imageSrc 图片地址
 */
function getImageDisplaySrc(imageSrc: string): string {
  return normalizeImageEmoticonSrc(imageSrc)
}

/**
 * 判断图片是否为内置图片表情
 * @param originalSrc 原始图片地址
 * @param displaySrc 展示图片地址
 */
function isImageEmoticonDisplaySrc(originalSrc: string, displaySrc: string) {
  return isImageEmoticonSrc(originalSrc) || isImageEmoticonSrc(displaySrc)
}

/**
 * 规范化 html 文本，避免插值时出现 undefined
 * @param html 原始 html
 * @param options 规范化选项
 */
export function normalizeHtml(html?: unknown, options: NormalizeHtmlOptions = {}): string {
  const normalizedHtml = typeof html === 'string' ? html : ''
  const loadImages = options.loadImages !== false
  const hasImgurImage = normalizedHtml.includes('i.imgur.com')
  const hasCloudflareEmail =
    normalizedHtml.includes('data-cfemail') ||
    normalizedHtml.includes('/cdn-cgi/l/email-protection#')
  const hasEmbeddedVideo = /<iframe\b/i.test(normalizedHtml)

  if (loadImages && !hasImgurImage && !hasCloudflareEmail && !hasEmbeddedVideo) {
    return normalizedHtml
  }

  const template = document.createElement('template')
  template.innerHTML = normalizedHtml
  decodeCloudflareEmails(template.content)

  if (hasEmbeddedVideo) {
    template.content.querySelectorAll<HTMLIFrameElement>('iframe').forEach(iframe => {
      const marker = document.createElement('span')
      marker.className = 'embedded-video-marker'
      marker.dataset.embedSrc = iframe.getAttribute('src') || ''
      iframe.replaceWith(marker)
    })
  }

  if (hasImgurImage || !loadImages) {
    template.content.querySelectorAll<HTMLImageElement>('img').forEach(img => {
      const originalSrc = img.getAttribute('data-preview-src') || img.getAttribute('src') || ''
      if (!originalSrc) {
        if (!loadImages) {
          img.removeAttribute('srcset')
        }
        return
      }

      // 图片表情提交使用 LD 地址，渲染时统一切回 HD 地址
      const displaySrc = getImageDisplaySrc(originalSrc)
      const proxiedSrc = proxyImgurImageSrc(displaySrc)
      if (isImageEmoticonDisplaySrc(originalSrc, displaySrc)) {
        img.classList.add('v2ex-emoticon-image')
      }

      if (!loadImages) {
        img.dataset.previewSrc = displaySrc
        img.removeAttribute('src')
        img.removeAttribute('srcset')
        return
      }

      if (proxiedSrc !== originalSrc) {
        // DOM 中展示代理地址，同时保留规范化后的真实图片地址
        img.dataset.previewSrc = displaySrc
        img.src = proxiedSrc
      }
    })

    if (!loadImages) {
      template.content.querySelectorAll<HTMLSourceElement>('source[srcset]').forEach(source => {
        source.removeAttribute('srcset')
      })
    }
  }

  return template.innerHTML
}

/**
 * 判断链接是否指向支持预览的图片
 * @param urlText 链接地址
 */
function isSupportImageUrl(urlText: string): boolean {
  try {
    const url = new URL(urlText, document.baseURI)
    const pathname = url.pathname.toLowerCase()
    const ext = pathname.split('.').pop() || ''
    return SUPPORT_IMAGE_TYPES.has(ext)
  } catch {
    return false
  }
}

/**
 * 判断链接是否指向支持预览的图片
 * @param anchor 链接元素
 */
function isSupportImageLink(anchor: HTMLAnchorElement): boolean {
  return isSupportImageUrl(anchor.href)
}

/**
 * 判断是否使用修饰键打开原始链接
 * @param event 交互事件
 */
function isOpenExternalClick(event: MouseEvent | KeyboardEvent): boolean {
  return isApplePlatform() ? event.metaKey || event.altKey : event.ctrlKey || event.altKey
}

/**
 * 获取图片预览操作提示
 * @param action 默认点击行为
 */
function getImagePreviewTitle(action: '查看大图' | '查看图片'): string {
  const modifierKeys = isApplePlatform() ? 'Cmd/Option' : 'Ctrl/Alt'
  return `点击${action}，按住 ${modifierKeys} 点击在浏览器中打开`
}

/**
 * 获取图片预览地址
 * @param img 图片元素
 */
function getImagePreviewSrc(img: HTMLImageElement): string {
  const loadedSrc = img.currentSrc || (img.hasAttribute('src') ? img.src : '')
  return normalizeImagePreviewSrc(loadedSrc || img.dataset.previewSrc || '')
}

/**
 * 规范化图片预览地址
 * @param src 图片地址
 */
function normalizeImagePreviewSrc(src: string): string {
  try {
    return resolveWebviewUrl(src)
  } catch {
    return src
  }
}

/**
 * 收集当前页面中可预览的图片地址
 */
function getImagePreviewSrcList(): string[] {
  const srcList: string[] = []

  document.querySelectorAll<HTMLElement>('.image-preview-target').forEach(element => {
    if (element instanceof HTMLImageElement) {
      srcList.push(getImagePreviewSrc(element))
      return
    }

    if (element instanceof HTMLAnchorElement && !element.querySelector('img')) {
      srcList.push(normalizeImagePreviewSrc(proxyImgurImageSrc(element.href)))
    }
  })

  return Array.from(new Set(srcList.filter(Boolean)))
}

/**
 * 打开图片预览或原始链接
 * @param src 图片地址
 * @param event 交互事件
 * @param openImagePreview 打开图片预览
 */
function openImage(
  src: string,
  event: MouseEvent | KeyboardEvent,
  openImagePreview: OpenImagePreview
) {
  if (isOpenExternalClick(event)) {
    vscode.openExternal(resolveWebviewUrl(src))
    return
  }

  const normalizedSrc = normalizeImagePreviewSrc(src)
  openImagePreview({
    src: normalizedSrc,
    srcList: getImagePreviewSrcList()
  })
}

/** 图片打开行为配置 */
interface ImageOpenBindingOptions {
  /** 默认点击行为 */
  action: '查看大图' | '查看图片'
  /** 获取图片预览地址 */
  getSrc: () => string
  /** 打开图片预览 */
  openImagePreview: OpenImagePreview
  /** 当前是否允许打开图片 */
  canOpen?: () => boolean
  /** 是否补充键盘交互 */
  keyboardAccessible?: boolean
}

/**
 * 给元素绑定图片预览与外部打开行为
 * @param element 交互元素
 * @param options 图片打开行为配置
 */
function bindImageOpen(
  element: HTMLElement,
  { action, getSrc, openImagePreview, canOpen, keyboardAccessible }: ImageOpenBindingOptions
) {
  /** 执行图片打开操作 */
  function activate(event: MouseEvent | KeyboardEvent) {
    event.preventDefault()
    event.stopPropagation()

    if (canOpen && !canOpen()) {
      return
    }

    openImage(getSrc(), event, openImagePreview)
  }

  element.title = getImagePreviewTitle(action)
  element.onclick = activate

  if (!keyboardAccessible) {
    return
  }

  element.onkeydown = event => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    activate(event)
  }
}

/**
 * 转换 imgur 图片为代理地址
 * @param imageSrc 图片地址
 */
export function proxyImgurImageSrc(imageSrc: string): string {
  // try {
  //   const url = new URL(imageSrc, document.baseURI)
  //   if (url.hostname === 'i.imgur.com') {
  //     return 'https://img.fuyou.tech/get?url=' + encodeURIComponent(url.href)
  //   }
  // } catch {
  //   return imageSrc
  // }

  return imageSrc
}

/**
 * 应用图片展示地址
 * @param img 图片元素
 */
function applyImageDisplaySrc(img: HTMLImageElement, showImages: boolean) {
  const originalSrc = img.dataset.previewSrc || img.currentSrc || img.src
  const displaySrc = getImageDisplaySrc(originalSrc)
  img.dataset.previewSrc = displaySrc
  if (isImageEmoticonDisplaySrc(originalSrc, displaySrc)) {
    img.classList.add('v2ex-emoticon-image')
  }
  if (showImages) {
    img.src = proxyImgurImageSrc(displaySrc)
    return
  }

  img.removeAttribute('src')
  img.removeAttribute('srcset')
}

/**
 * 给图片元素绑定预览行为
 * @param img 图片元素
 * @param openImagePreview 打开图片预览
 */
function bindImagePreview(img: HTMLImageElement, openImagePreview: OpenImagePreview) {
  img.classList.add('image-preview-target')
  const isInsideLink = Boolean(img.closest('a'))
  if (!isInsideLink) {
    img.role = 'button'
    img.tabIndex = 0
    if (!img.getAttribute('aria-label')) {
      img.setAttribute('aria-label', img.alt ? `${img.alt}，查看大图` : '查看大图')
    }
  }
  bindImageOpen(img, {
    action: '查看大图',
    getSrc: () => getImagePreviewSrc(img),
    openImagePreview,
    canOpen: () => img.complete,
    keyboardAccessible: !isInsideLink
  })
}

/**
 * 创建隐藏图片后的占位按钮
 * @param img 图片元素
 * @param openImagePreview 打开图片预览
 */
function createHiddenImageButton(
  img: HTMLImageElement,
  openImagePreview: OpenImagePreview
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'hidden-image-button'
  button.innerHTML = `
    <svg class="hidden-image-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m5.5 17 4.5-4.5 3.25 3.25 2.25-2.25 3 3" />
    </svg>
    <span>查看图片</span>
  `
  bindImageOpen(button, {
    action: '查看图片',
    getSrc: () => getImagePreviewSrc(img),
    openImagePreview
  })
  return button
}

/**
 * 同步图片显示状态
 * @param img 图片元素
 * @param showImages 是否显示图片
 * @param openImagePreview 打开图片预览
 */
function syncImageVisibility(
  img: HTMLImageElement,
  showImages: boolean,
  openImagePreview: OpenImagePreview
) {
  const placeholderId =
    img.dataset.hiddenImagePlaceholderId || `hidden-image-${++hiddenImagePlaceholderCount}`
  img.dataset.hiddenImagePlaceholderId = placeholderId

  const parentAnchor = img.closest('a')
  const placeholderContainer = parentAnchor?.parentElement || img.parentElement
  const existingButton = placeholderContainer?.querySelector<HTMLButtonElement>(
    `.hidden-image-button[data-placeholder-id="${placeholderId}"]`
  )

  if (showImages) {
    img.hidden = false
    img.classList.remove('hidden-image-source')
    existingButton?.remove()
    return
  }

  img.hidden = true
  img.classList.add('hidden-image-source')

  if (existingButton) {
    return
  }

  const button = createHiddenImageButton(img, openImagePreview)
  button.dataset.placeholderId = placeholderId

  if (parentAnchor && parentAnchor.parentNode) {
    parentAnchor.insertAdjacentElement('afterend', button)
    return
  }

  img.insertAdjacentElement('afterend', button)
}

/**
 * 给图片链接绑定预览行为
 * @param anchor 链接元素
 * @param openImagePreview 打开图片预览
 */
function bindImageLinkPreview(anchor: HTMLAnchorElement, openImagePreview: OpenImagePreview) {
  if (anchor.dataset.imagePreviewBound === 'true') {
    return
  }

  const image = anchor.querySelector<HTMLImageElement>('img')
  const imageSrc = proxyImgurImageSrc(anchor.href)

  anchor.dataset.imagePreviewBound = 'true'
  anchor.classList.add('image-preview-target')
  bindImageOpen(anchor, {
    action: '查看大图',
    getSrc: () => (image ? getImagePreviewSrc(image) : imageSrc),
    openImagePreview
  })
}

/**
 * 给站内链接绑定扩展内跳转行为
 * @param anchor 链接元素
 */
function bindNavigationLink(anchor: HTMLAnchorElement) {
  if (anchor.dataset.navigationBound === 'true') {
    return
  }

  anchor.dataset.navigationBound = 'true'
  anchor.addEventListener('click', event => handleWebviewLinkClick(event))
}

/**
 * 在站内话题链接后添加预览按钮
 * @param anchor 话题链接元素
 * @param openTopicPreview 打开话题预览
 */
function appendTopicPreviewButton(anchor: HTMLAnchorElement, openTopicPreview: OpenTopicPreview) {
  const topicId = getV2exTopicId(anchor.href, document.baseURI)
  if (!topicId || anchor.dataset.topicPreviewBound === 'true') {
    return
  }

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'topic-preview-button'
  button.textContent = '预览'
  button.setAttribute('aria-label', `预览帖子：${anchor.textContent?.trim() || topicId}`)
  button.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    openTopicPreview(topicId)
  })

  anchor.dataset.topicPreviewBound = 'true'
  anchor.insertAdjacentElement('afterend', button)
}

/**
 * 按需加载语法高亮并处理代码块
 * @param root 根节点
 */
export async function enhanceCodeBlocks(root: ParentNode) {
  const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>('pre > code')).filter(
    code => !code.classList.contains('hljs')
  )

  if (!codeBlocks.length) {
    return
  }

  codeBlocks.forEach(code => {
    code.dataset.syntaxHighlightPending = 'true'
  })

  try {
    const { highlightCodeBlocks } = await import('./syntaxHighlighting')
    highlightCodeBlocks(codeBlocks)
  } catch {
    codeBlocks.forEach(code => {
      delete code.dataset.syntaxHighlightPending
    })
  }
}

/** 外部打开图标 */
const embeddedVideoExternalIcon =
  '<path d="M15 3h6v6"/><path d="m10 14 11-11"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'

/**
 * 创建嵌入视频操作按钮
 * @param label 按钮文案
 * @param onClick 点击处理器
 */
function createEmbeddedVideoButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'embedded-video-button'
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">${embeddedVideoExternalIcon}</svg>
    <span></span>
  `
  button.querySelector('span')!.textContent = label
  button.addEventListener('click', onClick)
  return button
}

/**
 * 将嵌入视频转换为外部打开占位
 * @param marker 嵌入视频标记
 */
function enhanceEmbeddedVideo(marker: HTMLElement) {
  const info = getEmbeddedVideoInfo(marker.dataset.embedSrc || '', document.baseURI)
  if (!info) {
    marker.remove()
    return
  }

  const card = document.createElement('div')
  card.className = 'embedded-video-card'

  const toolbar = document.createElement('div')
  toolbar.className = 'embedded-video-toolbar'
  const toolbarSource = document.createElement('span')
  toolbarSource.textContent = `内嵌视频 · 来源：${info.source}`
  const toolbarActions = document.createElement('div')
  toolbarActions.className = 'embedded-video-actions'
  toolbar.append(toolbarSource, toolbarActions)

  /** 在系统浏览器中打开视频 */
  const openVideoExternal = () => vscode.openExternal(info.externalUrl)

  toolbarActions.append(createEmbeddedVideoButton('浏览器中打开', openVideoExternal))

  marker.replaceWith(card)
  card.append(toolbar)
}

/**
 * 增强内容中的嵌入视频
 * @param root 根节点
 */
function enhanceEmbeddedVideos(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>('.embedded-video-marker[data-embed-src]')
    .forEach(enhanceEmbeddedVideo)
}

/**
 * 给内容区域挂载图片预览与站内跳转行为
 * @param root 根节点
 * @param showImages 是否显示图片
 * @param openImagePreview 打开图片预览
 */
export function enhanceHtmlContent(
  root: ParentNode,
  showImages: boolean,
  openImagePreview: OpenImagePreview,
  openTopicPreview?: OpenTopicPreview
) {
  const topicImages = root.querySelectorAll<HTMLImageElement>('img')
  const topicLinks = root.querySelectorAll<HTMLAnchorElement>('a')

  topicImages.forEach(img => {
    applyImageDisplaySrc(img, showImages)
    if (showImages) {
      detectCompactImageEmoticon(img)
    }
    bindImagePreview(img, openImagePreview)
    syncImageVisibility(img, showImages, openImagePreview)
  })

  topicLinks.forEach(anchor => {
    if (isSupportImageLink(anchor)) {
      bindImageLinkPreview(anchor, openImagePreview)
    }
    if (openTopicPreview) {
      appendTopicPreviewButton(anchor, openTopicPreview)
    }
  })

  topicLinks.forEach(bindNavigationLink)
  enhanceEmbeddedVideos(root)
  void enhanceCodeBlocks(root)
}
