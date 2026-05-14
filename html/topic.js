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
 * }} TopicRenderState
 */

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
 * 给内容区域挂载图片预览与站内跳转行为
 * @param {ParentNode} root 根节点
 */
function enhanceTopicContent(root) {
  // imgur 图片代理
  /** @type {NodeListOf<HTMLImageElement>} */
  const topicImages = root.querySelectorAll('.topic-content img')

  /** @type {NodeListOf<HTMLAnchorElement>} */
  const topicLinks = root.querySelectorAll('.topic-content a')

  topicImages.forEach(img => {
    if (img.src.startsWith('https://i.imgur.com/')) {
      img.src = 'https://img.noobzone.ru/getimg.php?url=' + encodeURIComponent(img.src)
    }
  })

  // 给图片添加查看图片功能
  topicImages.forEach(img => {
    img.style.cursor = 'zoom-in'
    img.onclick = () => {
      if (!img.complete) {
        return
      }
      vsPostMessage('browseImage', {
        src: img.src
      })
    }
  })

  // 图片地址的 a 标签，点击打开图片
  const supportImageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
  supportImageTypes.forEach(type => {
    topicLinks.forEach(anchor => {
      if (!anchor.matches(`.topic-content a[href$=".${type}"]`)) {
        return
      }
      const imageSrc = anchor.href
      anchor.href = 'javascript:;'
      anchor.onclick = () => false

      if (anchor.childNodes[0] && anchor.childNodes[0].nodeName === 'IMG') {
        return
      }

      anchor.addEventListener('click', () => {
        vsPostMessage('browseImage', {
          src: imageSrc
        })
      })
    })
  })

  // 指向站内帖子的链接在扩展内打开
  topicLinks.forEach(anchor => {
    if (!anchor.matches('.topic-content a[href*="/t/"]')) {
      return
    }
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
  })
}

/**
 * 话题页面应用
 */
Vue.createApp({
  template: '#topic-template',
  data() {
    return {
      state: {
        status: 'loading',
        topic: undefined,
        message: '',
        showLogin: false,
        showRefresh: false
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
        enhanceTopicContent(document)
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
      this.state.status = event.data.state.status
    }
  }
}).mount('#app')
