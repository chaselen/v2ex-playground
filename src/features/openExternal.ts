import vscode from 'vscode'

/**
 * 在浏览器中打开 HTTP(S) 链接
 * @param link 链接地址
 */
export function openExternal(link?: string) {
  if (!link) {
    vscode.window.showWarningMessage('链接地址为空')
    return
  }

  let url: URL
  try {
    url = new URL(link)
  } catch {
    vscode.window.showWarningMessage('链接地址无效')
    return
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    vscode.window.showWarningMessage('仅支持打开 http 或 https 链接')
    return
  }

  return vscode.env.openExternal(vscode.Uri.parse(url.toString()))
}
