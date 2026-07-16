import { describe, expect, it } from 'vitest'
import { decodeCloudflareEmail } from './cloudflareEmail'

describe('decodeCloudflareEmail', () => {
  it('解码 V2EX 回复中的 Cloudflare 邮箱保护数据', () => {
    expect(decodeCloudflareEmail('8ef6cea0e1fce9')).toBe('x@.org')
  })

  it('拒绝无效的编码数据', () => {
    expect(decodeCloudflareEmail('')).toBeUndefined()
    expect(decodeCloudflareEmail('abc')).toBeUndefined()
    expect(decodeCloudflareEmail('zzzz')).toBeUndefined()
  })
})
