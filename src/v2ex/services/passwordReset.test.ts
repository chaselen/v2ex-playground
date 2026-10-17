import { expect, test, vi } from 'vitest'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { V2exSession } from '../session'
import { PasswordResetService } from './passwordReset'

const form = `<form method="post" action="/forgot"><input type="text" name="u"><input type="text" name="e"><input type="text" name="c"><img src="/_captcha"><input name="once" value="123"></form>`

function setup() {
  const session = new V2exSession()
  const requests: InternalAxiosRequestConfig[] = []
  let result = '<div class="problem">输入的验证码不正确</div>'
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    requests.push(config)
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: config.url?.startsWith('/_captcha')
        ? { 'content-type': 'image/png' }
        : { 'set-cookie': ['challenge=reset; Path=/'] },
      data: config.url?.startsWith('/_captcha')
        ? Buffer.from('image')
        : config.method === 'post'
          ? result
          : form
    }
  })
  ;(session as unknown as { http: AxiosInstance }).http.defaults.adapter = adapter
  return {
    service: new PasswordResetService(session),
    requests,
    setResult: (value: string) => {
      result = value
    }
  }
}

test('uses one isolated cookie jar and consumes each challenge once', async () => {
  const { service, requests } = setup()
  await expect(service.loadChallenge()).resolves.toMatch(/^data:image\/png;base64,/)
  expect(requests[1].headers.Cookie).toContain('challenge=reset')
  await expect(
    service.submit({ username: ' user ', email: ' user@example.com ', captcha: ' wrong ' })
  ).rejects.toThrow('输入的验证码不正确')
  const post = requests[2]
  expect(Object.fromEntries(new URLSearchParams(post.data))).toEqual({
    u: 'user',
    e: 'user@example.com',
    c: 'wrong',
    once: '123'
  })
  expect(post.maxRedirects).toBe(0)
  await expect(
    service.submit({ username: 'user', email: 'user@example.com', captcha: 'wrong' })
  ).rejects.toThrow('验证码已失效')
  expect(requests).toHaveLength(3)
  service.dispose()
  await expect(service.loadChallenge()).rejects.toThrow('已关闭')
})

test('returns source text without interpreting arbitrary HTTP 200 pages as email delivery', async () => {
  const { service, setResult } = setup()
  await service.loadChallenge()
  setResult('<html>Unexpected response</html>')
  await expect(
    service.submit({ username: 'user', email: 'user@example.com', captcha: 'abcd' })
  ).rejects.toThrow('无法识别')
})

test('rejects concurrent requests and aborts requests on disposal', async () => {
  const { service, requests } = setup()
  const loading = service.loadChallenge()
  await expect(service.loadChallenge()).rejects.toThrow('正在处理中')
  await loading
  service.dispose()
  expect(requests[0].signal?.aborted).toBe(true)
})
