import { expect, test, vi } from 'vitest'
import { formatPanelTitle } from './webviewPanel'

vi.mock('vscode', () => ({ default: {}, Uri: {} }))
vi.mock('@/global', () => ({ default: {} }))
vi.mock('@/features/panelIcon', () => ({ setDefaultPanelIcon: vi.fn() }))
vi.mock('@/core/webviewHtml', () => ({ renderWebviewHtml: vi.fn() }))
vi.mock('@/core/logger', () => ({ logger: {} }))

test.each([
  ['', ''],
  ['中文标题', '中文标题'],
  ['中'.repeat(12), '中'.repeat(12)],
  ['中'.repeat(13), '中'.repeat(12) + '...'],
  ['abc123'.repeat(4), 'abc123'.repeat(4)],
  ['abc123'.repeat(5), 'abc123'.repeat(4) + '...'],
  ['中'.repeat(11) + 'ab中', '中'.repeat(11) + 'ab...'],
  ['a'.repeat(23) + '中文', 'a'.repeat(23) + '...'],
  ['！'.repeat(13), '！'.repeat(12) + '...'],
  ['中'.repeat(11) + '👨‍👩‍👧‍👦x', '中'.repeat(11) + '👨‍👩‍👧‍👦...'],
  ['中'.repeat(11) + 'e\u0301x', '中'.repeat(11) + 'e\u0301...']
])('formats title %j as %j', (title, expected) => {
  expect(formatPanelTitle(title)).toBe(expected)
})
