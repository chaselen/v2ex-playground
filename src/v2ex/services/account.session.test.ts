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
  test('stops the daily sign-in request chain after switching sessions', async () => {
    const balanceRequest = createDeferred<AxiosResponse<string>>()
    const get = vi.fn().mockReturnValueOnce(balanceRequest.promise)
    const session = {
      get,
      onResponse: vi.fn()
    } as unknown as V2exSession
    const service = new AccountService(session, async () => ({
      isValid: true,
      username: 'OldAccount'
    }))
    let isSessionCurrent = true

    const resultPromise = service.dailySignIn(() => isSessionCurrent)
    await vi.waitFor(() => expect(get).toHaveBeenCalledWith('/balance?p=1'))
    isSessionCurrent = false
    balanceRequest.resolve({ data: '<html></html>' } as AxiosResponse<string>)

    await expect(resultPromise).resolves.toEqual({ result: 'failed', reward: 0 })
    expect(get).not.toHaveBeenCalledWith('/mission/daily')
    expect(get.mock.calls.some(([url]) => String(url).startsWith('/mission/daily/redeem'))).toBe(
      false
    )
  })
})
