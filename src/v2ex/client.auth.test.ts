import { describe, expect, test, vi } from 'vitest'
import { AuthSessionChangedError, type CheckCookieResult } from './types'

const { checkCookieMock } = vi.hoisted(() => ({
  checkCookieMock: vi.fn<() => Promise<CheckCookieResult>>()
}))

vi.mock('./services/auth', () => ({
  AuthService: class {
    checkCookie = checkCookieMock
  }
}))

import { V2exClient } from './client'

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

describe('V2exClient authentication session', () => {
  test('discards a stale Cookie check result after switching accounts', async () => {
    const staleCheck = createDeferred<CheckCookieResult>()
    const loginExpiredHandler = vi.fn()
    checkCookieMock.mockReturnValueOnce(staleCheck.promise)
    const client = new V2exClient('A2=old-cookie', { onLoginExpired: loginExpiredHandler })

    const resultPromise = client.checkCookie()
    client.setCookie('A2=new-cookie')
    staleCheck.resolve({ isValid: false })

    await expect(resultPromise).rejects.toBeInstanceOf(AuthSessionChangedError)
    expect(checkCookieMock).toHaveBeenCalledOnce()
    expect(client.getAuthIdentity()).toBeUndefined()
    expect(client.getCookie()).toContain('A2=new-cookie')
    expect(loginExpiredHandler).not.toHaveBeenCalled()
  })
})
