import { describe, expect, test, vi } from 'vitest'
import { TopicService } from './topic'
import type { V2exSession } from '../session'
import type { TopicManagementInput } from '../types'
import { readFileSync } from 'node:fs'

const realEditFixture = JSON.parse(
  readFileSync(new URL('../parsers/fixtures/topicManagement.json', import.meta.url), 'utf8')
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

describe('topic management', () => {
  test.each(['markdown', 'default'] as const)(
    'prepares the captured %s editor source without rendering or decoding it again',
    async syntax => {
      const { service, get } = setup()
      get
        .mockResolvedValueOnce({
          data: detail.replaceAll('/12', `/${realEditFixture.topicId}`)
        })
        .mockResolvedValueOnce({ data: realEditFixture.forms[syntax] })

      expect(await service.prepareManagement(realEditFixture.topicId, 'edit')).toEqual({
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
      expect(await service.prepareManagement(12, action)).toEqual({
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
    expect(await service.prepareManagement(12, 'edit')).toEqual({
      title: '原标题',
      content: '**原始正文**',
      syntax: 'markdown',
      nodeName: 'sandbox'
    })
    expect(get.mock.calls[1][0]).toBe('/edit/topic/12')
  })

  test.each<{ input: TopicManagementInput; body: Record<string, string> }>([
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
    await service.manage(12, input)
    expect(post.mock.calls[0][0]).toBe(`/${input.action}/topic/12`)
    expect(Object.fromEntries(post.mock.calls[0][1])).toEqual(body)
    expect(get).toHaveBeenCalledTimes(1)
    expect(getOnce).toHaveBeenCalledTimes(input.action === 'append' ? 1 : 0)
  })

  test('rechecks expired permissions before getting once or writing', async () => {
    const { service, get, post, getOnce } = setup()
    get.mockResolvedValue({ data: '<div id="Main"></div>' })
    await expect(
      service.manage(12, { action: 'append', content: '补充', syntax: 'markdown' })
    ).rejects.toThrow('不支持此操作')
    expect(post).not.toHaveBeenCalled()
    expect(getOnce).not.toHaveBeenCalled()
  })

  test.each<TopicManagementInput>([
    { action: 'append', content: '', syntax: 'default' },
    { action: 'edit', title: ' ', content: '', syntax: 'default' },
    { action: 'move', nodeName: ' ' }
  ])('rejects empty required input: $action', async input => {
    const { service, post, getOnce } = setup()
    await expect(service.manage(12, input)).rejects.toThrow()
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
      service.manage(12, { action: 'append', content: '补充', syntax: 'markdown' })
    ).rejects.toThrow('最多 3 条附言')
  })
})
