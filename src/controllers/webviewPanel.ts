import vscode, { Uri } from 'vscode'
import G from '@/global'
import { setDefaultPanelIcon } from '@/features/panelIcon'
import { renderWebviewHtml } from '@/core/webviewHtml'
import { logger } from '@/core/logger'

/** 面板标题的宽度预算，半角字符占 1，中文等非 ASCII 字符占 2 */
const defaultPanelTitleMaxWidth = 24

const panelTitleSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** 固定资源图标文件名 */
type ResourcePanelIcon =
  | 'panelBalance.svg'
  | 'panelRecentBrowse.svg'
  | 'panelSearch.svg'
  | 'panelTag.svg'
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
  /** 额外允许 Webview 加载的本地资源目录 */
  additionalLocalResourceRoots?: vscode.Uri[]
}

/**
 * 按近似显示宽度截断面板标题，保留完整字素；省略号不计入宽度预算
 * @param title 原始标题
 */
export function formatPanelTitle(title: string): string {
  let width = 0
  for (const { segment, index } of panelTitleSegmenter.segment(title)) {
    const segmentWidth = /^[\x00-\x7f]+$/.test(segment) ? 1 : 2
    if (width + segmentWidth > defaultPanelTitleMaxWidth) {
      return title.slice(0, index) + '...'
    }
    width += segmentWidth
  }
  return title
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
        Uri.joinPath(G.context.extensionUri, 'html'),
        Uri.joinPath(G.context.extensionUri, 'resources'),
        ...(options.additionalLocalResourceRoots || [])
      ]
    }
  )

  void renderWebviewHtml(panel.webview, options.htmlEntry)
    .then(html => {
      panel.webview.html = html
    })
    .catch(err => logger.error('Webview 页面加载失败', err, { htmlEntry: options.htmlEntry }))

  if (options.resourceIcon) {
    panel.iconPath = {
      light: Uri.joinPath(G.context.extensionUri, 'resources', 'light', options.resourceIcon),
      dark: Uri.joinPath(G.context.extensionUri, 'resources', 'dark', options.resourceIcon)
    }
  } else if (options.useDefaultIcon) {
    setDefaultPanelIcon(panel)
  }

  return panel
}
