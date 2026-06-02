import { useEffect, useState } from 'react'
import { Tabs } from '@douyinfe/semi-ui'
import NodeTree from './NodeTree'
import { postVsCodeMessage, requestVsCodeMessage } from '../shared/vscode'
import {
  EXPLORE_NODES,
  type InitData,
  type WebviewNode,
  type WebviewTopic
} from '../../../src/shared/webview'
import type { MainTabKey, MainTabs, NodeItem } from './types'

/** 主面板标签 key */
const tabKeys: MainTabKey[] = ['explore', 'custom', 'collection']

/**
 * 创建带前端状态的节点项
 * @param node 原始节点
 */
function createNodeItem(node: WebviewNode): NodeItem {
  return {
    ...node,
    loading: false,
    children: null,
    error: null
  }
}

/**
 * 合并节点数据并保留已加载状态
 * @param nodes 最新节点
 * @param existing 已有节点
 */
function mergeNodeItems(nodes: WebviewNode[], existing: NodeItem[]): NodeItem[] {
  return nodes.map(node => {
    const old = existing.find(item => item.id === node.id)
    return old ? { ...old, ...node } : createNodeItem(node)
  })
}

/**
 * 补齐话题列表默认字段
 * @param topics 话题列表
 */
function normalizeTopics(topics: WebviewTopic[]): WebviewTopic[] {
  return topics.map(topic => ({
    ...topic,
    replies: topic.replies || 0
  }))
}

/**
 * 判断消息是否为初始化数据
 * @param msg 扩展侧消息
 */
function isInitDataMessage(msg: unknown): msg is InitData & { command: 'initData' } {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'command' in msg &&
    msg.command === 'initData' &&
    'tabs' in msg &&
    'loggedIn' in msg
  )
}

/**
 * 主面板应用
 */
export default function MainApp() {
  const [activeTab, setActiveTab] = useState<MainTabKey>('explore')
  const [loggedIn, setLoggedIn] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [tabs, setTabs] = useState<MainTabs>({
    explore: EXPLORE_NODES.map(createNodeItem),
    custom: [],
    collection: []
  })

  /**
   * 更新单个节点
   * @param tab 标签 key
   * @param nodeId 节点 id
   * @param updater 节点更新函数
   */
  function updateNode(tab: MainTabKey, nodeId: string, updater: (node: NodeItem) => NodeItem) {
    setTabs(current => ({
      ...current,
      [tab]: current[tab].map(node => (node.id === nodeId ? updater(node) : node))
    }))
  }

  /**
   * 标记节点加载中
   * @param tab 标签 key
   * @param nodeId 节点 id
   */
  function setNodeLoading(tab: MainTabKey, nodeId: string) {
    updateNode(tab, nodeId, node => ({ ...node, loading: true }))
  }

  /**
   * 展开节点
   * @param tab 标签 key
   * @param nodeId 节点 id
   */
  async function expandNode(tab: MainTabKey, nodeId: string) {
    setNodeLoading(tab, nodeId)
    await requestNodeChildren('expandNode', tab, nodeId)
  }

  /**
   * 刷新节点
   * @param tab 标签 key
   * @param nodeId 节点 id
   */
  async function refreshNode(tab: MainTabKey, nodeId: string) {
    setNodeLoading(tab, nodeId)
    await requestNodeChildren('refreshNode', tab, nodeId)
  }

  /**
   * 删除自定义节点
   * @param nodeId 节点 id
   */
  async function removeNode(nodeId: string) {
    try {
      const data = await requestVsCodeMessage('removeNode', { nodeId })
      onCustomNodesUpdated(data)
    } catch (err) {
      console.error(err)
    }
  }

  /**
   * 添加自定义节点
   */
  async function addNode() {
    try {
      const data = await requestVsCodeMessage('addNode')
      onCustomNodesUpdated(data)
    } catch (err) {
      console.error(err)
    }
  }

  /**
   * 处理初始化数据
   * @param data 初始化数据
   */
  function onInitData(data: InitData) {
    setLoggedIn(data.loggedIn)
    setInitializing(false)
    setTabs(current => ({
      explore: mergeNodeItems(data.tabs.explore, current.explore),
      custom: mergeNodeItems(data.tabs.custom, current.custom),
      collection: mergeNodeItems(data.tabs.collection, current.collection)
    }))
  }

  /**
   * 处理节点话题列表
   * @param data 节点子项数据
   */
  function onNodeChildren(data: {
    tab: MainTabKey
    nodeId: string
    children: WebviewTopic[]
    error?: string
  }) {
    updateNode(data.tab, data.nodeId, node => {
      if (data.error) {
        return {
          ...node,
          loading: false,
          error: data.error,
          children: []
        }
      }

      return {
        ...node,
        loading: false,
        error: null,
        children: normalizeTopics(data.children || [])
      }
    })
  }

  /**
   * 请求节点话题列表
   * @param command 命令名
   * @param tab 标签 key
   * @param nodeId 节点 id
   */
  async function requestNodeChildren(
    command: 'expandNode' | 'refreshNode',
    tab: MainTabKey,
    nodeId: string
  ) {
    try {
      const data = await requestVsCodeMessage(command, { tab, nodeId })
      onNodeChildren(data)
    } catch (err) {
      onNodeChildren({
        tab,
        nodeId,
        children: [],
        error: (err as Error).message
      })
    }
  }

  /**
   * 处理自定义节点更新
   * @param data 自定义节点数据
   */
  function onCustomNodesUpdated(data: { nodes: WebviewNode[] }) {
    setTabs(current => ({
      ...current,
      custom: mergeNodeItems(data.nodes, current.custom)
    }))
  }

  /**
   * 刷新已加载过的节点
   */
  function refreshLoadedNodes() {
    setTabs(current => {
      const nextTabs: MainTabs = {
        explore: current.explore.map(node => ({ ...node })),
        custom: current.custom.map(node => ({ ...node })),
        collection: current.collection.map(node => ({ ...node }))
      }

      tabKeys.forEach(tab => {
        nextTabs[tab] = nextTabs[tab].map(node => {
          if (node.children === null || node.loading) {
            return node
          }
          requestNodeChildren('refreshNode', tab, node.id)
          return { ...node, loading: true }
        })
      })

      return nextTabs
    })
  }

  useEffect(() => {
    /**
     * 处理扩展侧消息
     * @param event 消息事件
     */
    function onMessage(event: MessageEvent) {
      const msg = event.data
      if (isInitDataMessage(msg)) {
        onInitData(msg)
        return
      }

      if (msg.command === 'refreshLoadedNodes') {
        refreshLoadedNodes()
      }
    }

    window.addEventListener('message', onMessage)
    requestVsCodeMessage('ready')
      .then(onInitData)
      .catch(err => {
        setInitializing(false)
        console.error(err)
      })

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [])

  return (
    <main className="main-container" onContextMenu={event => event.preventDefault()}>
      <Tabs
        activeKey={activeTab}
        tabPosition="top"
        type="line"
        size="medium"
        className="main-tabs"
        contentStyle={{ height: '100%', minHeight: 0, overflow: 'hidden' }}
        tabPaneMotion={false}
        onChange={value => setActiveTab(value as MainTabKey)}
      >
        <Tabs.TabPane itemKey="explore" tab="首页">
          <NodeTree
            tab="explore"
            nodes={tabs.explore}
            loggedIn={loggedIn}
            onExpandNode={expandNode}
            onRefreshNode={refreshNode}
            onRemoveNode={removeNode}
          />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="custom" tab="自定义">
          <NodeTree
            tab="custom"
            nodes={tabs.custom}
            loggedIn={loggedIn}
            onAddNode={addNode}
            onExpandNode={expandNode}
            onRefreshNode={refreshNode}
            onRemoveNode={removeNode}
          />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="collection" tab="收藏节点">
          <NodeTree
            tab="collection"
            nodes={tabs.collection}
            loggedIn={loggedIn}
            loading={initializing}
            onExpandNode={expandNode}
            onRefreshNode={refreshNode}
            onRemoveNode={removeNode}
          />
        </Tabs.TabPane>
      </Tabs>
    </main>
  )
}
