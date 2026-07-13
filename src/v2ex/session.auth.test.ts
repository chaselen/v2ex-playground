import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, test, vi } from 'vitest'
import { V2exSession } from './session'
import { LoginRequiredError } from './types'

/** 会话并发测试需要访问的内部方法 */
interface SessionInternals {
  attachCookieToRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig
  handleResponse(response: AxiosResponse): Promise<AxiosResponse>
  handleTwoFactorResponse(response: AxiosResponse): Promise<AxiosResponse>
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

describe('V2exSession authentication redirects', () => {
  test('notifies login expiration once for concurrent stale responses', async () => {
    const loginExpiredHandler = vi.fn()
    const session = new V2exSession('A2=expired-cookie', {
      onLoginExpired: loginExpiredHandler
    })
    const internals = session as unknown as SessionInternals
    const responses = [
      createLoginRedirectResponse(internals),
      createLoginRedirectResponse(internals)
    ]

    const results = await Promise.allSettled(
      responses.map(response => internals.handleResponse(response))
    )

    expect(loginExpiredHandler).toHaveBeenCalledTimes(1)
    expect(session.getCookie()).toBe('')
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({
      reason: expect.any(LoginRequiredError)
    })
  })

  test('does not clear a new login after an old response resumes', async () => {
    const loginExpiredHandler = vi.fn()
    const session = new V2exSession('A2=expired-cookie', {
      onLoginExpired: loginExpiredHandler
    })
    const internals = session as unknown as SessionInternals
    const response = createLoginRedirectResponse(internals)
    let resumeTwoFactorCheck!: (response: AxiosResponse) => void
    internals.handleTwoFactorResponse = vi.fn(
      () =>
        new Promise<AxiosResponse>(resolve => {
          resumeTwoFactorCheck = resolve
        })
    )

    const responsePromise = internals.handleResponse(response)
    await vi.waitFor(() => expect(internals.handleTwoFactorResponse).toHaveBeenCalled())
    session.setCookie('A2=new-cookie')
    resumeTwoFactorCheck(response)

    await expect(responsePromise).resolves.toBe(response)
    expect(session.getCookie()).toContain('A2=new-cookie')
    expect(loginExpiredHandler).not.toHaveBeenCalled()
  })
})
