// 完整 cheerio 入口会额外打包 parse5、undici 和编码处理依赖，显著增大 VSIX
// 复用 slim 的 htmlparser2，并由 decodeTextarea 补齐 textarea 的文本恢复规则
import { load } from 'cheerio/slim'
import { decodeHTML } from 'entities'
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
    title: decodeTextarea(String(title.val() ?? '')),
    content: decodeTextarea(String(content.val() ?? '')),
    syntax: syntax === '1' ? 'markdown' : 'default'
  }
}

/**
 * htmlparser2 10 保留 textarea 内的实体，直接读取 .val() 会把 &lt; 等转义文本带入编辑框
 * 实体只解码一次，例如 &amp;lt; 应恢复为 &lt;，不能继续变成 <
 * 升级 Cheerio / htmlparser2 时须核对 textarea 行为并运行对应回归测试，避免重复解码
 */
function decodeTextarea(raw: string): string {
  // 输入换行和空字符先标准化；首个 LF 在实体解码后移除，保留字符引用产生的 CR
  return decodeHTML(raw.replace(/\r\n?/g, '\n').replace(/\0/g, '\uFFFD')).replace(/^\n/, '')
}
