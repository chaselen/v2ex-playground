import { describe, expect, test, vi } from 'vitest'
import type { AxiosInstance, AxiosResponse } from 'axios'
import { AccountService } from './account'
import { V2exSession } from '../session'

/**
 * 创建可从测试中完成的 Promise
 */
function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

test('refreshes account and online count through an explicit tab despite a custom homepage', async () => {
  const session = new V2exSession('A2=valid')
  const http = (session as unknown as { http: AxiosInstance }).http
  const requests: string[] = []
  http.defaults.adapter = async config => {
    requests.push(config.url!)
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data:
        config.url === '/?tab=all'
          ? `
        <body><div id="Rightbar"><div class="box">
          <div id="member-activity"></div><a href="/member/alice">alice</a>
        </div></div><footer>123 人在线</footer></body>
      `
          : '<div id="Main">记事本</div>'
    }
  }
  const service = new AccountService(session, { getSummaryById: vi.fn() })
  await expect(service.getAccountOverview({ force: true })).resolves.toMatchObject({
    username: 'alice',
    showBalance: false
  })
  await expect(service.getOnlineCount({ force: true })).resolves.toBe(123)
  expect(requests).toEqual(['/?tab=all', '/?tab=all'])
})

describe('AccountService authentication session', () => {
  test('returns failed without sending requests when no login cookie exists', async () => {
    const get = vi.fn()
    const session = {
      get,
      getLoginCookie: () => '',
      onResponse: vi.fn()
    } as unknown as V2exSession

    await expect(
      new AccountService(session, { getSummaryById: vi.fn() }).dailySignIn()
    ).resolves.toEqual({
      result: 'failed',
      reward: 0
    })
    expect(get).not.toHaveBeenCalled()
  })

  test('does not redeem when the login Cookie changes while preparing', async () => {
    const get = vi.fn().mockResolvedValue({
      data: `<input value="领取 10 铜币" onclick="location.href = '/mission/daily/redeem?once=123'">`
    })
    const getLoginCookie = vi.fn().mockReturnValueOnce('A2=old').mockReturnValue('A2=new')
    const session = {
      get,
      getLoginCookie,
      onResponse: vi.fn()
    } as unknown as V2exSession
    const service = new AccountService(session, { getSummaryById: vi.fn() })
    const findDailySignInReward = vi
      .spyOn(
        service as unknown as {
          findDailySignInReward(): Promise<undefined>
        },
        'findDailySignInReward'
      )
      .mockResolvedValue(undefined)

    await expect(service.dailySignIn()).resolves.toEqual({ result: 'failed', reward: 0 })
    expect(findDailySignInReward).toHaveBeenCalledOnce()
    expect(get.mock.calls.some(([url]) => String(url).startsWith('/mission/daily/redeem'))).toBe(
      false
    )
  })

  test('stops result checks when the login Cookie changes during redeem', async () => {
    const redeemRequest = createDeferred<AxiosResponse>()
    const get = vi.fn((url: string) => {
      if (url.startsWith('/mission/daily/redeem')) return redeemRequest.promise
      return Promise.resolve({
        data: `<input value="领取 10 铜币" onclick="location.href = '/mission/daily/redeem?once=123'">`
      })
    })
    let loginCookie = 'A2=old'
    const session = {
      get,
      getLoginCookie: () => loginCookie,
      onResponse: vi.fn()
    } as unknown as V2exSession
    const service = new AccountService(session, { getSummaryById: vi.fn() })
    const findDailySignInReward = vi
      .spyOn(
        service as unknown as {
          findDailySignInReward(): Promise<undefined>
        },
        'findDailySignInReward'
      )
      .mockResolvedValue(undefined)

    const resultPromise = service.dailySignIn()
    await vi.waitFor(() => expect(get).toHaveBeenCalledWith('/mission/daily/redeem?once=123'))
    loginCookie = 'A2=new'
    redeemRequest.resolve({ data: '' } as AxiosResponse)

    await expect(resultPromise).resolves.toEqual({ result: 'failed', reward: 0 })
    expect(findDailySignInReward).toHaveBeenCalledOnce()
  })

  test('continues redeem when two-factor verification only adds A2O', async () => {
    const get = vi.fn((url: string) =>
      Promise.resolve({
        data: url.startsWith('/mission/daily/redeem')
          ? ''
          : `<input value="领取 10 铜币" onclick="location.href = '/mission/daily/redeem?once=123'">`
      })
    )
    const getLoginCookie = vi
      .fn()
      .mockReturnValueOnce('A2=current')
      .mockReturnValue('A2=current; A2O=verified')
    const session = {
      get,
      getLoginCookie,
      onResponse: vi.fn()
    } as unknown as V2exSession
    const service = new AccountService(session, { getSummaryById: vi.fn() })
    vi.spyOn(
      service as unknown as {
        findDailySignInReward(): Promise<{ date: string; reward: number } | undefined>
      },
      'findDailySignInReward'
    )
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ date: '2026-07-14', reward: 10 })

    await expect(service.dailySignIn()).resolves.toEqual({
      result: 'success',
      reward: 10,
      rewardDate: '2026-07-14'
    })
    expect(get).toHaveBeenCalledWith('/mission/daily/redeem?once=123')
  })
})
