import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger, Toast } from '@/components/ui'
import { createVsCodeClient } from '@/core/vscode'
import type {
  InitData,
  MainPanelTabKey,
  MainViewRpcCommands,
  MainViewWebviewEvents,
  WebviewAccountOverview
} from '@extension/shared/webview'
import { useNodeTreeTabs } from './hooks/useNodeTreeTabs'
import MyTab, { type MyTabHandle } from './tabs/MyTab'
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
 * 主面板应用
 */
export default function MainApp() {
  const [activeTab, setActiveTab] = useState<MainPanelTabKey>('explore')
  const [pendingTabs, setPendingTabs] = useState<MainPanelTabKey[]>([])
  const [contentLoadingTabs, setContentLoadingTabs] = useState<MainPanelTabKey[]>([])
  const [refreshingTabs, setRefreshingTabs] = useState<MainPanelTabKey[]>([])
  const [loggedIn, setLoggedIn] = useState(false)
  const [accountOverview, setAccountOverview] = useState<WebviewAccountOverview>()
  const [accountOverviewError, setAccountOverviewError] = useState<string | null>(null)
  const [accountOverviewLoaded, setAccountOverviewLoaded] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const myTabRef = useRef<MyTabHandle>(null)
  const nodeTreeTabs = useNodeTreeTabs()

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
        setActiveTab(data.selectedTab)
      }
      setInitializing(false)
      nodeTreeTabs.initializeTabs(data.tabs)
    },
    [nodeTreeTabs.initializeTabs]
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
  async function refreshTab(tab: MainPanelTabKey, options: RefreshTabOptions = {}) {
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
        setActiveTab(data.tab)
      }),
      vscode.on('topicRead', data => {
        data.topicIds.forEach(topicId => {
          nodeTreeTabs.markTopicRead(topicId)
          myTabRef.current?.markTopicRead(topicId)
        })
      }),
      vscode.on('collectionNodesChanged', data => {
        nodeTreeTabs.applyCollectionNodes(data)
      })
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
  }, [nodeTreeTabs.applyCollectionNodes, nodeTreeTabs.markTopicRead, onInitData])

  /** 当前标签刷新按钮文案 */
  const activeTabLabel = tabLabels[activeTab]
  /** 当前标签是否正在通过工具栏刷新 */
  const activeTabRefreshing = refreshingTabs.includes(activeTab)
  /** 当前标签是否有页面级错误 */
  const activeTabHasError =
    (activeTab === 'collection' && !!nodeTreeTabs.tabErrors.collection) ||
    (activeTab === 'my' && !!accountOverviewError && !accountOverview)
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
    !(activeTab === 'my' && !loggedIn)

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
          setActiveTab(value as MainPanelTabKey)
        }}
      >
        <TabsList
          overflowNavigation
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
        </TabsList>
        <TabsContent value="explore" forceMount>
          <NodeTreeTab tab="explore" nodes={nodeTreeTabs.tabs.explore} {...nodeTreeTabProps} />
        </TabsContent>
        <TabsContent value="custom" forceMount>
          <NodeTreeTab
            tab="custom"
            nodes={nodeTreeTabs.tabs.custom}
            loading={initializing}
            onAddNode={nodeTreeTabs.addNode}
            {...nodeTreeTabProps}
          />
        </TabsContent>
        <TabsContent value="collection" forceMount>
          <NodeTreeTab
            tab="collection"
            nodes={nodeTreeTabs.tabs.collection}
            error={nodeTreeTabs.tabErrors.collection}
            loading={collectionTabLoading}
            onAddNode={nodeTreeTabs.collectNode}
            onCancelCollectNode={nodeTreeTabs.cancelCollectNode}
            onRetryTab={() => refreshTab('collection', contentRetryOptions)}
            {...nodeTreeTabProps}
          />
        </TabsContent>
        <TabsContent value="my" forceMount>
          <MyTab
            ref={myTabRef}
            loading={myOverviewLoading}
            loggedIn={loggedIn}
            overview={accountOverview}
            overviewError={accountOverviewError}
            onRetryOverview={() => refreshTab('my', contentRetryOptions)}
            onOpenNodeCollection={() => {
              setActiveTab('collection')
            }}
          />
        </TabsContent>
      </Tabs>
    </main>
  )
}
