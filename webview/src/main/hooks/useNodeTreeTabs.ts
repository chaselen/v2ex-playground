import { useCallback, useRef, useState } from 'react'
import { Toast } from '@douyinfe/semi-ui'
import { createVsCodeClient } from '@/shared/vscode'
import {
  EXPLORE_NODES,
  type InitData,
  type MainViewRpcCommands,
  type NodeChildrenData,
  type NodeListData
} from '@extension/shared/webview'
import { createNodeItem, markTopicListRead, mergeNodeItems, normalizeTopics } from '../nodeData'
import type { MainTabKey, MainTabs, NodeItem } from '../types'

/** 主面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<MainViewRpcCommands>()

/**
 * 管理固定节点标签数据
 */
export function useNodeTreeTabs() {
  const [tabs, setTabs] = useState<MainTabs>({
    explore: EXPLORE_NODES.map(createNodeItem),
    custom: [],
    collection: []
  })
  const [tabErrors, setTabErrors] = useState<Partial<Record<MainTabKey, string | null>>>({})
  const [tabLoaded, setTabLoaded] = useState<Record<MainTabKey, boolean>>({
    explore: true,
    custom: true,
    collection: false
  })
  const nodeRequestSeq = useRef(new Map<string, number>())

  /**
   * 更新单个节点
   * @param tab 标签 key
   * @param itemKey 列表项 key
   * @param updater 节点更新函数
   */
  function updateNode(tab: MainTabKey, itemKey: string, updater: (node: NodeItem) => NodeItem) {
    setTabs(current => ({
      ...current,
      [tab]: current[tab].map(node => (node.name === itemKey ? updater(node) : node))
    }))
  }

  /**
   * 标记节点加载中
   * @param tab 标签 key
   * @param itemKey 列表项 key
   */
  function setNodeLoading(tab: MainTabKey, itemKey: string) {
    updateNode(tab, itemKey, node => ({ ...node, loading: true }))
  }

  /**
   * 批量设置节点加载状态
   * @param tab 标签 key
   * @param itemKeys 列表项 key
   * @param loading 是否加载中
   */
  function setNodesLoading(tab: MainTabKey, itemKeys: string[], loading = true) {
    const itemKeySet = new Set(itemKeys)
    setTabs(current => ({
      ...current,
      [tab]: current[tab].map(node => (itemKeySet.has(node.name) ? { ...node, loading } : node))
    }))
  }

  /**
   * 处理节点话题列表
   * @param data 节点子项数据
   * @param requestSeq 请求序号
   */
  function onNodeChildren(data: NodeChildrenData, requestSeq: number) {
    if (nodeRequestSeq.current.get(`${data.tab}:${data.itemKey}`) !== requestSeq) {
      return
    }

    updateNode(data.tab, data.itemKey, node => {
      if (data.error) {
        return {
          ...node,
          loading: false,
          error: data.error,
          page: data.page || node.page,
          totalPage: data.totalPage || node.totalPage,
          totalCount: data.totalCount || node.totalCount,
          children: node.children || []
        }
      }

      return {
        ...node,
        loading: false,
        error: null,
        page: data.page || 1,
        totalPage: data.totalPage || 1,
        totalCount: data.totalCount || 0,
        children: normalizeTopics(data.children || [])
      }
    })
  }

  /**
   * 请求节点话题列表
   * @param command 命令名
   * @param tab 标签 key
   * @param itemKey 列表项 key
   * @param page 页码
   */
  async function requestNodeChildren(
    command: 'expandNode' | 'refreshNode',
    tab: MainTabKey,
    itemKey: string,
    page = 1
  ) {
    const requestKey = `${tab}:${itemKey}`
    const requestSeq = (nodeRequestSeq.current.get(requestKey) || 0) + 1
    nodeRequestSeq.current.set(requestKey, requestSeq)

    try {
      const data = await vscode[command]({ tab, itemKey, page })
      onNodeChildren(data, requestSeq)
    } catch (err) {
      onNodeChildren(
        {
          tab,
          itemKey,
          page,
          totalPage: 1,
          totalCount: 0,
          children: [],
          error: (err as Error).message
        },
        requestSeq
      )
    }
  }

  /**
   * 展开节点
   * @param tab 标签 key
   * @param itemKey 列表项 key
   */
  async function expandNode(tab: MainTabKey, itemKey: string) {
    setNodeLoading(tab, itemKey)
    await requestNodeChildren('expandNode', tab, itemKey, 1)
  }

  /**
   * 刷新节点
   * @param tab 标签 key
   * @param itemKey 列表项 key
   */
  async function refreshNode(tab: MainTabKey, itemKey: string) {
    const node = tabs[tab].find(item => item.name === itemKey)
    setNodeLoading(tab, itemKey)
    await requestNodeChildren('refreshNode', tab, itemKey, node?.page || 1)
  }

  /**
   * 切换节点页码
   * @param tab 标签 key
   * @param itemKey 列表项 key
   * @param page 页码
   */
  async function changeNodePage(tab: MainTabKey, itemKey: string, page: number) {
    setNodeLoading(tab, itemKey)
    await requestNodeChildren('expandNode', tab, itemKey, page)
  }

  /**
   * 处理自定义节点更新
   * @param data 自定义节点数据
   */
  function onCustomNodesUpdated(data: NodeListData) {
    setTabs(current => ({
      ...current,
      custom: mergeNodeItems(data.nodes, current.custom)
    }))
  }

  /**
   * 删除自定义节点
   * @param nodeName 节点 name
   */
  async function removeNode(nodeName: string) {
    try {
      const data = await vscode.removeNode({ nodeName })
      onCustomNodesUpdated(data)
    } catch (err) {
      console.error(err)
    }
  }

  /**
   * 取消收藏节点
   * @param nodeName 节点 name
   */
  async function cancelCollectNode(nodeName: string) {
    try {
      await vscode.cancelCollectNode({ nodeName })
      setTabs(current => ({
        ...current,
        collection: current.collection.filter(node => node.name !== nodeName)
      }))
      Toast.success('已取消收藏节点')
    } catch (err) {
      Toast.error((err as Error).message || '取消收藏节点失败')
      throw err
    }
  }

  /**
   * 添加自定义节点
   */
  async function addNode() {
    try {
      const data = await vscode.addNode()
      onCustomNodesUpdated(data)
    } catch (err) {
      console.error(err)
    }
  }

  /**
   * 初始化固定节点标签数据
   * @param data 初始化标签数据
   */
  const initializeTabs = useCallback((data: InitData['tabs']) => {
    setTabs(current => ({
      explore: mergeNodeItems(data.explore, current.explore),
      custom: mergeNodeItems(data.custom, current.custom),
      collection: data.collection.map(createNodeItem)
    }))
    setTabErrors(current => ({
      ...current,
      collection: null
    }))
    setTabLoaded(current => ({
      ...current,
      explore: true,
      custom: true,
      collection: false
    }))
  }, [])

  /**
   * 标记已加载节点中的话题已读
   * @param topicId 话题 id
   */
  const markTopicRead = useCallback((topicId: number) => {
    setTabs(current => ({
      explore: markTabTopicRead(current.explore, topicId),
      custom: markTabTopicRead(current.custom, topicId),
      collection: markTabTopicRead(current.collection, topicId)
    }))
  }, [])

  /**
   * 刷新固定节点标签
   * @param tab 标签 key
   */
  async function refreshTab(tab: MainTabKey) {
    if (tab === 'collection') {
      const loadedNodes = tabs.collection.filter(node => node.children !== null)
      const loadedNodeNames = loadedNodes.map(node => node.name)
      setNodesLoading('collection', loadedNodeNames)

      try {
        const data = await vscode.refreshCollectionNodes()
        const nodeNames = new Set(data.nodes.map(node => node.name))
        const retainedLoadedNodes = loadedNodes.filter(node => nodeNames.has(node.name))
        const retainedLoadedNodeNames = new Set(retainedLoadedNodes.map(node => node.name))

        setTabErrors(current => ({
          ...current,
          collection: null
        }))
        setTabLoaded(current => ({
          ...current,
          collection: true
        }))
        setTabs(current => ({
          ...current,
          collection: mergeNodeItems(data.nodes, current.collection).map(node =>
            retainedLoadedNodeNames.has(node.name) ? { ...node, loading: true } : node
          )
        }))

        await Promise.all(
          retainedLoadedNodes.map(node =>
            requestNodeChildren('refreshNode', 'collection', node.name, 1)
          )
        )
      } catch (err) {
        setNodesLoading('collection', loadedNodeNames, false)
        setTabErrors(current => ({
          ...current,
          collection: (err as Error).message || '收藏节点加载失败'
        }))
        setTabLoaded(current => ({
          ...current,
          collection: true
        }))
        throw err
      }
      return
    }

    const loadedNodes = tabs[tab].filter(node => node.children !== null)
    setNodesLoading(
      tab,
      loadedNodes.map(node => node.name)
    )
    await Promise.all(
      loadedNodes.map(node => requestNodeChildren('refreshNode', tab, node.name, 1))
    )
  }

  return {
    tabs,
    tabErrors,
    tabLoaded,
    addNode,
    cancelCollectNode,
    changeNodePage,
    expandNode,
    initializeTabs,
    markTopicRead,
    refreshNode,
    refreshTab,
    removeNode
  }
}

/**
 * 标记标签页节点中的话题已读
 * @param nodes 节点列表
 * @param topicId 话题 id
 */
function markTabTopicRead(nodes: NodeItem[], topicId: number): NodeItem[] {
  return nodes.map(node =>
    node.children
      ? {
          ...node,
          children: markTopicListRead(node.children, topicId)
        }
      : node
  )
}
