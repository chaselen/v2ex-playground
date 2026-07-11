import * as cheerio from 'cheerio/slim'
import { parseMemberContent, parseMemberInfo } from '../parsers/member'
import type { V2exSession } from '../session'
import type { MemberContent, MemberContentOptions, MemberContentTabKey, MemberInfo } from '../types'

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
    private readonly baseUrl: string
  ) {}

  /** 根据用户名获取用户主页链接 */
  getLink(username: string): string {
    return `${this.baseUrl}/member/${username}`
  }

  /** 获取用户基本信息 */
  async getInfo(username: string): Promise<MemberInfo> {
    const { data: html } = await this.session.get<string>(`/member/${username}`)
    return parseMemberInfo(cheerio.load(html), username)
  }

  /** 获取用户活动内容 */
  async getContent(username: string, options: MemberContentOptions = {}): Promise<MemberContent> {
    const tab = this.normalizeTab(options.tab)
    const page = normalizePage(options.page)
    const { data: html } = await this.session.get<string>(this.getContentPath(username, tab, page))
    return parseMemberContent(cheerio.load(html), username, tab, page)
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

/** 归一化页码 */
function normalizePage(page?: number): number {
  return Number.isFinite(page) ? Math.max(1, Math.floor(Number(page))) : 1
}
