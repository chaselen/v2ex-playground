import * as cheerio from 'cheerio/slim'
import { parsePagerTotalPage } from '../parsers/common'
import {
  parseReplies,
  parseTagTopicList,
  parseTopicIdByLink,
  parseTopicListCells,
  parseTopicMeta
} from '../parsers/topic'
import { getResponseUrl } from '../clientUtils'
import { parseTopicEditContent } from '../parsers/topicManagement'
import type { TopicManagementAction, TopicManagementState, TopicManagementInput } from '../types'
import {
  type CreateTopicInput,
  type CreateTopicResult,
  type PreviewContentTarget,
  type TagTopicList,
  type ThankResponse,
  type Topic,
  type TopicDetail,
  type TopicSyntax,
  TOPIC_CONTENT_MAX_LENGTH,
  TOPIC_TITLE_MAX_LENGTH
} from '../types'
import type { V2exSession } from '../session'

/** V2EX 话题领域服务 */
export class TopicService {
  constructor(
    private readonly session: V2exSession,
    private readonly baseUrl: string,
    private readonly getOnce: () => Promise<string>
  ) {}

  /** 根据话题 id 获取话题链接 */
  getLink(topicId: string | number): string {
    return `${this.baseUrl}/t/${topicId}`
  }

  /** 根据标签名称获取标签页链接 */
  getTagLink(tag: string): string {
    return `${this.baseUrl}/tag/${encodeURIComponent(normalizeTag(tag))}`
  }

  /** 从链接中提取话题 id */
  getIdByLink(topicLink: string): number | undefined {
    return parseTopicIdByLink(topicLink)
  }

  /** 根据首页标签获取话题列表 */
  async getListByTab(tab: string): Promise<Topic[]> {
    const { data: html } = await this.session.get<string>(`/?tab=${tab}`)
    const $ = cheerio.load(html)
    return parseTopicListCells($, $('#Main > .box').eq(0).children('.cell.item'))
  }

  /** 根据标签获取话题列表 */
  async getListByTag(tag: string): Promise<TagTopicList> {
    const normalizedTag = normalizeTag(tag)
    const { data: html } = await this.session.get<string>(
      `/tag/${encodeURIComponent(normalizedTag)}`
    )
    const $ = cheerio.load(html)
    return parseTagTopicList($, normalizedTag)
  }

  /** 获取话题详情 */
  async getDetail(topicId: number, page = 1): Promise<TopicDetail> {
    const replyPage = normalizePage(page)
    const { data: html } = await this.session.get<string>(`/t/${topicId}?p=${replyPage}`)
    const $ = cheerio.load(html)
    const topic = parseTopicMeta($, topicId, this.baseUrl)
    topic.replies = parseReplies($)
    topic.replyTotalPage = parsePagerTotalPage($)
    topic.replyCurrentPage = Math.min(replyPage, topic.replyTotalPage)
    return topic
  }

  /** 创作新主题 */
  async create(input: CreateTopicInput): Promise<CreateTopicResult> {
    const title = input.title.trim()
    const content = input.content
    const nodeName = input.nodeName.trim()
    const syntax = normalizeTopicSyntax(input.syntax)
    if (!title) throw new Error('主题标题不能为空')
    if (title.length > TOPIC_TITLE_MAX_LENGTH) {
      throw new Error(`主题标题不能超过 ${TOPIC_TITLE_MAX_LENGTH} 个字符`)
    }
    if (content.length > TOPIC_CONTENT_MAX_LENGTH) {
      throw new Error(`主题内容不能超过 ${TOPIC_CONTENT_MAX_LENGTH} 个字符`)
    }
    if (!nodeName) throw new Error('请选择主题节点')

    const once = await this.getOnce()
    const response = await this.session.post<string>(
      '/write',
      new URLSearchParams({
        title,
        syntax,
        content,
        node_name: nodeName,
        once
      }),
      { responseType: 'text' }
    )
    const responseUrl = new URL(getResponseUrl(response, this.baseUrl))
    const topicId = parseTopicIdByLink(responseUrl.toString())
    if (topicId) {
      return { topicId, title }
    }

    const $ = cheerio.load(response.data)
    const errorMessage =
      $('#error_message').text().trim() ||
      $('.problem').first().text().trim() ||
      $('.message').first().text().trim()
    throw new Error(errorMessage || '发布主题失败')
  }

  /** 仅编辑需要读取原始正文；移动和附言只检查当前权限 */
  async prepareManagement(
    topicId: number,
    action: TopicManagementAction
  ): Promise<TopicManagementState> {
    const detail = await this.requireManagementAction(topicId, action)
    const state: TopicManagementState = {
      title: detail.title,
      content: '',
      syntax: 'default',
      nodeName: detail.node.name
    }
    if (action === 'edit') {
      const { data } = await this.session.get<string>(`/edit/topic/${topicId}`)
      Object.assign(state, parseTopicEditContent(data, topicId))
    }
    return state
  }

  /** 按已核实的三个独立表单契约提交；只有附言携带 once */
  async manage(topicId: number, input: TopicManagementInput): Promise<void> {
    await this.requireManagementAction(topicId, input.action)
    const body = new URLSearchParams()
    if (input.action === 'move') {
      if (!input.nodeName.trim()) throw new Error('请选择目标节点')
      body.set('destination', input.nodeName.trim())
    } else {
      if (input.syntax !== 'default' && input.syntax !== 'markdown')
        throw new Error('无效的文本标记语法')
      if (input.action === 'edit') {
        if (!input.title.trim()) throw new Error('主题标题不能为空')
        body.set('title', input.title.trim())
      } else {
        if (!input.content.trim()) throw new Error('附言内容不能为空')
        body.set('once', await this.getOnce())
      }
      body.set('content', input.content)
      body.set('syntax', input.syntax === 'markdown' ? '1' : '0')
    }
    const response = await this.session.post<string>(`/${input.action}/topic/${topicId}`, body, {
      responseType: 'text'
    })
    const url = new URL(getResponseUrl(response, this.baseUrl))
    if (url.pathname !== `/t/${topicId}`) {
      const $ = cheerio.load(response.data)
      throw new Error(
        $('.problem, #error_message, .message').first().text().trim() ||
          $('#Main .inner').first().text().trim() ||
          '操作未成功，请刷新主题后核对'
      )
    }
  }

  /** 权限以主题头部的服务端入口为准，写入时再次校验 */
  private async requireManagementAction(topicId: number, action: TopicManagementAction) {
    if (!['edit', 'move', 'append'].includes(action)) throw new Error('无效的主题操作')
    const detail = await this.getDetail(topicId)
    if (!detail.managementActions?.includes(action))
      throw new Error('当前主题不支持此操作，请刷新后重试')
    return detail
  }

  /** 提交回复 */
  async postReply(topicId: number, content: string): Promise<void> {
    const once = await this.getOnce()
    await this.session.post(`/t/${topicId}`, new URLSearchParams({ content, once }))
  }

  /**
   * 预览话题或回复内容
   * @param text 预览内容
   * @param syntax 预览语法
   * @param target 预览目标
   */
  async previewContent(
    text: string,
    syntax: TopicSyntax,
    target: PreviewContentTarget
  ): Promise<string> {
    const formData = new FormData()
    formData.append('text', text)
    if (target === 'topic') {
      formData.append('topic_content', '1')
    }
    const response = await this.session.post<string>(
      `/preview/${normalizeTopicSyntax(syntax)}`,
      formData,
      {
        responseType: 'text',
        transformResponse: data => data
      }
    )
    return String(response.data || '')
  }

  /** 感谢回复 */
  async thankReply(replyId: string): Promise<void> {
    const once = await this.getOnce()
    const response = await this.session.post<ThankResponse>(`/thank/reply/${replyId}?once=${once}`)
    if (response.status !== 200 || !response.data.success) {
      throw new Error(response.data.message || '感谢回复失败')
    }
  }

  /** 感谢话题 */
  async thankTopic(topicId: number): Promise<void> {
    const once = await this.getOnce()
    const response = await this.session.post<ThankResponse>(`/thank/topic/${topicId}?once=${once}`)
    if (response.status !== 200 || !response.data.success) {
      throw new Error(response.data.message || '感谢帖子失败')
    }
  }

  /** 收藏话题 */
  async collect(topicId: number): Promise<void> {
    await this.updateTopicAction(`/favorite/topic/${topicId}`, '收藏失败')
  }

  /** 取消收藏话题 */
  async cancelCollect(topicId: number): Promise<void> {
    await this.updateTopicAction(`/unfavorite/topic/${topicId}`, '取消收藏失败')
  }

  /** 忽略话题 */
  async ignore(topicId: number): Promise<void> {
    const topic = await this.getDetail(topicId)
    if (topic.isIgnored) return
    if (!topic.canIgnore) throw new Error('当前主题不支持忽略')
    await this.updateTopicAction(`/ignore/topic/${topicId}`, '忽略主题失败')
  }

  /** 取消忽略话题 */
  async cancelIgnore(topicId: number): Promise<void> {
    const topic = await this.getDetail(topicId)
    if (!topic.isIgnored) return
    await this.updateTopicAction(`/unignore/topic/${topicId}`, '取消忽略失败')
  }

  /** 执行话题状态更新请求 */
  private async updateTopicAction(path: string, errorMessage: string): Promise<void> {
    const once = await this.getOnce()
    const response = await this.session.get<string>(`${path}?once=${once}`, {
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    })
    if (response.status !== 302) throw new Error(errorMessage)
  }
}

/** 归一化页码 */
function normalizePage(page?: number): number {
  return Number.isFinite(page) ? Math.max(1, Math.floor(Number(page))) : 1
}

/** 归一化标签名称 */
function normalizeTag(tag: string): string {
  const normalizedTag = tag.trim()
  if (!normalizedTag) {
    throw new Error('标签名称不能为空')
  }
  return normalizedTag
}

/** 规范化话题正文语法 */
function normalizeTopicSyntax(syntax?: string): TopicSyntax {
  return syntax === 'default' ? 'default' : 'markdown'
}
