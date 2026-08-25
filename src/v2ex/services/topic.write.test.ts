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
      { post } as unknown as V2exSession,
      'https://www.v2ex.com',
      vi.fn().mockResolvedValue('54321')
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
      { post } as unknown as V2exSession,
      'https://www.v2ex.com',
      vi.fn()
    )

    await expect(service.previewContent('正文', 'markdown', 'topic')).resolves.toBe('<p>预览</p>')
    const body = post.mock.calls[0][1] as FormData
    expect(body.get('text')).toBe('正文')
    expect(body.get('topic_content')).toBe('1')
  })

  test('omits topic_content when previewing a reply', async () => {
    const post = vi.fn().mockResolvedValue({ data: '<p>预览</p>' })
    const service = new TopicService(
      { post } as unknown as V2exSession,
      'https://www.v2ex.com',
      vi.fn()
    )

    await expect(service.previewContent('回复', 'default', 'reply')).resolves.toBe('<p>预览</p>')
    const body = post.mock.calls[0][1] as FormData
    expect(body.get('text')).toBe('回复')
    expect(body.has('topic_content')).toBe(false)
  })
})
