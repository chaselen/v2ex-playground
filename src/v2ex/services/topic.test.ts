import { describe, expect, test, vi } from 'vitest'
import { TopicService } from './topic'
import type { V2exSession } from '../session'

/** 模拟服务端提供或省略忽略操作入口 */
function topicHtml(action = ''): string {
  return `<div class="topic_buttons"><a class="tb">加入收藏</a>${action ? `<a class="tb">${action}</a>` : ''}</div>`
}

describe('TopicService topic ignore actions', () => {
  test('ignores a topic with the current once token', async () => {
    const getOnce = vi.fn().mockResolvedValue('once-token')
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: topicHtml('忽略主题') })
      .mockResolvedValueOnce({ status: 302 })
    const service = new TopicService(
      { get } as unknown as V2exSession,
      'https://www.v2ex.com',
      getOnce
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
      { get } as unknown as V2exSession,
      'https://www.v2ex.com',
      getOnce
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
      { get } as unknown as V2exSession,
      'https://www.v2ex.com',
      getOnce
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
        { get } as unknown as V2exSession,
        'https://www.v2ex.com',
        getOnce
      )

      await service[method](893822)
      expect(get).toHaveBeenCalledOnce()
      expect(getOnce).not.toHaveBeenCalled()
    }
  )
})
