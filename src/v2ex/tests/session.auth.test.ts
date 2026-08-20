import {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig
} from 'axios'
import { describe, expect, test, vi } from 'vitest'
import { V2exSession } from '../session'
import { LoginRequiredError, TwoFactorRequiredError } from '../types'

/** 会话响应测试需要访问的内部方法 */
interface SessionInternals {
  http: AxiosInstance
  attachCookieToRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig
  handleBeforeRedirect(
    redirectHref: string,
    redirectHeaders: Record<string, unknown>,
    headers: Record<string, unknown>,
    responseUrl: string
  ): void
  handleResponse(response: AxiosResponse): Promise<AxiosResponse>
}

/** 创建重定向到登录页的响应 */
function createLoginRedirectResponse(internals: SessionInternals): AxiosResponse<string> {
  const config = internals.attachCookieToRequest({
    baseURL: 'https://www.v2ex.com',
    headers: new AxiosHeaders(),
    url: '/notifications'
  })
  return {
    config,
    data: '<html></html>',
    headers: {},
    request: {
      path: '/signin',
      res: { responseUrl: 'https://www.v2ex.com/signin' },
      _redirectable: { _currentUrl: 'https://www.v2ex.com/signin', _redirectCount: 1 }
    },
    status: 200,
    statusText: 'OK'
  }
}

describe('V2exSession authentication responses', () => {
  test('clears and reports an expired login only once for concurrent responses', async () => {
    const loginExpiredHandler = vi.fn()
    const session = new V2exSession('A2=expired-cookie', {
      onLoginExpired: loginExpiredHandler
    })
    const internals = session as unknown as SessionInternals
    const results = await Promise.allSettled([
      internals.handleResponse(createLoginRedirectResponse(internals)),
      internals.handleResponse(createLoginRedirectResponse(internals))
    ])

    expect(loginExpiredHandler).toHaveBeenCalledOnce()
    expect(session.getCookie()).toBe('')
    expect(results.some(result => result.status === 'rejected')).toBe(true)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({
      reason: expect.any(LoginRequiredError)
    })
  })

  test('stores V2EX redirect cookies without forwarding Cookie across origins', () => {
    const session = new V2exSession('A2=login-cookie')
    const internals = session as unknown as SessionInternals
    const redirectHeaders = { Cookie: 'A2=login-cookie' }

    internals.handleBeforeRedirect(
      'https://example.com/landing',
      redirectHeaders,
      { 'set-cookie': 'V2EX_LANG=zhcn; Path=/' },
      'https://www.v2ex.com/notifications'
    )

    expect(session.getCookie()).toContain('V2EX_LANG=zhcn')
    expect(redirectHeaders).not.toHaveProperty('Cookie')
  })

  test('forwards the latest Cookie on a V2EX redirect', () => {
    const session = new V2exSession('A2=login-cookie')
    const internals = session as unknown as SessionInternals
    const redirectHeaders: Record<string, unknown> = {}

    internals.handleBeforeRedirect(
      'https://www.v2ex.com/notifications',
      redirectHeaders,
      { 'set-cookie': 'A2=refreshed-cookie; Path=/' },
      'https://www.v2ex.com/'
    )

    expect(session.getCookie()).toContain('A2=refreshed-cookie')
    expect(redirectHeaders.Cookie).toContain('A2=refreshed-cookie')
  })

  test('writes persisted login Cookie values without decoding them', () => {
    const session = new V2exSession('A2="account%2Ftoken%3D"; A2O="two-factor%2Btoken%3D"')

    expect(session.getCookie()).toBe('A2="account%2Ftoken%3D"; A2O="two-factor%2Btoken%3D"')
  })

  test('restores persisted login Cookies with the V2EX server scope', () => {
    const session = new V2exSession('A2=login-cookie; A2O=expired-cookie')
    const internals = session as unknown as SessionInternals
    const redirectHeaders: Record<string, unknown> = {}

    internals.handleBeforeRedirect(
      'https://www.v2ex.com/',
      redirectHeaders,
      { 'set-cookie': 'A2O=verified-cookie; Domain=.v2ex.com; Path=/' },
      'https://www.v2ex.com/2fa'
    )

    expect(session.getCookie()).toBe('A2=login-cookie; A2O=verified-cookie')
  })

  test('restores a single login Cookie with the V2EX server scope', () => {
    const session = new V2exSession('A2=expired-cookie')
    const internals = session as unknown as SessionInternals
    const redirectHeaders: Record<string, unknown> = {}

    internals.handleBeforeRedirect(
      'https://www.v2ex.com/',
      redirectHeaders,
      { 'set-cookie': 'A2=verified-cookie; Domain=.v2ex.com; Path=/' },
      'https://www.v2ex.com/2fa'
    )

    expect(session.getCookie()).toBe('A2=verified-cookie')
  })

  test('retries the same two-factor request only once with the refreshed Cookie', async () => {
    let session!: V2exSession
    const twoFactorVerifiedHandler = vi.fn()
    const twoFactorHandler = vi.fn(async () => {
      return true
    })
    session = new V2exSession('A2=login-cookie', {
      onTwoFactorRequired: twoFactorHandler,
      onTwoFactorVerified: twoFactorVerifiedHandler
    })
    const internals = session as unknown as SessionInternals
    const config = internals.attachCookieToRequest({
      baseURL: 'https://www.v2ex.com',
      headers: new AxiosHeaders(),
      url: '/notifications'
    })
    const response: AxiosResponse<string> = {
      config,
      data: '',
      headers: { location: '/2fa' },
      request: { path: '/2fa' },
      status: 302,
      statusText: 'Found'
    }
    const retriedResponse = {
      ...response,
      headers: {
        'set-cookie': ['A2O=two-factor-cookie; Path=/']
      },
      request: { path: '/notifications' },
      status: 200,
      statusText: 'OK'
    }
    const request = vi
      .spyOn(internals.http, 'request')
      .mockImplementation(async () => internals.handleResponse(retriedResponse))

    await expect(internals.handleResponse(response)).resolves.toBe(retriedResponse)
    expect(request).toHaveBeenCalledOnce()
    expect(config.headers.Cookie).toContain('A2=login-cookie')
    expect(session.getCookie()).toContain('A2O=two-factor-cookie')
    expect(twoFactorVerifiedHandler).toHaveBeenCalledOnce()

    await expect(internals.handleResponse(response)).rejects.toBeInstanceOf(TwoFactorRequiredError)
    expect(twoFactorHandler).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledOnce()
  })
})
