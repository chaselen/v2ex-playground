import { useEffect, useRef, useState } from 'react'
import { Button, Tabs, Toast } from '@douyinfe/semi-ui'
import { IconRefresh } from '@douyinfe/semi-icons'
import MyAccountPanel, { type MyAccountPanelHandle } from './components/MyAccountPanel'
import NodeTree from './components/NodeTree'
import { requestVsCodeMessage } from '../shared/vscode'
import {
  type AccountOverviewChangedData,
  EXPLORE_NODES,
  type InitData,
  type MainPanelTabKey,
  type NodeChildrenData,
  type NodeListData,
  type SelectMainTabData,
  type WebviewAccountOverview,
  type WebviewNode,
  type WebviewTopic
} from '../../../src/shared/webview'
import type { MainTabKey, MainTabs, NodeItem } from './types'

/** 主面板标签文案 */
const tabLabels: Record<MainPanelTabKey, string> = {
  explore: '首页',
  custom: '自定义',
  collection: '收藏节点',
  my: '我的'
}

/**
 * 创建带前端状态的节点项
 * @param node 原始节点
 */
function createNodeItem(node: WebviewNode): NodeItem {
  return {
    ...node,
    loading: false,
    page: 1,
    totalPage: 1,
    totalCount: 0,
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
    const old = existing.find(item => item.name === node.name)
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
 * 判断消息是否为账户概览变化
 * @param msg 扩展侧消息
 */
function isAccountOverviewChangedMessage(
  msg: unknown
): msg is AccountOverviewChangedData & { command: 'accountOverviewChanged' } {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'command' in msg &&
    msg.command === 'accountOverviewChanged' &&
    'overview' in msg
  )
}

/**
 * 判断消息是否为主面板标签切换
 * @param msg 扩展侧消息
 */
function isSelectMainTabMessage(
  msg: unknown
): msg is SelectMainTabData & { command: 'selectMainTab' } {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'command' in msg &&
    msg.command === 'selectMainTab' &&
    'tab' in msg
  )
}

/**
 * 主面板应用
 */
export default function MainApp() {
  const [activeTab, setActiveTab] = useState<MainPanelTabKey>('explore')
  const [refreshingTabs, setRefreshingTabs] = useState<MainPanelTabKey[]>([])
  const [loggedIn, setLoggedIn] = useState(false)
  const [accountOverview, setAccountOverview] = useState<WebviewAccountOverview>()
  const [initializing, setInitializing] = useState(true)
  const [tabs, setTabs] = useState<MainTabs>({
    explore: EXPLORE_NODES.map(createNodeItem),
    custom: [],
    collection: []
  })
  const myAccountPanelRef = useRef<MyAccountPanelHandle>(null)
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
   * 删除自定义节点
   * @param nodeName 节点 name
   */
  async function removeNode(nodeName: string) {
    try {
      const data = await requestVsCodeMessage('removeNode', { nodeName })
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
      await requestVsCodeMessage('cancelCollectNode', { nodeName })
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
    setAccountOverview(data.accountOverview)
    if (data.selectedTab) {
      setActiveTab(data.selectedTab)
    }
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
      const data = await requestVsCodeMessage(command, { tab, itemKey, page })
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
   * 刷新当前标签
   * @param tab 标签 key
   */
  async function refreshTab(tab: MainPanelTabKey) {
    if (refreshingTabs.includes(tab)) {
      return
    }

    setRefreshingTabs(current => [...current, tab])

    try {
      if (tab === 'my') {
        const [overviewResult, tabsResult] = await Promise.allSettled([
          requestVsCodeMessage('refreshMyOverview'),
          myAccountPanelRef.current?.refreshLoadedTabs()
        ])
        if (overviewResult.status === 'rejected') {
          throw overviewResult.reason
        }
        if (tabsResult.status === 'rejected') {
          throw tabsResult.reason
        }
        const data = overviewResult.value
        setLoggedIn(data.loggedIn)
        setAccountOverview(data.accountOverview)
        return
      }

      if (tab === 'collection') {
        const data = await requestVsCodeMessage('refreshCollectionNodes')
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
    } catch (err) {
      Toast.error((err as Error).message || '刷新失败')
    } finally {
      setRefreshingTabs(current => current.filter(key => key !== tab))
    }
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

      if (isAccountOverviewChangedMessage(msg)) {
        setAccountOverview(msg.overview)
        return
      }

      if (isSelectMainTabMessage(msg)) {
        setActiveTab(msg.tab)
        return
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
        collapsible="auto"
        className="main-tabs"
        contentStyle={{ height: '100%', minHeight: 0, overflow: 'hidden' }}
        tabBarExtraContent={
          <Button
            className="main-tab-refresh"
            theme="borderless"
            type="tertiary"
            size="small"
            icon={<IconRefresh />}
            loading={refreshingTabs.includes(activeTab)}
            title={`刷新${tabLabels[activeTab]}`}
            aria-label={`刷新${tabLabels[activeTab]}`}
            onClick={() => refreshTab(activeTab)}
          />
        }
        tabPaneMotion={false}
        onChange={value => setActiveTab(value as MainPanelTabKey)}
      >
        <Tabs.TabPane itemKey="explore" tab={tabLabels.explore}>
          <NodeTree
            tab="explore"
            nodes={tabs.explore}
            loggedIn={loggedIn}
            onExpandNode={expandNode}
            onRefreshNode={refreshNode}
            onPageChange={changeNodePage}
            onRemoveNode={removeNode}
          />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="custom" tab={tabLabels.custom}>
          <NodeTree
            tab="custom"
            nodes={tabs.custom}
            loggedIn={loggedIn}
            onAddNode={addNode}
            onExpandNode={expandNode}
            onRefreshNode={refreshNode}
            onPageChange={changeNodePage}
            onRemoveNode={removeNode}
          />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="collection" tab={tabLabels.collection}>
          <NodeTree
            tab="collection"
            nodes={tabs.collection}
            loggedIn={loggedIn}
            loading={initializing}
            onExpandNode={expandNode}
            onRefreshNode={refreshNode}
            onPageChange={changeNodePage}
            onRemoveNode={removeNode}
            onCancelCollectNode={cancelCollectNode}
          />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="my" tab={tabLabels.my}>
          <MyAccountPanel
            ref={myAccountPanelRef}
            loading={initializing}
            loggedIn={loggedIn}
            overview={accountOverview}
            onOpenNodeCollection={() => setActiveTab('collection')}
          />
        </Tabs.TabPane>
      </Tabs>
    </main>
  )
}
