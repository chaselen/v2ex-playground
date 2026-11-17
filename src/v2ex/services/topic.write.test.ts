import { describe, expect, test, vi } from 'vitest'
import { TopicService } from './topic'
import type { V2exSession } from '../session'

/** 创建带最终响应链接的测试响应 */
function createResponse(data: string, responseUrl: string) {
  return {
    data,
    request: {
      res: { responseUrl }
    },
    config: { url: '/write' }
  }
}

describe('TopicService write', () => {
  test('posts the real write fields and returns the redirected topic id', async () => {
    const post = vi.fn().mockResolvedValue(createResponse('', 'https://www.v2ex.com/t/123456'))
    const service = new TopicService(
      { post, getOnce: vi.fn().mockResolvedValue('54321') } as unknown as V2exSession,
      'https://www.v2ex.com'
    )

    await expect(
      service.create({
        title: '测试主题',
        content: '正文',
        syntax: 'markdown',
        nodeName: 'programmer'
      })
    ).resolves.toEqual({ topicId: 123456, title: '测试主题' })

    const body = post.mock.calls[0][1] as URLSearchParams
    expect(Object.fromEntries(body)).toEqual({
      title: '测试主题',
      syntax: 'markdown',
      content: '正文',
      node_name: 'programmer',
      once: '54321'
    })
  })

  test('uses topic_content when previewing a new topic', async () => {
    const post = vi.fn().mockResolvedValue({ data: '<p>预览</p>' })
    const service = new TopicService(
      { post, getOnce: vi.fn() } as unknown as V2exSession,
      'https://www.v2ex.com'
    )

    await expect(service.previewContent('正文', 'markdown', 'topic')).resolves.toBe('<p>预览</p>')
    const body = post.mock.calls[0][1] as FormData
    expect(body.get('text')).toBe('正文')
    expect(body.get('topic_content')).toBe('1')
  })

  test('omits topic_content when previewing a reply', async () => {
    const post = vi.fn().mockResolvedValue({ data: '<p>预览</p>' })
    const service = new TopicService(
      { post, getOnce: vi.fn() } as unknown as V2exSession,
      'https://www.v2ex.com'
    )

    await expect(service.previewContent('回复', 'default', 'reply')).resolves.toBe('<p>预览</p>')
    const body = post.mock.calls[0][1] as FormData
    expect(body.get('text')).toBe('回复')
    expect(body.has('topic_content')).toBe(false)
  })
})

describe('official reply target submission', () => {
  test('keeps confirmed success and its page when the response provides no reply id', async () => {
    const service = new TopicService(
      {
        getOnce: vi.fn().mockResolvedValue('123'),
        post: vi.fn().mockResolvedValue({ data: { success: true, url: '/t/1?p=2' } })
      } as unknown as V2exSession,
      'https://www.v2ex.com'
    )
    await expect(service.postReply(1, '正文')).resolves.toEqual({
      replyPage: 2,
      replyId: undefined
    })
  })
  test.each([undefined, '18293772'])(
    'submits parent_id only for an explicit target: %s',
    async parentId => {
      const post = vi
        .fn()
        .mockResolvedValue({ data: { success: true, reply_id: 1234, url: '/t/1257325?p=2' } })
      const service = new TopicService(
        { getOnce: vi.fn().mockResolvedValue('123'), post } as unknown as V2exSession,
        'https://www.v2ex.com'
      )
      await expect(
        service.postReply(1257325, '@alice 收到', { parentReplyId: parentId, replyPage: 1 })
      ).resolves.toEqual({ replyId: '1234', replyPage: 2 })
      const body = post.mock.calls[0][1] as URLSearchParams
      expect(body.get('parent_id')).toBe(parentId ?? null)
      expect(body.get('content')).toBe('@alice 收到')
      expect(body.get('return_to_page')).toBe('1')
      expect(body.get('once')).toBe('123')
      expect(post.mock.calls[0][2]).toMatchObject({
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      })
    }
  )
  test('rejects malformed reply ids before any request', async () => {
    const getOnce = vi.fn()
    const service = new TopicService({ getOnce } as unknown as V2exSession, 'https://www.v2ex.com')
    await expect(service.postReply(1, '回复', { parentReplyId: '1&x=2' })).rejects.toThrow(
      '无效的父回复编号'
    )
    expect(getOnce).not.toHaveBeenCalled()
  })
  test.each([
    [{ success: false, message: '回复过于频繁' }, '回复过于频繁'],
    ['<html>业务错误</html>', '回复发表失败'],
    [null, '回复发表失败'],
    [{ success: 0 }, '回复发表失败']
  ])(
    'rejects a refused or non-JSON submission without reporting success: %j',
    async (data, message) => {
      const service = new TopicService(
        {
          getOnce: vi.fn().mockResolvedValue('123'),
          post: vi.fn().mockResolvedValue({ data })
        } as unknown as V2exSession,
        'https://www.v2ex.com'
      )
      await expect(service.postReply(1, '正文')).rejects.toThrow(message)
    }
  )
  test.each(['https://example.com/t/1?p=99', '/t/2?p=99', '/t/1?p=-1'])(
    'does not trust an unrelated success location: %s',
    async url => {
      const service = new TopicService(
        {
          getOnce: vi.fn().mockResolvedValue('123'),
          post: vi.fn().mockResolvedValue({ data: { success: true, url } })
        } as unknown as V2exSession,
        'https://www.v2ex.com'
      )
      await expect(service.postReply(1, '正文', { replyPage: 3 })).resolves.toEqual({
        replyPage: 3,
        replyId: undefined
      })
    }
  )
})
