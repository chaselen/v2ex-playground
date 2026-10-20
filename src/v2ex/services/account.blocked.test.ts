import { describe, expect, it, vi } from 'vitest'
import type { V2exSession } from '../session'
import { AccountService } from './account'
import { MemberService } from './member'

/** 使用同一会话组合账户与成员服务，覆盖屏蔽列表的资源查询 */
function createAccountService(session: V2exSession) {
  return new AccountService(session, new MemberService(session))
}

describe('AccountService blocked members', () => {
  it('从页面脚本 blocked 编号拉取屏蔽用户摘要', async () => {
    const get = vi.fn(async (url: string, config?: { params?: { id?: number } }) => {
      if (url === '/?tab=all') {
        return {
          data: `
            <script>
              const blocked = [350370, 367256];
              const ignored_topics = [893822];
            </script>
          `
        }
      }

      if (url === '/api/members/show.json') {
        const memberId = config?.params?.id
        if (memberId === 350370) {
          return {
            data: {
              id: 350370,
              username: 'alice',
              status: 'found',
              avatar_normal: 'https://cdn.v2ex.com/alice.png',
              avatar_large: 'https://cdn.v2ex.com/alice-large.png',
              avatar_mini: 'https://cdn.v2ex.com/alice-mini.png'
            }
          }
        }
        if (memberId === 367256) {
          return {
            data: {
              id: 367256,
              username: 'bob',
              status: 'found',
              avatar_normal: '',
              avatar_large: 'https://cdn.v2ex.com/bob-large.png',
              avatar_mini: ''
            }
          }
        }
      }

      throw new Error(`unexpected url: ${url}`)
    })
    const service = createAccountService({
      get,
      onResponse: () => undefined,
      baseUrl: 'https://www.v2ex.com',
      getLoginCookie: () => ''
    } as unknown as V2exSession)

    await expect(service.getBlockedMembers()).resolves.toEqual([
      {
        memberId: 350370,
        username: 'alice',
        avatar: 'https://cdn.v2ex.com/alice.png'
      },
      {
        memberId: 367256,
        username: 'bob',
        avatar: 'https://cdn.v2ex.com/bob-large.png'
      }
    ])
    expect(get).toHaveBeenCalledWith('/?tab=all')
    expect(get).toHaveBeenCalledWith('/api/members/show.json', {
      params: { id: 350370 }
    })
    expect(get).toHaveBeenCalledWith('/api/members/show.json', {
      params: { id: 367256 }
    })
  })

  it('单个成员 API 失败时跳过该用户', async () => {
    const get = vi.fn(async (url: string, config?: { params?: { id?: number } }) => {
      if (url === '/?tab=all') {
        return {
          data: 'const blocked = [1, 2];'
        }
      }

      if (url === '/api/members/show.json' && config?.params?.id === 1) {
        throw new Error('network error')
      }

      if (url === '/api/members/show.json' && config?.params?.id === 2) {
        return {
          data: {
            id: 2,
            username: 'ok',
            status: 'found',
            avatar_normal: 'https://cdn.v2ex.com/ok.png',
            avatar_large: 'https://cdn.v2ex.com/ok-large.png',
            avatar_mini: 'https://cdn.v2ex.com/ok-mini.png'
          }
        }
      }

      throw new Error(`unexpected url: ${url}`)
    })
    const service = createAccountService({
      get,
      onResponse: () => undefined,
      baseUrl: 'https://www.v2ex.com',
      getLoginCookie: () => ''
    } as unknown as V2exSession)

    await expect(service.getBlockedMembers()).resolves.toEqual([
      {
        memberId: 2,
        username: 'ok',
        avatar: 'https://cdn.v2ex.com/ok.png'
      }
    ])
  })

  it('成员 API 成功响应带 status=found 时仍可解析', async () => {
    const get = vi.fn(async (url: string, config?: { params?: { id?: number } }) => {
      if (url === '/?tab=all') {
        return {
          data: 'const blocked = [367256];'
        }
      }

      if (url === '/api/members/show.json' && config?.params?.id === 367256) {
        return {
          data: {
            id: 367256,
            username: 'laojuelv',
            status: 'found',
            avatar_normal: 'https://cdn.v2ex.com/laojuelv.png',
            avatar_large: 'https://cdn.v2ex.com/laojuelv-large.png',
            avatar_mini: 'https://cdn.v2ex.com/laojuelv-mini.png'
          }
        }
      }

      throw new Error(`unexpected url: ${url}`)
    })
    const service = createAccountService({
      get,
      onResponse: () => undefined,
      baseUrl: 'https://www.v2ex.com',
      getLoginCookie: () => ''
    } as unknown as V2exSession)

    await expect(service.getBlockedMembers()).resolves.toEqual([
      {
        memberId: 367256,
        username: 'laojuelv',
        avatar: 'https://cdn.v2ex.com/laojuelv.png'
      }
    ])
  })

  it('从页面脚本一并读取忽略主题编号', async () => {
    const get = vi.fn(async (url: string) => {
      if (url === '/?tab=all') {
        return {
          data: `
            <script>
              const blocked = [350370];
              const ignored_topics = [893822, 10001];
            </script>
          `
        }
      }
      throw new Error(`unexpected url: ${url}`)
    })
    const service = createAccountService({
      get,
      onResponse: () => undefined,
      baseUrl: 'https://www.v2ex.com',
      getLoginCookie: () => ''
    } as unknown as V2exSession)

    await expect(service.getBlockedAndIgnoredIds()).resolves.toEqual({
      blockedMemberIds: [350370],
      ignoredTopicIds: [893822, 10001]
    })
    await expect(service.getIgnoredTopicIds()).resolves.toEqual([893822, 10001])
  })

  it('一次请求同时返回屏蔽用户与忽略主题编号', async () => {
    const get = vi.fn(async (url: string, config?: { params?: { id?: number } }) => {
      if (url === '/?tab=all') {
        return {
          data: 'const blocked = [350370]; const ignored_topics = [893822];'
        }
      }

      if (url === '/api/members/show.json' && config?.params?.id === 350370) {
        return {
          data: {
            id: 350370,
            username: 'alice',
            status: 'found',
            avatar_normal: 'https://cdn.v2ex.com/alice.png',
            avatar_large: 'https://cdn.v2ex.com/alice-large.png',
            avatar_mini: 'https://cdn.v2ex.com/alice-mini.png'
          }
        }
      }

      throw new Error(`unexpected url: ${url}`)
    })
    const service = createAccountService({
      get,
      onResponse: () => undefined,
      baseUrl: 'https://www.v2ex.com',
      getLoginCookie: () => ''
    } as unknown as V2exSession)

    await expect(service.getBlockedMembersAndIgnoredTopicIds()).resolves.toEqual({
      blockedMembers: [
        {
          memberId: 350370,
          username: 'alice',
          avatar: 'https://cdn.v2ex.com/alice.png'
        }
      ],
      ignoredTopicIds: [893822]
    })
  })

  it('成员 API 返回 Object Not Found 时跳过该用户', async () => {
    const get = vi.fn(async (url: string, config?: { params?: { id?: number } }) => {
      if (url === '/?tab=all') {
        return {
          data: 'const blocked = [1, 2];'
        }
      }

      if (url === '/api/members/show.json' && config?.params?.id === 1) {
        return {
          data: {
            status: 'error',
            message: 'Object Not Found'
          }
        }
      }

      if (url === '/api/members/show.json' && config?.params?.id === 2) {
        return {
          data: {
            id: 2,
            username: 'ok',
            status: 'found',
            avatar_normal: 'https://cdn.v2ex.com/ok.png',
            avatar_large: 'https://cdn.v2ex.com/ok-large.png',
            avatar_mini: 'https://cdn.v2ex.com/ok-mini.png'
          }
        }
      }

      throw new Error(`unexpected url: ${url}`)
    })
    const service = createAccountService({
      get,
      onResponse: () => undefined,
      baseUrl: 'https://www.v2ex.com',
      getLoginCookie: () => ''
    } as unknown as V2exSession)

    await expect(service.getBlockedMembers()).resolves.toEqual([
      {
        memberId: 2,
        username: 'ok',
        avatar: 'https://cdn.v2ex.com/ok.png'
      }
    ])
  })
})

describe('AccountService clear block settings', () => {
  it.each([
    ['clearBlockedMembers', 'blocked'],
    ['clearIgnoredTopics', 'ignored_topics'],
    ['clearIgnoredNodes', 'ignored_nodes']
  ] as const)('%s 使用最新 once 且仅请求清除接口', async (method, kind) => {
    const getOnce = vi.fn().mockResolvedValue('123')
    const get = vi.fn().mockResolvedValueOnce({
      data: `<div class="message">${kind === 'blocked' ? '你刚刚清除了你所有的屏蔽设定' : kind === 'ignored_nodes' ? '你刚刚清除了你所有选择忽略的节点' : '你刚刚清除了你所有选择忽略的主题'}</div>`,
      request: { res: { responseUrl: 'https://www.v2ex.com/settings/block' } }
    })
    const service = createAccountService({
      get,
      getOnce,
      onResponse: vi.fn()
    } as unknown as V2exSession)
    await service[method]()
    expect(getOnce).toHaveBeenCalledTimes(1)
    expect(get.mock.calls.map(([url]) => url)).toEqual([`/settings/reset/${kind}?once=123`])
    expect(getOnce.mock.invocationCallOrder[0]).toBeLessThan(get.mock.invocationCallOrder[0])
  })

  it('获取 once 失败时不发送清除请求', async () => {
    const get = vi.fn()
    const getOnce = vi.fn().mockRejectedValue(new Error('获取 once 失败'))
    const service = createAccountService({
      get,
      getOnce,
      onResponse: vi.fn()
    } as unknown as V2exSession)
    await expect(service.clearBlockedMembers()).rejects.toThrow('获取 once 失败')
    expect(get).not.toHaveBeenCalled()
  })

  it('清除请求失败时向调用方抛出错误', async () => {
    const getOnce = vi.fn().mockResolvedValue('123')
    const get = vi.fn().mockRejectedValue(new Error('清除请求失败'))
    const service = createAccountService({
      get,
      getOnce,
      onResponse: vi.fn()
    } as unknown as V2exSession)
    await expect(service.clearBlockedMembers()).rejects.toThrow('清除请求失败')
    expect(get).toHaveBeenCalledTimes(1)
  })
  it.each([
    ['/settings/block', '<div class="problem">令牌无效</div>', '令牌无效'],
    ['/settings/block', '', '清除未成功'],
    ['/settings/block', '<div class="message">操作失败</div>', '操作失败'],
    ['/signin', '<div class="message">你刚刚清除了你所有选择忽略的主题</div>', '你刚刚清除了']
  ])('拒绝缺少成功判据的响应：%s %s', async (path, data, message) => {
    const get = vi
      .fn()
      .mockResolvedValue({ data, request: { res: { responseUrl: `https://www.v2ex.com${path}` } } })
    const service = createAccountService({
      get,
      getOnce: vi.fn().mockResolvedValue('123'),
      onResponse: vi.fn()
    } as unknown as V2exSession)
    await expect(service.clearIgnoredTopics()).rejects.toThrow(message)
    expect(get).toHaveBeenCalledTimes(1)
  })
})
