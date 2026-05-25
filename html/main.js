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

const TAB_KEYS = ['explore', 'custom', 'collection']

function createMainApp() {
  const app = createApp({
    data() {
      return {
        /** @type {number} */
        selectedIndex: 0,
        /** @type {{ explore: NodeItem[], custom: NodeItem[], collection: NodeItem[] }} */
        tabs: {
          explore: [],
          custom: [],
          collection: []
        },
        loggedIn: false,
        /** @type {{ show: boolean, x: number, y: number, topic: WebviewTopic | null, items: Array<{ label: string, value: string }> }} */
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
        const toNodeItem = (/** @type {WebviewNode} */ n) => ({
          ...n,
          loading: false,
          children: null,
          error: null
        })
        /* 合并节点数据，保留已有的展开/加载/子话题状态 */
        ;['explore', 'custom', 'collection'].forEach(key => {
          const existing = /** @type {NodeItem[]} */ (this.tabs[key]) || []
          // @ts-ignore
          this.tabs[key] = data.tabs[key].map(n => {
            const old = existing.find(e => e.id === n.id)
            return old ? { ...old, ...n } : toNodeItem(n)
          })
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
          node.children = (data.children || []).map(t => ({
            ...t,
            replies: t.replies || 0
          }))
        }
      },

      /**
       * @param {{ nodes: WebviewNode[] }} data
       */
      onCustomNodesUpdated(data) {
        const existing = /** @type {NodeItem[]} */ (this.tabs.custom) || []
        this.tabs.custom = data.nodes.map(n => {
          const old = existing.find(e => e.id === n.id)
          return old ? { ...old, ...n } : { ...n, loading: false, children: null, error: null }
        })
      },

      /**
       * @param {string} tab
       * @param {string} nodeId
       * @returns {NodeItem | undefined}
       */
      findNode(tab, nodeId) {
        return /** @type {NodeItem[]} */ (this.tabs[tab]).find(n => n.id === nodeId)
      },

      /**
       * @param {string} tab
       * @param {NodeItem} node
       * @param {Event} event
       */
      onNodeClick(tab, node, event) {
        /* 通过 composedPath 判断点击来源：忽略操作按钮和子 tree-item */
        const path = event.composedPath()
        for (const el of path) {
          if (el instanceof Element && el.getAttribute?.('slot') === 'actions') return
          if (
            el instanceof Element &&
            el.matches?.('vscode-tree-item') &&
            el !== event.currentTarget
          )
            return
        }
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
       * @param {CustomEvent} event
       */
      onContextMenuSelect(event) {
        const topic = this.ctxMenu.topic
        if (!topic) return
        const value = event.detail?.value
        if (value === 'copyLink') {
          vscode.postMessage({ command: 'ctxCopyLink', topicId: topic.id, label: topic.title })
        } else if (value === 'copyTitleLink') {
          vscode.postMessage({ command: 'ctxCopyTitleLink', topicId: topic.id, label: topic.title })
        } else if (value === 'viewInBrowser') {
          vscode.postMessage({ command: 'ctxViewInBrowser', topicId: topic.id, label: topic.title })
        }
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
       * @param {string} tab
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

  // 将 vscode- 前缀的元素视为原生 Web Component，保留 slot 属性
  app.config.compilerOptions = {
    isCustomElement: (/** @type {string} */ tag) => tag.startsWith('vscode-')
  }

  app.mount('#app')
}

createMainApp()

export {}
