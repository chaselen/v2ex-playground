import { describe, expect, test, vi } from 'vitest'
import { TopicService } from './topic'
import type { V2exSession } from '../session'

describe('TopicService topic ignore actions', () => {
  test('ignores a topic with the current once token', async () => {
    const getOnce = vi.fn().mockResolvedValue('once-token')
    const get = vi.fn().mockResolvedValue({ status: 302 })
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
    const get = vi.fn().mockResolvedValue({ status: 302 })
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
})
