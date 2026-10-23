import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SyntaxTheme } from 'vscode-tint'
const mocks = vi.hoisted(() => ({
  getSyntaxTheme: vi.fn(),
  listener: undefined as ((event: { theme: SyntaxTheme }) => void) | undefined
}))
vi.mock('./vscode', async importOriginal => {
  const actual = await importOriginal<typeof import('./vscode')>()
  return {
    ...actual,
    createVsCodeClient: () => ({
      getSyntaxTheme: mocks.getSyntaxTheme,
      on: (_event: string, listener: typeof mocks.listener) => {
        mocks.listener = listener
        return () => {
          mocks.listener = undefined
        }
      }
    })
  }
})
beforeEach(() => {
  vi.resetModules()
  mocks.getSyntaxTheme.mockReset()
  mocks.listener = undefined
  vi.stubGlobal('acquireVsCodeApi', () => {})
})
afterEach(() => vi.unstubAllGlobals())
it('同一文档共用读取，主题事件替换完整规则', async () => {
  const first = { settings: [{ scope: 'string', settings: { foreground: '#a5d6ff' } }] }
  mocks.getSyntaxTheme.mockResolvedValue(first)
  const { getSyntaxTheme, onSyntaxThemeChanged } = await import('./syntaxTheme')
  expect(await getSyntaxTheme()).toEqual(first)
  expect(await getSyntaxTheme()).toEqual(first)
  expect(mocks.getSyntaxTheme).toHaveBeenCalledOnce()
  const changed = vi.fn()
  onSyntaxThemeChanged(changed)
  const next = { settings: [] }
  mocks.listener?.({ theme: next })
  expect(changed).toHaveBeenCalledWith(next)
  expect(await getSyntaxTheme()).toEqual(next)
})
it('初始响应不能覆盖较早到达的新主题事件', async () => {
  let resolveInitial!: (theme: SyntaxTheme) => void
  mocks.getSyntaxTheme.mockReturnValue(
    new Promise(resolve => {
      resolveInitial = resolve
    })
  )
  const { getSyntaxTheme } = await import('./syntaxTheme')
  const pending = getSyntaxTheme()
  const next = { name: 'new', settings: [] }
  mocks.listener?.({ theme: next })
  resolveInitial({ name: 'old', settings: [] })
  expect(await pending).toEqual(next)
})
it('没有宿主 API 时使用无配色主题，不发起请求', async () => {
  vi.stubGlobal('acquireVsCodeApi', undefined)
  const { getSyntaxTheme } = await import('./syntaxTheme')
  expect(await getSyntaxTheme()).toEqual({ settings: [] })
  expect(mocks.getSyntaxTheme).not.toHaveBeenCalled()
})
