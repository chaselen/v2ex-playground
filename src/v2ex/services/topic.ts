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
import {
  AccountRestrictedError,
  LoginRequiredError,
  type CreateTopicInput,
  type CreateTopicResult,
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
    await this.ensureCreateResponseAvailable(responseUrl)
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

  /** 提交回复 */
  async postReply(topicId: number, content: string): Promise<void> {
    const once = await this.getOnce()
    await this.session.post(`/t/${topicId}`, new URLSearchParams({ content, once }))
  }

  /** 预览回复内容 */
  async previewReply(text: string, syntax: 'default' | 'markdown'): Promise<string> {
    const formData = new FormData()
    formData.append('text', text)
    const response = await this.session.post<string>(`/preview/${syntax}`, formData, {
      responseType: 'text',
      transformResponse: data => data
    })
    return String(response.data || '')
  }

  /** 预览新主题正文 */
  async previewTopic(text: string, syntax: TopicSyntax): Promise<string> {
    const formData = new FormData()
    formData.append('text', text)
    formData.append('topic_content', '1')
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
    await this.updateCollection(`/favorite/topic/${topicId}`, '收藏失败')
  }

  /** 取消收藏话题 */
  async cancelCollect(topicId: number): Promise<void> {
    await this.updateCollection(`/unfavorite/topic/${topicId}`, '取消收藏失败')
  }

  /** 更新话题收藏状态 */
  private async updateCollection(path: string, errorMessage: string): Promise<void> {
    const once = await this.getOnce()
    const response = await this.session.get<string>(`${path}?once=${once}`, {
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    })
    if (response.status !== 302) throw new Error(errorMessage)
  }

  /** 检查发布主题后的跳转结果 */
  private async ensureCreateResponseAvailable(responseUrl: URL): Promise<void> {
    if (responseUrl.pathname === '/signin') {
      await this.session.expireLogin()
      throw new LoginRequiredError('创作新主题需要先登录')
    }
    if (responseUrl.pathname === '/restricted') {
      throw new AccountRestrictedError('当前账号访问受限，无法创作新主题')
    }
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
