import { TreeNode } from '../providers/BaseProvider'
import vscode from 'vscode'
import G from '../global'
import path from 'path'
import Config from '../config'
import { TopicPanelController } from '../controllers/TopicPanelController'
import { openImagePreview } from '../imagePreview'

/**
 * 存放话题页面的控制器
 * key：话题链接
 * value：控制器
 */
const topicPanels: Record<string, TopicPanelController> = {}

/**
 * 截取标题
 * @param title 标题
 */
function _getTitle(title: string) {
  return title.length <= 15 ? title : title.slice(0, 15) + '...'
}

/**
 * 创建webview面板
 * @param id 面板id
 * @param label 面板标题
 */
function _createPanel(id: string, label: string): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(id, _getTitle(label), vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
    enableFindWidget: true
  })
  panel.iconPath = vscode.Uri.file(path.join(G.context.extensionPath, 'resources/favicon.png'))
  return panel
}

/**
 * 在已有话题面板中打开另一个话题
 * @param topicId 话题 id
 */
function _openTopicInPanel(topicId: string | number) {
  const topicItem = new TreeNode(`/t/${topicId}`, false)
  topicItem.topicId = Number(topicId)
  topicItemClick(topicItem)
}

/**
 * 统一执行带进度提示的话题操作
 * @param title 进度标题
 * @param task 具体任务
 */
function _runTopicAction(title: string, task: () => Thenable<void> | Promise<void>) {
  return vscode.window.withProgress(
    {
      title,
      location: vscode.ProgressLocation.Notification
    },
    task
  )
}

/**
 * 点击子节点打开详情页面
 * @param item 话题的子节点
 */
export default function topicItemClick(item: TreeNode) {
  const topicKey = item.link!.toString()

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

  controller = new TopicPanelController(item, {
    createPanel: _createPanel,
    openTopic: _openTopicInPanel,
    openLargeImage: openImagePreview,
    runTopicAction: _runTopicAction,
    getTitle: _getTitle
  })
  topicPanels[topicKey] = controller
  controller.onDidDispose(() => {
    delete topicPanels[topicKey]
  })
  controller.load()
}
