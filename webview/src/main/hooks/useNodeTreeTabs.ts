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
import { createNodeItem, mergeNodeItems, normalizeTopics } from '../nodeData'
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
   * 批量标记节点加载中
   * @param tab 标签 key
   * @param itemKeys 列表项 key
   */
  function setNodesLoading(tab: MainTabKey, itemKeys: string[]) {
    const itemKeySet = new Set(itemKeys)
    setTabs(current => ({
      ...current,
      [tab]: current[tab].map(node =>
        itemKeySet.has(node.name) ? { ...node, loading: true } : node
      )
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
      collection: mergeNodeItems(data.collection, current.collection)
    }))
  }, [])

  /**
   * 刷新固定节点标签
   * @param tab 标签 key
   */
  async function refreshTab(tab: MainTabKey) {
    if (tab === 'collection') {
      const data = await vscode.refreshCollectionNodes()
      const nodeNames = new Set(data.nodes.map(node => node.name))
      const loadedNodes = tabs.collection.filter(
        node => nodeNames.has(node.name) && node.children !== null
      )
      const loadedNodeNames = new Set(loadedNodes.map(node => node.name))

      setTabs(current => ({
        ...current,
        collection: mergeNodeItems(data.nodes, current.collection).map(node =>
          loadedNodeNames.has(node.name) ? { ...node, loading: true } : node
        )
      }))

      await Promise.all(
        loadedNodes.map(node => requestNodeChildren('refreshNode', 'collection', node.name, 1))
      )
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
    addNode,
    cancelCollectNode,
    changeNodePage,
    expandNode,
    initializeTabs,
    refreshNode,
    refreshTab,
    removeNode
  }
}
