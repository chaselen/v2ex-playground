import { readFileSync } from 'fs'
import path from 'path'
import vscode from 'vscode'
import G from '@/global'

/**
 * 渲染 Vite 构建后的 Webview HTML
 * @param webview VS Code Webview
 * @param filename HTML 文件名
 */
export function renderWebviewHtml(webview: vscode.Webview, filename: string): string {
  const htmlDir = path.join(G.context.extensionPath, 'html')
  const htmlPath = path.join(htmlDir, filename)
  const source = readFileSync(htmlPath, 'utf-8')

  return source.replace(/\b(src|href)="([^"]+)"/g, (match, attr: string, rawUrl: string) => {
    if (!isLocalAssetUrl(rawUrl)) {
      return match
    }

    const assetPath = rawUrl.replace(/^\.?\//, '')
    const uri = webview.asWebviewUri(vscode.Uri.file(path.join(htmlDir, assetPath)))
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
