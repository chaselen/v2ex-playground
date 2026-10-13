import {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig
} from 'axios'
import { describe, expect, test, vi } from 'vitest'
import { V2exSession } from '../session'
import { AccountRestrictedError, LoginRequiredError, TwoFactorRequiredError } from '../types'

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

  test.each([
    '/favorite/topic/1',
    '/unfavorite/node/90',
    '/ignore/topic/1',
    '/follow/2',
    '/block/2',
    '/write'
  ])('expires credentials for an unfollowed signin redirect from %s', async path => {
    const expired = vi.fn()
    const session = new V2exSession('A2=expired', { onLoginExpired: expired })
    const internals = session as unknown as SessionInternals
    const response = createLoginRedirectResponse(internals)
    response.config.url = path
    response.status = 302
    response.headers = { location: '/signin?next=%2F' }
    response.request = { path, _redirectable: { _redirectCount: 0 } }

    await expect(internals.handleResponse(response)).rejects.toBeInstanceOf(LoginRequiredError)
    expect(expired).toHaveBeenCalledOnce()
    expect(session.getLoginCookie()).toBe('')
  })

  test('accepts a successful write redirect to the homepage', async () => {
    const session = new V2exSession('A2=valid')
    const internals = session as unknown as SessionInternals
    const response = createLoginRedirectResponse(internals)
    response.config.url = '/favorite/topic/1'
    response.status = 302
    response.headers = { location: '/?tab=all' }
    response.request = { path: '/favorite/topic/1' }
    await expect(internals.handleResponse(response)).resolves.toBe(response)
    expect(session.getLoginCookie()).toBe('A2=valid')
  })

  test('classifies restricted redirects independently from login expiration', async () => {
    const expired = vi.fn()
    const session = new V2exSession('A2=valid', { onLoginExpired: expired })
    const internals = session as unknown as SessionInternals
    const response = createLoginRedirectResponse(internals)
    response.config.url = '/write'
    response.status = 302
    response.headers = { location: '/restricted?reason=1' }
    await expect(internals.handleResponse(response)).rejects.toBeInstanceOf(AccountRestrictedError)
    expect(expired).not.toHaveBeenCalled()
    expect(session.getLoginCookie()).toBe('A2=valid')
  })

  test('uses the final pathname rather than signin text in the request path', async () => {
    const expired = vi.fn()
    const session = new V2exSession('A2=valid', { onLoginExpired: expired })
    const internals = session as unknown as SessionInternals
    const response = createLoginRedirectResponse(internals)
    response.config.url = '/t/1'
    response.request.path = '/other?next=/signin'
    response.request.res.responseUrl = 'https://www.v2ex.com/other?next=/signin'
    await expect(internals.handleResponse(response)).rejects.toThrow('未知错误')
    expect(expired).not.toHaveBeenCalled()
    expect(session.getLoginCookie()).toBe('A2=valid')
  })

  test.each([
    ['A2=valid', '您无权访问此页面'],
    ['V2EX_LANG=zhcn', '你要查看的页面需要先登录']
  ])('classifies homepage redirects with queries for %s', async (cookie, message) => {
    const session = new V2exSession(cookie)
    const internals = session as unknown as SessionInternals
    const response = createLoginRedirectResponse(internals)
    response.request.path = '/?tab=all'
    response.request.res.responseUrl = 'https://www.v2ex.com/?tab=all'
    await expect(internals.handleResponse(response)).rejects.toThrow(message)
  })

  test('limits repeated two-factor redirects through actual Axios config merging', async () => {
    const required = vi.fn(async () => true)
    const session = new V2exSession('A2=valid', { onTwoFactorRequired: required })
    const internals = session as unknown as SessionInternals
    const adapter = vi.fn(async config => ({
      config,
      data: '',
      headers: { location: '/2fa' },
      status: 302,
      statusText: 'Found'
    }))
    internals.http.defaults.adapter = adapter

    await expect(
      session.get('/notifications', {
        maxRedirects: 0,
        validateStatus: status => status < 400
      })
    ).rejects.toBeInstanceOf(TwoFactorRequiredError)
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(required).toHaveBeenCalledOnce()
  })

  test('retries failed expiration cleanup and shares the concurrent retry task', async () => {
    const cleanup = vi
      .fn()
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValue(undefined)
    const session = new V2exSession('A2=expired', { onLoginExpired: cleanup })
    await expect(session.expireLogin()).rejects.toThrow('storage unavailable')
    await Promise.all([session.expireLogin(), session.expireLogin()])
    expect(cleanup).toHaveBeenCalledTimes(2)
    expect(session.getLoginCookie()).toBe('')
  })

  test('preserves LoginRequiredError when expiration cleanup fails', async () => {
    const session = new V2exSession('A2=expired', {
      onLoginExpired: () => {
        throw new Error('storage unavailable')
      }
    })
    const internals = session as unknown as SessionInternals
    await expect(
      internals.handleResponse(createLoginRedirectResponse(internals))
    ).rejects.toBeInstanceOf(LoginRequiredError)
  })

  test('keeps only the newly written authentication cookie across domains and paths', () => {
    const session = new V2exSession('A2=valid; A2O=domain-old; V2EX_LANG=zhcn')
    const internals = session as unknown as SessionInternals
    internals.handleBeforeRedirect(
      'https://www.v2ex.com/',
      {},
      {
        'set-cookie': ['A2O=host-old; Path=/', 'A2O=path-old; Path=/2fa']
      },
      'https://www.v2ex.com/2fa'
    )
    internals.handleBeforeRedirect(
      'https://www.v2ex.com/',
      {},
      {
        'set-cookie': 'A2O=domain-latest; Domain=.v2ex.com; Path=/'
      },
      'https://www.v2ex.com/2fa'
    )
    expect(session.getCookie()).toBe('A2=valid; V2EX_LANG=zhcn; A2O=domain-latest')
    expect(session.getCookie('https://www.v2ex.com/2fa').match(/A2O=/g)).toHaveLength(1)
    expect(session.getLoginCookie()).toBe('A2=valid; A2O=domain-latest')
  })

  test('an expired authentication cookie also removes conflicting old values', () => {
    const session = new V2exSession('A2=valid; A2O=old')
    const internals = session as unknown as SessionInternals
    internals.handleBeforeRedirect(
      'https://www.v2ex.com/',
      {},
      {
        'set-cookie': 'A2O=; Path=/; Max-Age=0'
      },
      'https://www.v2ex.com/2fa'
    )
    expect(session.getLoginCookie()).toBe('A2=valid')
  })
})
