import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ notify: vi.fn(), dispose: vi.fn() }))
vi.mock('vscode', () => ({ default: { window: { showInformationMessage: mocks.notify } } }))
vi.mock('./webviewPanel', () => ({
  createV2exWebviewPanel: () => ({ webview: {}, dispose: mocks.dispose, onDidDispose: vi.fn() })
}))
vi.mock('@/core/WebviewRpcBridge', () => ({
  WebviewRpcBridge: class {
    dispose() {}
  }
}))
import { TwoFactorPanelController } from './TwoFactorPanelController'

beforeEach(() => vi.clearAllMocks())

test('closes successful verification without an extra success notification', async () => {
  const controller = new TwoFactorPanelController({ verify: vi.fn().mockResolvedValue(undefined) })
  await controller.rpc_verify('123456')
  await expect(controller.wait()).resolves.toBe(true)
  expect(mocks.dispose).toHaveBeenCalledTimes(1)
  expect(mocks.notify).not.toHaveBeenCalled()
})

test('does not report verification success after cancellation during submission', async () => {
  let release!: () => void
  const verification = new Promise<void>(resolve => {
    release = resolve
  })
  const controller = new TwoFactorPanelController({ verify: () => verification })
  const submitting = controller.rpc_verify('123456')
  controller.rpc_cancel()
  await expect(controller.wait()).resolves.toBe(false)
  release()
  await submitting
  expect(mocks.notify).not.toHaveBeenCalled()
  expect(mocks.dispose).toHaveBeenCalledTimes(1)
})
