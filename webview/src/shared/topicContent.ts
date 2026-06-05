import { postVsCodeMessage } from './vscode'

/** 支持直接预览的图片后缀 */
const SUPPORT_IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'])

/** 隐藏图片占位按钮 id 计数 */
let hiddenImagePlaceholderCount = 0

/**
 * 规范化 html 文本，避免插值时出现 undefined
 * @param html 原始 html
 */
export function normalizeHtml(html?: string | null): string {
  return html || ''
}

/**
 * 判断链接是否是可在扩展内打开的帖子地址
 * @param anchor 链接元素
 */
function extractTopicId(anchor: HTMLAnchorElement): string {
  const match = /\/t\/(\d+)/.exec(anchor.href)
  return match ? match[1] : ''
}

/**
 * 从链接中提取用户名
 * @param anchor 链接元素
 */
function extractMemberUsername(anchor: HTMLAnchorElement): string {
  const match = /\/member\/([A-Za-z0-9_-]+)/.exec(anchor.href)
  return match ? decodeURIComponent(match[1]) : ''
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
    postVsCodeMessage('openExternal', { src })
    return
  }

  postVsCodeMessage('browseImage', { src })
}

/**
 * 转换 imgur 图片代理地址
 * @param img 图片元素
 */
function proxyImgurImage(img: HTMLImageElement) {
  const originalSrc = img.dataset.previewSrc || img.currentSrc || img.src
  img.dataset.previewSrc = originalSrc

  if (img.src.startsWith('https://i.imgur.com/')) {
    img.src = 'https://img.noobzone.ru/getimg.php?url=' + encodeURIComponent(originalSrc)
  }
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
  button.innerHTML = '<span class="hidden-image-icon">▧</span><span>查看图片</span>'
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

  const imageSrc = anchor.href

  if (anchor.childNodes[0] && anchor.childNodes[0].nodeName === 'IMG') {
    return
  }

  anchor.dataset.imagePreviewBound = 'true'
  anchor.classList.add('image-preview-target')
  anchor.title = '点击查看大图，按住 Cmd/Ctrl/Alt 点击在浏览器中打开'
  anchor.addEventListener('click', event => {
    event.preventDefault()
    openImage(imageSrc, event)
  })
}

/**
 * 给站内帖子链接绑定扩展内跳转行为
 * @param anchor 链接元素
 */
function bindTopicLink(anchor: HTMLAnchorElement) {
  const topicId = extractTopicId(anchor)
  if (!topicId) {
    return
  }
  anchor.dataset.topicId = topicId
  anchor.href = 'javascript:;'
  anchor.onclick = () => {
    postVsCodeMessage('openTopic', {
      topicId
    })
    return false
  }
}

/**
 * 给站内用户链接绑定扩展内跳转行为
 * @param anchor 链接元素
 */
function bindMemberLink(anchor: HTMLAnchorElement) {
  const username = extractMemberUsername(anchor)
  if (!username) {
    return
  }
  anchor.dataset.memberUsername = username
  anchor.href = 'javascript:;'
  anchor.onclick = () => {
    postVsCodeMessage('openMember', {
      username
    })
    return false
  }
}

/**
 * 给用户内容 HTML 中的站内链接增加数据标记
 * @param html 原始 HTML
 */
export function normalizeMemberContentLinks(html?: string | null): string {
  return normalizeHtml(html)
    .replace(/href="\/t\/(\d+)([^"]*)"/g, 'href="javascript:;" data-topic-id="$1"')
    .replace(
      /href="\/member\/([A-Za-z0-9_-]+)"/g,
      (_, username: string) =>
        `href="javascript:;" data-member-username="${decodeURIComponent(username)}"`
    )
}

/**
 * 给内容区域挂载图片预览与站内跳转行为
 * @param root 根节点
 * @param showImages 是否显示图片
 */
export function enhanceTopicContent(root: ParentNode, showImages: boolean) {
  const topicImages = root.querySelectorAll<HTMLImageElement>('.topic-content img')
  const topicLinks = root.querySelectorAll<HTMLAnchorElement>('.topic-content a')

  topicImages.forEach(img => {
    proxyImgurImage(img)
    bindImagePreview(img)
    syncImageVisibility(img, showImages)
  })

  topicLinks.forEach(anchor => {
    if (isSupportImageLink(anchor)) {
      bindImageLinkPreview(anchor)
    }
  })

  topicLinks.forEach(anchor => {
    if (!anchor.matches('.topic-content a[href*="/t/"]')) {
      return
    }
    bindTopicLink(anchor)
  })

  topicLinks.forEach(anchor => {
    if (!anchor.matches('.topic-content a[href*="/member/"]')) {
      return
    }
    bindMemberLink(anchor)
  })
}

/**
 * 等待 DOM 更新后增强帖子内容
 * @param showImages 是否显示图片
 */
export function enhanceTopicContentAfterRender(showImages: boolean) {
  requestAnimationFrame(() => {
    enhanceTopicContent(document, showImages)
  })
}
