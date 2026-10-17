import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  resetChallenge: vi.fn(),
  resetSubmit: vi.fn(),
  resetDispose: vi.fn(),
  reveal: vi.fn(),
  challenge: vi.fn<() => Promise<string>>(),
  submit: vi.fn(),
  cancelAttempt: vi.fn(),
  cookie: vi.fn(),
  disposePanel: vi.fn(),
  onDispose: undefined as (() => void) | undefined
}))
vi.mock('@/global', () => ({
  default: {
    context: { subscriptions: [] },
    V2ex: {
      createPasswordReset: () => ({
        loadChallenge: mocks.resetChallenge,
        submit: mocks.resetSubmit,
        dispose: mocks.resetDispose
      }),
      createPasswordLogin: () => ({
        loadChallenge: mocks.challenge,
        submit: mocks.submit,
        dispose: mocks.cancelAttempt
      }),
      switchLoginCookie: mocks.cookie
    }
  }
}))
vi.mock('./webviewPanel', () => ({
  createV2exWebviewPanel: () => ({
    webview: {},
    reveal: mocks.reveal,
    dispose: mocks.disposePanel,
    onDidDispose: (callback: () => void) => {
      mocks.onDispose = callback
    }
  })
}))
vi.mock('@/core/WebviewRpcBridge', () => ({
  WebviewRpcBridge: class {
    post = mocks.post
    dispose = vi.fn()
  }
}))

import { LoginPanelController } from './LoginPanelController'
import { LoginCooldownError } from '@/v2ex'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.challenge.mockResolvedValue('data:image/png;base64,first')
})

test('keeps password reset separate and disposes it on close', async () => {
  const controller = new LoginPanelController()
  mocks.resetChallenge.mockResolvedValue('data:image/png;base64,reset')
  await expect(controller.rpc_startPasswordReset()).resolves.toContain('reset')
  const input = { username: 'user', email: 'user@example.com', captcha: 'abcd' }
  mocks.resetSubmit.mockResolvedValue('source message')
  await expect(controller.rpc_submitPasswordReset(input)).resolves.toBe('source message')
  expect(mocks.resetSubmit).toHaveBeenCalledWith(input)
  expect(mocks.challenge).not.toHaveBeenCalled()
  controller.rpc_closePasswordReset()
  expect(mocks.resetDispose).toHaveBeenCalledOnce()
  expect(() => controller.rpc_refreshPasswordResetCaptcha()).toThrow('请重新打开')
})

describe('login panel async state', () => {
  test('Cookie login works while the captcha is unavailable and late image loading preserves submission and the password challenge', async () => {
    let release!: (image: string) => void
    mocks.challenge.mockReturnValueOnce(
      new Promise(resolve => {
        release = resolve
      })
    )
    mocks.cookie.mockReturnValueOnce(new Promise(() => {}))
    const controller = new LoginPanelController()
    expect(controller.rpc_ready().loading).toBe(true)
    controller.rpc_loginWithCookie('A2=new')
    expect(mocks.cookie).toHaveBeenCalledWith('A2=new', { signal: expect.any(AbortSignal) })
    expect(controller.rpc_ready().submitting).toBe(true)
    release('data:image/png;base64,late')
    await vi.waitFor(() =>
      expect(controller.rpc_ready().captchaImage).toBe('data:image/png;base64,late')
    )
    expect(controller.rpc_ready()).toMatchObject({ loading: false, submitting: true })
    expect(controller.rpc_ready().captchaImage).toBe('data:image/png;base64,late')
    controller.rpc_loginWithCookie('A2=duplicate')
    expect(mocks.cookie).toHaveBeenCalledTimes(1)
    mocks.onDispose?.()
    expect(mocks.cookie.mock.calls[0][1].signal.aborted).toBe(true)
  })

  test('password failure refreshes the challenge and makes the form available again', async () => {
    const controller = new LoginPanelController()
    controller.rpc_ready()
    await vi.waitFor(() => expect(controller.rpc_ready().loading).toBe(false))
    mocks.submit.mockRejectedValueOnce(new Error('验证码错误'))
    mocks.challenge.mockResolvedValueOnce('data:image/png;base64,second')
    controller.rpc_loginWithPassword({ username: 'user', password: 'secret', captcha: 'abc' })
    expect(controller.rpc_ready().submitting).toBe(true)
    await vi.waitFor(() =>
      expect(controller.rpc_ready()).toMatchObject({
        loading: false,
        submitting: false,
        passwordError: '验证码错误',
        captchaImage: 'data:image/png;base64,second'
      })
    )
    mocks.onDispose?.()
  })
})

test.each([false, true])(
  'does not reveal a closed panel after challenge recovery (failure: %s)',
  async fail => {
    const controller = new LoginPanelController()
    controller.rpc_ready()
    await vi.waitFor(() => expect(controller.rpc_ready().loading).toBe(false))
    mocks.submit.mockRejectedValueOnce(new Error('wrong captcha'))
    let finish!: () => void
    mocks.challenge.mockReturnValueOnce(
      new Promise((resolve, reject) => {
        finish = () =>
          fail ? reject(new Error('network failure')) : resolve('data:image/png;base64,retry')
      })
    )
    controller.rpc_loginWithPassword({ username: 'user', password: 'secret', captcha: 'abc' })
    await vi.waitFor(() => expect(controller.rpc_ready().loading).toBe(true))
    mocks.onDispose?.()
    mocks.post.mockClear()
    finish()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mocks.reveal).not.toHaveBeenCalled()
    expect(mocks.post).not.toHaveBeenCalled()
  }
)

test('keeps password and Cookie errors independent through login and captcha retries', async () => {
  const controller = new LoginPanelController()
  controller.rpc_ready()
  await vi.waitFor(() => expect(controller.rpc_ready().loading).toBe(false))
  mocks.submit.mockRejectedValueOnce(new Error('密码登录错误'))
  controller.rpc_loginWithPassword({ username: 'user', password: 'secret', captcha: 'abc' })
  await vi.waitFor(() =>
    expect(controller.rpc_ready()).toMatchObject({
      submitting: false,
      passwordError: '密码登录错误'
    })
  )
  expect(controller.rpc_ready().cookieError).toBeUndefined()
  mocks.cookie.mockRejectedValueOnce(new Error('Cookie 登录错误'))
  controller.rpc_loginWithCookie('A2=invalid')
  await vi.waitFor(() =>
    expect(controller.rpc_ready()).toMatchObject({
      submitting: false,
      passwordError: '密码登录错误',
      cookieError: 'Cookie 登录错误'
    })
  )
  controller.rpc_refreshCaptcha()
  await vi.waitFor(() => expect(controller.rpc_ready().loading).toBe(false))
  expect(controller.rpc_ready().passwordError).toBeUndefined()
  expect(controller.rpc_ready().cookieError).toBe('Cookie 登录错误')
  mocks.onDispose?.()
})

test('stops captcha recovery after a password login cooldown', async () => {
  const controller = new LoginPanelController()
  controller.rpc_ready()
  await vi.waitFor(() => expect(controller.rpc_ready().loading).toBe(false))
  mocks.submit.mockRejectedValueOnce(new LoginCooldownError())
  controller.rpc_loginWithPassword({ username: 'user', password: 'secret', captcha: 'abc' })
  await vi.waitFor(() =>
    expect(controller.rpc_ready()).toMatchObject({
      submitting: false,
      loading: false,
      passwordError: expect.stringContaining('登录受限')
    })
  )
  expect(controller.rpc_ready().captchaImage).toBeUndefined()
  expect(mocks.challenge).toHaveBeenCalledTimes(1)
  mocks.onDispose?.()
})
