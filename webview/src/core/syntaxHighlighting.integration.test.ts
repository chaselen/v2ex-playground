import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterEach, expect, it, vi } from 'vitest'
import { decodeHTML } from 'entities'

vi.mock('./syntaxTheme', () => ({
  getSyntaxTheme: async () => ({
    settings: [
      { scope: 'string', settings: { foreground: '#aabbcc' } },
      { scope: 'entity.name.tag.html', settings: { foreground: '#123456' } },
      { scope: 'support.type.property-name.css', settings: { foreground: '#abcdef' } }
    ]
  }),
  onSyntaxThemeChanged: () => () => {}
}))
afterEach(() => vi.unstubAllGlobals())

it('使用 npm 实际引擎、本地 WASM 和预设 grammar 渲染 HTML 与标签模板', async () => {
  const bytes = readFileSync(
    createRequire(import.meta.url).resolve('vscode-oniguruma/release/onig.wasm')
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(bytes))
  )
  vi.stubGlobal('document', { querySelectorAll: () => [] })
  const { highlightCodeBlocks } = await import('./syntaxHighlighting')
  for (const [source, language] of [
    [
      '<!doctype html><html><style>h1 { color: red; }</style><script>const title = "hello"</script></html>',
      undefined
    ],
    ['const view = html`<h1>Hello</h1>`; const style = css`h1 { color: red; }`;', 'javascript'],
    ['<img src=x onerror=alert(1)>', 'unknown']
  ]) {
    const names = new Set(language ? [`language-${language}`] : [])
    const code = {
      textContent: source,
      innerHTML: '',
      dataset: {},
      classList: {
        [Symbol.iterator]: () => names[Symbol.iterator](),
        contains: (name: string) => names.has(name),
        add: (name: string) => names.add(name),
        remove: (name: string) => names.delete(name)
      }
    } as unknown as HTMLElement
    await highlightCodeBlocks([code])
    expect(decodeHTML(code.innerHTML.replace(/<[^>]*>/g, ''))).toBe(source)
    if (language === 'unknown') {
      expect(code.dataset.highlighted).toBe('plain')
      expect(code.dataset.syntaxHighlightFallback).toBe('unsupported-language')
      expect(code.innerHTML).not.toContain('<img')
    } else {
      expect(code.dataset.highlighted).toBe('textmate')
      expect(code.innerHTML).toContain('#123456')
      expect(code.innerHTML).toContain('#ABCDEF')
      if (!language) expect(code.innerHTML).toContain('#AABBCC')
    }
  }
})
