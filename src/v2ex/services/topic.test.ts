import { describe, expect, test, vi } from 'vitest'
import { TopicService } from './topic'
import type { V2exSession } from '../session'
import type { TopicContentInput } from '../types'
import { readFileSync } from 'node:fs'

/** 模拟服务端提供或省略忽略操作入口 */
function topicHtml(action = ''): string {
  return `<div class="topic_buttons"><a class="tb">加入收藏</a>${action ? `<a class="tb">${action}</a>` : ''}</div>`
}

describe('TopicService homepage topics', () => {
  test('skips the homepage node directory and reads the topic box', async () => {
    const html = `
      <div id="Main">
        <div class="box">
          <div class="cell">V2EX / 节点导航</div>
          <a href="/go/qna">问与答</a>
        </div>
        <div class="box">
          <div class="cell item">
            <a class="topic-link" href="/t/12">标题</a>
            <a class="node" href="/go/sandbox">沙盒</a>
            <span class="topic_info"><strong><a href="/member/a">a</a></strong></span>
          </div>
        </div>
      </div>`
    const get = vi.fn().mockResolvedValue({ data: html })
    const service = new TopicService({ get } as unknown as V2exSession, 'https://www.v2ex.com')

    await expect(service.getListByTab('tech')).resolves.toMatchObject([{ id: 12, title: '标题' }])
    expect(get).toHaveBeenCalledWith('/?tab=tech')
  })
})

describe('TopicService topic ignore actions', () => {
  test('ignores a topic with the current once token', async () => {
    const getOnce = vi.fn().mockResolvedValue('once-token')
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: topicHtml('忽略主题') })
      .mockResolvedValueOnce({ status: 302 })
    const service = new TopicService(
      { get, getOnce: getOnce } as unknown as V2exSession,
      'https://www.v2ex.com'
    )

    await service.ignore(893822)

    expect(getOnce).toHaveBeenCalledOnce()
    expect(get).toHaveBeenCalledWith('/ignore/topic/893822?once=once-token', {
      maxRedirects: 0,
      validateStatus: expect.any(Function)
    })
  })

  test('cancels topic ignore with the current once token', async () => {
    const getOnce = vi.fn().mockResolvedValue('once-token')
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: topicHtml('取消忽略') })
      .mockResolvedValueOnce({ status: 302 })
    const service = new TopicService(
      { get, getOnce: getOnce } as unknown as V2exSession,
      'https://www.v2ex.com'
    )

    await service.cancelIgnore(893822)

    expect(getOnce).toHaveBeenCalledOnce()
    expect(get).toHaveBeenCalledWith('/unignore/topic/893822?once=once-token', {
      maxRedirects: 0,
      validateStatus: expect.any(Function)
    })
  })

  test('rejects unsupported ignore before obtaining once or sending a write request', async () => {
    const getOnce = vi.fn()
    const get = vi.fn().mockResolvedValue({ data: topicHtml() })
    const service = new TopicService(
      { get, getOnce: getOnce } as unknown as V2exSession,
      'https://www.v2ex.com'
    )

    await expect(service.ignore(703733)).rejects.toThrow('当前主题不支持忽略')
    expect(get).toHaveBeenCalledOnce()
    expect(getOnce).not.toHaveBeenCalled()
  })

  test.each([
    ['ignore', '取消忽略'],
    ['cancelIgnore', '忽略主题']
  ] as const)(
    'keeps %s idempotent when the requested state is already present',
    async (method, action) => {
      const getOnce = vi.fn()
      const get = vi.fn().mockResolvedValue({ data: topicHtml(action) })
      const service = new TopicService(
        { get, getOnce: getOnce } as unknown as V2exSession,
        'https://www.v2ex.com'
      )

      await service[method](893822)
      expect(get).toHaveBeenCalledOnce()
      expect(getOnce).not.toHaveBeenCalled()
    }
  )
})

const realEditFixture = JSON.parse(
  readFileSync(new URL('../parsers/fixtures/topicContent.json', import.meta.url), 'utf8')
)

const detail = `<div class="header"><h1>原标题</h1><a href="/go/sandbox">沙盒</a><small class="gray">
<a href="/append/topic/12">APPEND</a><a href="/edit/topic/12">EDIT</a><a href="/move/topic/12">MOVE</a></small></div>`
const editForm = `<form method="post" action="/edit/topic/12"><textarea name="title">原标题</textarea>
<textarea name="content">**原始正文**</textarea><select name="syntax"><option value="0">Default</option><option value="1" selected>Markdown</option></select></form>`

function setup() {
  const get = vi.fn().mockResolvedValue({ data: detail })
  const post = vi
    .fn()
    .mockResolvedValue({ data: '', request: { res: { responseUrl: 'https://www.v2ex.com/t/12' } } })
  const getOnce = vi.fn().mockResolvedValue('fresh')
  const service = new TopicService(
    { get, post, getOnce: getOnce } as unknown as V2exSession,
    'https://www.v2ex.com'
  )
  return { service, get, post, getOnce }
}

describe('topic content', () => {
  test.each(['markdown', 'default'] as const)(
    'prepares the captured %s editor source without rendering or decoding it again',
    async syntax => {
      const { service, get } = setup()
      get
        .mockResolvedValueOnce({
          data: detail.replaceAll('/12', `/${realEditFixture.topicId}`)
        })
        .mockResolvedValueOnce({ data: realEditFixture.forms[syntax] })

      expect(await service.prepareContent(realEditFixture.topicId, 'edit')).toEqual({
        ...realEditFixture.expected,
        syntax,
        nodeName: 'sandbox'
      })
    }
  )

  test.each(['append', 'move'] as const)(
    'prepares %s from permissions without requesting its form or once',
    async action => {
      const { service, get, getOnce } = setup()
      expect(await service.prepareContent(12, action)).toEqual({
        title: '原标题',
        content: '',
        syntax: 'default',
        nodeName: 'sandbox'
      })
      expect(get).toHaveBeenCalledTimes(1)
      expect(getOnce).not.toHaveBeenCalled()
    }
  )

  test('reads original content only when editing', async () => {
    const { service, get } = setup()
    get.mockResolvedValueOnce({ data: detail }).mockResolvedValueOnce({ data: editForm })
    expect(await service.prepareContent(12, 'edit')).toEqual({
      title: '原标题',
      content: '**原始正文**',
      syntax: 'markdown',
      nodeName: 'sandbox'
    })
    expect(get.mock.calls[1][0]).toBe('/edit/topic/12')
  })

  test.each<{ input: TopicContentInput; body: Record<string, string> }>([
    {
      input: { action: 'edit', title: ' 新标题 ', content: '', syntax: 'markdown' },
      body: { title: '新标题', content: '', syntax: '1' }
    },
    { input: { action: 'move', nodeName: 'programmer' }, body: { destination: 'programmer' } },
    {
      input: { action: 'append', content: '补充', syntax: 'default' },
      body: { content: '补充', syntax: '0', once: 'fresh' }
    }
  ])('submits the fixed $input.action contract', async ({ input, body }) => {
    const { service, get, post, getOnce } = setup()
    await service.updateContent(12, input)
    expect(post.mock.calls[0][0]).toBe(`/${input.action}/topic/12`)
    expect(Object.fromEntries(post.mock.calls[0][1])).toEqual(body)
    expect(get).toHaveBeenCalledTimes(1)
    expect(getOnce).toHaveBeenCalledTimes(input.action === 'append' ? 1 : 0)
  })

  test('rechecks expired permissions before getting once or writing', async () => {
    const { service, get, post, getOnce } = setup()
    get.mockResolvedValue({ data: '<div id="Main"></div>' })
    await expect(
      service.updateContent(12, { action: 'append', content: '补充', syntax: 'markdown' })
    ).rejects.toThrow('不支持此操作')
    expect(post).not.toHaveBeenCalled()
    expect(getOnce).not.toHaveBeenCalled()
  })

  test.each<TopicContentInput>([
    { action: 'append', content: '', syntax: 'default' },
    { action: 'edit', title: ' ', content: '', syntax: 'default' },
    { action: 'move', nodeName: ' ' }
  ])('rejects empty required input: $action', async input => {
    const { service, post, getOnce } = setup()
    await expect(service.updateContent(12, input)).rejects.toThrow()
    expect(post).not.toHaveBeenCalled()
    expect(getOnce).not.toHaveBeenCalled()
  })

  test('surfaces server errors instead of treating a form page as success', async () => {
    const { service, post } = setup()
    post.mockResolvedValue({
      data: '<div class="problem">最多 3 条附言</div>',
      request: { res: { responseUrl: 'https://www.v2ex.com/append/topic/12' } }
    })
    await expect(
      service.updateContent(12, { action: 'append', content: '补充', syntax: 'markdown' })
    ).rejects.toThrow('最多 3 条附言')
  })
})

test('rejects display management actions at the content boundary before making requests', async () => {
  const { service, get, post, getOnce } = setup()
  await expect(
    // @ts-expect-error 展示管理不属于内容操作契约
    service.updateContent(12, { action: 'fade', confirmation: '确认下沉' })
  ).rejects.toThrow('无效的主题内容操作')
  expect(get).not.toHaveBeenCalled()
  expect(post).not.toHaveBeenCalled()
  expect(getOnce).not.toHaveBeenCalled()
})

const placementHtml = (
  price = 100,
  once = 123
) => `<div id="Main"><div class="box"><div class="inner"><div class="fr">
<a onclick="if (confirm('你确认要消耗 ${price} 铜币将此主题放到首页？')) { location.href = '/t/12/boost?once=${once}'; }">放到首页 ↑</a>
<a onclick="if (confirm('你确认要将此主题下沉 10 天？')) { location.href = '/fade/topic/12?once=${once}'; }">下沉 ↓</a>
</div></div></div></div>`

describe('topic placement', () => {
  test.each(['boost', 'fade'] as const)(
    'checks %s permission and confirmation before fetching the latest once',
    async action => {
      const { service, get, post, getOnce } = setup()
      get.mockResolvedValueOnce({ data: placementHtml(700, 111) })
      const state = await service.prepareManagement(12, action)
      expect(state.confirmation).toBe(
        action === 'boost'
          ? '你确认要消耗 700 铜币将此主题放到首页？'
          : '你确认要将此主题下沉 10 天？'
      )
      expect(getOnce).not.toHaveBeenCalled()
      get.mockResolvedValueOnce({ data: placementHtml(700, 222) }).mockResolvedValueOnce({
        data: action === 'fade' ? '<div class="message">主题 12 已经被下沉 10 天</div>' : '',
        request: { res: { responseUrl: 'https://www.v2ex.com/t/12' } }
      })
      await service.manage(12, { action, confirmation: state.confirmation })
      expect(get.mock.calls[2][0]).toBe(
        action === 'boost' ? '/t/12/boost?once=fresh' : '/fade/topic/12?once=fresh'
      )
      expect(post).not.toHaveBeenCalled()
      expect(getOnce).toHaveBeenCalledTimes(1)
      expect(get.mock.invocationCallOrder[1]).toBeLessThan(getOnce.mock.invocationCallOrder[0])
      expect(getOnce.mock.invocationCallOrder[0]).toBeLessThan(get.mock.invocationCallOrder[2])
    }
  )

  test('requires confirmation again when the server changes the price', async () => {
    const { service, get, getOnce } = setup()
    get.mockResolvedValue({ data: placementHtml(700) })
    await expect(
      service.manage(12, {
        action: 'boost',
        confirmation: '你确认要消耗 100 铜币将此主题放到首页？'
      })
    ).rejects.toThrow('费用已变化')
    expect(getOnce).not.toHaveBeenCalled()
    expect(get).toHaveBeenCalledTimes(1)
  })

  test.each(['boost', 'fade'] as const)(
    'rejects withdrawn %s permission without writing',
    async action => {
      const { service, get, getOnce } = setup()
      await expect(service.manage(12, { action, confirmation: '确认' })).rejects.toThrow(
        '不支持此操作'
      )
      expect(getOnce).not.toHaveBeenCalled()
      expect(get).toHaveBeenCalledTimes(1)
    }
  )

  test('does not submit with the page token when polling once fails', async () => {
    const { service, get, getOnce } = setup()
    get.mockResolvedValueOnce({ data: placementHtml() })
    getOnce.mockRejectedValueOnce(new Error('获取 once 失败'))
    await expect(
      service.manage(12, {
        action: 'fade',
        confirmation: '你确认要将此主题下沉 10 天？'
      })
    ).rejects.toThrow('获取 once 失败')
    expect(get).toHaveBeenCalledTimes(1)
  })

  test.each([
    { url: 'https://www.v2ex.com/fade/topic/12', html: '<div class="message">不能下沉</div>' },
    { url: 'https://www.v2ex.com/t/12', html: '<div class="problem">操作失败</div>' }
  ])('does not mistake a rejected request for success: $url', async ({ url, html }) => {
    const { service, get } = setup()
    get
      .mockResolvedValueOnce({ data: placementHtml() })
      .mockResolvedValueOnce({ data: html, request: { res: { responseUrl: url } } })
    await expect(
      service.manage(12, { action: 'fade', confirmation: '你确认要将此主题下沉 10 天？' })
    ).rejects.toThrow(/不能下沉|操作失败/)
  })
})

test.each(['主题 1248973 已经被下沉 10 天', '主题已被下沉', '该主题已经被下沉 7 天'])(
  'recognizes a fade success notice after redirecting home: %s',
  async message => {
    const { service, get } = setup()
    get.mockResolvedValueOnce({ data: placementHtml() }).mockResolvedValueOnce({
      data: `<div class="message">${message}</div>`,
      request: { res: { responseUrl: 'https://www.v2ex.com/' } }
    })
    await expect(
      service.manage(12, { action: 'fade', confirmation: '你确认要将此主题下沉 10 天？' })
    ).resolves.toBeUndefined()
    expect(get.mock.calls[1][1]).toMatchObject({
      headers: { Referer: 'https://www.v2ex.com/t/12' }
    })
  }
)

test.each(['主题未被下沉', '无法下沉此主题'])(
  'does not treat a failure notice as successful fading: %s',
  async message => {
    const { service, get } = setup()
    get.mockResolvedValueOnce({ data: placementHtml() }).mockResolvedValueOnce({
      data: `<div class="message">${message}</div>`,
      request: { res: { responseUrl: 'https://www.v2ex.com/' } }
    })
    await expect(
      service.manage(12, {
        action: 'fade',
        confirmation: '你确认要将此主题下沉 10 天？'
      })
    ).rejects.toThrow(message)
  }
)

test('rejects content actions at the management boundary before making requests', async () => {
  const { service, get, post, getOnce } = setup()
  // Webview RPC 参数在运行时仍需校验，不能只依赖 TypeScript
  await expect(
    // @ts-expect-error 内容操作不属于展示管理契约
    service.manage(12, { action: 'append', content: '附言', syntax: 'default' })
  ).rejects.toThrow('无效的主题管理操作')
  expect(get).not.toHaveBeenCalled()
  expect(post).not.toHaveBeenCalled()
  expect(getOnce).not.toHaveBeenCalled()
})
