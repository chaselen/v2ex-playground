import { EOL } from 'node:os'
import vscode from 'vscode'
import G from '@/global'
import { openExternal } from '@/features/openExternal'

/**
 * 复制话题链接
 * @param topicId 话题 id
 */
export function copyTopicLink(topicId: string | number) {
  void vscode.env.clipboard.writeText(G.V2ex.getTopicLinkById(topicId))
}

/**
 * 复制话题标题和链接
 * @param topicId 话题 id
 * @param title 话题标题
 */
export function copyTopicTitleLink(topicId: string | number, title: string) {
  const link = G.V2ex.getTopicLinkById(topicId)
  void vscode.env.clipboard.writeText(`${title}${EOL}${link}`)
}

/**
 * 在浏览器中打开话题
 * @param topicId 话题 id
 */
export function viewTopicInBrowser(topicId: string | number) {
  openExternal(G.V2ex.getTopicLinkById(topicId))
}
