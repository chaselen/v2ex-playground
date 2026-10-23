import type { SyntaxTheme } from 'vscode-tint'
import type {
  SyntaxThemeRpcCommands,
  SyntaxThemeWebviewEvents
} from '@extension/shared/syntaxTheme'
import { createVsCodeClient, subscribeWebviewState } from './vscode'

let latest: SyntaxTheme = { settings: [] }
let ready: Promise<void> | undefined
const listeners = new Set<(theme: SyntaxTheme) => void>()

/** 首次需要高亮时读取主题，订阅先于读取，避免旧响应覆盖新事件 */
export async function getSyntaxTheme(): Promise<SyntaxTheme> {
  if (!ready) {
    ready = new Promise(resolve => {
      if (typeof acquireVsCodeApi !== 'function') {
        resolve()
        return
      }
      const vscode = createVsCodeClient<SyntaxThemeRpcCommands, SyntaxThemeWebviewEvents>()
      subscribeWebviewState(
        handler => vscode.on('syntaxThemeChanged', event => handler(event.theme)),
        () => vscode.getSyntaxTheme(),
        theme => {
          latest = theme
          listeners.forEach(listener => listener(theme))
          resolve()
        },
        error => {
          console.error('读取代码高亮主题失败', error)
          resolve()
        }
      )
    })
  }
  await ready
  return latest
}

/** 文档级高亮器使用的主题变更订阅 */
export function onSyntaxThemeChanged(listener: (theme: SyntaxTheme) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
