import vscode, { Uri } from 'vscode'
import G from '@/global'

/**
 * 渲染 Vite 构建后的 Webview HTML
 * @param webview VS Code Webview
 * @param filename HTML 文件名
 */
export async function renderWebviewHtml(
  webview: vscode.Webview,
  filename: string
): Promise<string> {
  const htmlDirUri = Uri.joinPath(G.context.extensionUri, 'html')
  const htmlUri = Uri.joinPath(htmlDirUri, filename)
  const source = new TextDecoder().decode(await vscode.workspace.fs.readFile(htmlUri))

  return source.replace(/\b(src|href)="([^"]+)"/g, (match, attr: string, rawUrl: string) => {
    if (!isLocalAssetUrl(rawUrl)) {
      return match
    }

    const assetPath = rawUrl.replace(/^\.?\//, '')
    const uri = webview.asWebviewUri(Uri.joinPath(htmlDirUri, assetPath))
    return `${attr}="${uri.toString()}"`
  })
}

/**
 * 判断是否是需要转换的本地资源地址
 * @param url 资源地址
 */
function isLocalAssetUrl(url: string): boolean {
  if (!url || url.startsWith('#')) {
    return false
  }

  return !/^(https?:|data:|mailto:|javascript:|vscode-resource:|vscode-webview-resource:)/.test(url)
}
