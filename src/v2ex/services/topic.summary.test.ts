import { describe, expect, it, vi } from 'vitest'
import type { V2exSession } from '../session'
import { TopicService } from './topic'

describe('TopicService summaries', () => {
  it('按主题编号列表补齐摘要并保持入参顺序', async () => {
    const get = vi.fn(async (url: string, config?: { params?: { id?: number } }) => {
      if (url === '/api/topics/show.json' && config?.params?.id === 1) {
        return {
          data: [
            {
              id: 1,
              title: 'Hello V2EX',
              replies: 3,
              created: 1272207387,
              last_reply_by: 'bob',
              member: { username: 'alice' },
              node: { name: 'babel', title: 'Project Babel' }
            }
          ]
        }
      }

      if (url === '/api/topics/show.json' && config?.params?.id === 2) {
        throw new Error('network error')
      }

      if (url === '/api/topics/show.json' && config?.params?.id === 3) {
        return {
          data: [
            {
              id: 3,
              title: 'Later topic',
              replies: 0,
              created: 1272207387,
              last_reply_by: '',
              member: { username: 'carol' },
              node: { name: 'share', title: '分享发现' }
            }
          ]
        }
      }

      throw new Error(`unexpected url: ${url}`)
    })
    const service = new TopicService(
      {
        get,
        onResponse: () => undefined,
        baseUrl: 'https://www.v2ex.com',
        getLoginCookie: () => ''
      } as unknown as V2exSession,
      'https://www.v2ex.com'
    )

    await expect(service.getByIds([3, 2, 1])).resolves.toEqual([
      {
        id: 3,
        title: 'Later topic',
        node: {
          name: 'share',
          title: '分享发现'
        },
        authorName: 'carol',
        replies: 0,
        displayTime: '2010-04-25 22:56:27',
        publishedAt: '2010-04-25 22:56:27',
        lastReplyUser: undefined
      },
      {
        id: 1,
        title: 'Hello V2EX',
        node: {
          name: 'babel',
          title: 'Project Babel'
        },
        authorName: 'alice',
        replies: 3,
        displayTime: '2010-04-25 22:56:27',
        publishedAt: '2010-04-25 22:56:27',
        lastReplyUser: 'bob'
      }
    ])
    expect(get).toHaveBeenCalledWith('/api/topics/show.json', {
      params: { id: 3 }
    })
    expect(get).toHaveBeenCalledWith('/api/topics/show.json', {
      params: { id: 2 }
    })
    expect(get).toHaveBeenCalledWith('/api/topics/show.json', {
      params: { id: 1 }
    })
  })
  it('空编号列表不发请求', async () => {
    const get = vi.fn()
    const service = new TopicService({ get } as unknown as V2exSession, 'https://www.v2ex.com')
    await expect(service.getByIds([])).resolves.toEqual([])
    expect(get).not.toHaveBeenCalled()
  })

  it('主题不存在时跳过空响应', async () => {
    const get = vi.fn().mockResolvedValue({ data: [] })
    const service = new TopicService({ get } as unknown as V2exSession, 'https://www.v2ex.com')
    await expect(service.getByIds([999])).resolves.toEqual([])
  })
})
