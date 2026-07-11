import vscode from 'vscode'
import { openTopic as openTopicPanel } from '@/features/panelNavigation'
import G from '@/global'

/**
 * 使用原生输入框获取帖子 ID 或链接并打开帖子面板
 */
export default async function openTopic() {
  const input = await vscode.window.showInputBox({
    title: '打开帖子',
    prompt: '输入帖子 ID、帖子链接或包含帖子链接的文本',
    placeHolder: '例如：1136705 或 https://www.v2ex.com/t/1136705',
    validateInput: value =>
      !value.trim() || parseTopicId(value)
        ? undefined
        : '未找到有效的帖子 ID 或链接',
  })

  if (input === undefined) {
    return
  }

  const topicId = parseTopicId(input)
  if (!topicId) {
    return
  }

  openTopicPanel({ label: `/t/${topicId}`, topicId })
}

/**
 * 从纯数字 ID、帖子链接或包含帖子链接的文本中解析帖子 ID
 * @param input 用户输入
 */
function parseTopicId(input: string): number | undefined {
  const normalizedInput = input.trim()
  if (/^\d+$/.test(normalizedInput)) {
    const topicId = Number(normalizedInput)
    return Number.isSafeInteger(topicId) && topicId > 0 ? topicId : undefined
  }

  const topicId = G.V2ex.getTopicIdByLink(normalizedInput)
  return topicId && Number.isSafeInteger(topicId) && topicId > 0
    ? topicId
    : undefined
}
