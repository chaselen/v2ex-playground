import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { LoginCookieStore } from '../client'
import type { V2exSession, V2exSessionOptions } from '../session'
import { TwoFactorRequiredError, type CheckCookieResult } from '../types'

const { checkCookieMock, submitTwoFactorCodeMock } = vi.hoisted(() => ({
  checkCookieMock: vi.fn<(session: V2exSession) => Promise<CheckCookieResult>>(),
  submitTwoFactorCodeMock: vi.fn<(session: V2exSession, code: string) => Promise<void>>()
}))

vi.mock('../services/auth', () => ({
  AuthService: class {
    constructor(private readonly session: V2exSession) {}

    checkCookie(): Promise<CheckCookieResult> {
      return checkCookieMock(this.session)
    }

    getOnce(): Promise<string> {
      return Promise.resolve('once')
    }

    submitTwoFactorCode(code: string): Promise<void> {
      return submitTwoFactorCodeMock(this.session, code)
    }
  }
}))

import { V2exClient } from '../client'

/** 创建可从测试中完成的 Promise */
function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

/** 创建内存登录 Cookie 存储 */
function createLoginCookieStore(initialCookie = ''): {
  store: LoginCookieStore
  load: ReturnType<typeof vi.fn<LoginCookieStore['load']>>
  save: ReturnType<typeof vi.fn<LoginCookieStore['save']>>
} {
  let cookie = initialCookie
  const load = vi.fn(async () => cookie)
  const save = vi.fn(async (nextCookie: string) => {
    cookie = nextCookie
  })
  return {
    store: { load, save },
    load,
    save
  }
}

/** 获取客户端内部 Session */
function getClientSession(client: V2exClient): V2exSession {
  return (client as unknown as { session: V2exSession }).session
}

/** 获取 Session 内部配置 */
function getSessionOptions(session: V2exSession): V2exSessionOptions {
  return (session as unknown as { options: V2exSessionOptions }).options
}

describe('V2exClient authentication', () => {
  beforeEach(() => {
    checkCookieMock.mockReset()
    submitTwoFactorCodeMock.mockReset()
    submitTwoFactorCodeMock.mockResolvedValue(undefined)
  })

  test('gets only persistable login cookies', () => {
    const client = new V2exClient('A2=login; A2O=two-factor; V2EX_LANG=zhcn')

    expect(client.getLoginCookie()).toBe('A2=login; A2O=two-factor')
  })

  test('loads persisted credentials but waits for validation before marking authenticated', async () => {
    const { store, load } = createLoginCookieStore('A2=persisted')
    const checkResult = createDeferred<CheckCookieResult>()
    checkCookieMock.mockReturnValue(checkResult.promise)

    const client = await V2exClient.create({ loginCookieStore: store })

    expect(load).toHaveBeenCalledOnce()
    expect(client.isAuthenticated()).toBe(false)
    const firstCheck = client.ensureAuthenticated()
    const secondCheck = client.ensureAuthenticated()
    expect(secondCheck).toBe(firstCheck)

    checkResult.resolve({ isValid: true, username: 'PersistedUser' })
    await expect(firstCheck).resolves.toBe(true)
    expect(checkCookieMock).toHaveBeenCalledOnce()
    expect(client.getAuthenticatedUsername()).toBe('PersistedUser')
  })

  test('keeps persisted credentials when validation fails because of a temporary error', async () => {
    const { store, save } = createLoginCookieStore('A2=persisted')
    checkCookieMock
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce({ isValid: true, username: 'PersistedUser' })
    const client = await V2exClient.create({ loginCookieStore: store })

    await expect(client.ensureAuthenticated()).rejects.toThrow('temporary network failure')
    expect(client.getLoginCookie()).toBe('A2=persisted')
    expect(save).not.toHaveBeenCalled()

    await expect(client.ensureAuthenticated()).resolves.toBe(true)
    expect(client.getAuthenticatedUsername()).toBe('PersistedUser')
  })

  test('clears runtime and persisted credentials when validation reports expiration', async () => {
    const { store, save } = createLoginCookieStore('A2=expired')
    const onLoginExpired = vi.fn()
    checkCookieMock
      .mockResolvedValueOnce({ isValid: true, username: 'ExpiredUser' })
      .mockResolvedValueOnce({ isValid: false })
    const client = await V2exClient.create({ loginCookieStore: store, onLoginExpired })

    await expect(client.ensureAuthenticated()).resolves.toBe(true)
    await expect(client.refreshAuthentication()).resolves.toBe(false)

    expect(client.getLoginCookie()).toBe('')
    expect(client.isAuthenticated()).toBe(false)
    expect(client.getAuthenticatedUsername()).toBeUndefined()
    expect(save).toHaveBeenLastCalledWith('')
    expect(onLoginExpired).toHaveBeenCalledOnce()
  })

  test('commits a candidate Cookie only after isolated validation succeeds', async () => {
    const { store, save } = createLoginCookieStore('A2=old')
    const checkResult = createDeferred<CheckCookieResult>()
    checkCookieMock.mockReturnValue(checkResult.promise)
    const client = await V2exClient.create({ loginCookieStore: store })

    const switching = client.switchLoginCookie('A2=new')
    expect(client.getLoginCookie()).toBe('A2=old')
    expect(save).not.toHaveBeenCalled()

    checkResult.resolve({ isValid: true, username: 'NewUser' })
    await expect(switching).resolves.toBe('authenticated')
    expect(save).toHaveBeenCalledWith('A2=new')
    expect(client.getLoginCookie()).toBe('A2=new')
    expect(client.getAuthenticatedUsername()).toBe('NewUser')
  })

  test('allows only the first validated concurrent candidate to commit', async () => {
    const { store, save } = createLoginCookieStore('A2=current')
    const firstCheck = createDeferred<CheckCookieResult>()
    const secondCheck = createDeferred<CheckCookieResult>()
    checkCookieMock.mockReturnValueOnce(firstCheck.promise).mockReturnValueOnce(secondCheck.promise)
    const client = await V2exClient.create({ loginCookieStore: store })

    const firstSwitch = client.switchLoginCookie('A2=first')
    const secondSwitch = client.switchLoginCookie('A2=second')
    secondCheck.resolve({ isValid: true, username: 'SecondUser' })
    await expect(secondSwitch).resolves.toBe('authenticated')
    firstCheck.resolve({ isValid: true, username: 'FirstUser' })

    await expect(firstSwitch).resolves.toBe('canceled')
    expect(client.getLoginCookie()).toBe('A2=second')
    expect(client.getAuthenticatedUsername()).toBe('SecondUser')
    expect(save).toHaveBeenCalledTimes(1)
  })

  test('keeps the current session unchanged when candidate validation fails', async () => {
    const { store, save } = createLoginCookieStore('A2=old')
    checkCookieMock.mockResolvedValue({ isValid: false })
    const client = await V2exClient.create({ loginCookieStore: store })

    await expect(client.switchLoginCookie('A2=invalid')).resolves.toBe('invalid')

    expect(client.getLoginCookie()).toBe('A2=old')
    expect(save).not.toHaveBeenCalled()
  })

  test('keeps the current session unchanged when candidate validation throws', async () => {
    const { store, save } = createLoginCookieStore('A2=old')
    checkCookieMock.mockRejectedValue(new Error('temporary network failure'))
    const client = await V2exClient.create({ loginCookieStore: store })

    await expect(client.switchLoginCookie('A2=new')).rejects.toThrow('temporary network failure')

    expect(client.getLoginCookie()).toBe('A2=old')
    expect(save).not.toHaveBeenCalled()
  })

  test('submits candidate two-factor verification and persists A2O on commit', async () => {
    const { store, save } = createLoginCookieStore('A2=old')
    const onTwoFactorRequired = vi.fn(async verification => {
      await verification.submitCode('123456')
      return true
    })
    checkCookieMock.mockImplementation(async session => {
      const verified = await getSessionOptions(session).onTwoFactorRequired?.()
      if (!verified) throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
      return { isValid: true, username: 'VerifiedUser' }
    })
    submitTwoFactorCodeMock.mockImplementation(async session => {
      session.setCookie('A2=new; A2O=verified')
    })
    const client = await V2exClient.create({
      loginCookieStore: store,
      onTwoFactorRequired
    })

    await expect(client.switchLoginCookie('A2=new')).resolves.toBe('authenticated')

    expect(submitTwoFactorCodeMock).toHaveBeenCalledWith(expect.anything(), '123456')
    expect(save).toHaveBeenLastCalledWith('A2=new; A2O=verified')
    expect(client.getLoginCookie()).toBe('A2=new; A2O=verified')
  })

  test('keeps the current session unchanged when candidate two-factor verification is canceled', async () => {
    const { store, save } = createLoginCookieStore('A2=old')
    checkCookieMock.mockImplementation(async session => {
      const verified = await getSessionOptions(session).onTwoFactorRequired?.()
      if (!verified) throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
      return { isValid: true, username: 'NewUser' }
    })
    const client = await V2exClient.create({
      loginCookieStore: store,
      onTwoFactorRequired: async () => false
    })

    await expect(client.switchLoginCookie('A2=new')).resolves.toBe('canceled')

    expect(client.getLoginCookie()).toBe('A2=old')
    expect(save).not.toHaveBeenCalled()
  })

  test('persists A2O after business two-factor verification', async () => {
    const { store, save } = createLoginCookieStore('A2=current')
    const onTwoFactorRequired = vi.fn(async verification => {
      await verification.submitCode('123456')
      return true
    })
    submitTwoFactorCodeMock.mockImplementation(async session => {
      session.setCookie('A2=current; A2O=verified')
    })
    const client = await V2exClient.create({
      loginCookieStore: store,
      onTwoFactorRequired
    })
    const session = getClientSession(client)

    await expect(getSessionOptions(session).onTwoFactorRequired?.()).resolves.toBe(true)

    expect(save).toHaveBeenLastCalledWith('A2=current; A2O=verified')
  })

  test('does not let an old authentication check overwrite a newly committed login', async () => {
    const { store } = createLoginCookieStore('A2=old')
    const oldCheck = createDeferred<CheckCookieResult>()
    checkCookieMock
      .mockReturnValueOnce(oldCheck.promise)
      .mockResolvedValueOnce({ isValid: true, username: 'NewUser' })
    const client = await V2exClient.create({ loginCookieStore: store })

    const oldRefresh = client.refreshAuthentication()
    await expect(client.switchLoginCookie('A2=new')).resolves.toBe('authenticated')
    oldCheck.resolve({ isValid: false })

    await expect(oldRefresh).resolves.toBe(true)
    expect(client.getLoginCookie()).toBe('A2=new')
    expect(client.getAuthenticatedUsername()).toBe('NewUser')
  })

  test('logout wins over a pending candidate validation', async () => {
    const { store, save } = createLoginCookieStore('A2=current')
    const checkResult = createDeferred<CheckCookieResult>()
    checkCookieMock.mockReturnValue(checkResult.promise)
    const client = await V2exClient.create({ loginCookieStore: store })

    const switching = client.switchLoginCookie('A2=new')
    await client.logout()
    checkResult.resolve({ isValid: true, username: 'NewUser' })

    await expect(switching).resolves.toBe('canceled')
    expect(client.getLoginCookie()).toBe('')
    expect(client.isAuthenticated()).toBe(false)
    expect(save).toHaveBeenLastCalledWith('')
  })

  test('logout clears a verified username and both runtime and persisted credentials', async () => {
    const { store, save } = createLoginCookieStore('A2=old')
    checkCookieMock.mockResolvedValue({ isValid: true, username: 'CurrentUser' })
    const client = await V2exClient.create({ loginCookieStore: store })
    await client.ensureAuthenticated()

    await client.logout()

    expect(client.getLoginCookie()).toBe('')
    expect(client.getAuthenticatedUsername()).toBeUndefined()
    expect(client.isAuthenticated()).toBe(false)
    expect(save).toHaveBeenLastCalledWith('')
  })

  test('does not let an authentication check started during logout restore the username', async () => {
    const { store, save } = createLoginCookieStore('A2=current')
    const credentialDeletion = createDeferred<void>()
    const staleCheck = createDeferred<CheckCookieResult>()
    checkCookieMock
      .mockResolvedValueOnce({ isValid: true, username: 'CurrentUser' })
      .mockReturnValueOnce(staleCheck.promise)
    const client = await V2exClient.create({ loginCookieStore: store })
    await client.ensureAuthenticated()
    save.mockImplementationOnce(() => credentialDeletion.promise)

    const logout = client.logout()
    const refresh = client.refreshAuthentication()
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(''))
    credentialDeletion.resolve()
    await logout
    staleCheck.resolve({ isValid: true, username: 'CurrentUser' })

    await expect(refresh).resolves.toBe(false)
    expect(client.getLoginCookie()).toBe('')
    expect(client.getAuthenticatedUsername()).toBeUndefined()
    expect(client.isAuthenticated()).toBe(false)
  })

  test('does not persist business two-factor Cookie updates started during logout', async () => {
    const { store, save } = createLoginCookieStore('A2=current')
    const credentialDeletion = createDeferred<void>()
    const onTwoFactorRequired = vi.fn(async verification => {
      await verification.submitCode('123456')
      return true
    })
    const client = await V2exClient.create({
      loginCookieStore: store,
      onTwoFactorRequired
    })
    const session = getClientSession(client)
    submitTwoFactorCodeMock.mockImplementation(async () => {
      session.setCookie('A2=current; A2O=verified')
    })
    save.mockImplementationOnce(() => credentialDeletion.promise)

    const logout = client.logout()
    const verification = getSessionOptions(session).onTwoFactorRequired?.()
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(''))
    credentialDeletion.resolve()

    await logout
    await expect(verification).resolves.toBe(false)
    expect(client.getLoginCookie()).toBe('')
    expect(save).toHaveBeenCalledTimes(1)
  })

  test('keeps the runtime session when deleting persisted credentials fails', async () => {
    const { store, save } = createLoginCookieStore('A2=current')
    checkCookieMock.mockResolvedValue({ isValid: true, username: 'CurrentUser' })
    const client = await V2exClient.create({ loginCookieStore: store })
    await client.ensureAuthenticated()
    save.mockRejectedValueOnce(new Error('SecretStorage unavailable'))

    await expect(client.logout()).rejects.toThrow('SecretStorage unavailable')

    expect(client.getLoginCookie()).toBe('A2=current')
    expect(client.getAuthenticatedUsername()).toBe('CurrentUser')
    expect(client.isAuthenticated()).toBe(true)
  })
})
