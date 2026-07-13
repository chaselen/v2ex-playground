import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { CheckCookieResult } from './types'

const { checkCookieMock } = vi.hoisted(() => ({
  checkCookieMock: vi.fn<() => Promise<CheckCookieResult>>()
}))

vi.mock('./services/auth', () => ({
  AuthService: class {
    checkCookie = checkCookieMock
  }
}))

import { V2exClient } from './client'

/** 创建可从测试中完成的 Promise */
function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('V2exClient login expiration', () => {
  beforeEach(() => {
    checkCookieMock.mockReset()
  })

  test('clears the current runtime cookie when validation reports expiration', async () => {
    const loginExpiredHandler = vi.fn()
    checkCookieMock.mockResolvedValue({ isValid: false })
    const client = new V2exClient('A2=expired-cookie', {
      onLoginExpired: loginExpiredHandler
    })

    await expect(client.checkCookie()).resolves.toEqual({ isValid: false })
    expect(client.getCookie()).toBe('')
    expect(loginExpiredHandler).toHaveBeenCalledOnce()
  })

  test('does not expire a replacement session because of an older validation result', async () => {
    const staleCheck = createDeferred<CheckCookieResult>()
    const loginExpiredHandler = vi.fn()
    checkCookieMock.mockReturnValue(staleCheck.promise)
    const client = new V2exClient('A2=old-cookie', { onLoginExpired: loginExpiredHandler })

    const resultPromise = client.checkCookie()
    client.setCookie('A2=old-cookie')
    staleCheck.resolve({ isValid: false })

    await expect(resultPromise).resolves.toEqual({ isValid: false })
    expect(client.getCookie()).toContain('A2=old-cookie')
    expect(loginExpiredHandler).not.toHaveBeenCalled()
  })
})
