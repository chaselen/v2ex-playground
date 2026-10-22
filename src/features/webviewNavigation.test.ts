import { beforeEach, expect, test, vi } from 'vitest'
import { canOpenWebviewUrl } from './webviewRoute'
import { createWebviewNavigator } from './webviewNavigation'

const mocks = vi.hoisted(() => ({
  openMember: vi.fn(),
  openTopic: vi.fn(),
  openNode: vi.fn(),
  openTag: vi.fn(),
  openBalance: vi.fn(),
  openCreateTopic: vi.fn(),
  openHelp: vi.fn(),
  openExternal: vi.fn()
}))
const openWebviewUrl = createWebviewNavigator(mocks)
beforeEach(() => vi.resetAllMocks())

test.each(['%20', '%09', '%20%09%0A'])(
  'rejects blank decoded node names during validation and navigation: %s',
  name => {
    const url = `https://www.v2ex.com/go/${name}`
    expect(canOpenWebviewUrl(url)).toBe(false)
    expect(mocks.openNode).not.toHaveBeenCalled()
    expect(() => openWebviewUrl(url)).not.toThrow()
    expect(mocks.openNode).not.toHaveBeenCalled()
    expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith(url)
  }
)

test.each([
  ['https://www.v2ex.com/tag/TypeScript', 'TypeScript'],
  ['http://v2ex.com/tag/VS%20Code/', 'VS Code'],
  ['https://edge.v2ex.com/tag/%E4%B8%AD%E6%96%87?p=2#topics', '中文'],
  ['https://www.v2ex.com/tag/%20TypeScript%20', 'TypeScript']
])('opens decoded tags using the tag panel: %s', (url, tag) => {
  expect(canOpenWebviewUrl(url)).toBe(true)
  expect(mocks.openTag).not.toHaveBeenCalled()
  openWebviewUrl(url)
  expect(mocks.openTag).toHaveBeenCalledExactlyOnceWith(tag)
  expect(mocks.openExternal).not.toHaveBeenCalled()
})

test.each([
  'https://www.v2ex.com/tag/',
  'https://www.v2ex.com/tag/%20',
  'https://www.v2ex.com/tag/%FF',
  'https://www.v2ex.com/tag/one/two',
  'https://example.com/tag/TypeScript',
  'ftp://www.v2ex.com/tag/TypeScript'
])('keeps invalid or unsupported tag URLs in the browser: %s', url => {
  expect(canOpenWebviewUrl(url)).toBe(false)
  openWebviewUrl(url)
  expect(mocks.openTag).not.toHaveBeenCalled()
  expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith(url)
})

test.each(['0', '000', '9007199254740992', '9007199254740993'])(
  'rejects invalid topic IDs during validation and navigation: %s',
  topicId => {
    const url = `https://www.v2ex.com/t/${topicId}`
    expect(canOpenWebviewUrl(url)).toBe(false)
    expect(mocks.openTopic).not.toHaveBeenCalled()
    openWebviewUrl(url)
    expect(mocks.openTopic).not.toHaveBeenCalled()
    expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith(url)
  }
)

test('validates supported URLs without opening a panel', () => {
  const url = 'https://www.v2ex.com/t/9007199254740991'
  expect(canOpenWebviewUrl(url)).toBe(true)
  expect(mocks.openTopic).not.toHaveBeenCalled()
  openWebviewUrl(url)
  expect(mocks.openTopic).toHaveBeenCalledExactlyOnceWith('9007199254740991', undefined)
})

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
