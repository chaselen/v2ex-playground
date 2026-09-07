import { describe, expect, it, vi } from 'vitest'
import type { V2exSession } from '../session'
import { MemberService } from './member'

describe('MemberService', () => {
  it('使用官方 API 区分用户签名和简介', async () => {
    const get = vi.fn(async (url: string) => {
      if (url === '/api/members/show.json') {
        return {
          data: {
            tagline: 'qm',
            bio: 'jj'
          }
        }
      }

      return {
        data: `
          <main id="Main">
            <div class="box">
              <div class="cell">
                <img class="avatar" data-uid="159728" alt="chaselen">
                <h1>chaselen</h1>
                <span class="bigger">qm</span>
                <span class="gray">
                  V2EX member #159728, joined on 2016-02-20 23:12:13 +08:00
                </span>
              </div>
              <div class="cell">不应被视为 bio 的其他资料</div>
            </div>
          </main>
        `
      }
    })
    const service = new MemberService(
      { get } as unknown as V2exSession,
      'https://www.v2ex.com',
      async () => 'once-token'
    )

    const member = await service.getInfo('chaselen')

    expect(member.tagline).toBe('qm')
    expect(member.bio).toBe('jj')
    expect(get).toHaveBeenCalledWith('/api/members/show.json', {
      params: { username: 'chaselen' }
    })
  })

  it('使用 once 参数更新用户关系', async () => {
    const get = vi.fn().mockResolvedValue({ status: 302 })
    const getOnce = vi.fn().mockResolvedValue('once-token')
    const service = new MemberService(
      { get } as unknown as V2exSession,
      'https://www.v2ex.com',
      getOnce
    )

    await service.follow(42)
    await service.unfollow(42)
    await service.block(42)
    await service.unblock(42)

    expect(getOnce).toHaveBeenCalledTimes(4)
    expect(get).toHaveBeenNthCalledWith(1, '/follow/42?once=once-token', {
      maxRedirects: 0,
      validateStatus: expect.any(Function)
    })
    expect(get).toHaveBeenNthCalledWith(2, '/unfollow/42?once=once-token', {
      maxRedirects: 0,
      validateStatus: expect.any(Function)
    })
    expect(get).toHaveBeenNthCalledWith(3, '/block/42?once=once-token', {
      maxRedirects: 0,
      validateStatus: expect.any(Function)
    })
    expect(get).toHaveBeenNthCalledWith(4, '/unblock/42?once=once-token', {
      maxRedirects: 0,
      validateStatus: expect.any(Function)
    })
  })
})
