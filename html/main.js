/// <reference path="../global.d.ts" />
// @ts-check

const vscode = acquireVsCodeApi()

/**
 * @typedef {import('../src/providers/MainViewProvider').WebviewNode} WebviewNode
 * @typedef {import('../src/providers/MainViewProvider').WebviewTopic} WebviewTopic
 */

/**
 * @typedef {WebviewNode & { loading: boolean, children: WebviewTopic[] | null, error: string | null }} NodeItem
 */

const { createApp } = Vue

/**
 * @typedef {'explore' | 'custom' | 'collection'} MainTabKey
 */

/**
 * @typedef {{ explore: NodeItem[], custom: NodeItem[], collection: NodeItem[] }} MainTabs
 */

/**
 * @typedef {'copyLink' | 'copyTitleLink' | 'viewInBrowser'} ContextMenuAction
 */

/** 主面板空状态文案 */
const TAB_EMPTY_TEXT = {
  explore: '暂无数据',
  custom: '还没有添加自定义节点',
  collection: '还没有收藏的节点'
}

/** @type {MainTabKey[]} */
const TAB_KEYS = /** @type {MainTabKey[]} */ (Object.keys(TAB_EMPTY_TEXT))

/** 右键菜单命令映射 */
const CONTEXT_MENU_COMMANDS = {
  copyLink: 'ctxCopyLink',
  copyTitleLink: 'ctxCopyTitleLink',
  viewInBrowser: 'ctxViewInBrowser'
}

/**
 * 创建带前端状态的节点项
 * @param {WebviewNode} node 原始节点
 * @returns {NodeItem}
 */
function createNodeItem(node) {
  return {
    ...node,
    loading: false,
    children: null,
    error: null
  }
}

/**
 * 合并节点数据并保留已加载状态
 * @param {WebviewNode[]} nodes 最新节点
 * @param {NodeItem[]} existing 已有节点
 * @returns {NodeItem[]}
 */
function mergeNodeItems(nodes, existing) {
  return nodes.map(node => {
    const old = existing.find(item => item.id === node.id)
    return old ? { ...old, ...node } : createNodeItem(node)
  })
}

/**
 * 补齐话题列表默认字段
 * @param {WebviewTopic[]} topics 话题列表
 * @returns {WebviewTopic[]}
 */
function normalizeTopics(topics) {
  return topics.map(topic => ({
    ...topic,
    replies: topic.replies || 0
  }))
}

/**
 * 判断节点点击是否来自操作按钮或子项
 * @param {Event} event 点击事件
 * @returns {boolean}
 */
function isIgnoredNodeClick(event) {
  const path = event.composedPath()
  for (const el of path) {
    if (el instanceof Element && el.getAttribute?.('slot') === 'actions') return true
    if (el instanceof Element && el.matches?.('vscode-tree-item') && el !== event.currentTarget) {
      return true
    }
  }
  return false
}

/**
 * 创建主面板 Vue 应用
 */
function createMainApp() {
  const app = createApp({
    data() {
      return {
        /** @type {number} */
        selectedIndex: 0,
        /** @type {MainTabs} */
        tabs: {
          explore: [],
          custom: [],
          collection: []
        },
        loggedIn: false,
        /** @type {{ show: boolean, x: number, y: number, topic: WebviewTopic | null, items: Array<{ label: string, value: ContextMenuAction }> }} */
        ctxMenu: { show: false, x: 0, y: 0, topic: null, items: [] }
      }
    },

    created() {
      window.addEventListener('message', this.onMessage)
    },

    mounted() {
      vscode.postMessage({ command: 'ready' })
    },

    methods: {
      /**
       * @param {MessageEvent} event
       */
      onMessage(event) {
        const msg = event.data
        switch (msg.command) {
          case 'initData':
            this.onInitData(msg)
            break
          case 'nodeChildren':
            this.onNodeChildren(msg)
            break
          case 'customNodesUpdated':
            this.onCustomNodesUpdated(msg)
            break
          default:
            break
        }
      },

      /**
       * @param {{ tabs: { explore: WebviewNode[], custom: WebviewNode[], collection: WebviewNode[] }, loggedIn: boolean }} data
       */
      onInitData(data) {
        this.loggedIn = data.loggedIn
        /* 合并节点数据，保留已有的展开/加载/子话题状态 */
        TAB_KEYS.forEach(key => {
          const existing = /** @type {NodeItem[]} */ (this.tabs[key]) || []
          this.tabs[key] = mergeNodeItems(data.tabs[key], existing)
        })
      },

      /**
       * @param {{ tab: string, nodeId: string, children: WebviewTopic[], error?: string }} data
       */
      onNodeChildren(data) {
        const node = this.findNode(data.tab, data.nodeId)
        if (!node) return
        node.loading = false
        if (data.error) {
          node.error = data.error
          node.children = []
        } else {
          node.error = null
          node.children = normalizeTopics(data.children || [])
        }
      },

      /**
       * @param {{ nodes: WebviewNode[] }} data
       */
      onCustomNodesUpdated(data) {
        const existing = /** @type {NodeItem[]} */ (this.tabs.custom) || []
        this.tabs.custom = mergeNodeItems(data.nodes, existing)
      },

      /**
       * 获取空状态文案
       * @param {MainTabKey} tab 标签 key
       * @returns {string}
       */
      getEmptyText(tab) {
        return TAB_EMPTY_TEXT[tab] || ''
      },

      /**
       * @param {MainTabKey} tab
       * @param {string} nodeId
       * @returns {NodeItem | undefined}
       */
      findNode(tab, nodeId) {
        return /** @type {NodeItem[]} */ (this.tabs[tab]).find(n => n.id === nodeId)
      },

      /**
       * @param {MainTabKey} tab
       * @param {NodeItem} node
       * @param {Event} event
       */
      onNodeClick(tab, node, event) {
        if (isIgnoredNodeClick(event)) return
        if (node.loading) return
        if (node.children === null) {
          node.loading = true
          vscode.postMessage({ command: 'expandNode', tab, nodeId: node.id })
        }
      },

      /**
       * @param {WebviewTopic} topic
       */
      openTopic(topic) {
        vscode.postMessage({ command: 'openTopic', topicId: topic.id, title: topic.title })
      },

      /**
       * @param {WebviewTopic} topic
       * @param {PointerEvent} event
       */
      onContextMenu(topic, event) {
        event.preventDefault()
        event.stopPropagation()
        this.ctxMenu = {
          show: true,
          x: event.clientX,
          y: event.clientY,
          topic,
          items: [
            { label: '复制链接', value: 'copyLink' },
            { label: '复制标题和链接', value: 'copyTitleLink' },
            { label: '在浏览器中打开', value: 'viewInBrowser' }
          ]
        }
      },

      /**
       * @param {CustomEvent<{ value: ContextMenuAction }>} event
       */
      onContextMenuSelect(event) {
        const topic = this.ctxMenu.topic
        if (!topic) return
        const command = CONTEXT_MENU_COMMANDS[event.detail.value]
        vscode.postMessage({ command, topicId: topic.id, label: topic.title })
        this.ctxMenu.show = false
      },

      closeContextMenu() {
        this.ctxMenu.show = false
      },

      /**
       * @param {Event} event
       */
      onTabChange(event) {
        this.selectedIndex = /** @type {any} */ (event.target).selectedIndex
      },

      addNode() {
        vscode.postMessage({ command: 'addNode' })
      },

      /**
       * @param {NodeItem} node
       */
      removeNode(node) {
        vscode.postMessage({ command: 'removeNode', nodeId: node.id })
      },

      /**
       * @param {MainTabKey} tab
       * @param {NodeItem} node
       */
      refreshNode(tab, node) {
        node.children = null
        node.loading = true
        vscode.postMessage({ command: 'refreshNode', tab, nodeId: node.id })
      },

      login() {
        vscode.postMessage({ command: 'login' })
      }
    }
  })

  /* 将 vscode- 前缀的元素视为原生 Web Component，保留 slot 属性 */
  app.config.compilerOptions = {
    isCustomElement: (/** @type {string} */ tag) => tag.startsWith('vscode-')
  }

  app.mount('#app')
}

createMainApp()

export {}
