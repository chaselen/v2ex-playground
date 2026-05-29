import Config from '@/config'
import { TopicPanelController, TopicPanelInput } from '@/controllers/TopicPanelController'
import G from '@/global'

/**
 * 存放话题页面的控制器
 * key：话题链接
 * value：控制器
 */
const topicPanels: Record<string, TopicPanelController> = {}

/**
 * 点击子节点打开详情页面
 * @param topic 话题参数
 */
export default function topicItemClick(topic: TopicPanelInput) {
  if (Number.isNaN(topic.topicId)) {
    throw new Error('打开话题面板缺少必要参数')
  }

  const topicKey = G.V2ex.getTopicLinkById(topic.topicId)

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
