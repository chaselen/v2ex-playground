import * as cheerio from 'cheerio/slim'
import { parsePagerTotalPage } from '../parsers/common'
import {
  parseReplies,
  parseTopicIdByLink,
  parseTopicListCells,
  parseTopicMeta
} from '../parsers/topic'
import type { ThankResponse, Topic, TopicDetail } from '../types'
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
}

/** 归一化页码 */
function normalizePage(page?: number): number {
  return Number.isFinite(page) ? Math.max(1, Math.floor(Number(page))) : 1
}
