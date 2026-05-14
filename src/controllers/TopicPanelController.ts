import vscode from 'vscode'
import path from 'path'
import { LoginRequiredError, AccountRestrictedError } from '../error'
import { V2ex } from '../v2ex'
import G from '../global'
import { TopicDetail } from '../type'
import { openImagePreview } from '../imagePreview'

/**
 * Webview 发给扩展侧的话题命令消息
 */
export interface TopicPanelMessage {
  /** 命令名 */
  command: string
  /** 图片地址 */
  src?: string
  /** 话题 id */
  topicId?: string | number
  /** 回复内容 */
  content?: string
  /** 回复 id */
  replyId?: string
}

/**
 * 打开话题面板所需的最小参数
 */
export interface TopicPanelInput {
  /** 话题标题 */
  label: string
  /** 话题 id */
  topicId: number
}

/**
 * 话题面板控制器
 */
export class TopicPanelController {
  /** 话题面板缓存 key */
  readonly key: string

  /** 话题 id */
  private readonly topicId: number

  /** 话题面板 */
  private readonly panel: vscode.WebviewPanel

  /** 当前话题详情，仅在扩展侧维护 */
  private detail = new TopicDetail()

  /**
   * @param input 话题面板输入参数
   */
  constructor(input: TopicPanelInput) {
    this.key = V2ex.getTopicLinkById(input.topicId)
    this.topicId = input.topicId
    this.panel = createPanel(this.key, input.label)
    this.panel.webview.onDidReceiveMessage((message: TopicPanelMessage) => {
      this.handleMessage(message)
    })
  }

  /**
   * 激活当前面板
   */
  reveal() {
    this.panel.reveal()
  }

  /**
   * 销毁当前面板
   */
  dispose() {
    this.panel.dispose()
  }

  /**
   * 监听面板销毁
   * @param listener 销毁回调
   */
  onDidDispose(listener: () => void) {
    this.panel.onDidDispose(listener)
  }

  /**
   * 加载当前话题
   */
  load() {
    this.panel.webview.html = V2ex.renderPage('loading.html', {
      contextPath: G.getWebViewContextPath(this.panel.webview)
    })

    V2ex.getTopicDetail(this.topicId)
      .then(detail => {
        this.detail = detail
        this.panel.title = fmtPanelTitle(detail.title)
        this.render(detail)
      })
      .catch((err: Error) => {
        console.error(err)
        this.renderError(err)
      })
  }

  /**
   * 渲染话题详情
   * @param topicDetail 话题详情
   */
  render(topicDetail: TopicDetail) {
    try {
      // 在 panel 被关闭后设置 html 会抛出异常，这里保持兼容处理
      this.panel.webview.html = V2ex.renderPage('topic.html', {
        topic: topicDetail,
        contextPath: G.getWebViewContextPath(this.panel.webview)
      })
    } catch (err) {
      console.log(err)
    }
  }

  /**
   * 渲染异常页面
   * @param err 异常对象
   */
  private renderError(err: Error) {
    if (err instanceof LoginRequiredError) {
      this.panel.webview.html = V2ex.renderPage('error.html', {
        contextPath: G.getWebViewContextPath(this.panel.webview),
        message: err.message,
        showLogin: true,
        showRefresh: true
      })
      return
    }

    if (err instanceof AccountRestrictedError) {
      this.panel.webview.html = V2ex.renderPage('error.html', {
        contextPath: G.getWebViewContextPath(this.panel.webview),
        message: err.message,
        showRefresh: false
      })
      return
    }

    this.panel.webview.html = V2ex.renderPage('error.html', {
      contextPath: G.getWebViewContextPath(this.panel.webview),
      message: err.message,
      showRefresh: true
    })
  }

  /**
   * 处理 webview 发来的消息
   * @param message 页面消息
   */
  private handleMessage(message: TopicPanelMessage) {
    switch (message.command) {
      case 'browseImage':
        return this.runTopicAction('正在打开大图', () => openImagePreview(message.src || ''))
      case 'openTopic':
        if (message.topicId !== undefined) {
          this.openTopic(message.topicId)
        }
        return
      case 'login':
        return vscode.commands.executeCommand('v2ex.login')
      case 'refresh':
        return this.load()
      case 'collect':
        return this.runTopicMutation('正在收藏', () =>
          V2ex.collectTopic(this.detail.id, this.detail.once || '')
        )
      case 'cancelCollect':
        return this.runTopicMutation('正在取消收藏', () =>
          V2ex.cancelCollectTopic(this.detail.id, this.detail.once || '')
        )
      case 'thank':
        return this.runTopicMutation('发送感谢', () =>
          V2ex.thankTopic(this.detail.id, this.detail.once)
        )
      case 'postReply':
        return this.handlePostReply(message)
      case 'thankReply':
        return this.handleThankReply(message)
      default:
        return
    }
  }

  /**
   * 统一处理会导致页面整体刷新的话题操作
   * @param title 进度标题
   * @param task 具体任务
   */
  private runTopicMutation(title: string, task: () => Promise<unknown>) {
    return this.runTopicAction(title, async () => {
      await task()
      this.load()
    })
  }

  /**
   * 打开扩展内另一个话题
   * @param topicId 话题 id
   */
  private openTopic(topicId: string | number) {
    const nextTopicId = Number(topicId)
    vscode.commands.executeCommand('v2ex.topicItemClick', {
      label: `/t/${nextTopicId}`,
      topicId: nextTopicId
    } satisfies TopicPanelInput)
  }

  /**
   * 统一执行带进度提示的话题操作
   * @param title 进度标题
   * @param task 具体任务
   */
  private runTopicAction(title: string, task: () => Thenable<void> | Promise<void>) {
    return vscode.window.withProgress(
      {
        title,
        location: vscode.ProgressLocation.Notification
      },
      task
    )
  }

  /**
   * 处理提交回复
   * @param message 页面消息
   */
  private handlePostReply(message: TopicPanelMessage) {
    const { content } = message
    if (!content) {
      vscode.window.showWarningMessage('请输入回复内容')
      return
    }

    return this.runTopicMutation('正在提交回复', () =>
      V2ex.postReply(this.detail.link, content, this.detail.once)
    )
  }

  /**
   * 处理感谢回复者
   * @param message 页面消息
   */
  private handleThankReply(message: TopicPanelMessage) {
    const { replyId } = message
    if (!replyId) {
      return
    }

    const reply = this.detail.replies.find(r => r.replyId === replyId)
    if (!reply) {
      return
    }

    return this.runTopicAction('发送感谢', async () => {
      const resp = await V2ex.thankReply(replyId, this.detail.once)
      if (resp.success && resp.once) {
        reply.thanked = true
        reply.thanks++
        this.detail.once = resp.once
        this.render(this.detail)
      }
    })
  }
}

/**
 * 截断面板标题
 * @param title 原始标题
 */
function fmtPanelTitle(title: string) {
  return title.length <= 15 ? title : title.slice(0, 15) + '...'
}

/**
 * 创建话题 webview 面板
 * @param id 面板 id
 * @param label 面板标题
 */
function createPanel(id: string, label: string): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    id,
    fmtPanelTitle(label),
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      enableFindWidget: true
    }
  )
  panel.iconPath = vscode.Uri.file(path.join(G.context.extensionPath, 'resources/favicon.png'))
  return panel
}
