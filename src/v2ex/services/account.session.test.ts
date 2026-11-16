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
  test.each(['preparation', 'confirmation'])(
    'rejects another account reward during %s',
    async phase => {
      let loginCookie = 'A2=old'
      const get = vi.fn().mockResolvedValue({
        data:
          phase === 'preparation'
            ? '<li class="fa fa-ok-sign"></li>'
            : `<input value="领取 10 铜币" onclick="location.href = '/mission/daily/redeem?once=123'">`
      })
      const session = {
        baseUrl: 'https://www.v2ex.com',
        get,
        getLoginCookie: () => loginCookie,
        onResponse: vi.fn()
      } as unknown as V2exSession
      const service = new AccountService(session, { getSummaryById: vi.fn() })
      let reads = 0
      vi.spyOn(
        service as unknown as {
          findDailySignInReward(): Promise<{ date: string; reward: number } | undefined>
        },
        'findDailySignInReward'
      ).mockImplementation(async () => {
        reads += 1
        if (phase === 'preparation' || reads === 2) {
          loginCookie = 'A2=new'
          return { date: '2026-11-16', reward: 10 }
        }
        return undefined
      })

      await expect(service.dailySignIn()).resolves.toEqual({ result: 'failed', reward: 0 })
    }
  )

  test('warms up the hot tab and carries its cookies into daily redeem', async () => {
    const session = new V2exSession('A2=valid; A2O=old')
    const http = (session as unknown as { http: AxiosInstance }).http
    const requests: string[] = []
    http.defaults.adapter = async config => {
      requests.push(config.url!)
      if (config.url !== '/?tab=hot') {
        const cookie = String(config.headers.get('Cookie'))
        for (const value of [
          'PB3_SESSION=session',
          'V2EX_LANG=zhcn',
          'V2EX_TAB=hot',
          'A2O=renewed'
        ]) {
          expect(cookie).toContain(value)
        }
      }
      if (config.url?.startsWith('/mission/daily/redeem')) {
        expect(config.headers.get('Referer')).toBe('https://www.v2ex.com/mission/daily')
      }
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers:
          config.url === '/?tab=hot'
            ? {
                'set-cookie': [
                  'PB3_SESSION=session; Path=/; HttpOnly',
                  'V2EX_LANG=zhcn; Path=/',
                  'V2EX_TAB=hot; Path=/; HttpOnly',
                  'A2O=renewed; Path=/'
                ]
              }
            : {},
        data:
          config.url === '/mission/daily'
            ? `<input value="领取 10 铜币" onclick="location.href = '/mission/daily/redeem?once=123'">`
            : ''
      }
    }
    const service = new AccountService(session, { getSummaryById: vi.fn() })
    vi.spyOn(
      service as unknown as {
        findDailySignInReward(): Promise<{ date: string; reward: number } | undefined>
      },
      'findDailySignInReward'
    )
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ date: '2026-11-16', reward: 10 })

    await expect(service.dailySignIn()).resolves.toMatchObject({ result: 'success' })
    expect(requests).toEqual(['/?tab=hot', '/mission/daily', '/mission/daily/redeem?once=123'])
  })

  test('returns failed without sending requests when no login cookie exists', async () => {
    const get = vi.fn()
    const session = {
      baseUrl: 'https://www.v2ex.com',
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
      baseUrl: 'https://www.v2ex.com',
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
      baseUrl: 'https://www.v2ex.com',
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
    await vi.waitFor(() =>
      expect(get).toHaveBeenCalledWith('/mission/daily/redeem?once=123', {
        headers: { Referer: 'https://www.v2ex.com/mission/daily' }
      })
    )
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
      baseUrl: 'https://www.v2ex.com',
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
    expect(get).toHaveBeenCalledWith('/mission/daily/redeem?once=123', {
      headers: { Referer: 'https://www.v2ex.com/mission/daily' }
    })
  })
})
