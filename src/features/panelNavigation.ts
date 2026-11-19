import { createWebviewNavigator } from './webviewNavigation'
import { openExternal } from './openExternal'
import { getTopicLink, getMemberLink, getNodeLink, getTagLink, V2EX_BASE_URL } from '@/v2ex'
import { getPanelPageUrl } from '@/shared/panelHistory'
import { PanelHistory } from '@/controllers/PanelHistory'
import { HelpPanelController } from '@/controllers/HelpPanelController'
import { MemberPanelController } from '@/controllers/MemberPanelController'
import { TopicPanelController } from '@/controllers/TopicPanelController'
import { BalancePanelController } from '@/controllers/BalancePanelController'
import { SearchPanelController } from '@/controllers/SearchPanelController'
import { RecentBrowsePanelController } from '@/controllers/RecentBrowsePanelController'
import { TagPanelController } from '@/controllers/TagPanelController'
import { NodePanelController } from '@/controllers/NodePanelController'
import { CreateTopicPanelController } from '@/controllers/CreateTopicPanelController'

const topicHistory = new PanelHistory<TopicPanelController>()
const memberHistory = new PanelHistory<MemberPanelController>()
const nodeHistory = new PanelHistory<NodePanelController>()
const tagHistory = new PanelHistory<TagPanelController>()
const helpHistory = new PanelHistory<HelpPanelController>()

/** 账户余额页面控制器 */
let balancePanel: BalancePanelController | undefined

/** 搜索页面控制器 */
let searchPanel: SearchPanelController | undefined

/** 最近浏览页面控制器 */
let recentBrowsePanel: RecentBrowsePanelController | undefined

/** 创作新主题页面控制器 */
let createTopicPanel: CreateTopicPanelController | undefined

/** 将 Webview URL 导航到对应面板，未支持的地址交给浏览器 */
export const openWebviewUrl = createWebviewNavigator({
  openTopic,
  openMember,
  openNode,
  openTag,
  openHelp,
  openCreateTopic,
  openBalance,
  openExternal
})

/**
 * 控制器面板导航依赖
 */
const panelDeps = {
  openExternal: openWebviewUrl,
  openMember,
  openTopic,
  openNode,
  openTag,
  openHelp,
  openCreateTopic
}

/**
 * 打开用户详情页面
 * @param username 用户名
 */
export function openMember(username: string) {
  memberHistory.open(getMemberLink(encodeURIComponent(username)), createPanel => {
    const controller = new MemberPanelController(username, panelDeps, createPanel)
    void controller.load()
    return controller
  })
}

/**
 * 打开话题详情页面
 * @param id 话题 id
 * @param title 话题展示标题
 */
export function openTopic(id: string | number, title?: string, page = 1) {
  const topicId = Number(id)
  if (Number.isNaN(topicId)) {
    throw new Error('打开话题面板缺少必要参数')
  }

  const url = getTopicLink(topicId)
  topicHistory.open(getPanelPageUrl(url, page), (createPanel, restoredPage = page) => {
    const controller = new TopicPanelController(
      topicId,
      title,
      panelDeps,
      createPanel,
      (page, addEntry) => {
        topicHistory.updatePage(controller, getPanelPageUrl(url, page), page, addEntry)
      }
    )
    void controller.load(restoredPage)
    return controller
  })
}

/**
 * 打开标签主题页面
 * @param tag 标签名称
 */
export function openTag(tag: string) {
  const tagName = tag.trim()
  if (!tagName) {
    throw new Error('打开标签面板缺少必要参数')
  }

  tagHistory.open(getTagLink(tagName), createPanel => {
    const controller = new TagPanelController(tagName, panelDeps, createPanel)
    void controller.load().catch(() => undefined)
    return controller
  })
}

/**
 * 打开节点主题页面
 * @param name 节点 name
 * @param title 节点展示标题
 */
export function openNode(name: string, title?: string, page = 1) {
  const nodeName = name?.trim()
  if (!nodeName) {
    throw new Error('打开节点面板缺少必要参数')
  }

  const panelTitle = title?.trim() || nodeName
  const url = getNodeLink(nodeName)
  nodeHistory.open(getPanelPageUrl(url, page), (createPanel, restoredPage = page) => {
    const controller = new NodePanelController(
      nodeName,
      panelTitle,
      panelDeps,
      createPanel,
      (page, addEntry) => {
        nodeHistory.updatePage(controller, getPanelPageUrl(url, page), page, addEntry)
      }
    )
    void controller.load(restoredPage).catch(() => undefined)
    return controller
  })
}

/**
 * 登录态变化后刷新已打开的话题、用户、节点和余额面板
 */
export function refreshTopicPanelsForAuthChange() {
  topicHistory.current?.refreshForAuthChange()
  nodeHistory.current?.refreshForAuthChange()
  memberHistory.current?.refreshForAuthChange()
  balancePanel?.refreshForAuthChange()
  void createTopicPanel?.refreshForAuthChange()
}

/**
 * 打开账户余额页面
 */
export function openBalance() {
  if (balancePanel) {
    balancePanel.reveal()
    return
  }

  balancePanel = new BalancePanelController(panelDeps)
  balancePanel.onDidDispose(() => {
    balancePanel = undefined
  })
  balancePanel.load()
}

/** 打开搜索页面 */
export function openSearch() {
  if (searchPanel) {
    searchPanel.reveal()
    return
  }

  searchPanel = new SearchPanelController(panelDeps)
  searchPanel.onDidDispose(() => {
    searchPanel = undefined
  })
}

/** 打开最近浏览页面 */
export function openRecentBrowse() {
  if (recentBrowsePanel) {
    recentBrowsePanel.reveal()
    return
  }

  recentBrowsePanel = new RecentBrowsePanelController(panelDeps)
  recentBrowsePanel.onDidDispose(() => {
    recentBrowsePanel = undefined
  })
}

/**
 * 打开创作新主题页面
 * @param nodeName 需要预选的主题节点 name
 */
export function openCreateTopic(nodeName?: string) {
  if (createTopicPanel) {
    createTopicPanel.reveal()
    if (nodeName) {
      createTopicPanel.selectNode(nodeName)
    }
    return
  }

  createTopicPanel = new CreateTopicPanelController(panelDeps, nodeName)
  createTopicPanel.onDidDispose(() => {
    createTopicPanel = undefined
  })
  void createTopicPanel.load()
}

/** 打开原站帮助主题或章节，并复用帮助标签页 */
export function openHelp(slug = 'home', anchor?: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('帮助主题无效')

  const url = new URL(`/help/${slug}`, V2EX_BASE_URL)
  if (anchor) url.hash = encodeURIComponent(anchor)

  helpHistory.open(
    url.href,
    createPanel => {
      const previousPage = helpHistory.current?.rpc_ready().data
      const controller = new HelpPanelController(panelDeps, createPanel, previousPage)
      void controller.load(slug, false, anchor)
      return controller
    },
    controller => {
      if (anchor) void controller.load(slug, false, anchor)
    }
  )
}
