import { describe, expect, test, vi } from 'vitest'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { V2exSession } from '../session'
import { LoginRequiredError } from '../types'
import { AuthService } from './auth'

/** 保留实际 Session 拦截器，模拟验证码提交的服务端响应 */
function createAuthService(location?: string, data = '') {
  const required = vi.fn(async () => false)
  const session = new V2exSession('A2=valid', { onTwoFactorRequired: required })
  const http = (session as unknown as { http: AxiosInstance }).http
  const requests = vi.fn(async (config: InternalAxiosRequestConfig) => {
    if (config.url === '/poll_once') {
      return { config, status: 200, statusText: 'OK', headers: {}, data: '12345' }
    }
    return {
      config,
      status: location ? 302 : 200,
      statusText: 'OK',
      headers: location ? { location } : {},
      data
    }
  })
  http.defaults.adapter = requests
  return { service: new AuthService(session), session, required, requests }
}

describe('AuthService two-factor submission', () => {
  test('accepts the homepage redirect and submits the real code and once fields', async () => {
    const { service, requests } = createAuthService('/')
    await service.submitTwoFactorCode('123456')
    const config = requests.mock.calls[1][0]
    expect(config.url).toBe('/2fa')
    expect(config.method).toBe('post')
    expect(Object.fromEntries(new URLSearchParams(config.data))).toEqual({
      code: '123456',
      once: '12345'
    })
  })

  test.each(['/2fa', '/other', 'https://example.com/', 'http://www.v2ex.com/'])(
    'rejects %s without reentering the verification callback',
    async location => {
      const { service, required, requests } = createAuthService(location)
      await expect(service.submitTwoFactorCode('123456')).rejects.toThrow('两步验证码验证失败')
      expect(required).not.toHaveBeenCalled()
      expect(requests).toHaveBeenCalledTimes(2)
    }
  )

  test('reports the server problem and keeps the current credential for retry', async () => {
    const { service, session } = createAuthService(
      undefined,
      '<div class="problem">验证码错误，请重试</div>'
    )
    await expect(service.submitTwoFactorCode('123456')).rejects.toThrow('验证码错误，请重试')
    expect(session.getLoginCookie()).toBe('A2=valid')
  })

  test('expires credentials instead of treating a signin redirect as verified', async () => {
    const { service, session, required } = createAuthService('/signin?next=%2F')
    await expect(service.submitTwoFactorCode('123456')).rejects.toBeInstanceOf(LoginRequiredError)
    expect(session.getLoginCookie()).toBe('')
    expect(required).not.toHaveBeenCalled()
  })
})

describe('AuthService login validation', () => {
  test('reports a homepage signin redirect as an invalid credential', async () => {
    const { service, session } = createAuthService('/signin')
    await expect(service.checkCookie()).resolves.toEqual({ isValid: false })
    expect(session.getLoginCookie()).toBe('')
  })

  test('keeps ambiguous homepage responses as errors rather than expired credentials', async () => {
    const { service, session } = createAuthService(undefined, '<html>temporary maintenance</html>')
    await expect(service.checkCookie()).rejects.toThrow('登录状态检查失败')
    expect(session.getLoginCookie()).toBe('A2=valid')
  })
})
