import { useEffect, useRef, useState } from 'react'
import { Button, Tabs, Toast } from '@douyinfe/semi-ui'
import { IconClose, IconRefresh } from '@douyinfe/semi-icons'
import MyAccountPanel, { type MyAccountPanelHandle } from './components/MyAccountPanel'
import NodeTree from './components/NodeTree'
import NodeTopicPanel from './components/NodeTopicPanel'
import { createVsCodeClient } from '../shared/vscode'
import {
  EXPLORE_NODES,
  type InitData,
  type MainPanelTabKey,
  type MainViewRpcCommands,
  type MainViewWebviewEvents,
  type NodeChildrenData,
  type NodeListData,
  type NodeTopicListData,
  type WebviewAccountOverview,
  type WebviewNode,
  type WebviewTopic
} from '../../../src/shared/webview'
import type { MainTabKey, MainTabs, NodeItem, NodeTopicTab } from './types'

/** 主面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<MainViewRpcCommands, MainViewWebviewEvents>()

/** 主面板标签文案 */
const tabLabels: Record<MainPanelTabKey, string> = {
  explore: '首页',
  custom: '自定义',
  collection: '收藏节点',
  my: '我的'
}

/** Webview 主面板标签 key */
type WebviewMainTabKey = MainPanelTabKey | 'node'

/**
 * 截取动态节点标签标题
 * @param title 完整节点标题
 */
function getNodeTabTitle(title: string): string {
  return Array.from(title).slice(0, 4).join('')
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
 * 主面板应用
 */
export default function MainApp() {
  const [activeTab, setActiveTab] = useState<WebviewMainTabKey>('explore')
  const [refreshingTabs, setRefreshingTabs] = useState<WebviewMainTabKey[]>([])
  const [loggedIn, setLoggedIn] = useState(false)
  const [accountOverview, setAccountOverview] = useState<WebviewAccountOverview>()
  const [initializing, setInitializing] = useState(true)
  const [nodeTab, setNodeTab] = useState<NodeTopicTab>()
  const [tabs, setTabs] = useState<MainTabs>({
    explore: EXPLORE_NODES.map(createNodeItem),
    custom: [],
    collection: []
  })
  const myAccountPanelRef = useRef<MyAccountPanelHandle>(null)
  const lastFixedTab = useRef<MainPanelTabKey>('explore')
  const nodeRequestSeq = useRef(new Map<string, number>())
  const nodeTopicRequestSeq = useRef(0)

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
   * 打开节点主题标签
   * @param node 节点
   */
  function openNodeTab(node: WebviewNode) {
    setActiveTab('node')
    if (nodeTab?.name === node.name) {
      return
    }

    setNodeTab({
      ...node,
      loading: true,
      page: 1,
      totalPage: 1,
      totalCount: 0,
      topics: [],
      error: null
    })
    requestNodeTopics(node, 1)
  }

  /**
   * 关闭节点主题标签
   */
  function closeNodeTab() {
    nodeTopicRequestSeq.current += 1
    setNodeTab(undefined)
    if (activeTab === 'node') {
      setActiveTab(lastFixedTab.current)
    }
  }

  /**
   * 请求节点主题列表
   * @param node 节点
   * @param page 页码
   */
  async function requestNodeTopics(node: WebviewNode, page: number) {
    const requestSeq = nodeTopicRequestSeq.current + 1
    nodeTopicRequestSeq.current = requestSeq
    setNodeTab(current =>
      current?.name === node.name ? { ...current, loading: true, error: null } : current
    )

    try {
      const data = await vscode.getNodeTopics({ nodeName: node.name, page })
      onNodeTopics(data, requestSeq)
    } catch (err) {
      if (nodeTopicRequestSeq.current !== requestSeq) {
        return
      }
      setNodeTab(current =>
        current?.name === node.name
          ? { ...current, loading: false, error: (err as Error).message || '加载失败' }
          : current
      )
    }
  }

  /**
   * 处理节点主题列表
   * @param data 节点主题列表数据
   * @param requestSeq 请求序号
   */
  function onNodeTopics(data: NodeTopicListData, requestSeq: number) {
    if (nodeTopicRequestSeq.current !== requestSeq) {
      return
    }

    setNodeTab(current =>
      current?.name === data.node.name
        ? {
            ...current,
            ...data.node,
            loading: false,
            page: data.page,
            totalPage: data.totalPage,
            totalCount: data.totalCount,
            topics: normalizeTopics(data.topics),
            error: null
          }
        : current
    )
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
   * 处理初始化数据
   * @param data 初始化数据
   */
  function onInitData(data: InitData) {
    setLoggedIn(data.loggedIn)
    setAccountOverview(data.accountOverview)
    if (data.selectedTab) {
      lastFixedTab.current = data.selectedTab
      setActiveTab(data.selectedTab)
    }
    if (data.selectedNode) {
      openNodeTab(data.selectedNode)
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
  async function refreshTab(tab: WebviewMainTabKey) {
    if (refreshingTabs.includes(tab)) {
      return
    }

    setRefreshingTabs(current => [...current, tab])

    try {
      if (tab === 'node') {
        if (nodeTab) {
          await requestNodeTopics(nodeTab, nodeTab.page)
        }
        return
      }

      if (tab === 'my') {
        const [overviewResult, tabsResult] = await Promise.allSettled([
          vscode.refreshMyOverview(),
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
    } catch (err) {
      Toast.error((err as Error).message || '刷新失败')
    } finally {
      setRefreshingTabs(current => current.filter(key => key !== tab))
    }
  }

  useEffect(() => {
    const disposables = [
      vscode.on('initData', onInitData),
      vscode.on('accountOverviewChanged', data => setAccountOverview(data.overview)),
      vscode.on('selectMainTab', data => {
        lastFixedTab.current = data.tab
        setActiveTab(data.tab)
      }),
      vscode.on('openNode', openNodeTab)
    ]
    vscode
      .ready()
      .then(onInitData)
      .catch(err => {
        setInitializing(false)
        console.error(err)
      })

    return () => {
      disposables.forEach(dispose => dispose())
    }
  }, [])

  /** 当前标签刷新按钮文案 */
  const activeTabLabel = activeTab === 'node' ? nodeTab?.title || '节点' : tabLabels[activeTab]

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
            title={`刷新${activeTabLabel}`}
            aria-label={`刷新${activeTabLabel}`}
            onClick={() => refreshTab(activeTab)}
          />
        }
        tabPaneMotion={false}
        onChange={value => {
          const tab = value as WebviewMainTabKey
          setActiveTab(tab)
          if (tab !== 'node') {
            lastFixedTab.current = tab
          }
        }}
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
            onOpenNodeCollection={() => {
              lastFixedTab.current = 'collection'
              setActiveTab('collection')
            }}
          />
        </Tabs.TabPane>
        {nodeTab && (
          <Tabs.TabPane
            itemKey="node"
            tab={
              <span className="node-tab-label">
                <span className="node-tab-title" title={nodeTab.title}>
                  {getNodeTabTitle(nodeTab.title)}
                </span>
                <button
                  type="button"
                  className="node-tab-close"
                  title={`关闭${nodeTab.title}节点`}
                  aria-label={`关闭${nodeTab.title}节点`}
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation()
                    closeNodeTab()
                  }}
                >
                  <IconClose />
                </button>
              </span>
            }
          >
            <NodeTopicPanel
              node={nodeTab}
              onPageChange={page => requestNodeTopics(nodeTab, page)}
            />
          </Tabs.TabPane>
        )}
      </Tabs>
    </main>
  )
}
