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
    const service = new MemberService({
      get,
      getOnce: async () => 'once-token'
    } as unknown as V2exSession)

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
    const service = new MemberService({ get, getOnce: getOnce } as unknown as V2exSession)

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
  it('按编号查询摘要并按常规、大图、迷你图顺序选择头像', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        id: 42,
        status: 'found',
        username: ' alice ',
        avatar_normal: '',
        avatar_large: ' /large.png ',
        avatar_mini: '/mini.png'
      }
    })
    const service = new MemberService({ get } as unknown as V2exSession)
    await expect(service.getSummaryById(42)).resolves.toEqual({
      memberId: 42,
      username: 'alice',
      avatar: '/large.png'
    })
    expect(get).toHaveBeenCalledWith('/api/members/show.json', { params: { id: 42 } })
  })

  it.each([
    { status: 'error', message: 'Object Not Found' },
    { status: 'found', id: 42, username: ' ', avatar_normal: '', avatar_large: '', avatar_mini: '' }
  ])('成员不存在或用户名为空时拒绝返回无效摘要', async data => {
    const get = vi.fn().mockResolvedValue({ data })
    const service = new MemberService({ get } as unknown as V2exSession)
    await expect(service.getSummaryById(42)).rejects.toThrow('未找到编号为 42 的用户')
  })
})
