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
    const { data: html } = await this.session.get<string>('/planes')
    const $ = cheerio.load(html)
    const nodes: Node[] = []
    $('a.item_node').each((_, element) => {
      nodes.push({
        name: $(element).attr('href')?.split('go/')[1] || '',
        title: $(element).text().trim()
      })
    })
    this.cachedNodes = nodes
    return nodes
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

  /** 取消收藏节点 */
  async cancelCollect(nodeName: string): Promise<void> {
    const { data: html } = await this.session.get<string>(`/go/${nodeName}`)
    const $ = cheerio.load(html)
    const href = $('a[href^="/unfavorite/node/"]').first().attr('href')
    const url = new URL(href || '/', this.baseUrl)
    const nodeId = Number(url.pathname.match(/^\/unfavorite\/node\/(\d+)$/)?.[1])
    const once = url.searchParams.get('once')
    if (!nodeId || !once) throw new Error('未找到节点取消收藏参数')

    const response = await this.session.get(`/unfavorite/node/${nodeId}?once=${once}`, {
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    })
    if (response.status !== 302) throw new Error('取消收藏节点失败')
  }

  /** 解析节点页面信息 */
  private parsePageInfo($: cheerio.CheerioAPI, nodeName: string): Node {
    const header = $('.node-header').first()
    const avatar = header.find('.page-content-header > img').first().attr('src')
    const description = header.find('.intro').first().text().trim()
    return {
      name: nodeName,
      title: header.find('.node-breadcrumb').first().text().split('›').pop()?.trim() || nodeName,
      avatar: avatar ? new URL(avatar, this.baseUrl).toString() : undefined,
      description: description || undefined
    }
  }
}
