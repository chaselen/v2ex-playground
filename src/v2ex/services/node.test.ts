import { describe, expect, test, vi } from 'vitest'
import { NodeService } from './node'
import type { V2exSession } from '../session'

/** 构造带节点页关键结构的 HTML */
function createNodePageHtml(options: {
  title: string
  collected: boolean
  collectCount: number
  nodeId?: number
  once?: string
}): string {
  const nodeId = options.nodeId ?? 90
  const once = options.once ?? 'abc123'
  const collectAction = options.collected
    ? `<a href="/unfavorite/node/${nodeId}?once=${once}">取消收藏</a>`
    : `<a href="/favorite/node/${nodeId}?once=${once}">加入收藏</a>`

  return `
    <div class="node-header">
      <div class="page-content-header">
        <img src="//cdn.v2ex.com/navatar/test.png">
        <div class="node-breadcrumb">V2EX <span class="chevron">&nbsp;›&nbsp;</span> ${options.title}</div>
        <div class="intro">节点简介</div>
        <div class="topic-count">主题总数 <strong>12</strong></div>
      </div>
    </div>
    <div id="TopicsNode"></div>
    <div class="cell flex-one-row gap10">
      <span class="gray">第 1 到 20 / 共 12 个主题</span>
      <div class="spacer"></div>
      <div>${options.collectCount} 人收藏了这个节点</div>
      ${collectAction}
    </div>
  `
}

describe('NodeService', () => {
  test('builds node links without encoding node names', () => {
    const service = new NodeService({} as V2exSession, 'https://www.v2ex.com')
    expect(service.getLink('programmer')).toBe('https://www.v2ex.com/go/programmer')
    expect(service.getLink('vibe-coding')).toBe('https://www.v2ex.com/go/vibe-coding')
    expect(service.getLink('0x10c')).toBe('https://www.v2ex.com/go/0x10c')
  })

  test('parses node page collection state and topics meta', async () => {
    const get = vi.fn().mockResolvedValue({
      data: createNodePageHtml({
        title: '程序员',
        collected: true,
        collectCount: 10821
      })
    })
    const service = new NodeService({ get } as unknown as V2exSession, 'https://www.v2ex.com')

    const result = await service.getTopics('programmer', 1)

    expect(get).toHaveBeenCalledWith('/go/programmer?p=1')
    expect(result.node).toMatchObject({
      name: 'programmer',
      title: '程序员',
      description: '节点简介',
      isCollected: true,
      collectCount: 10821
    })
    expect(result.node.avatar).toBe('https://cdn.v2ex.com/navatar/test.png')
    expect(result.totalCount).toBe(12)
  })

  test('collects node via favorite link from node page', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        data: createNodePageHtml({
          title: '程序员',
          collected: false,
          collectCount: 10,
          nodeId: 90,
          once: 'once-token'
        })
      })
      .mockResolvedValueOnce({ status: 302 })

    const service = new NodeService({ get } as unknown as V2exSession, 'https://www.v2ex.com')
    await service.collect('programmer')

    expect(get).toHaveBeenNthCalledWith(1, '/go/programmer')
    expect(get).toHaveBeenNthCalledWith(2, '/favorite/node/90?once=once-token', {
      maxRedirects: 0,
      validateStatus: expect.any(Function)
    })
  })

  test('cancels node collection via unfavorite link from node page', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        data: createNodePageHtml({
          title: '程序员',
          collected: true,
          collectCount: 10,
          nodeId: 90,
          once: 'once-token'
        })
      })
      .mockResolvedValueOnce({ status: 302 })

    const service = new NodeService({ get } as unknown as V2exSession, 'https://www.v2ex.com')
    await service.cancelCollect('programmer')

    expect(get).toHaveBeenNthCalledWith(1, '/go/programmer')
    expect(get).toHaveBeenNthCalledWith(2, '/unfavorite/node/90?once=once-token', {
      maxRedirects: 0,
      validateStatus: expect.any(Function)
    })
  })
})
