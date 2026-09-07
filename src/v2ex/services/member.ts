import * as cheerio from 'cheerio/slim'
import { parseMemberContent, parseMemberInfo } from '../parsers/member'
import type { V2exSession } from '../session'
import type { MemberContent, MemberContentOptions, MemberContentTabKey, MemberInfo } from '../types'

/** V2EX 用户 API 中的资料字段 */
interface MemberApiInfo {
  /** 用户签名 */
  tagline?: unknown
  /** 用户简介 */
  bio?: unknown
}

/** 用户页支持的内容标签 */
const memberContentTabs = new Set<MemberContentTabKey>([
  'topics',
  'replies',
  'qna',
  'tech',
  'play',
  'jobs',
  'deals',
  'city'
])

/** V2EX 用户领域服务 */
export class MemberService {
  constructor(
    private readonly session: V2exSession,
    private readonly baseUrl: string,
    private readonly getOnce: () => Promise<string>
  ) {}

  /** 根据用户名获取用户主页链接 */
  getLink(username: string): string {
    return `${this.baseUrl}/member/${username}`
  }

  /** 获取用户基本信息 */
  async getInfo(username: string): Promise<MemberInfo> {
    const [pageResponse, apiResponse] = await Promise.all([
      this.session.get<string>(`/member/${username}`),
      this.session.get<MemberApiInfo>('/api/members/show.json', {
        params: { username }
      })
    ])
    const member = parseMemberInfo(cheerio.load(pageResponse.data), username)

    return {
      ...member,
      tagline: normalizeApiText(apiResponse.data.tagline, member.tagline),
      bio: normalizeApiText(apiResponse.data.bio)
    }
  }

  /** 获取用户活动内容 */
  async getContent(username: string, options: MemberContentOptions = {}): Promise<MemberContent> {
    const tab = this.normalizeTab(options.tab)
    const page = normalizePage(options.page)
    const { data: html } = await this.session.get<string>(this.getContentPath(username, tab, page))
    return parseMemberContent(cheerio.load(html), username, tab, page)
  }

  /**
   * 加入特别关注
   * @param memberId 用户编号
   */
  async follow(memberId: number): Promise<void> {
    await this.updateMemberRelation(memberId, 'follow', '加入特别关注失败')
  }

  /**
   * 取消特别关注
   * @param memberId 用户编号
   */
  async unfollow(memberId: number): Promise<void> {
    await this.updateMemberRelation(memberId, 'unfollow', '取消特别关注失败')
  }

  /**
   * 屏蔽用户
   * @param memberId 用户编号
   */
  async block(memberId: number): Promise<void> {
    await this.updateMemberRelation(memberId, 'block', '屏蔽用户失败')
  }

  /**
   * 取消屏蔽用户
   * @param memberId 用户编号
   */
  async unblock(memberId: number): Promise<void> {
    await this.updateMemberRelation(memberId, 'unblock', '取消屏蔽用户失败')
  }

  /**
   * 更新用户关系状态
   * @param memberId 用户编号
   * @param action 关系操作
   * @param errorMessage 操作失败提示
   */
  private async updateMemberRelation(
    memberId: number,
    action: MemberRelationAction,
    errorMessage: string
  ): Promise<void> {
    const normalizedMemberId = normalizeMemberId(memberId)
    const once = await this.getOnce()
    const response = await this.session.get(`/${action}/${normalizedMemberId}?once=${once}`, {
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    })
    if (response.status !== 302) {
      throw new Error(errorMessage)
    }
  }

  /** 归一化用户页标签 */
  private normalizeTab(tab?: MemberContentTabKey): MemberContentTabKey {
    return tab && memberContentTabs.has(tab) ? tab : 'topics'
  }

  /** 获取用户页请求路径 */
  private getContentPath(username: string, tab: MemberContentTabKey, page: number): string {
    return `/member/${username}/${tab}?p=${page}`
  }
}

/** 用户关系操作 */
type MemberRelationAction = 'follow' | 'unfollow' | 'block' | 'unblock'

/** 归一化页码 */
function normalizePage(page?: number): number {
  return Number.isFinite(page) ? Math.max(1, Math.floor(Number(page))) : 1
}

/**
 * 归一化用户编号
 * @param memberId 用户编号
 */
function normalizeMemberId(memberId: number): number {
  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw new Error('用户编号无效')
  }
  return memberId
}

/**
 * 将 API 文本字段归一化为字符串
 * @param value API 字段值
 * @param fallback 字段缺失时的兜底值
 */
function normalizeApiText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}
