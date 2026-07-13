import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, test, vi } from 'vitest'
import { V2exSession } from './session'
import { LoginRequiredError } from './types'

/** 会话响应测试需要访问的内部方法 */
interface SessionInternals {
  attachCookieToRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig
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

  test('ignores Cookie and login-state side effects from a replaced session', async () => {
    const loginExpiredHandler = vi.fn()
    const responseHandler = vi.fn()
    const session = new V2exSession('A2=old-cookie', {
      onLoginExpired: loginExpiredHandler
    })
    session.onResponse(responseHandler)
    const internals = session as unknown as SessionInternals
    const response = createLoginRedirectResponse(internals)
    response.headers = { 'set-cookie': ['A2=stale-cookie; Path=/'] }

    session.setCookie('A2=new-cookie')
    const redirectHeaders = { Cookie: 'A2=old-cookie' }
    response.config.beforeRedirect?.(
      { href: 'https://www.v2ex.com/', headers: redirectHeaders },
      {
        headers: { 'set-cookie': 'A2=stale-redirect-cookie; Path=/' },
        statusCode: 302
      },
      {
        headers: { Cookie: 'A2=old-cookie' },
        url: 'https://www.v2ex.com/notifications',
        method: 'GET'
      }
    )

    await expect(internals.handleResponse(response)).resolves.toBe(response)
    expect(session.getCookie()).toContain('A2=new-cookie')
    expect(session.getCookie()).not.toContain('stale-cookie')
    expect(session.getCookie()).not.toContain('stale-redirect-cookie')
    expect(redirectHeaders).not.toHaveProperty('Cookie')
    expect(loginExpiredHandler).not.toHaveBeenCalled()
    expect(responseHandler).not.toHaveBeenCalled()
  })

  test('does not retry a two-factor request with a replacement cookie', async () => {
    let resolveTwoFactor!: (verified: boolean) => void
    const session = new V2exSession('A2=old-cookie', {
      onTwoFactorRequired: () =>
        new Promise<boolean>(resolve => {
          resolveTwoFactor = resolve
        })
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

    const responsePromise = internals.handleResponse(response)
    await vi.waitFor(() => expect(resolveTwoFactor).toBeTypeOf('function'))
    session.setCookie('A2=new-cookie')
    resolveTwoFactor(true)

    await expect(responsePromise).resolves.toBe(response)
    expect(session.getCookie()).toContain('A2=new-cookie')
  })
})
