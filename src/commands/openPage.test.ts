import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  input: vi.fn(),
  openTopic: vi.fn(),
  openMember: vi.fn(),
  openNode: vi.fn(),
  openTag: vi.fn(),
  openHelp: vi.fn(),
  openCreateTopic: vi.fn(),
  openBalance: vi.fn(),
  openExternal: vi.fn()
}))
vi.mock('vscode', () => ({ default: { window: { showInputBox: mocks.input } } }))
vi.mock('@/features/panelNavigation', () => mocks)
vi.mock('@/features/openExternal', () => ({ openExternal: mocks.openExternal }))
import openPage from './openPage'

beforeEach(() => vi.resetAllMocks())

test.each([
  [' 123 ', 'openTopic', ['123', undefined]],
  ['https://www.v2ex.com/t/123?p=2#reply9', 'openTopic', ['123', undefined]],
  ['[帖子](https://www.v2ex.com/t/123)', 'openTopic', ['123', undefined]],
  ['(https://www.v2ex.com/help/api)', 'openHelp', ['api', undefined]],
  ['[用户](https://www.v2ex.com/member/Livid)', 'openMember', ['Livid']],
  ['查看 https://www.v2ex.com/go/vscode.', 'openNode', ['vscode', 'vscode']],
  ['`https://www.v2ex.com/write`', 'openCreateTopic', []],
  ['9007199254740991', 'openTopic', ['9007199254740991', undefined]],
  ['/t/9007199254740991', 'openTopic', ['9007199254740991', undefined]],
  ['https://www.v2ex.com/t/9007199254740991', 'openTopic', ['9007199254740991', undefined]],
  ['分享：https://edge.v2ex.com/member/Livid 查看', 'openMember', ['Livid']],
  ['/go/vscode', 'openNode', ['vscode', 'vscode']],
  ['/tag/VS%20Code', 'openTag', ['VS Code']],
  ['https://www.v2ex.com/tag/%E4%B8%AD%E6%96%87/', 'openTag', ['中文']],
  ['[标签](https://edge.v2ex.com/tag/TypeScript)', 'openTag', ['TypeScript']],
  ['https://cn.v2ex.com/help/currency#%62oost', 'openHelp', ['currency', 'boost']],
  ['/write', 'openCreateTopic', []],
  ['https://www.v2ex.com/balance/', 'openBalance', []],
  ['查看 https://example.com 然后 https://www.v2ex.com/t/456', 'openTopic', ['456', undefined]]
] as const)('opens a supported page from %s', async (input, method, args) => {
  mocks.input.mockResolvedValue(input)
  await openPage()
  const options = mocks.input.mock.calls[0][0]
  expect(options.title).toBe('打开页面')
  expect(options.validateInput(input)).toBeUndefined()
  expect(mocks[method]).toHaveBeenCalledExactlyOnceWith(...args)
  expect(mocks.openExternal).not.toHaveBeenCalled()
})

test.each([
  '0',
  '9007199254740992',
  '/t/0',
  '/t/9007199254740993',
  'https://www.v2ex.com/t/0',
  'https://www.v2ex.com/t/9007199254740993',
  '[帖子](https://www.v2ex.com/t/9007199254740993)',
  'https://example.com/t/123',
  'https://www.v2ex.com/settings',
  'https://www.v2ex.com/member/%FF',
  'https://www.v2ex.com/help/api#%FF',
  '/tag/%FF',
  '/go/%20',
  'https://www.v2ex.com/go/%20%09/',
  '查看 https://[/go/node',
  '/tag/%20',
  '/tag/',
  '/tag/one/two',
  'https://example.com/tag/TypeScript',
  '//example.com/write',
  '没有链接'
])('rejects invalid or unsupported input: %s', async input => {
  mocks.input.mockResolvedValue(input)
  await openPage()
  expect(mocks.input.mock.calls[0][0].validateInput(input)).toBeTruthy()
  for (const method of [
    'openTopic',
    'openMember',
    'openNode',
    'openTag',
    'openHelp',
    'openCreateTopic',
    'openBalance',
    'openExternal'
  ] as const) {
    expect(mocks[method]).not.toHaveBeenCalled()
  }
})

test.each([undefined, '', '  '])(
  'does nothing when input is cancelled or empty: %s',
  async input => {
    mocks.input.mockResolvedValue(input)
    await openPage()
    expect(mocks.openTopic).not.toHaveBeenCalled()
    expect(mocks.openExternal).not.toHaveBeenCalled()
  }
)
