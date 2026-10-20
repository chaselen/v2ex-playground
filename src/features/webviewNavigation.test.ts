import { beforeEach, expect, test, vi } from 'vitest'
import { openWebviewUrl } from './webviewNavigation'

const mocks = vi.hoisted(() => ({
  openMember: vi.fn(),
  openTopic: vi.fn(),
  openNode: vi.fn(),
  openBalance: vi.fn(),
  openCreateTopic: vi.fn(),
  openHelp: vi.fn(),
  openExternal: vi.fn()
}))
vi.mock('@/features/panelNavigation', () => mocks)
vi.mock('@/features/openExternal', () => ({ openExternal: mocks.openExternal }))
beforeEach(() => vi.resetAllMocks())

test.each([
  'https://www.v2ex.com',
  'https://edge.v2ex.com',
  'http://v2ex.com',
  'https://cn.v2ex.com'
])('opens help document action links inside the extension: %s', origin => {
  openWebviewUrl(`${origin}/write`)
  expect(mocks.openCreateTopic).toHaveBeenCalledOnce()
  openWebviewUrl(`${origin}/balance/`)
  expect(mocks.openBalance).toHaveBeenCalledOnce()
  expect(mocks.openExternal).not.toHaveBeenCalled()
})

test.each([
  'https://www.v2ex.com/balance/add',
  'https://www.v2ex.com/settings/tokens',
  'https://www.v2ex.com/write/other',
  'https://example.com/write',
  'https://www.v2ex.com.example.com/balance',
  'ftp://www.v2ex.com/write',
  'invalid'
])('keeps unsupported pages and external links in the browser: %s', path => {
  openWebviewUrl(path)
  expect(mocks.openExternal).toHaveBeenCalledWith(path)
  expect(mocks.openBalance).not.toHaveBeenCalled()
  expect(mocks.openCreateTopic).not.toHaveBeenCalled()
})

test('opens help articles only once through the existing help navigation', () => {
  openWebviewUrl('https://www.v2ex.com/help/currency#boost')
  expect(mocks.openHelp).toHaveBeenCalledExactlyOnceWith('currency', 'boost')
  expect(mocks.openExternal).not.toHaveBeenCalled()
})

test('routes topic URLs by pathname and preserves the link title', () => {
  openWebviewUrl('https://www.v2ex.com/t/123/?p=2#reply9', '话题标题')
  expect(mocks.openTopic).toHaveBeenCalledExactlyOnceWith('123', '话题标题')
  expect(mocks.openExternal).not.toHaveBeenCalled()
})

test('decodes member and node names and preserves node titles', () => {
  openWebviewUrl('https://edge.v2ex.com/member/%E7%94%A8%E6%88%B7')
  expect(mocks.openMember).toHaveBeenCalledExactlyOnceWith('用户')
  openWebviewUrl('https://www.v2ex.com/go/python', 'Python')
  expect(mocks.openNode).toHaveBeenCalledWith('python', 'Python')
  openWebviewUrl('https://www.v2ex.com/go/vscode')
  expect(mocks.openNode).toHaveBeenLastCalledWith('vscode', 'vscode')
  expect(mocks.openExternal).not.toHaveBeenCalled()
})

test.each([
  'https://example.com/t/123',
  'https://www.v2ex.com/?next=/t/123',
  'https://www.v2ex.com/t/123/other',
  'https://www.v2ex.com/member/%FF',
  'https://www.v2ex.com/go/%FF',
  'ftp://www.v2ex.com/member/test'
])('does not misroute unsupported URLs: %s', path => {
  openWebviewUrl(path)
  expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith(path)
  expect(mocks.openTopic).not.toHaveBeenCalled()
  expect(mocks.openMember).not.toHaveBeenCalled()
  expect(mocks.openNode).not.toHaveBeenCalled()
})

test('decodes help fragments and rejects malformed fragment encoding', () => {
  openWebviewUrl('https://cn.v2ex.com/help/currency#%62oost')
  expect(mocks.openHelp).toHaveBeenCalledExactlyOnceWith('currency', 'boost')
  openWebviewUrl('https://www.v2ex.com/help/api#%FF')
  expect(mocks.openHelp).toHaveBeenCalledOnce()
  expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith('https://www.v2ex.com/help/api#%FF')
})
