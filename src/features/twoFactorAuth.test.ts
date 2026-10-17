import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TwoFactorVerification } from '@/v2ex'

const panels = vi.hoisted(() => ({
  created: [] as Array<{
    dispose: ReturnType<typeof vi.fn>
    reveal: ReturnType<typeof vi.fn>
    finish(verified: boolean): void
  }>
}))
vi.mock('@/controllers/TwoFactorPanelController', () => ({
  TwoFactorPanelController: class {
    private resolve!: (verified: boolean) => void
    private task = new Promise<boolean>(resolve => {
      this.resolve = resolve
    })
    reveal = vi.fn()
    dispose = vi.fn(() => this.resolve(false))
    finish = (verified: boolean) => this.resolve(verified)
    constructor() {
      panels.created.push(this)
    }
    wait() {
      return this.task
    }
  }
}))
import { requestTwoFactorVerification } from './twoFactorAuth'

beforeEach(() => {
  panels.created.length = 0
})
function verification(abort: AbortController): TwoFactorVerification {
  return { signal: abort.signal, submitCode: vi.fn() }
}

describe('two-factor panel lifetime', () => {
  test('does not open a panel for an already canceled login', async () => {
    const abort = new AbortController()
    abort.abort()
    await expect(requestTwoFactorVerification(verification(abort))).resolves.toBe(false)
    expect(panels.created).toHaveLength(0)
  })

  test('closing a login closes its pending verification panel and resolves the wait', async () => {
    const abort = new AbortController()
    const task = requestTwoFactorVerification(verification(abort))
    abort.abort()
    await expect(task).resolves.toBe(false)
    expect(panels.created[0].dispose).toHaveBeenCalledTimes(1)
  })

  test('completed verification detaches its cancellation listener', async () => {
    const abort = new AbortController()
    const task = requestTwoFactorVerification(verification(abort))
    panels.created[0].finish(true)
    await expect(task).resolves.toBe(true)
    abort.abort()
    expect(panels.created[0].dispose).not.toHaveBeenCalled()
  })

  test('canceling a replaced verification does not close the new panel', async () => {
    const old = new AbortController()
    const next = new AbortController()
    const first = requestTwoFactorVerification(verification(old))
    const second = requestTwoFactorVerification(verification(next))
    await expect(first).resolves.toBe(false)
    old.abort()
    expect(panels.created[1].dispose).not.toHaveBeenCalled()
    next.abort()
    await expect(second).resolves.toBe(false)
  })
})
