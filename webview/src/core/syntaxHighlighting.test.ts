import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HighlightResult, SyntaxTheme } from 'vscode-tint'
import { escapeHtml } from 'vscode-tint'

const mocks = vi.hoisted(() => ({
  highlight: vi.fn(),
  setTheme: vi.fn(),
  create: vi.fn(),
  change: undefined as ((theme: SyntaxTheme) => void) | undefined,
  blocks: [] as HTMLElement[],
  theme: { settings: [] } as SyntaxTheme
}))
vi.mock('vscode-tint/presets/textmate', () => ({ createTextmateHighlighter: mocks.create }))
vi.mock('./syntaxTheme', () => ({
  getSyntaxTheme: async () => mocks.theme,
  onSyntaxThemeChanged: (handler: typeof mocks.change) => {
    mocks.change = handler
  }
}))

/** 独立保留原始文本，模拟 token HTML 替换后浏览器仍能读取代码 */
function createCodeBlock(source: string, classes: string[] = []) {
  const names = new Set(classes)
  let text = source
  let html = source
  return {
    classList: {
      [Symbol.iterator]: () => names[Symbol.iterator](),
      add: (...values: string[]) => values.forEach(value => names.add(value)),
      remove: (value: string) => names.delete(value),
      contains: (value: string) => names.has(value)
    },
    dataset: { syntaxHighlightPending: 'true' },
    get textContent() {
      return text
    },
    set textContent(value: string) {
      text = value
      html = escapeHtml(value)
    },
    get innerHTML() {
      return html
    },
    set innerHTML(value: string) {
      html = value
    }
  } as unknown as HTMLElement
}

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  mocks.change = undefined
  mocks.blocks = []
  mocks.highlight.mockResolvedValue({
    html: '<span>TextMate output</span>',
    highlighted: true,
    className: 'vscode-tint-textmate'
  })
  mocks.setTheme.mockResolvedValue(undefined)
  mocks.create.mockImplementation(async () => ({
    highlight: mocks.highlight,
    setTheme: mocks.setTheme
  }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response()))
  vi.stubGlobal('document', { querySelectorAll: () => mocks.blocks })
})
afterEach(() => vi.unstubAllGlobals())

describe('highlightCodeBlocks', () => {
  it.each([
    ['dockerfile', 'docker'],
    ['patch', 'diff'],
    ['js', 'javascript']
  ])('显式 %s 传入 npm 引擎并使用返回的 HTML 与类名', async (alias, language) => {
    const { highlightCodeBlocks } = await import('./syntaxHighlighting')
    const code = createCodeBlock('value = 1', [`language-${alias}`])
    await highlightCodeBlocks([code])
    expect(mocks.highlight).toHaveBeenCalledWith('value = 1', { language })
    expect(code.classList.contains('vscode-tint-textmate')).toBe(true)
    expect(code.dataset.highlighted).toBe('textmate')
    expect(code.dataset.syntaxHighlightPending).toBeUndefined()
  })
  it('使用预设和本地 WASM，HTML 重绘仍保持自动模式', async () => {
    const { highlightCodeBlocks } = await import('./syntaxHighlighting')
    const source = '<!doctype html><html><script>const x = 1</script></html>'
    const code = createCodeBlock(source)
    mocks.blocks = [code]
    await highlightCodeBlocks([code])
    const options = mocks.create.mock.calls[0][0]
    expect(options).toMatchObject({ wasm: expect.any(Promise), theme: mocks.theme })
    expect(options).not.toHaveProperty('loadGrammar')
    expect(options).not.toHaveProperty('detectLanguage')
    mocks.change?.({ name: 'new', settings: [] })
    await vi.waitFor(() => expect(mocks.highlight).toHaveBeenCalledTimes(2))
    expect(mocks.highlight.mock.calls.every(([, options]) => options.language === undefined)).toBe(
      true
    )
  })
  it.each(['text', 'plaintext', 'unknown'])(
    '显式 %s 仍作为显式语言，应用完整纯文本回退',
    async language => {
      const source = '<img src=x onerror=alert(1)>'
      mocks.highlight.mockResolvedValue({
        html: escapeHtml(source),
        highlighted: false,
        reason: language === 'unknown' ? 'unsupported-language' : 'plaintext',
        className: 'vscode-tint-textmate'
      })
      const { highlightCodeBlocks } = await import('./syntaxHighlighting')
      const code = createCodeBlock(source, [`language-${language}`])
      await highlightCodeBlocks([code])
      expect(mocks.highlight).toHaveBeenCalledWith(source, { language: expect.any(String) })
      expect(mocks.highlight.mock.calls[0][1].language).not.toBeUndefined()
      expect(code.dataset.highlighted).toBe('plain')
      expect(code.dataset.syntaxHighlightFallback).toBe(
        language === 'unknown' ? 'unsupported-language' : 'plaintext'
      )
      expect(code.innerHTML).not.toContain('<img')
    }
  )
  it('跳过 nohighlight，不初始化引擎', async () => {
    const { highlightCodeBlocks } = await import('./syntaxHighlighting')
    const code = createCodeBlock('text', ['nohighlight'])
    await highlightCodeBlocks([code])
    expect(mocks.create).not.toHaveBeenCalled()
    expect(code.dataset.syntaxHighlightPending).toBeUndefined()
  })
  it('初始化失败可重试，单个代码块失败不影响后续内容', async () => {
    mocks.create.mockRejectedValueOnce(new Error('WASM failed'))
    const { highlightCodeBlocks } = await import('./syntaxHighlighting')
    const first = createCodeBlock('<first>'),
      second = createCodeBlock('second')
    await highlightCodeBlocks([first, second])
    expect(first.innerHTML).toBe('&lt;first&gt;')
    expect(first.dataset.highlighted).toBe('plain')
    expect(second.dataset.highlighted).toBe('textmate')
    expect(mocks.create).toHaveBeenCalledTimes(2)
  })
  it('丢弃旧渲染结果', async () => {
    let finish!: (value: HighlightResult) => void
    mocks.highlight.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const { highlightCodeBlocks } = await import('./syntaxHighlighting')
    const code = createCodeBlock('old')
    const first = highlightCodeBlocks([code])
    await vi.waitFor(() => expect(mocks.highlight).toHaveBeenCalledOnce())
    code.textContent = 'new'
    await highlightCodeBlocks([code])
    finish({ html: '<span>stale</span>', highlighted: true, className: 'vscode-tint-textmate' })
    await first
    expect(code.innerHTML).toBe('<span>TextMate output</span>')
    expect(code.textContent).toBe('new')
  })
  it('等待主题设置完成再重绘，快速切换主题按顺序应用', async () => {
    const { highlightCodeBlocks } = await import('./syntaxHighlighting')
    const code = createCodeBlock('const x = 1')
    mocks.blocks = [code]
    await highlightCodeBlocks([code])
    let finish!: () => void
    mocks.setTheme.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finish = resolve
        })
    )
    mocks.change?.({ name: 'first', settings: [] })
    mocks.change?.({ name: 'second', settings: [] })
    await vi.waitFor(() => expect(mocks.setTheme).toHaveBeenCalledOnce())
    expect(mocks.highlight).toHaveBeenCalledOnce()
    finish()
    await vi.waitFor(() => expect(mocks.highlight).toHaveBeenCalledTimes(2))
    expect(mocks.setTheme.mock.calls.map(([theme]) => theme.name)).toEqual(['first', 'second'])
  })
  it('初始化期间切换主题时补读最新快照', async () => {
    const initial = mocks.theme
    const latest = { name: 'during initialization', settings: [] }
    mocks.create.mockImplementationOnce(async () => {
      mocks.theme = latest
      return { highlight: mocks.highlight, setTheme: mocks.setTheme }
    })
    const { highlightCodeBlocks } = await import('./syntaxHighlighting')
    await highlightCodeBlocks([createCodeBlock('const x = 1')])
    expect(mocks.create.mock.calls[0][0].theme).toBe(initial)
    expect(mocks.setTheme).toHaveBeenCalledWith(latest)
    expect(mocks.highlight).toHaveBeenCalledOnce()
  })
  it('渲染中主题变化时重新高亮，不应用旧主题结果', async () => {
    let finish!: (value: HighlightResult) => void
    mocks.highlight.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const { highlightCodeBlocks } = await import('./syntaxHighlighting')
    const code = createCodeBlock('const x = 1')
    const pending = highlightCodeBlocks([code])
    await vi.waitFor(() => expect(mocks.highlight).toHaveBeenCalledOnce())
    mocks.change?.({ name: 'next', settings: [] })
    finish({
      html: '<span>stale theme</span>',
      highlighted: true,
      className: 'vscode-tint-textmate'
    })
    await pending
    expect(mocks.highlight).toHaveBeenCalledTimes(2)
    expect(code.innerHTML).toBe('<span>TextMate output</span>')
  })
})
