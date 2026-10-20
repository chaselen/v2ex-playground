import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { handleWebviewLinkClick } from './linkNavigation'

const mocks = vi.hoisted(() => ({ openExternal: vi.fn(), openTopic: vi.fn() }))
vi.mock('./vscode', () => ({ createVsCodeClient: () => mocks }))

class LinkElement {
  textContent = '链接标题'
  classList = { contains: (name: string) => name === 'topic-link' }
  constructor(private readonly href: string) {}
  closest() {
    return this
  }
  getAttribute() {
    return this.href
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('Element', LinkElement)
  vi.stubGlobal('document', { baseURI: 'https://www.v2ex.com/' })
})
afterEach(() => vi.unstubAllGlobals())

function click(href: string, defaultPrevented = false) {
  return {
    target: new LinkElement(href) as unknown as EventTarget,
    defaultPrevented,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
}

test.each(['/t/123', '/member/test', '/go/python', '/help/home', 'https://example.com/'])(
  'sends resolved URLs and titles through the shared RPC: %s',
  href => {
    const event = click(href)
    expect(handleWebviewLinkClick(event)).toBe(true)
    expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith(
      new URL(href, 'https://www.v2ex.com/').href,
      '链接标题'
    )
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
    expect(mocks.openTopic).not.toHaveBeenCalled()
  }
)

test('does not navigate clicks already handled by anchors or previews', () => {
  const event = click('#section', true)
  expect(handleWebviewLinkClick(event)).toBe(false)
  expect(mocks.openExternal).not.toHaveBeenCalled()
  expect(event.preventDefault).not.toHaveBeenCalled()
})

test.each(['', 'javascript:;', 'http://['])('uses known topics for placeholder links: %s', href => {
  expect(
    handleWebviewLinkClick(click(href), { fallbackTopic: { topicId: 123, title: '消息话题' } })
  ).toBe(true)
  expect(mocks.openTopic).toHaveBeenCalledExactlyOnceWith(123, '消息话题')
  expect(mocks.openExternal).not.toHaveBeenCalled()
})

test('valid URLs take priority over fallback topics', () => {
  handleWebviewLinkClick(click('/member/test'), { fallbackTopic: { topicId: 123 } })
  expect(mocks.openExternal).toHaveBeenCalledOnce()
  expect(mocks.openTopic).not.toHaveBeenCalled()
})
