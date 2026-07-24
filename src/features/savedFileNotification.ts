import vscode, { Uri } from 'vscode'

/**
 * 显示文件保存位置并提供查看操作
 * @param destination 已保存文件 URI
 * @param label 通知文案
 */
export async function showSavedFileNotification(destination: Uri, label: string) {
  const displayPath = destination.scheme === 'file' ? destination.fsPath : destination.path
  const action = await vscode.window.showInformationMessage(`${label}：${displayPath}`, '查看')
  if (action !== '查看') {
    return
  }

  const command = destination.scheme === 'file' ? 'revealFileInOS' : 'revealInExplorer'
  await vscode.commands.executeCommand(command, destination)
}
