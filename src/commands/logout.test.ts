import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ logout: vi.fn(), notify: vi.fn(), error: vi.fn() }))
vi.mock('vscode', () => ({
  default: {
    ProgressLocation: { Notification: 15 },
    window: {
      withProgress: (_options: unknown, run: () => unknown) => run(),
      showInformationMessage: mocks.notify,
      showErrorMessage: mocks.error
    }
  }
}))
vi.mock('@/global', () => ({ default: { V2ex: { logout: mocks.logout } } }))
vi.mock('@/core/logger', () => ({ logger: { error: vi.fn() } }))
import logout from './logout'
beforeEach(() => {
  vi.resetAllMocks()
})

test('does not report success for a logout superseded by another authentication operation', async () => {
  mocks.logout.mockResolvedValue(false)
  await expect(logout()).resolves.toBe(false)
  expect(mocks.notify).not.toHaveBeenCalled()
  expect(mocks.error).not.toHaveBeenCalled()
})

test('reports successful logout only after completion', async () => {
  mocks.logout.mockResolvedValue(true)
  await expect(logout()).resolves.toBe(true)
  expect(mocks.notify).toHaveBeenCalledWith('已退出 V2EX')
})
