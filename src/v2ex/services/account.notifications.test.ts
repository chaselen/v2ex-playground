import { describe, expect, it, vi } from 'vitest'
import type { V2exSession } from '../session'
import { AccountService } from './account'

function setup() {
  const post = vi.fn().mockResolvedValue({ data: '' })
  const getOnce = vi.fn().mockResolvedValue('456')
  const service = new AccountService(
    {
      post,
      onResponse: () => undefined
    } as unknown as V2exSession,
    getOnce
  )
  return { service, post, getOnce }
}

describe('notification deletion', () => {
  it('每次 POST 前获取最新 once，不使用消息页中的旧令牌', async () => {
    const { service, post, getOnce } = setup()
    getOnce.mockResolvedValueOnce('fresh-1').mockResolvedValueOnce('fresh-2')
    await service.deleteNotification(123)
    await service.deleteNotification(124)
    expect(getOnce).toHaveBeenCalledTimes(2)
    expect(post.mock.calls).toEqual([
      ['/delete/notification/123?once=fresh-1'],
      ['/delete/notification/124?once=fresh-2']
    ])
    expect(getOnce.mock.invocationCallOrder[0]).toBeLessThan(post.mock.invocationCallOrder[0])
    expect(getOnce.mock.invocationCallOrder[1]).toBeLessThan(post.mock.invocationCallOrder[1])
  })

  it('获取 once 失败时不发送删除请求', async () => {
    const { service, post, getOnce } = setup()
    getOnce.mockRejectedValue(new Error('令牌获取失败'))
    await expect(service.deleteNotification(123)).rejects.toThrow('令牌获取失败')
    expect(post).not.toHaveBeenCalled()
  })

  it('拒绝无效编号且不获取令牌或发送删除请求', async () => {
    const { service, post, getOnce } = setup()
    await expect(service.deleteNotification(-1)).rejects.toThrow('无效的消息编号')
    expect(getOnce).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  it('删除失败时透传错误且不重试写请求', async () => {
    const { service, post } = setup()
    post.mockRejectedValue(new Error('删除请求失败'))
    await expect(service.deleteNotification(123)).rejects.toThrow('删除请求失败')
    expect(post).toHaveBeenCalledTimes(1)
  })
})
