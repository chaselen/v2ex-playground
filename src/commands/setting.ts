import vscode from 'vscode'
import G from '../global'

/**
 * 打开插件设置
 */
export default async function setting() {
  vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${G.context.extension.id}`)
}
