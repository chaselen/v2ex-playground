import { useEffect, useState } from 'react'
import { Tabs } from '@douyinfe/semi-ui'
import NodeTree from './NodeTree'
import { postVsCodeMessage } from '../shared/vscode'
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
 * 主面板应用
 */
export default function MainApp() {
  const [activeTab, setActiveTab] = useState<MainTabKey>('explore')
  const [loggedIn, setLoggedIn] = useState(false)
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
  function expandNode(tab: MainTabKey, nodeId: string) {
    setNodeLoading(tab, nodeId)
    postVsCodeMessage('expandNode', { tab, nodeId })
  }

  /**
   * 刷新节点
   * @param tab 标签 key
   * @param nodeId 节点 id
   */
  function refreshNode(tab: MainTabKey, nodeId: string) {
    setNodeLoading(tab, nodeId)
    postVsCodeMessage('refreshNode', { tab, nodeId })
  }

  /**
   * 删除自定义节点
   * @param nodeId 节点 id
   */
  function removeNode(nodeId: string) {
    postVsCodeMessage('removeNode', { nodeId })
  }

  /**
   * 添加自定义节点
   */
  function addNode() {
    postVsCodeMessage('addNode')
  }

  /**
   * 处理初始化数据
   * @param data 初始化数据
   */
  function onInitData(data: InitData) {
    setLoggedIn(data.loggedIn)
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
          postVsCodeMessage('refreshNode', { tab, nodeId: node.id })
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
      switch (msg.command) {
        case 'initData':
          onInitData(msg)
          break
        case 'nodeChildren':
          onNodeChildren(msg)
          break
        case 'customNodesUpdated':
          onCustomNodesUpdated(msg)
          break
        case 'refreshLoadedNodes':
          refreshLoadedNodes()
          break
        default:
          break
      }
    }

    window.addEventListener('message', onMessage)
    postVsCodeMessage('ready')

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
            onExpandNode={expandNode}
            onRefreshNode={refreshNode}
            onRemoveNode={removeNode}
          />
        </Tabs.TabPane>
      </Tabs>
    </main>
  )
}
