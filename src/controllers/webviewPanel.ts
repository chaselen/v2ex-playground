import path from 'path'
import vscode from 'vscode'
import G from '@/global'
import { setDefaultPanelIcon } from '@/features/panelIcon'
import { renderWebviewHtml } from '@/core/webviewHtml'

/** 面板标题最大长度 */
const defaultPanelTitleMaxLength = 15

/** 固定资源图标文件名 */
type ResourcePanelIcon =
  | 'panelBalance.svg'
  | 'panelRecentBrowse.svg'
  | 'panelSearch.svg'
  | 'panelTwoFactor.svg'

/** V2EX Webview 面板创建选项 */
interface V2exWebviewPanelOptions {
  /** 面板类型 */
  viewType: string
  /** 面板标题 */
  title: string
  /** Vite Webview HTML 入口 */
  htmlEntry: string
  /** 是否保留隐藏面板上下文 */
  retainContextWhenHidden?: boolean
  /** 是否启用查找组件 */
  enableFindWidget?: boolean
  /** 资源目录中的固定图标文件名 */
  resourceIcon?: ResourcePanelIcon
  /** 是否使用远程图片兜底图标 */
  useDefaultIcon?: boolean
}

/**
 * 截断面板标题
 * @param title 原始标题
 */
export function formatPanelTitle(title: string): string {
  return title.length <= defaultPanelTitleMaxLength
    ? title
    : title.slice(0, defaultPanelTitleMaxLength) + '...'
}

/**
 * 创建 V2EX Webview 面板
 * @param options 面板创建选项
 */
export function createV2exWebviewPanel(options: V2exWebviewPanelOptions): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    options.viewType,
    formatPanelTitle(options.title),
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: options.retainContextWhenHidden ?? true,
      enableFindWidget: options.enableFindWidget,
      localResourceRoots: [
        vscode.Uri.file(path.join(G.context.extensionPath, 'html')),
        vscode.Uri.file(path.join(G.context.extensionPath, 'resources'))
      ]
    }
  )

  panel.webview.html = renderWebviewHtml(panel.webview, options.htmlEntry)

  if (options.resourceIcon) {
    panel.iconPath = {
      light: vscode.Uri.file(
        path.join(G.context.extensionPath, `resources/light/${options.resourceIcon}`)
      ),
      dark: vscode.Uri.file(
        path.join(G.context.extensionPath, `resources/dark/${options.resourceIcon}`)
      )
    }
  } else if (options.useDefaultIcon) {
    setDefaultPanelIcon(panel)
  }

  return panel
}
