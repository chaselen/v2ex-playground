import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Tabs, Toast } from '@douyinfe/semi-ui'
import { IconClose, IconRefresh } from '@douyinfe/semi-icons'
import { createVsCodeClient } from '@/shared/vscode'
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
  const [refreshingTabs, setRefreshingTabs] = useState<WebviewMainTabKey[]>([])
  const [loggedIn, setLoggedIn] = useState(false)
  const [accountOverview, setAccountOverview] = useState<WebviewAccountOverview>()
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
      throw overviewResult.reason
    }
    if (tabsResult.status === 'rejected') {
      throw tabsResult.reason
    }

    const data = overviewResult.value
    setLoggedIn(data.loggedIn)
    setAccountOverview(data.accountOverview)
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
  }, [onInitData, openNodeTab])

  /** 当前标签刷新按钮文案 */
  const activeTabLabel =
    activeTab === 'node' ? nodeTopicTab.nodeTab?.title || '节点' : tabLabels[activeTab]

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
        activeKey={activeTab}
        tabPosition="top"
        type="line"
        size="medium"
        collapsible="auto"
        lazyRender
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
        onChange={value => {
          const tab = value as WebviewMainTabKey
          setActiveTab(tab)
          if (tab !== 'node') {
            lastFixedTab.current = tab
          }
        }}
      >
        <Tabs.TabPane itemKey="explore" tab={tabLabels.explore}>
          <NodeTreeTab tab="explore" nodes={nodeTreeTabs.tabs.explore} {...nodeTreeTabProps} />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="custom" tab={tabLabels.custom}>
          <NodeTreeTab
            tab="custom"
            nodes={nodeTreeTabs.tabs.custom}
            onAddNode={nodeTreeTabs.addNode}
            {...nodeTreeTabProps}
          />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="collection" tab={tabLabels.collection}>
          <NodeTreeTab
            tab="collection"
            nodes={nodeTreeTabs.tabs.collection}
            loading={initializing}
            onCancelCollectNode={nodeTreeTabs.cancelCollectNode}
            {...nodeTreeTabProps}
          />
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="my" tab={tabLabels.my}>
          <MyTab
            ref={myTabRef}
            loading={initializing}
            loggedIn={loggedIn}
            overview={accountOverview}
            onOpenNodeCollection={() => {
              lastFixedTab.current = 'collection'
              setActiveTab('collection')
            }}
          />
        </Tabs.TabPane>
        {nodeTopicTab.nodeTab && (
          <Tabs.TabPane
            itemKey="node"
            tab={
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
                  <IconClose />
                </button>
              </span>
            }
          >
            <NodeTopicTab
              node={nodeTopicTab.nodeTab}
              onPageChange={page => nodeTopicTab.requestNodeTopics(nodeTopicTab.nodeTab!, page)}
            />
          </Tabs.TabPane>
        )}
      </Tabs>
    </main>
  )
}
