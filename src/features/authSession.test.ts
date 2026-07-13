import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { V2exClient } from '@/v2ex'
import type { LoginCredentialStore } from './loginCredentialStore'

const { requestTwoFactorVerificationMock } = vi.hoisted(() => ({
  requestTwoFactorVerificationMock: vi.fn()
}))

vi.mock('@/features/twoFactorAuth', () => ({
  requestTwoFactorVerification: requestTwoFactorVerificationMock
}))

import { AuthSessionManager, type CandidateClientFactory } from './authSession'

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
function createBusinessClientStub() {
  return {
    setCookie: vi.fn(),
    getLoginCookie: vi.fn().mockReturnValue('A2=runtime'),
    getAuthSessionVersion: vi.fn().mockReturnValue(1)
  } as unknown as V2exClient
}

/** 创建已配置业务客户端工厂的会话管理器 */
function createAuthSessionManager(
  credentialStore: LoginCredentialStore,
  businessClient: V2exClient,
  createCandidateClient: CandidateClientFactory
) {
  return new AuthSessionManager(
    credentialStore,
    vi.fn().mockReturnValue(businessClient),
    createCandidateClient
  )
}

describe('AuthSessionManager', () => {
  beforeEach(() => {
    requestTwoFactorVerificationMock.mockReset()
  })

  test('creates the business client from the persisted login cookie', async () => {
    const credentialStore = createCredentialStore('A2=persisted')
    const businessClient = createBusinessClientStub()
    const createBusinessClient = vi.fn().mockReturnValue(businessClient)
    const manager = new AuthSessionManager(credentialStore, createBusinessClient, vi.fn())

    await expect(manager.initialize()).resolves.toBe(businessClient)
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
    const createCandidateClient = vi.fn().mockReturnValue(candidateClient)
    const credentialStore = createCredentialStore('A2=old')
    const businessClient = createBusinessClientStub()
    const manager = createAuthSessionManager(credentialStore, businessClient, createCandidateClient)
    await manager.initialize()

    const authentication = manager.authenticate('A2=new')
    expect(businessClient.setCookie).not.toHaveBeenCalled()
    expect(credentialStore.save).not.toHaveBeenCalled()

    checkResult.resolve({ isValid: true, username: 'new-user' })

    await expect(authentication).resolves.toBe('authenticated')
    expect(credentialStore.save).toHaveBeenCalledWith('A2=new; A2O=verified')
    expect(businessClient.setCookie).toHaveBeenCalledWith('A2=new; A2O=verified')
    expect(manager.isAuthenticated()).toBe(true)
  })

  test('keeps the business session unchanged when candidate validation fails', async () => {
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
        return { isValid: true, username: 'verified-user' }
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
    const credentialStore = createCredentialStore('A2=old')
    const businessClient = createBusinessClientStub()
    const manager = createAuthSessionManager(credentialStore, businessClient, createCandidateClient)
    await manager.initialize()

    await expect(manager.authenticate('A2=new')).resolves.toBe('authenticated')
    expect(submitTwoFactorCode).toHaveBeenCalledWith('123456')
    expect(businessClient.setCookie).toHaveBeenCalledWith('A2=new; A2O=verified')
  })

  test('does not commit an older candidate after a newer login starts', async () => {
    const oldResult = createDeferred<{ isValid: true; username: string }>()
    const oldCandidate = {
      checkCookie: vi.fn(() => oldResult.promise),
      getLoginCookie: vi.fn().mockReturnValue('A2=old-candidate')
    } as unknown as V2exClient
    const newCandidate = {
      checkCookie: vi.fn().mockResolvedValue({ isValid: true, username: 'new-user' }),
      getLoginCookie: vi.fn().mockReturnValue('A2=new-candidate')
    } as unknown as V2exClient
    const credentialStore = createCredentialStore('A2=current')
    const businessClient = createBusinessClientStub()
    const manager = createAuthSessionManager(
      credentialStore,
      businessClient,
      vi.fn().mockReturnValueOnce(oldCandidate).mockReturnValueOnce(newCandidate)
    )
    await manager.initialize()

    const oldAuthentication = manager.authenticate('A2=old-candidate')
    await expect(manager.authenticate('A2=new-candidate')).resolves.toBe('authenticated')
    oldResult.resolve({ isValid: true, username: 'old-user' })

    await expect(oldAuthentication).resolves.toBe('canceled')
    expect(businessClient.setCookie).toHaveBeenCalledTimes(1)
    expect(businessClient.setCookie).toHaveBeenCalledWith('A2=new-candidate')
    expect(manager.getLoginCookie()).toBe('A2=new-candidate')
  })

  test('persists the runtime login cookie after business two-factor verification', async () => {
    const credentialStore = createCredentialStore('A2=old')
    const submitTwoFactorCode = vi.fn().mockResolvedValue(undefined)
    const businessClient = {
      ...createBusinessClientStub(),
      submitTwoFactorCode,
      getLoginCookie: vi.fn().mockReturnValue('A2=old; A2O=verified'),
      getAuthSessionVersion: vi.fn().mockReturnValue(2)
    } as unknown as V2exClient
    let onTwoFactorRequired!: () => boolean | Promise<boolean>
    const createBusinessClient = vi.fn((_, handlers) => {
      onTwoFactorRequired = handlers.onTwoFactorRequired
      return businessClient
    })
    requestTwoFactorVerificationMock.mockImplementation(async (owner, options) => {
      expect(owner).toBe(businessClient)
      await options.verify('123456')
      return true
    })
    const manager = new AuthSessionManager(credentialStore, createBusinessClient, vi.fn())
    await manager.initialize()

    await expect(onTwoFactorRequired()).resolves.toBe(true)
    expect(submitTwoFactorCode).toHaveBeenCalledWith('123456')
    expect(credentialStore.save).toHaveBeenCalledWith('A2=old; A2O=verified')
    expect(manager.getLoginCookie()).toBe('A2=old; A2O=verified')
  })
})
