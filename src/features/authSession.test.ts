import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { V2exClient } from '@/v2ex'
import type { LoginCredentialStore } from './loginCredentialStore'

const { requestTwoFactorVerificationMock } = vi.hoisted(() => ({
  requestTwoFactorVerificationMock: vi.fn()
}))

vi.mock('@/features/twoFactorAuth', () => ({
  requestTwoFactorVerification: requestTwoFactorVerificationMock
}))

import {
  AuthSessionManager,
  type BusinessClientAuthHandlers,
  type CandidateClientFactory
} from './authSession'

/** 创建可从测试中完成的 Promise */
function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

/** 创建内存凭据存储 */
function createCredentialStore(initialCookie = '') {
  let cookie = initialCookie
  return {
    load: vi.fn(async () => cookie),
    save: vi.fn(async (nextCookie: string) => {
      cookie = nextCookie
    })
  } as unknown as LoginCredentialStore
}

/** 创建业务客户端桩 */
function createBusinessClientStub(overrides: Partial<V2exClient> = {}) {
  return {
    setCookie: vi.fn(),
    getLoginCookie: vi.fn().mockReturnValue('A2=runtime'),
    checkCookie: vi.fn().mockResolvedValue({ isValid: false }),
    submitTwoFactorCode: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as V2exClient
}

/** 创建已配置业务客户端工厂的会话管理器 */
function createAuthSessionManager(
  credentialStore: LoginCredentialStore,
  businessClient: V2exClient,
  createCandidateClient: CandidateClientFactory,
  onHandlers?: (handlers: BusinessClientAuthHandlers) => void
) {
  return new AuthSessionManager(
    credentialStore,
    vi.fn((_, handlers) => {
      onHandlers?.(handlers)
      return businessClient
    }),
    createCandidateClient
  )
}

describe('AuthSessionManager', () => {
  beforeEach(() => {
    requestTwoFactorVerificationMock.mockReset()
  })

  test('loads persisted credentials but waits for validation before marking authenticated', async () => {
    const credentialStore = createCredentialStore('A2=persisted')
    const businessClient = createBusinessClientStub({
      checkCookie: vi.fn().mockResolvedValue({ isValid: true, username: 'PersistedUser' })
    })
    const createBusinessClient = vi.fn().mockReturnValue(businessClient)
    const manager = new AuthSessionManager(credentialStore, createBusinessClient, vi.fn())

    await expect(manager.initialize()).resolves.toBe(businessClient)
    expect(manager.isAuthenticated()).toBe(false)
    await expect(manager.ensureAuthenticated()).resolves.toBe(true)
    expect(manager.getAuthenticatedSession()?.username).toBe('PersistedUser')
    expect(createBusinessClient).toHaveBeenCalledWith('A2=persisted', {
      onLoginExpired: expect.any(Function),
      onTwoFactorRequired: expect.any(Function)
    })
  })

  test('commits a candidate cookie only after isolated validation succeeds', async () => {
    const checkResult = createDeferred<{ isValid: true; username: string }>()
    const candidateClient = {
      checkCookie: vi.fn(() => checkResult.promise),
      getLoginCookie: vi.fn().mockReturnValue('A2=new; A2O=verified')
    } as unknown as V2exClient
    const credentialStore = createCredentialStore('A2=old')
    const businessClient = createBusinessClientStub()
    const manager = createAuthSessionManager(
      credentialStore,
      businessClient,
      vi.fn().mockReturnValue(candidateClient)
    )
    await manager.initialize()

    const authentication = manager.authenticate('A2=new')
    expect(businessClient.setCookie).not.toHaveBeenCalled()
    expect(credentialStore.save).not.toHaveBeenCalled()

    checkResult.resolve({ isValid: true, username: 'NewUser' })

    await expect(authentication).resolves.toBe('authenticated')
    expect(credentialStore.save).toHaveBeenCalledWith('A2=new; A2O=verified')
    expect(businessClient.setCookie).toHaveBeenCalledWith('A2=new; A2O=verified')
    expect(manager.getAuthenticatedSession()?.username).toBe('NewUser')
  })

  test('keeps the current session unchanged when candidate validation fails', async () => {
    const candidateClient = {
      checkCookie: vi.fn().mockResolvedValue({ isValid: false })
    } as unknown as V2exClient
    const credentialStore = createCredentialStore('A2=old')
    const businessClient = createBusinessClientStub()
    const manager = createAuthSessionManager(
      credentialStore,
      businessClient,
      vi.fn().mockReturnValue(candidateClient)
    )
    await manager.initialize()

    await expect(manager.authenticate('A2=new')).resolves.toBe('invalid')
    expect(credentialStore.save).not.toHaveBeenCalled()
    expect(businessClient.setCookie).not.toHaveBeenCalled()
    expect(manager.getLoginCookie()).toBe('A2=old')
  })

  test('submits two-factor verification through the candidate session', async () => {
    const submitTwoFactorCode = vi.fn().mockResolvedValue(undefined)
    let onTwoFactorRequired!: () => Promise<boolean>
    const candidateClient = {
      checkCookie: vi.fn(async () => {
        await onTwoFactorRequired()
        return { isValid: true, username: 'VerifiedUser' }
      }),
      getLoginCookie: vi.fn().mockReturnValue('A2=new; A2O=verified'),
      submitTwoFactorCode
    } as unknown as V2exClient
    const createCandidateClient: CandidateClientFactory = (_, handler) => {
      onTwoFactorRequired = handler
      return candidateClient
    }
    requestTwoFactorVerificationMock.mockImplementation(async (owner, options) => {
      expect(owner).toBe(candidateClient)
      await options.verify('123456')
      return true
    })
    const manager = createAuthSessionManager(
      createCredentialStore('A2=old'),
      createBusinessClientStub(),
      createCandidateClient
    )
    await manager.initialize()

    await expect(manager.authenticate('A2=new')).resolves.toBe('authenticated')
    expect(submitTwoFactorCode).toHaveBeenCalledWith('123456')
  })

  test('allows only the latest concurrent login attempt to commit', async () => {
    const oldResult = createDeferred<{ isValid: true; username: string }>()
    const oldCandidate = {
      checkCookie: vi.fn(() => oldResult.promise),
      getLoginCookie: vi.fn().mockReturnValue('A2=old-candidate')
    } as unknown as V2exClient
    const newCandidate = {
      checkCookie: vi.fn().mockResolvedValue({ isValid: true, username: 'NewUser' }),
      getLoginCookie: vi.fn().mockReturnValue('A2=new-candidate')
    } as unknown as V2exClient
    const businessClient = createBusinessClientStub()
    const manager = createAuthSessionManager(
      createCredentialStore('A2=current'),
      businessClient,
      vi.fn().mockReturnValueOnce(oldCandidate).mockReturnValueOnce(newCandidate)
    )
    await manager.initialize()

    const oldAuthentication = manager.authenticate('A2=old-candidate')
    await expect(manager.authenticate('A2=new-candidate')).resolves.toBe('authenticated')
    oldResult.resolve({ isValid: true, username: 'OldUser' })

    await expect(oldAuthentication).resolves.toBe('canceled')
    expect(businessClient.setCookie).toHaveBeenCalledTimes(1)
    expect(manager.getLoginCookie()).toBe('A2=new-candidate')
    expect(manager.getAuthenticatedSession()?.username).toBe('NewUser')
  })

  test('does not let an old authentication check overwrite a newly committed login', async () => {
    const oldCheck = createDeferred<{ isValid: true; username: string }>()
    const businessClient = createBusinessClientStub({
      checkCookie: vi.fn(() => oldCheck.promise)
    })
    const candidateClient = {
      checkCookie: vi.fn().mockResolvedValue({ isValid: true, username: 'NewUser' }),
      getLoginCookie: vi.fn().mockReturnValue('A2=new')
    } as unknown as V2exClient
    const manager = createAuthSessionManager(
      createCredentialStore('A2=old'),
      businessClient,
      vi.fn().mockReturnValue(candidateClient)
    )
    await manager.initialize()

    const oldRefresh = manager.refreshAuthentication()
    await expect(manager.authenticate('A2=new')).resolves.toBe('authenticated')
    oldCheck.resolve({ isValid: true, username: 'OldUser' })

    await expect(oldRefresh).resolves.toBe(true)
    expect(manager.getAuthenticatedSession()?.username).toBe('NewUser')
  })

  test('persists A2O after business two-factor verification', async () => {
    const credentialStore = createCredentialStore('A2=old')
    const businessClient = createBusinessClientStub({
      getLoginCookie: vi.fn().mockReturnValue('A2=old; A2O=verified')
    })
    let handlers!: BusinessClientAuthHandlers
    requestTwoFactorVerificationMock.mockImplementation(async (owner, options) => {
      expect(owner).not.toBe(businessClient)
      await options.verify('123456')
      return true
    })
    const manager = createAuthSessionManager(credentialStore, businessClient, vi.fn(), value => {
      handlers = value
    })
    await manager.initialize()

    await expect(handlers.onTwoFactorRequired()).resolves.toBe(true)
    expect(businessClient.submitTwoFactorCode).toHaveBeenCalledWith('123456')
    expect(credentialStore.save).toHaveBeenCalledWith('A2=old; A2O=verified')
    expect(manager.getLoginCookie()).toBe('A2=old; A2O=verified')
  })

  test('replaces the business two-factor owner after switching sessions', async () => {
    const owners: object[] = []
    const candidateClient = {
      checkCookie: vi.fn().mockResolvedValue({ isValid: true, username: 'NewUser' }),
      getLoginCookie: vi.fn().mockReturnValue('A2=new')
    } as unknown as V2exClient
    let handlers!: BusinessClientAuthHandlers
    requestTwoFactorVerificationMock.mockImplementation(async owner => {
      owners.push(owner)
      return false
    })
    const manager = createAuthSessionManager(
      createCredentialStore('A2=old'),
      createBusinessClientStub(),
      vi.fn().mockReturnValue(candidateClient),
      value => {
        handlers = value
      }
    )
    await manager.initialize()

    await handlers.onTwoFactorRequired()
    await manager.authenticate('A2=new')
    await handlers.onTwoFactorRequired()

    expect(owners).toHaveLength(2)
    expect(owners[1]).not.toBe(owners[0])
  })

  test('clears verified state and persisted credentials when login expires', async () => {
    const credentialStore = createCredentialStore('A2=expired')
    const businessClient = createBusinessClientStub({
      checkCookie: vi.fn().mockResolvedValue({ isValid: true, username: 'ExpiredUser' })
    })
    let handlers!: BusinessClientAuthHandlers
    const manager = createAuthSessionManager(credentialStore, businessClient, vi.fn(), value => {
      handlers = value
    })
    await manager.initialize()
    await manager.refreshAuthentication()

    await handlers.onLoginExpired()

    expect(manager.isAuthenticated()).toBe(false)
    expect(manager.getLoginCookie()).toBe('')
    expect(credentialStore.save).toHaveBeenLastCalledWith('')
  })

  test('clears runtime and persisted state on logout', async () => {
    const credentialStore = createCredentialStore('A2=current')
    const businessClient = createBusinessClientStub({
      checkCookie: vi.fn().mockResolvedValue({ isValid: true, username: 'CurrentUser' })
    })
    const manager = createAuthSessionManager(credentialStore, businessClient, vi.fn())
    await manager.initialize()
    await manager.refreshAuthentication()

    await manager.logout()

    expect(businessClient.setCookie).toHaveBeenCalledWith('')
    expect(credentialStore.save).toHaveBeenLastCalledWith('')
    expect(manager.isAuthenticated()).toBe(false)
    expect(manager.getLoginCookie()).toBe('')
  })
})
