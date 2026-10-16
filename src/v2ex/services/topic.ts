import type { AxiosResponse } from 'axios'
import { getTagLink, parseTopicIdByLink } from '../links'
import * as cheerio from 'cheerio/slim'
import dayjs, { BEIJING_UTC_OFFSET } from '@/core/dayjs'
import { parsePagerTotalPage } from '../parsers/common'
import {
  parseReplies,
  parseTagTopicList,
  parseTopicListCells,
  parseTopicMeta,
  parseTopicInfo,
  parseTopicEditContent,
  parseTopicManagement
} from '../parsers/topic'
import { getResponseUrl } from '../clientUtils'
import type {
  TopicContentAction,
  TopicContentState,
  TopicContentInput,
  TopicManagementAction,
  TopicManagementState,
  TopicManagementInput
} from '../types'
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

/**
 * 主题 API `/api/topics/show.json?id=` 单条成功响应字段
 *
 * 主题不存在时接口返回 `[]`；有结果时这些字段均会给出。
 * `last_reply_by` 无回复时为空字符串。
 */
interface TopicShowApiInfo {
  /** 主题编号 */
  id: number
  /** 标题 */
  title: string
  /** 回复数 */
  replies: number
  /** 创建时间 Unix 秒 */
  created: number
  /** 最后回复用户名；无回复时为空字符串 */
  last_reply_by: string
  /** 作者 */
  member: {
    /** 用户名 */
    username: string
  }
  /** 节点 */
  node: {
    /** 节点 name */
    name: string
    /** 节点标题 */
    title: string
  }
}

/** V2EX 话题领域服务 */
export class TopicService {
  constructor(
    private readonly session: V2exSession,
    private readonly baseUrl: string
  ) {}

  /** 根据首页标签获取话题列表 */
  async getListByTab(tab: string): Promise<Topic[]> {
    const { data: html } = await this.session.get<string>(`/?tab=${tab}`)
    const $ = cheerio.load(html)
    return parseTopicListCells($, $('#Main > .box').eq(0).children('.cell.item'))
  }

  /** 根据标签获取话题列表 */
  async getListByTag(tag: string): Promise<TagTopicList> {
    const tagLink = getTagLink(tag, this.baseUrl)
    const normalizedTag = tag.trim()
    const { data: html } = await this.session.get<string>(tagLink)
    const $ = cheerio.load(html)
    return parseTagTopicList($, normalizedTag)
  }

  /** 读取源站授权的主题信息；不从详情推算统计或时间 */
  async getInfo(topicId: number) {
    const { data: html } = await this.session.get<string>(`/t/${topicId}/info`)
    return parseTopicInfo(html, topicId)
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

  /**
   * 按主题编号列表补齐主题摘要
   *
   * 逐个请求 `/api/topics/show.json`；单个失败时跳过该编号，不中断整表，并保持入参顺序
   * @param topicIds 主题编号
   */
  async getByIds(topicIds: number[]): Promise<Topic[]> {
    if (!topicIds.length) {
      return []
    }

    const topics = await Promise.all(
      topicIds.map(async topicId => {
        try {
          return await this.getTopicListItemById(topicId)
        } catch {
          return undefined
        }
      })
    )

    return topics.filter((topic): topic is Topic => !!topic)
  }

  /**
   * 按主题编号获取主题摘要
   * @param topicId 主题编号
   */
  private async getTopicListItemById(topicId: number): Promise<Topic> {
    const { data } = await this.session.get<TopicShowApiInfo[]>('/api/topics/show.json', {
      params: { id: topicId }
    })
    const item = Array.isArray(data) ? data[0] : undefined
    if (!item) {
      throw new Error(`未找到编号为 ${topicId} 的主题`)
    }

    const title = item.title.trim()
    if (!title) {
      throw new Error(`未找到编号为 ${topicId} 的主题`)
    }

    const nodeName = item.node.name.trim()
    const nodeTitle = item.node.title.trim()
    const authorName = item.member.username.trim()
    const lastReplyUser = item.last_reply_by.trim()
    const publishedAt = dayjs
      .unix(item.created)
      .utcOffset(BEIJING_UTC_OFFSET)
      .format('YYYY-MM-DD HH:mm:ss')

    return {
      id: item.id > 0 ? item.id : topicId,
      title,
      node: {
        name: nodeName,
        title: nodeTitle || nodeName
      },
      authorName: authorName || undefined,
      replies: Math.max(0, Math.floor(item.replies)),
      displayTime: publishedAt,
      publishedAt,
      lastReplyUser: lastReplyUser || undefined
    }
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

    const once = await this.session.getOnce()
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

  /** 内容操作仅在编辑时读取原文，移动和附言检查当前权限 */
  async prepareContent(topicId: number, action: TopicContentAction): Promise<TopicContentState> {
    const detail = await this.requireContentAction(topicId, action)
    const state: TopicContentState = {
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

  /** 按编辑、移动及附言各自的表单契约提交 */
  async updateContent(topicId: number, input: TopicContentInput): Promise<void> {
    await this.requireContentAction(topicId, input.action)
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
        body.set('once', await this.session.getOnce())
      }
      body.set('content', input.content)
      body.set('syntax', input.syntax === 'markdown' ? '1' : '0')
    }
    const response = await this.session.post<string>(`/${input.action}/topic/${topicId}`, body, {
      responseType: 'text'
    })
    this.assertTopicUpdateSuccess(response, topicId)
  }

  /** 展示管理只读取操作确认信息，不加载编辑表单 */
  async prepareManagement(
    topicId: number,
    action: TopicManagementAction
  ): Promise<TopicManagementState> {
    const operation = await this.requireManagementAction(topicId, action)
    return { confirmation: operation.confirmation }
  }

  /** 展示管理在确认费用后获取最新 once，使用当前授权入口提交 */
  async manage(topicId: number, input: TopicManagementInput): Promise<void> {
    const operation = await this.requireManagementAction(topicId, input.action)
    if (input.confirmation !== operation.confirmation) {
      throw new Error('操作说明或费用已变化，请关闭后重新确认')
    }
    const query = new URLSearchParams({ once: await this.session.getOnce() })
    const response = await this.session.get<string>(`${operation.path}?${query}`, {
      responseType: 'text',
      headers: { Referer: new URL(`/t/${topicId}`, this.baseUrl).toString() }
    })
    const $ = cheerio.load(response.data)
    // 完整响应示例：主题 1248973 已经被下沉 10 天；仅匹配成功关键词，兼容编号、时长及措辞变化
    const faded =
      input.action === 'fade' &&
      $('.message')
        .toArray()
        .some(element => /已(?:经)?被下沉/.test($(element).text()))
    if (!faded) this.assertTopicUpdateSuccess(response, topicId)
  }

  private assertTopicUpdateSuccess(response: AxiosResponse<string>, topicId: number) {
    const url = new URL(getResponseUrl(response, this.baseUrl))
    const $ = cheerio.load(response.data)
    const problem = $('.problem').first().text().trim()
    if (problem || url.pathname !== `/t/${topicId}`) {
      throw new Error(
        problem ||
          $('#error_message, .message').first().text().trim() ||
          $('#Main .inner').first().text().trim() ||
          '操作未成功，请刷新主题后核对'
      )
    }
  }

  /** 内容操作权限仅以主题头部的服务端入口为准 */
  private async requireContentAction(topicId: number, action: TopicContentAction) {
    if (!['edit', 'move', 'append'].includes(action)) throw new Error('无效的主题内容操作')
    const detail = await this.getDetail(topicId)
    if (!detail.contentActions?.includes(action))
      throw new Error('当前主题不支持此操作，请刷新后重试')
    return detail
  }

  /** 展示管理权限与确认信息只从管理栏读取，提交前再次校验 */
  private async requireManagementAction(topicId: number, action: TopicManagementAction) {
    if (!['boost', 'fade'].includes(action)) throw new Error('无效的主题管理操作')
    const { data } = await this.session.get<string>(`/t/${topicId}?p=1`)
    const operation = parseTopicManagement(cheerio.load(data), topicId)[action]
    if (!operation) throw new Error('当前主题不支持此操作，请刷新后重试')
    return operation
  }

  /** 提交回复 */
  async postReply(topicId: number, content: string): Promise<void> {
    const once = await this.session.getOnce()
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
    const once = await this.session.getOnce()
    const response = await this.session.post<ThankResponse>(`/thank/reply/${replyId}?once=${once}`)
    if (response.status !== 200 || !response.data.success) {
      throw new Error(response.data.message || '感谢回复失败')
    }
  }

  /** 感谢话题 */
  async thankTopic(topicId: number): Promise<void> {
    const once = await this.session.getOnce()
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
    const once = await this.session.getOnce()
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

/** 规范化话题正文语法 */
function normalizeTopicSyntax(syntax?: string): TopicSyntax {
  return syntax === 'default' ? 'default' : 'markdown'
}
