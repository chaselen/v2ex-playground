/// <reference path="../global.d.ts" />
// @ts-check

const vscode = acquireVsCodeApi()

/**
 * 话题详情
 * @typedef {import('../src/type').TopicDetail} TopicDetail
 */

/**
 * 话题页面状态
 * @typedef {{
 *   status: 'loading' | 'topic' | 'error'
 *   topic?: TopicDetail
 *   message?: string
 *   showLogin?: boolean
 *   showRefresh?: boolean
 *   showImages?: boolean
 * }} TopicRenderState
 */

/** 支持直接预览的图片后缀 */
const SUPPORT_IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'])

/** 隐藏图片占位按钮 id 计数 */
let hiddenImagePlaceholderCount = 0

/**
 * 向扩展侧发送消息
 * @param {string} command 命令名
 * @param {Record<string, any>} messages 附加参数
 */
function vsPostMessage(command, messages) {
  vscode.postMessage({
    command,
    ...(messages || {})
  })
}

/**
 * 规范化 html 文本，避免插值时出现 undefined
 * @param {string | undefined | null} html 原始 html
 */
function normalizeHtml(html) {
  return html || ''
}

/**
 * 判断链接是否是可在扩展内打开的帖子地址
 * @param {HTMLAnchorElement} anchor 链接元素
 */
function extractTopicId(anchor) {
  const match = /\/t\/(\d+)/.exec(anchor.href)
  return match ? match[1] : ''
}

/**
 * 判断链接是否指向支持预览的图片
 * @param {string} urlText 链接地址
 * @returns {boolean}
 */
function isSupportImageUrl(urlText) {
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
 * @param {HTMLAnchorElement} anchor 链接元素
 * @returns {boolean}
 */
function isSupportImageLink(anchor) {
  return isSupportImageUrl(anchor.href)
}

/**
 * 判断是否使用修饰键打开原始链接
 * @param {MouseEvent} event 鼠标事件
 * @returns {boolean}
 */
function isOpenExternalClick(event) {
  return event.metaKey || event.ctrlKey || event.altKey
}

/**
 * 获取图片预览地址
 * @param {HTMLImageElement} img 图片元素
 * @returns {string}
 */
function getImagePreviewSrc(img) {
  return img.dataset.previewSrc || img.currentSrc || img.src
}

/**
 * 打开图片预览或原始链接
 * @param {string} src 图片地址
 * @param {MouseEvent} event 鼠标事件
 */
function openImage(src, event) {
  if (isOpenExternalClick(event)) {
    vsPostMessage('openExternal', { src })
    return
  }

  vsPostMessage('browseImage', { src })
}

/**
 * 转换 imgur 图片代理地址
 * @param {HTMLImageElement} img 图片元素
 */
function proxyImgurImage(img) {
  const originalSrc = img.dataset.previewSrc || img.currentSrc || img.src
  img.dataset.previewSrc = originalSrc

  if (img.src.startsWith('https://i.imgur.com/')) {
    img.src = 'https://img.noobzone.ru/getimg.php?url=' + encodeURIComponent(originalSrc)
  }
}

/**
 * 给图片元素绑定预览行为
 * @param {HTMLImageElement} img 图片元素
 */
function bindImagePreview(img) {
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
 * @param {HTMLImageElement} img 图片元素
 * @returns {HTMLButtonElement}
 */
function createHiddenImageButton(img) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'hidden-image-button'
  button.title = '点击查看图片，按住 Cmd/Ctrl/Alt 点击在浏览器中打开'
  button.innerHTML = '<span class="codicon codicon-file-media"></span><span>查看图片</span>'
  button.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    openImage(getImagePreviewSrc(img), event)
  })
  return button
}

/**
 * 同步图片显示状态
 * @param {HTMLImageElement} img 图片元素
 * @param {boolean} showImages 是否显示图片
 */
function syncImageVisibility(img, showImages) {
  const placeholderId =
    img.dataset.hiddenImagePlaceholderId || `hidden-image-${++hiddenImagePlaceholderCount}`
  img.dataset.hiddenImagePlaceholderId = placeholderId

  /** @type {HTMLButtonElement | null} */
  const existingButton = document.querySelector(
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
 * @param {HTMLAnchorElement} anchor 链接元素
 */
function bindImageLinkPreview(anchor) {
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
 * @param {HTMLAnchorElement} anchor 链接元素
 */
function bindTopicLink(anchor) {
  const topicId = extractTopicId(anchor)
  if (!topicId) {
    return
  }
  anchor.dataset.topicId = topicId
  anchor.href = 'javascript:;'
  anchor.onclick = () => {
    vsPostMessage('openTopic', {
      topicId
    })
    return false
  }
}

/**
 * 给内容区域挂载图片预览与站内跳转行为
 * @param {ParentNode} root 根节点
 * @param {boolean} showImages 是否显示图片
 */
function enhanceTopicContent(root, showImages) {
  /** @type {NodeListOf<HTMLImageElement>} */
  const topicImages = root.querySelectorAll('.topic-content img')

  /** @type {NodeListOf<HTMLAnchorElement>} */
  const topicLinks = root.querySelectorAll('.topic-content a')

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
}

/**
 * 话题页面应用
 */
Vue.createApp({
  data() {
    return {
      state: {
        status: 'loading',
        topic: undefined,
        message: '',
        showLogin: false,
        showRefresh: false,
        showImages: true
      }
    }
  },
  computed: {
    /**
     * 当前话题
     * @returns {TopicDetail | undefined}
     */
    topic() {
      return this.state.topic
    }
  },
  watch: {
    /**
     * 话题数据变化后重新增强内容区域行为
     * @param {TopicDetail | undefined} topic 当前话题
     */
    topic(topic) {
      if (!topic) {
        return
      }
      this.applyContentEnhancements()
    },

    /**
     * 图片显示配置变化后同步内容区域
     */
    'state.showImages'() {
      this.applyContentEnhancements()
    }
  },
  mounted() {
    window.addEventListener('message', this.onMessage)
    this.applyContentEnhancements()
  },
  methods: {
    vsPostMessage,
    normalizeHtml,

    /**
     * 更新内容区域的增强行为
     */
    applyContentEnhancements() {
      this.$nextTick(() => {
        enhanceTopicContent(document, this.state.showImages)
      })
    },

    /**
     * 提交回复
     */
    onSubmit() {
      /** @type {HTMLTextAreaElement | null} */
      const replyBox = document.querySelector('#replyBox')
      const content = (replyBox && replyBox.value ? replyBox.value : '').trim()
      vsPostMessage('postReply', {
        content
      })
    },

    /**
     * 感谢回复者
     * @param {string} replyId 回复 id
     */
    thankReply(replyId) {
      vsPostMessage('thankReply', {
        replyId
      })
    },

    /**
     * 快捷回复楼层
     * @param {string} replyAuthor 回复作者
     * @param {string} replyFloor 楼层
     */
    floorReply(replyAuthor, replyFloor) {
      /** @type {HTMLTextAreaElement | null} */
      const replyBox = document.querySelector('#replyBox')
      if (!replyBox) {
        return
      }
      replyBox.value = '@' + replyAuthor + ' #' + replyFloor + ' '
      replyBox.focus()
    },

    /**
     * 处理扩展侧发送的视图状态
     * @param {MessageEvent<{ command?: string; state?: TopicRenderState }>} event 消息事件
     */
    onMessage(event) {
      if (event.data.command !== 'renderState' || !event.data.state) {
        return
      }

      this.state.topic = event.data.state.topic
      this.state.message = event.data.state.message || ''
      this.state.showLogin = Boolean(event.data.state.showLogin)
      this.state.showRefresh = Boolean(event.data.state.showRefresh)
      this.state.showImages = event.data.state.showImages !== false
      this.state.status = event.data.state.status
    }
  }
}).mount('#app')
