import { getTopicLink } from '@/v2ex'
import { EOL } from 'node:os'
import vscode from 'vscode'
import { openExternal } from '@/features/openExternal'

/**
 * 复制话题链接
 * @param topicId 话题 id
 */
export function copyTopicLink(topicId: string | number) {
  void vscode.env.clipboard.writeText(getTopicLink(topicId))
}

/**
 * 复制话题标题和链接
 * @param topicId 话题 id
 * @param title 话题标题
 */
export function copyTopicTitleLink(topicId: string | number, title: string) {
  const link = getTopicLink(topicId)
  void vscode.env.clipboard.writeText(`${title}${EOL}${link}`)
}

/**
 * 在浏览器中打开话题
 * @param topicId 话题 id
 */
export function viewTopicInBrowser(topicId: string | number) {
  openExternal(getTopicLink(topicId))
}
