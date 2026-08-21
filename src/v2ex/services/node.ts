import * as cheerio from 'cheerio/slim'
import { parsePagerTotalPage } from '../parsers/common'
import { parseTopicListCells } from '../parsers/topic'
import type { V2exSession } from '../session'
import type { Node, NodeTopicList } from '../types'

/** V2EX 节点领域服务 */
export class NodeService {
  private cachedNodes: Node[] = []

  constructor(
    private readonly session: V2exSession,
    private readonly baseUrl: string
  ) {}

  /**
   * 根据节点 name 获取节点页链接
   * 节点 name 来自 `/go/{name}` 路径段，本身无需 URL 编码
   * @param nodeName 节点 name
   */
  getLink(nodeName: string): string {
    return `${this.baseUrl}/go/${nodeName}`
  }

  /** 获取节点话题列表 */
  async getTopics(nodeName: string, page = 1): Promise<NodeTopicList> {
    const { data: html } = await this.session.get<string>(`/go/${nodeName}?p=${page}`)
    const $ = cheerio.load(html)
    const node = this.parsePageInfo($, nodeName)
    return {
      node,
      totalPage: parsePagerTotalPage($),
      totalCount:
        Number($('.node-header .topic-count strong').first().text().replace(/,/g, '')) || 0,
      list: parseTopicListCells($, $('#TopicsNode .cell[class*="t_"]'), node)
    }
  }

  /** 获取所有节点 */
  async getAll(): Promise<Node[]> {
    if (this.cachedNodes.length) return this.cachedNodes
    const { data } = await this.session.get<V2exApiNode[]>('/api/nodes/all.json')
    this.cachedNodes = (Array.isArray(data) ? data : [])
      .map(item => this.mapApiNode(item))
      .filter(node => node.name.length > 0)
    return this.cachedNodes
  }

  /** 获取已收藏节点 */
  async getCollection(): Promise<Node[]> {
    const { data: html } = await this.session.get<string>('/my/nodes')
    const $ = cheerio.load(html)
    const nodes: Node[] = []
    $('#my-nodes > a.fav-node').each((_, element) => {
      nodes.push({
        name: $(element).attr('href')?.split('go/')[1] || '',
        title: $(element).children('.fav-node-name').text().trim().split(' ')[0]
      })
    })
    return nodes
  }

  /** 收藏节点 */
  async collect(nodeName: string): Promise<void> {
    await this.updateCollection(nodeName, 'favorite', '收藏节点失败')
  }

  /** 取消收藏节点 */
  async cancelCollect(nodeName: string): Promise<void> {
    await this.updateCollection(nodeName, 'unfavorite', '取消收藏节点失败')
  }

  /**
   * 根据节点页收藏链接更新收藏状态
   * @param nodeName 节点 name
   * @param action 收藏或取消收藏
   * @param errorMessage 失败文案
   */
  private async updateCollection(
    nodeName: string,
    action: 'favorite' | 'unfavorite',
    errorMessage: string
  ): Promise<void> {
    const { data: html } = await this.session.get<string>(`/go/${nodeName}`)
    const $ = cheerio.load(html)
    const href = $(`a[href^="/${action}/node/"]`).first().attr('href')
    const url = new URL(href || '/', this.baseUrl)
    const nodeId = Number(url.pathname.match(new RegExp(`^/${action}/node/(\\d+)$`))?.[1])
    const once = url.searchParams.get('once')
    if (!nodeId || !once) {
      throw new Error(action === 'favorite' ? '未找到节点收藏参数' : '未找到节点取消收藏参数')
    }

    const response = await this.session.get(`/${action}/node/${nodeId}?once=${once}`, {
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    })
    if (response.status !== 302) throw new Error(errorMessage)
  }

  /** 解析节点页面信息 */
  private parsePageInfo($: cheerio.CheerioAPI, nodeName: string): Node {
    const header = $('.node-header').first()
    const avatar = header.find('.page-content-header > img').first().attr('src')
    const description = header.find('.intro').first().text().trim()
    const isCollected = $('a[href^="/unfavorite/node/"]').length > 0
    const collectCountMatch = $('.cell.flex-one-row')
      .first()
      .text()
      .match(/([\d,]+)\s*人收藏了这个节点/)
    const collectCount = collectCountMatch
      ? Number(collectCountMatch[1].replace(/,/g, '')) || 0
      : undefined

    return {
      name: nodeName,
      title: header.find('.node-breadcrumb').first().text().split('›').pop()?.trim() || nodeName,
      avatar: this.normalizeAvatar(avatar),
      description: description || undefined,
      isCollected,
      collectCount
    }
  }

  /**
   * 将 `/api/nodes/all.json` 节点映射为领域类型
   * @param item API 节点
   */
  private mapApiNode(item: V2exApiNode): Node {
    const collectCount = typeof item.stars === 'number' && item.stars >= 0 ? item.stars : undefined

    return {
      name: item.name?.trim() || '',
      title: item.title?.trim() || item.name?.trim() || '',
      avatar: this.normalizeAvatar(
        item.avatar_mini || item.avatar_normal || item.avatar_large || undefined
      ),
      collectCount
    }
  }

  /**
   * 规范化节点图标地址
   * API / 页面常对无自定义图标节点返回 `/static/img/node_default_*.png`，这类占位图视为无图标
   * @param avatarSrc 原始图标地址
   */
  private normalizeAvatar(avatarSrc?: string): string | undefined {
    if (!avatarSrc?.trim()) {
      return undefined
    }

    try {
      const avatar = new URL(avatarSrc, this.baseUrl).toString()
      /* node_default_* 是站点统一占位图，不作为真实节点图标返回 */
      return avatar.includes('node_default') ? undefined : avatar
    } catch {
      return undefined
    }
  }
}

/** V2EX `/api/nodes/all.json` 节点字段 */
interface V2exApiNode {
  /** 节点 name */
  name?: string
  /** 节点标题 */
  title?: string
  /** 收藏人数 */
  stars?: number
  /** 小尺寸图标 */
  avatar_mini?: string
  /** 常规尺寸图标 */
  avatar_normal?: string
  /** 大尺寸图标 */
  avatar_large?: string
}
