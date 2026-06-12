import Config from '@/config'
import { MemberPanelController } from '@/controllers/MemberPanelController'
import { TopicPanelController } from '@/controllers/TopicPanelController'
import { BalancePanelController } from '@/controllers/BalancePanelController'
import { SearchPanelController } from '@/controllers/SearchPanelController'
import type { MemberPanelInput, NodeTabInput, TopicPanelInput } from '@/controllers/panelTypes'
import G from '@/global'

/**
 * 存放用户页面的控制器
 * key：用户主页链接
 * value：控制器
 */
const memberPanels: Record<string, MemberPanelController> = {}

/**
 * 存放话题页面的控制器
 * key：话题链接
 * value：控制器
 */
const topicPanels: Record<string, TopicPanelController> = {}

/** 账户余额页面控制器 */
let balancePanel: BalancePanelController | undefined

/** 搜索页面控制器 */
let searchPanel: SearchPanelController | undefined

/** 打开主面板节点标签回调 */
let openNodeTab: (node: NodeTabInput) => void = () => undefined

/**
 * 控制器面板导航依赖
 */
const panelDeps = {
  openMember,
  openTopic,
  openNode: (node: NodeTabInput) => openNodeTab(node)
}

/**
 * 设置打开主面板节点标签回调
 * @param handler 打开节点标签回调
 */
export function setOpenNodeTabHandler(handler: (node: NodeTabInput) => void) {
  openNodeTab = handler
}

/**
 * 打开用户详情页面
 * @param member 用户参数
 */
export function openMember(member: MemberPanelInput) {
  const memberKey = G.V2ex.getMemberLink(member.username)

  // 如果控制器已经存在，则直接激活
  let controller = memberPanels[memberKey]
  if (controller) {
    controller.reveal()
    return
  }

  // 不在新标签页打开，则关闭之前的标签页重新创建
  if (!Config.openInNewTab()) {
    Object.values(memberPanels).forEach(memberPanel => {
      memberPanel.dispose()
    })
  }

  controller = new MemberPanelController(member, panelDeps)
  memberPanels[memberKey] = controller
  controller.onDidDispose(() => {
    delete memberPanels[memberKey]
  })
  controller.load()
}

/**
 * 打开话题详情页面
 * @param topic 话题参数
 */
export function openTopic(topic: TopicPanelInput) {
  const topicId = Number(topic.topicId)
  if (Number.isNaN(topicId)) {
    throw new Error('打开话题面板缺少必要参数')
  }

  const topicKey = G.V2ex.getTopicLinkById(topicId)

  // 如果控制器已经存在，则直接激活
  let controller = topicPanels[topicKey]
  if (controller) {
    controller.reveal()
    return
  }

  // 不在新标签页打开，则关闭之前的标签页重新创建
  if (!Config.openInNewTab()) {
    Object.values(topicPanels).forEach(topicPanel => {
      topicPanel.dispose()
    })
  }

  controller = new TopicPanelController({ ...topic, topicId }, panelDeps)
  topicPanels[topicKey] = controller
  controller.onDidDispose(() => {
    delete topicPanels[topicKey]
  })
  controller.load()
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
