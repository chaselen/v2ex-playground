import { TreeNode } from '../providers/BaseProvider'
import { LoginRequiredError, AccountRestrictedError } from './../error'
import { V2ex } from '../v2ex'
import vscode from 'vscode'
import G from '../global'
import path from 'path'
import Config from '../config'
import { TopicDetail } from '../type'
import http from '../http'

/**
 * 存放话题页面的panels
 * key：话题的链接/图片链接
 * value：panel
 */
const panels: Record<string, vscode.WebviewPanel> = {}

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
  panels[id] = panel

  panel.onDidDispose(() => {
    delete panels[id]
  })
  return panel
}

/**
 * 点击子节点打开详情页面
 * @param item 话题的子节点
 */
export default function topicItemClick(item: TreeNode) {
  // 如果panel已经存在，则直接激活
  let panel = panels[item.link!]
  if (panel) {
    panel.reveal()
    return
  }

  // 不在新标签页打开，则关闭之前的标签页重新创建
  if (!Config.openInNewTab()) {
    Object.values(panels).forEach(p => {
      p.dispose()
    })
  }

  panel = _createPanel(item.link!.toString(), item.label as string)
  panel.webview.onDidReceiveMessage(message => {
    const topic: TopicDetail = message._topic ? TopicDetail.from(message._topic) : new TopicDetail()
    switch (message.command) {
      case 'setTitle':
        panel.title = _getTitle(message.title)
        break
      case 'browseImage':
        vscode.window.withProgress(
          {
            title: '正在打开大图',
            location: vscode.ProgressLocation.Notification
          },
          () => _openLargeImage(message.src)
        )

        break
      case 'openTopic':
        // label显示/t/xxx部分
        {
          const topicId = message.topicId
          const item = new TreeNode(`/t/${topicId}`, false)
          item.topicId = topicId
          topicItemClick(item)
        }
        break
      case 'login':
        vscode.commands.executeCommand('v2ex.login')
        break
      case 'refresh':
        loadTopicInPanel(panel, item.topicId!)
        break
      case 'collect': // 收藏
        {
          vscode.window.withProgress(
            {
              title: '正在收藏',
              location: vscode.ProgressLocation.Notification
            },
            async () => {
              await V2ex.collectTopic(topic.id, topic.once || '')
              loadTopicInPanel(panel, item.topicId!)
            }
          )
        }
        break
      case 'cancelCollect': // 取消收藏
        {
          vscode.window.withProgress(
            {
              title: '正在取消收藏',
              location: vscode.ProgressLocation.Notification
            },
            async () => {
              await V2ex.cancelCollectTopic(topic.id, topic.once || '')
              loadTopicInPanel(panel, item.topicId!)
            }
          )
        }
        break
      case 'thank':
        {
          vscode.window.withProgress(
            {
              title: '发送感谢',
              location: vscode.ProgressLocation.Notification
            },
            async () => {
              await V2ex.thankTopic(topic.id, topic.once)
              loadTopicInPanel(panel, item.topicId!)
            }
          )
        }
        break
      case 'postReply':
        {
          const { content } = message
          if (!content) {
            vscode.window.showWarningMessage('请输入回复内容')
            return
          }
          vscode.window.withProgress(
            {
              title: '正在提交回复',
              location: vscode.ProgressLocation.Notification
            },
            async () => {
              await V2ex.postReply(topic.link, content, topic.once)
              loadTopicInPanel(panel, item.topicId!)
            }
          )
        }
        break
      case 'thankReply':
        {
          const { replyId } = message
          const reply = topic.replies.find(r => r.replyId === replyId)
          if (!reply) {
            return
          }
          vscode.window.withProgress(
            {
              title: '发送感谢',
              location: vscode.ProgressLocation.Notification
            },
            async () => {
              const resp = await V2ex.thankReply(replyId, topic.once)
              if (resp.success && resp.once) {
                reply.thanked = true
                reply.thanks++
                topic.once = resp.once
                renderTopicInPanel(panel, topic)
              }
            }
          )
        }
        break
      default:
        break
    }
  })

  loadTopicInPanel(panel, item.topicId!)
}

/**
 * 在Panel中加载话题
 * @param panel panel
 * @param topicId 话题id
 */
function loadTopicInPanel(panel: vscode.WebviewPanel, topicId: number) {
  panel.webview.html = V2ex.renderPage('loading.html', {
    contextPath: G.getWebViewContextPath(panel.webview)
  })

  // 获取详情数据
  V2ex.getTopicDetail(topicId)
    .then(detail => {
      renderTopicInPanel(panel, detail)
    })
    .catch((err: Error) => {
      console.error(err)
      if (err instanceof LoginRequiredError) {
        panel.webview.html = V2ex.renderPage('error.html', {
          contextPath: G.getWebViewContextPath(panel.webview),
          message: err.message,
          showLogin: true,
          showRefresh: true
        })
      } else if (err instanceof AccountRestrictedError) {
        panel.webview.html = V2ex.renderPage('error.html', {
          contextPath: G.getWebViewContextPath(panel.webview),
          message: err.message,
          showRefresh: false
        })
      } else {
        panel.webview.html = V2ex.renderPage('error.html', {
          contextPath: G.getWebViewContextPath(panel.webview),
          message: err.message,
          showRefresh: true
        })
      }
    })
}

/**
 * 在Panel中加载话题
 * @param panel panel
 * @param topicDetail 话题详情
 */
function renderTopicInPanel(panel: vscode.WebviewPanel, topicDetail: TopicDetail) {
  try {
    // 在panel被关闭后设置html，会出现'Webview is disposed'异常，暂时简单粗暴地解决一下
    panel.webview.html = V2ex.renderPage('topic.html', {
      topic: topicDetail,
      // 避免内容被转义，所以用base64
      topicJson: Buffer.from(JSON.stringify(topicDetail)).toString('base64'),
      contextPath: G.getWebViewContextPath(panel.webview)
    })
  } catch (err) {
    console.log(err)
  }
}

/**
 * 打开大图
 * @param imageSrc 图片地址
 */
async function _openLargeImage(imageSrc: string) {
  // 如果panel已经存在，则直接激活
  let panel = panels[imageSrc]
  if (panel) {
    panel.reveal()
    return
  }

  console.log('打开大图：', imageSrc)
  panel = _createPanel(imageSrc, '查看图片')
  // panel.webview.html = V2ex.renderPage('browseImage.html', {
  //   imageSrc: imageSrc
  // })

  panel.webview.html = V2ex.renderPage('loading.html', {
    contextPath: G.getWebViewContextPath(panel.webview)
  })

  try {
    const res = await http.get(imageSrc, { responseType: 'arraybuffer' })

    const ft = await import('file-type').then(m => m.fileTypeFromBuffer(res.data))
    if (!ft) {
      throw new Error('获取文件类型失败')
    }
    if (!ft.mime.startsWith('image/')) {
      throw new Error(`不是有效的图片类型：${ft.mime}`)
    }

    const base64 = Buffer.from(res.data).toString('base64')
    panel.webview.html = `<img src="data:${ft.mime};base64,${base64}">`
  } catch (e: any) {
    vscode.window.showErrorMessage(`下载图片失败：${e.message}`)
  }
}
