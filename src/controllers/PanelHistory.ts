import vscode from 'vscode'
import { WebviewRpcBridge } from '@/core/WebviewRpcBridge'
import {
  WEBVIEW_RESPONSE_COMMAND,
  type WebviewRequestMessage,
  type WebviewResponseMessage
} from '@/shared/webviewRpc'
import type {
  PanelHistoryRpcCommands,
  PanelHistoryState,
  PanelHistoryWebviewEvents
} from '@/shared/panelHistory'
import {
  createV2exWebviewPanel,
  formatPanelTitle,
  type CreateWebviewContentPanel
} from './webviewPanel'

interface HistoryEntry<Controller> {
  id: number
  url: string
  page?: number
  activate: (createPanel: CreateWebviewContentPanel, page?: number) => Controller
}

/** 一个编辑器标签页的导航历史，内容控制器仅服务本次激活的目标 */
export class PanelHistory<Controller> {
  private panel?: vscode.WebviewPanel
  private defaultIcon: vscode.WebviewPanel['iconPath']
  private rpc?: WebviewRpcBridge<PanelHistoryRpcCommands, PanelHistoryWebviewEvents>
  private contentLifecycle?: vscode.EventEmitter<void>
  private entries: HistoryEntry<Controller>[] = []
  private index = -1
  private entryId = 0
  private activationId = 0
  private controller?: Controller

  get current() {
    return this.controller
  }

  /** 打开新目标，重复打开当前目标时只激活现有标签页 */
  open(
    url: string,
    activate: HistoryEntry<Controller>['activate'],
    onRepeat?: (controller: Controller) => void
  ) {
    if (this.entries[this.index]?.url === url && this.controller) {
      this.panel?.reveal()
      onRepeat?.(this.controller)
      return
    }

    this.push({ id: ++this.entryId, url, activate })
    this.activate(this.index)
    this.panel?.reveal()
  }

  /** 同一内容控制器内完成翻页后同步历史，保留正文中的回复定位等交互 */
  updatePage(controller: Controller, url: string, page: number, addEntry: boolean) {
    if (controller !== this.controller) return
    const current = this.entries[this.index]
    if (current.url === url) return

    if (addEntry) {
      this.push({ ...current, id: ++this.entryId, url, page })
    } else {
      // 站点将请求的页码修正为实际页码时，更新当前条目
      current.url = url
      current.page = page
    }
    this.postHistory()
  }

  private push(entry: HistoryEntry<Controller>) {
    this.entries.splice(++this.index, this.entries.length, entry)
  }

  rpc_historyReady(): PanelHistoryState {
    const entry = this.entries[this.index]
    return {
      entryId: entry.id,
      url: entry.url,
      activationId: this.activationId,
      canGoBack: this.index > 0,
      canGoForward: this.index < this.entries.length - 1
    }
  }

  rpc_traverseHistory(activationId: number, direction: 'back' | 'forward') {
    if (activationId !== this.activationId || (direction !== 'back' && direction !== 'forward'))
      return
    const index = this.index + (direction === 'back' ? -1 : 1)
    if (!this.entries[index]) return
    this.activate(index)
  }

  private activate(index: number) {
    this.releaseContent()
    this.index = index
    const activationId = ++this.activationId
    const lifecycle = new vscode.EventEmitter<void>()
    this.contentLifecycle = lifecycle
    const entry = this.entries[index]
    this.controller = entry.activate(options => {
      const panel = this.panel ?? this.createPanel(options)
      panel.title = formatPanelTitle(options.title)
      panel.iconPath = this.defaultIcon
      const isCurrent = () => this.panel === panel && this.contentLifecycle === lifecycle
      return {
        set title(title: string) {
          if (isCurrent()) panel.title = title
        },
        set iconPath(icon: vscode.WebviewPanel['iconPath']) {
          if (isCurrent()) panel.iconPath = icon
        },
        onDidDispose: lifecycle.event,
        webview: {
          asWebviewUri: uri => panel.webview.asWebviewUri(uri),
          onDidReceiveMessage: listener =>
            panel.webview.onDidReceiveMessage((message: WebviewRequestMessage) => {
              if (!isCurrent() || !message || isHistoryRequest(message)) return
              if (message.panelActivationId === activationId) {
                listener(message)
              } else if (typeof message.requestId === 'string') {
                void panel.webview.postMessage({
                  command: WEBVIEW_RESPONSE_COMMAND,
                  requestId: message.requestId,
                  ok: false,
                  error: '页面已切换'
                } satisfies WebviewResponseMessage)
              }
            }),
          // 写操作的响应仍需送达原调用方，例如发表成功后清除对应的草稿版本
          postMessage: message => {
            if (this.panel !== panel) return Promise.resolve(false)
            if (message.command === WEBVIEW_RESPONSE_COMMAND)
              return panel.webview.postMessage(message)
            if (!isCurrent()) return Promise.resolve(false)
            return panel.webview.postMessage({ ...message, panelActivationId: activationId })
          }
        }
      }
    }, entry.page)
    this.postHistory()
  }

  private createPanel(options: Parameters<CreateWebviewContentPanel>[0]) {
    const panel = createV2exWebviewPanel(options)
    this.panel = panel
    this.defaultIcon = panel.iconPath
    this.rpc = new WebviewRpcBridge<PanelHistoryRpcCommands, PanelHistoryWebviewEvents>(
      {
        postMessage: message => panel.webview.postMessage(message),
        onDidReceiveMessage: listener =>
          panel.webview.onDidReceiveMessage((message: WebviewRequestMessage) => {
            if (message && isHistoryRequest(message)) listener(message)
          })
      },
      this
    )
    panel.onDidChangeViewState(({ webviewPanel }) => {
      // 隐藏期间的导航事件可能未送达，恢复可见时重新同步当前条目
      if (webviewPanel.visible) this.postHistory()
    })
    panel.onDidDispose(() => {
      this.panel = undefined
      this.releaseContent()
      this.rpc?.dispose()
      this.rpc = undefined
      this.entries = []
      this.index = -1
      this.controller = undefined
    })
    return panel
  }

  private postHistory() {
    if (this.index >= 0) {
      this.rpc?.post('panelHistoryChanged', { state: this.rpc_historyReady() })
    }
  }

  private releaseContent() {
    const lifecycle = this.contentLifecycle
    this.contentLifecycle = undefined
    lifecycle?.fire()
    lifecycle?.dispose()
  }
}

function isHistoryRequest(message: WebviewRequestMessage) {
  return message.command === 'historyReady' || message.command === 'traverseHistory'
}
