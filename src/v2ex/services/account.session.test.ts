import { describe, expect, test, vi } from 'vitest'
import type { AxiosResponse } from 'axios'
import { AccountService } from './account'
import type { V2exSession } from '../session'

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

describe('AccountService authentication session', () => {
  test('returns failed without sending requests when no login cookie exists', async () => {
    const get = vi.fn()
    const session = {
      get,
      getLoginCookie: () => '',
      onResponse: vi.fn(),
      createSessionGuard: () => () => true
    } as unknown as V2exSession

    await expect(new AccountService(session).dailySignIn()).resolves.toEqual({
      result: 'failed',
      reward: 0
    })
    expect(get).not.toHaveBeenCalled()
  })

  test('stops the daily sign-in request chain after switching sessions', async () => {
    const missionRequest = createDeferred<AxiosResponse<string>>()
    const get = vi.fn().mockReturnValueOnce(missionRequest.promise)
    let isActiveSession = true
    const session = {
      get,
      getLoginCookie: () => 'A2=old',
      onResponse: vi.fn(),
      createSessionGuard: () => () => isActiveSession
    } as unknown as V2exSession
    const service = new AccountService(session)

    const resultPromise = service.dailySignIn()
    await vi.waitFor(() => expect(get).toHaveBeenCalledWith('/mission/daily'))
    isActiveSession = false
    missionRequest.resolve({ data: '<html></html>' } as AxiosResponse<string>)

    await expect(resultPromise).resolves.toEqual({ result: 'failed', reward: 0 })
    expect(get).not.toHaveBeenCalledWith('/balance?p=1')
    expect(get.mock.calls.some(([url]) => String(url).startsWith('/mission/daily/redeem'))).toBe(
      false
    )
  })
})
