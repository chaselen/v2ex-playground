import type { WebviewContentRpcCommands } from '@extension/shared/webview'
import { handleWebviewLinkClick } from './linkNavigation'
import { createVsCodeClient, resolveWebviewUrl } from './vscode'
import { isImageEmoticonSrc, normalizeImageEmoticonSrc } from './imageEmoticons'

/** 内容增强功能使用的 VS Code 通信客户端 */
const vscode = createVsCodeClient<WebviewContentRpcCommands>()

/** 支持直接预览的图片后缀 */
const SUPPORT_IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'])

/** 隐藏图片占位按钮 id 计数 */
let hiddenImagePlaceholderCount = 0

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
 */
export function normalizeHtml(html?: unknown): string {
  const normalizedHtml = typeof html === 'string' ? html : ''

  if (!normalizedHtml.includes('i.imgur.com')) {
    return normalizedHtml
  }

  const template = document.createElement('template')
  template.innerHTML = normalizedHtml

  template.content.querySelectorAll<HTMLImageElement>('img').forEach(img => {
    const originalSrc = img.getAttribute('data-preview-src') || img.getAttribute('src') || ''
    if (!originalSrc) {
      return
    }

    // 图片表情提交使用 LD 地址，渲染时统一切回 HD 地址
    const displaySrc = getImageDisplaySrc(originalSrc)
    const proxiedSrc = proxyImgurImageSrc(displaySrc)
    if (isImageEmoticonDisplaySrc(originalSrc, displaySrc)) {
      img.classList.add('v2ex-emoticon-image')
    }

    if (proxiedSrc === originalSrc) {
      return
    }

    // DOM 中展示代理地址，同时保留规范化后的真实图片地址
    img.dataset.previewSrc = displaySrc
    img.src = proxiedSrc
  })

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
 * @param event 鼠标事件
 */
function isOpenExternalClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey
}

/**
 * 获取图片预览地址
 * @param img 图片元素
 */
function getImagePreviewSrc(img: HTMLImageElement): string {
  return img.currentSrc || img.src || img.dataset.previewSrc || ''
}

/**
 * 打开图片预览或原始链接
 * @param src 图片地址
 * @param event 鼠标事件
 */
function openImage(src: string, event: MouseEvent) {
  if (isOpenExternalClick(event)) {
    vscode.openExternal({ path: resolveWebviewUrl(src) })
    return
  }

  vscode.browseImage({ src })
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
function applyImageDisplaySrc(img: HTMLImageElement) {
  const originalSrc = img.dataset.previewSrc || img.currentSrc || img.src
  const displaySrc = getImageDisplaySrc(originalSrc)
  img.dataset.previewSrc = displaySrc
  if (isImageEmoticonDisplaySrc(originalSrc, displaySrc)) {
    img.classList.add('v2ex-emoticon-image')
  }
  img.src = proxyImgurImageSrc(displaySrc)
}

/**
 * 给图片元素绑定预览行为
 * @param img 图片元素
 */
function bindImagePreview(img: HTMLImageElement) {
  img.classList.add('image-preview-target')
  img.title = '点击查看大图，按住 Cmd/Ctrl/Alt 点击在浏览器中打开'
  img.onclick = event => {
    event.preventDefault()
    event.stopPropagation()

    if (!img.complete) {
      return
    }
    openImage(getImagePreviewSrc(img), event)
  }
}

/**
 * 创建隐藏图片后的占位按钮
 * @param img 图片元素
 */
function createHiddenImageButton(img: HTMLImageElement): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'hidden-image-button'
  button.title = '点击查看图片，按住 Cmd/Ctrl/Alt 点击在浏览器中打开'
  button.innerHTML = `
    <svg class="hidden-image-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m5.5 17 4.5-4.5 3.25 3.25 2.25-2.25 3 3" />
    </svg>
    <span>查看图片</span>
  `
  button.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    openImage(getImagePreviewSrc(img), event)
  })
  return button
}

/**
 * 同步图片显示状态
 * @param img 图片元素
 * @param showImages 是否显示图片
 */
function syncImageVisibility(img: HTMLImageElement, showImages: boolean) {
  const placeholderId =
    img.dataset.hiddenImagePlaceholderId || `hidden-image-${++hiddenImagePlaceholderCount}`
  img.dataset.hiddenImagePlaceholderId = placeholderId

  const existingButton = document.querySelector<HTMLButtonElement>(
    `.hidden-image-button[data-placeholder-id="${placeholderId}"]`
  )

  if (showImages) {
    img.hidden = false
    existingButton?.remove()
    return
  }

  img.hidden = true

  if (existingButton) {
    return
  }

  const button = createHiddenImageButton(img)
  button.dataset.placeholderId = placeholderId

  const parentAnchor = img.closest('a')
  if (parentAnchor && parentAnchor.parentNode) {
    parentAnchor.insertAdjacentElement('afterend', button)
    return
  }

  img.insertAdjacentElement('afterend', button)
}

/**
 * 给图片链接绑定预览行为
 * @param anchor 链接元素
 */
function bindImageLinkPreview(anchor: HTMLAnchorElement) {
  if (anchor.dataset.imagePreviewBound === 'true') {
    return
  }

  const imageSrc = proxyImgurImageSrc(anchor.href)

  if (anchor.childNodes[0] && anchor.childNodes[0].nodeName === 'IMG') {
    return
  }

  anchor.dataset.imagePreviewBound = 'true'
  anchor.classList.add('image-preview-target')
  anchor.title = '点击查看大图，按住 Cmd/Ctrl/Alt 点击在浏览器中打开'
  anchor.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    openImage(imageSrc, event)
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
 * 给内容区域挂载图片预览与站内跳转行为
 * @param root 根节点
 * @param showImages 是否显示图片
 */
export function enhanceHtmlContent(root: ParentNode, showImages: boolean) {
  const topicImages = root.querySelectorAll<HTMLImageElement>('.topic-content img')
  const topicLinks = root.querySelectorAll<HTMLAnchorElement>('.topic-content a')

  topicImages.forEach(img => {
    applyImageDisplaySrc(img)
    bindImagePreview(img)
    syncImageVisibility(img, showImages)
  })

  topicLinks.forEach(anchor => {
    if (isSupportImageLink(anchor)) {
      bindImageLinkPreview(anchor)
    }
  })

  topicLinks.forEach(bindNavigationLink)
}

/**
 * 等待 DOM 更新后增强帖子内容
 * @param showImages 是否显示图片
 */
export function enhanceHtmlContentAfterRender(showImages: boolean) {
  requestAnimationFrame(() => {
    enhanceHtmlContent(document, showImages)
  })
}
