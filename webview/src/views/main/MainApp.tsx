import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger, Toast } from '@/components/ui'
import { createVsCodeClient } from '@/core/vscode'
import type {
  InitData,
  MainPanelTabKey,
  MainViewRpcCommands,
  MainViewWebviewEvents,
  WebviewAccountOverview,
  WebviewNode
} from '@extension/shared/webview'
import { useNodeTreeTabs } from './hooks/useNodeTreeTabs'
import { useNodeTopicTab } from './hooks/useNodeTopicTab'
import MyTab, { type MyTabHandle } from './tabs/MyTab'
import NodeTopicTab from './tabs/NodeTopicTab'
import NodeTreeTab from './tabs/NodeTreeTab'

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

/** 刷新标签选项 */
interface RefreshTabOptions {
  /** 是否静默处理错误 */
  silent?: boolean
  /** 是否显示页面内容 loading */
  showContentLoading?: boolean
  /** 是否显示工具栏刷新按钮 loading */
  showToolbarLoading?: boolean
}

/** 页面内重试选项 */
const contentRetryOptions: RefreshTabOptions = {
  silent: true,
  showContentLoading: true,
  showToolbarLoading: false
}

/**
 * 截取动态节点标签标题
 * @param title 完整节点标题
 */
function getNodeTabTitle(title: string): string {
  return Array.from(title).slice(0, 4).join('')
}

/**
 * 主面板应用
 */
export default function MainApp() {
  const [activeTab, setActiveTab] = useState<WebviewMainTabKey>('explore')
  const [pendingTabs, setPendingTabs] = useState<WebviewMainTabKey[]>([])
  const [contentLoadingTabs, setContentLoadingTabs] = useState<WebviewMainTabKey[]>([])
  const [refreshingTabs, setRefreshingTabs] = useState<WebviewMainTabKey[]>([])
  const [loggedIn, setLoggedIn] = useState(false)
  const [accountOverview, setAccountOverview] = useState<WebviewAccountOverview>()
  const [accountOverviewError, setAccountOverviewError] = useState<string | null>(null)
  const [accountOverviewLoaded, setAccountOverviewLoaded] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const myTabRef = useRef<MyTabHandle>(null)
  const lastFixedTab = useRef<MainPanelTabKey>('explore')
  const nodeTreeTabs = useNodeTreeTabs()
  const nodeTopicTab = useNodeTopicTab()

  /**
   * 打开节点主题标签
   * @param node 节点
   */
  const openNodeTab = useCallback(
    (node: WebviewNode) => {
      setActiveTab('node')
      nodeTopicTab.openNodeTab(node)
    },
    [nodeTopicTab.openNodeTab]
  )

  /**
   * 关闭节点主题标签
   */
  function closeNodeTab() {
    nodeTopicTab.closeNodeTab()
    if (activeTab === 'node') {
      setActiveTab(lastFixedTab.current)
    }
  }

  /**
   * 处理初始化数据
   * @param data 初始化数据
   */
  const onInitData = useCallback(
    (data: InitData) => {
      setLoggedIn(data.loggedIn)
      setAccountOverview(data.accountOverview)
      setAccountOverviewError(null)
      setAccountOverviewLoaded(!!data.accountOverview)
      if (data.selectedTab) {
        lastFixedTab.current = data.selectedTab
        setActiveTab(data.selectedTab)
      }
      if (data.selectedNode) {
        openNodeTab(data.selectedNode)
      }
      setInitializing(false)
      nodeTreeTabs.initializeTabs(data.tabs)
    },
    [nodeTreeTabs.initializeTabs, openNodeTab]
  )

  /**
   * 刷新我的标签
   */
  async function refreshMyTab() {
    const [overviewResult, tabsResult] = await Promise.allSettled([
      vscode.refreshMyOverview(),
      myTabRef.current?.refreshLoadedTabs()
    ])
    if (overviewResult.status === 'rejected') {
      setAccountOverviewError((overviewResult.reason as Error).message || '账户概览加载失败')
      setAccountOverviewLoaded(true)
      throw overviewResult.reason
    }
    if (tabsResult.status === 'rejected') {
      throw tabsResult.reason
    }

    const data = overviewResult.value
    setLoggedIn(data.loggedIn)
    setAccountOverview(data.accountOverview)
    setAccountOverviewError(null)
    setAccountOverviewLoaded(true)
  }

  /**
   * 刷新当前标签
   * @param tab 标签 key
   * @param options 刷新选项
   */
  async function refreshTab(tab: WebviewMainTabKey, options: RefreshTabOptions = {}) {
    if (pendingTabs.includes(tab)) {
      return
    }

    setPendingTabs(current => [...current, tab])
    if (options.showContentLoading) {
      setContentLoadingTabs(current => [...current, tab])
    }
    if (options.showToolbarLoading !== false) {
      setRefreshingTabs(current => [...current, tab])
    }

    try {
      if (tab === 'node') {
        if (nodeTopicTab.nodeTab) {
          await nodeTopicTab.requestNodeTopics(nodeTopicTab.nodeTab, 1)
        }
        return
      }

      if (tab === 'my') {
        await refreshMyTab()
        return
      }

      await nodeTreeTabs.refreshTab(tab)
    } catch (err) {
      if (!options.silent) {
        Toast.error((err as Error).message || '刷新失败')
      }
    } finally {
      setPendingTabs(current => current.filter(key => key !== tab))
      setContentLoadingTabs(current => current.filter(key => key !== tab))
      setRefreshingTabs(current => current.filter(key => key !== tab))
    }
  }

  /**
   * 通过工具栏刷新当前标签
   */
  function refreshActiveTab() {
    refreshTab(activeTab, {
      showContentLoading: activeTab === 'my'
    })
  }

  useEffect(() => {
    if (initializing) {
      return
    }

    if (activeTab === 'collection' && loggedIn && !nodeTreeTabs.tabLoaded.collection) {
      refreshTab('collection', contentRetryOptions)
      return
    }

    if (
      activeTab === 'my' &&
      loggedIn &&
      !accountOverviewLoaded &&
      !accountOverview &&
      !accountOverviewError
    ) {
      refreshTab('my', contentRetryOptions)
    }
  }, [
    accountOverview,
    accountOverviewError,
    accountOverviewLoaded,
    activeTab,
    initializing,
    loggedIn,
    nodeTreeTabs.tabLoaded.collection
  ])

  useEffect(() => {
    const disposables = [
      vscode.on('initData', onInitData),
      vscode.on('accountOverviewChanged', data => {
        setAccountOverview(data.overview)
        setAccountOverviewError(null)
        setAccountOverviewLoaded(true)
      }),
      vscode.on('selectMainTab', data => {
        lastFixedTab.current = data.tab
        setActiveTab(data.tab)
      }),
      vscode.on('topicRead', data => {
        nodeTreeTabs.markTopicRead(data.topicId)
        nodeTopicTab.markTopicRead(data.topicId)
        myTabRef.current?.markTopicRead(data.topicId)
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
  }, [nodeTopicTab.markTopicRead, nodeTreeTabs.markTopicRead, onInitData, openNodeTab])

  /** 当前标签刷新按钮文案 */
  const activeTabLabel =
    activeTab === 'node' ? nodeTopicTab.nodeTab?.title || '节点' : tabLabels[activeTab]
  /** 当前标签是否正在通过工具栏刷新 */
  const activeTabRefreshing = refreshingTabs.includes(activeTab)
  /** 当前标签是否有页面级错误 */
  const activeTabHasError =
    (activeTab === 'collection' && !!nodeTreeTabs.tabErrors.collection) ||
    (activeTab === 'my' && !!accountOverviewError && !accountOverview) ||
    (activeTab === 'node' && !!nodeTopicTab.nodeTab?.error && !nodeTopicTab.nodeTab.topics.length)
  /** 收藏节点标签是否处于加载状态 */
  const collectionTabLoading =
    initializing ||
    contentLoadingTabs.includes('collection') ||
    (activeTab === 'collection' && loggedIn && !nodeTreeTabs.tabLoaded.collection)
  /** 我的标签是否处于账户概览加载状态 */
  const myOverviewLoading =
    initializing ||
    contentLoadingTabs.includes('my') ||
    (activeTab === 'my' &&
      loggedIn &&
      !accountOverviewLoaded &&
      !accountOverview &&
      !accountOverviewError)
  /** 当前标签是否能使用工具栏刷新 */
  const canRefreshActiveTab =
    !initializing &&
    (!pendingTabs.includes(activeTab) || activeTabRefreshing) &&
    !activeTabHasError &&
    !(activeTab === 'collection' && !loggedIn) &&
    !(activeTab === 'my' && !loggedIn) &&
    !(activeTab === 'node' && !nodeTopicTab.nodeTab)

  /** 固定节点标签公共参数 */
  const nodeTreeTabProps = {
    loggedIn,
    onExpandNode: nodeTreeTabs.expandNode,
    onRefreshNode: nodeTreeTabs.refreshNode,
    onPageChange: nodeTreeTabs.changeNodePage,
    onRemoveNode: nodeTreeTabs.removeNode
  }

  return (
    <main className="main-container" onContextMenu={event => event.preventDefault()}>
      <Tabs
        value={activeTab}
        className="main-tabs"
        onValueChange={value => {
          const tab = value as WebviewMainTabKey
          setActiveTab(tab)
          if (tab !== 'node') {
            lastFixedTab.current = tab
          }
        }}
      >
        <TabsList
          extra={
            <Button
              className="main-tab-refresh"
              variant="ghost"
              size="small"
              icon={<RefreshCw aria-hidden="true" />}
              loading={activeTabRefreshing}
              disabled={!canRefreshActiveTab}
              title={`刷新${activeTabLabel}`}
              aria-label={`刷新${activeTabLabel}`}
              onClick={refreshActiveTab}
            />
          }
        >
          <TabsTrigger value="explore">{tabLabels.explore}</TabsTrigger>
          <TabsTrigger value="custom">{tabLabels.custom}</TabsTrigger>
          <TabsTrigger value="collection">{tabLabels.collection}</TabsTrigger>
          <TabsTrigger value="my">{tabLabels.my}</TabsTrigger>
          {nodeTopicTab.nodeTab && (
            <TabsTrigger value="node" className="node-tab-trigger">
              <span className="node-tab-label">
                <span className="node-tab-title" title={nodeTopicTab.nodeTab.title}>
                  {getNodeTabTitle(nodeTopicTab.nodeTab.title)}
                </span>
                <button
                  type="button"
                  className="node-tab-close"
                  title={`关闭${nodeTopicTab.nodeTab.title}节点`}
                  aria-label={`关闭${nodeTopicTab.nodeTab.title}节点`}
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation()
                    closeNodeTab()
                  }}
                >
                  <X aria-hidden="true" />
                </button>
              </span>
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="explore">
          <NodeTreeTab tab="explore" nodes={nodeTreeTabs.tabs.explore} {...nodeTreeTabProps} />
        </TabsContent>
        <TabsContent value="custom">
          <NodeTreeTab
            tab="custom"
            nodes={nodeTreeTabs.tabs.custom}
            loading={initializing}
            onAddNode={nodeTreeTabs.addNode}
            {...nodeTreeTabProps}
          />
        </TabsContent>
        <TabsContent value="collection">
          <NodeTreeTab
            tab="collection"
            nodes={nodeTreeTabs.tabs.collection}
            error={nodeTreeTabs.tabErrors.collection}
            loading={collectionTabLoading}
            onCancelCollectNode={nodeTreeTabs.cancelCollectNode}
            onRetryTab={() => refreshTab('collection', contentRetryOptions)}
            {...nodeTreeTabProps}
          />
        </TabsContent>
        <TabsContent value="my">
          <MyTab
            ref={myTabRef}
            loading={myOverviewLoading}
            loggedIn={loggedIn}
            overview={accountOverview}
            overviewError={accountOverviewError}
            onRetryOverview={() => refreshTab('my', contentRetryOptions)}
            onOpenNodeCollection={() => {
              lastFixedTab.current = 'collection'
              setActiveTab('collection')
            }}
          />
        </TabsContent>
        {nodeTopicTab.nodeTab && (
          <TabsContent value="node">
            <NodeTopicTab
              node={nodeTopicTab.nodeTab}
              onPageChange={page => nodeTopicTab.requestNodeTopics(nodeTopicTab.nodeTab!, page)}
            />
          </TabsContent>
        )}
      </Tabs>
    </main>
  )
}
