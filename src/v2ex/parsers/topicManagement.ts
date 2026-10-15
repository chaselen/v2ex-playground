// 使用 HTML 标准解析器恢复 textarea 的实体和原文语义
import { load } from 'cheerio'
import type { TopicManagementState } from '../types'

/** 只提取编辑所需原文，不能用主题页已渲染的 HTML 反推正文 */
export function parseTopicEditContent(
  html: string,
  topicId: number
): Pick<TopicManagementState, 'title' | 'content' | 'syntax'> {
  const $ = load(html)
  const form = $(`form[method="post"][action="/edit/topic/${topicId}"]`)
  const title = form.find('textarea[name="title"]')
  const content = form.find('textarea[name="content"]')
  const syntax = String(form.find('select[name="syntax"]').val() ?? '')
  if (!title.length || !content.length || !['0', '1'].includes(syntax)) {
    throw new Error(
      $('.problem, #error_message, .message').first().text().trim() ||
        $('#Main .inner').first().text().trim() ||
        '无法读取主题原文，请刷新后重试'
    )
  }
  return {
    title: String(title.val() ?? ''),
    content: String(content.val() ?? ''),
    syntax: syntax === '1' ? 'markdown' : 'default'
  }
}
