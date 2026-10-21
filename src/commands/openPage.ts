import { getTopicLink } from '@/v2ex'
import vscode from 'vscode'
import { canOpenWebviewUrl, openWebviewUrl } from '@/features/webviewNavigation'

/** 使用原生输入框获取帖子 ID 或页面链接，并通过共享导航打开 */
export default async function openPage() {
  const input = await vscode.window.showInputBox({
    title: '打开页面',
    prompt:
      '输入帖子 ID、页面链接或包含链接的文本，支持帖子、用户、帮助、创建主题、节点、标签和余额页',
    placeHolder: '例如：1136705、/member/Livid 或 https://www.v2ex.com/go/vscode',
    validateInput: value =>
      !value.trim() || parsePageUrl(value) ? undefined : '未找到插件支持的页面链接或有效的帖子 ID'
  })

  if (input === undefined) return

  const url = parsePageUrl(input)
  if (url) openWebviewUrl(url)
}

/** 从帖子 ID、站内路径或文本中的完整链接提取插件支持的页面 */
function parsePageUrl(input: string): string | undefined {
  const value = input.trim()
  if (/^\d+$/.test(value)) {
    const topicId = Number(value)
    return Number.isSafeInteger(topicId) && topicId > 0 ? getTopicLink(topicId) : undefined
  }

  if (value.startsWith('/') && !value.startsWith('//')) {
    const url = `https://www.v2ex.com${value}`
    return canOpenWebviewUrl(url) ? url : undefined
  }

  const links = (value.match(/https?:\/\/[^\s<>"'`()\[\]，。！？；（）【】]+/gi) ?? []).map(link =>
    link.replace(/[.,;!]+$/, '')
  )
  return links.find(canOpenWebviewUrl)
}
