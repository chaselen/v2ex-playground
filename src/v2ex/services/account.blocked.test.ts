import { describe, expect, it, vi } from 'vitest'
import type { V2exSession } from '../session'
import { AccountService } from './account'

describe('AccountService blocked members', () => {
  it('从首页 blocked 编号拉取屏蔽用户摘要', async () => {
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
              username: 'alice',
              avatar_normal: 'https://cdn.v2ex.com/alice.png'
            }
          }
        }
        if (memberId === 367256) {
          return {
            data: {
              username: 'bob',
              avatar_large: 'https://cdn.v2ex.com/bob-large.png'
            }
          }
        }
      }

      throw new Error(`unexpected url: ${url}`)
    })
    const service = new AccountService({
      get,
      onResponse: () => undefined,
      baseUrl: 'https://www.v2ex.com',
      getLoginCookie: () => ''
    } as unknown as V2exSession)

    await expect(service.getBlockedMembers()).resolves.toEqual([
      {
        username: 'alice',
        avatar: 'https://cdn.v2ex.com/alice.png'
      },
      {
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
            username: 'ok',
            avatar_normal: 'https://cdn.v2ex.com/ok.png'
          }
        }
      }

      throw new Error(`unexpected url: ${url}`)
    })
    const service = new AccountService({
      get,
      onResponse: () => undefined,
      baseUrl: 'https://www.v2ex.com',
      getLoginCookie: () => ''
    } as unknown as V2exSession)

    await expect(service.getBlockedMembers()).resolves.toEqual([
      {
        username: 'ok',
        avatar: 'https://cdn.v2ex.com/ok.png'
      }
    ])
  })

  it('从首页脚本一并读取忽略主题编号', async () => {
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
    const service = new AccountService({
      get,
      onResponse: () => undefined,
      baseUrl: 'https://www.v2ex.com',
      getLoginCookie: () => ''
    } as unknown as V2exSession)

    await expect(service.getHomeScriptPreferences()).resolves.toEqual({
      blockedMemberIds: [350370],
      ignoredTopicIds: [893822, 10001]
    })
    await expect(service.getIgnoredTopicIds()).resolves.toEqual([893822, 10001])
  })
})
