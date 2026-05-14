import { TreeNode } from '../providers/BaseProvider'
import Config from '../config'
import { TopicPanelController, TopicPanelInput } from '../controllers/TopicPanelController'
import { V2ex } from '../v2ex'

/**
 * 存放话题页面的控制器
 * key：话题链接
 * value：控制器
 */
const topicPanels: Record<string, TopicPanelController> = {}

/**
 * 点击子节点打开详情页面
 * @param item 话题的子节点
 */
export default function topicItemClick(item: TreeNode | TopicPanelInput) {
  const topic = normalizeTopicPanelOptions(item)
  const topicKey = V2ex.getTopicLinkById(topic.topicId)

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

  controller = new TopicPanelController(topic)
  topicPanels[topicKey] = controller
  controller.onDidDispose(() => {
    delete topicPanels[topicKey]
  })
  controller.load()
}

/**
 * 将树节点或轻量参数转换为控制器需要的最小数据
 * @param item 话题来源对象
 */
function normalizeTopicPanelOptions(item: TreeNode | TopicPanelInput): TopicPanelInput {
  if (item instanceof TreeNode) {
    if (!item.topicId) {
      throw new Error('打开话题面板缺少必要参数')
    }

    return {
      topicId: item.topicId,
      label: typeof item.label === 'string' ? item.label : V2ex.getTopicLinkById(item.topicId)
    }
  }

  if (Number.isNaN(item.topicId)) {
    throw new Error('打开话题面板缺少必要参数')
  }

  return {
    topicId: item.topicId,
    label: item.label
  }
}
