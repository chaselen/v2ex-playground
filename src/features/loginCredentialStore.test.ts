import { describe, expect, test, vi } from 'vitest'
import type vscode from 'vscode'
import { LoginCredentialStore } from './loginCredentialStore'

/** 创建 SecretStorage 与 globalState 测试上下文 */
function createContext(secretCookie?: string, legacyCookie?: string) {
  const secrets = {
    get: vi.fn().mockResolvedValue(secretCookie),
    store: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined)
  }
  const globalState = {
    get: vi.fn().mockReturnValue(legacyCookie),
    update: vi.fn().mockResolvedValue(undefined)
  }
  return {
    context: { secrets, globalState } as unknown as vscode.ExtensionContext,
    secrets,
    globalState
  }
}

describe('LoginCredentialStore', () => {
  test('prefers SecretStorage and removes leftover legacy data', async () => {
    const { context, secrets, globalState } = createContext(
      'A2=secret; A2O=verified; V2EX_LANG=zhcn',
      'A2=legacy'
    )

    await expect(new LoginCredentialStore(context).load()).resolves.toBe('A2=secret; A2O=verified')
    expect(secrets.store).toHaveBeenCalledWith('v2ex.loginCookie', 'A2=secret; A2O=verified')
    expect(globalState.update).toHaveBeenCalledWith('cookie', undefined)
  })

  test('migrates a legacy login cookie into SecretStorage once', async () => {
    const { context, secrets, globalState } = createContext(undefined, 'A2=legacy')

    await expect(new LoginCredentialStore(context).load()).resolves.toBe('A2=legacy')
    expect(secrets.store).toHaveBeenCalledWith('v2ex.loginCookie', 'A2=legacy')
    expect(globalState.update).toHaveBeenCalledWith('cookie', undefined)
  })

  test('falls back to a valid legacy cookie when the stored secret is malformed', async () => {
    const { context, secrets, globalState } = createContext('invalid', 'A2=legacy')

    await expect(new LoginCredentialStore(context).load()).resolves.toBe('A2=legacy')
    expect(secrets.store).toHaveBeenCalledWith('v2ex.loginCookie', 'A2=legacy')
    expect(globalState.update).toHaveBeenCalledWith('cookie', undefined)
  })

  test('stores only A2/A2O and deletes the secret on logout', async () => {
    const { context, secrets } = createContext()
    const store = new LoginCredentialStore(context)

    await store.save('A2=login; A2O=verified; V2EX_LANG=zhcn')
    await store.save('')

    expect(secrets.store).toHaveBeenCalledWith('v2ex.loginCookie', 'A2=login; A2O=verified')
    expect(secrets.delete).toHaveBeenCalledWith('v2ex.loginCookie')
  })
})
