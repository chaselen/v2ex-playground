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
  test.each([{ id: 864 }, { name: 'promotions' }])('按单一条件获取节点资料：%o', async query => {
    const get = vi.fn().mockResolvedValue({
      data: { id: 864, name: 'promotions', title: '推广', stars: 10, topics: 20 }
    })
    const service = new NodeService({ get } as unknown as V2exSession, 'https://www.v2ex.com')
    await expect(service.getInfo(query)).resolves.toMatchObject({
      id: 864,
      name: 'promotions',
      title: '推广',
      collectCount: 10,
      topicCount: 20
    })
    expect(get).toHaveBeenCalledWith('/api/nodes/show.json', { params: query })
  })

  test('maps topic and collection counts from all-nodes API', async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          id: 300,
          name: 'programmer',
          title: '程序员',
          topics: 54321,
          stars: 1234
        }
      ]
    })
    const service = new NodeService({ get } as unknown as V2exSession, 'https://www.v2ex.com')

    await expect(service.getAll()).resolves.toEqual([
      expect.objectContaining({
        id: 300,
        name: 'programmer',
        collectCount: 1234,
        topicCount: 54321
      })
    ])
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

describe('NodeService ignored nodes', () => {
  test.each([
    ['ignore', 'ignore', true],
    ['cancelIgnore', 'unignore', false]
  ] as const)(
    '%s 通过 API 取得编号，携带 Referer 和最新 once 提交',
    async (method, action, ignored) => {
      const getOnce = vi.fn().mockResolvedValue('fresh')
      const get = vi
        .fn()
        .mockResolvedValueOnce({ data: { id: 864, name: 'promotions' } })
        .mockResolvedValueOnce({
          data:
            createNodePageHtml({ title: '推广', collected: true, collectCount: 10 }) +
            `<div class="message">推广 ${ignored ? '节点已经被忽略' : '节点已经被取消忽略'}，里面的内容已更新</div>`
        })
      const service = new NodeService(
        { get, getOnce } as unknown as V2exSession,
        'https://www.v2ex.com'
      )
      const node = await service[method]('promotions')
      expect(node).toMatchObject({
        name: 'promotions',
        title: '推广',
        isIgnored: ignored,
        isCollected: true
      })
      expect(get).toHaveBeenCalledTimes(2)
      expect(get).toHaveBeenNthCalledWith(1, '/api/nodes/show.json', {
        params: { name: 'promotions' }
      })
      expect(get).toHaveBeenNthCalledWith(2, `/settings/${action}/node/864?once=fresh`, {
        headers: { Referer: 'https://www.v2ex.com/go/promotions' }
      })
      expect(getOnce).toHaveBeenCalledTimes(1)
    }
  )

  test.each([undefined, 0, -1, 1.5])('API 编号无效时不提交操作：%s', async id => {
    const get = vi.fn().mockResolvedValue({ data: { id } })
    const getOnce = vi.fn()
    const service = new NodeService(
      { get, getOnce } as unknown as V2exSession,
      'https://www.v2ex.com'
    )
    await expect(service.ignore('promotions')).rejects.toThrow('未找到有效的节点编号')
    expect(get).toHaveBeenCalledTimes(1)
    expect(getOnce).not.toHaveBeenCalled()
  })

  test('操作返回错误提示时报告失败', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: 864 } })
      .mockResolvedValueOnce({ data: '<div class="problem">令牌无效</div>' })
    const service = new NodeService(
      { get, getOnce: vi.fn().mockResolvedValue('fresh') } as unknown as V2exSession,
      'https://www.v2ex.com'
    )
    await expect(service.ignore('promotions')).rejects.toThrow('令牌无效')
  })
})
