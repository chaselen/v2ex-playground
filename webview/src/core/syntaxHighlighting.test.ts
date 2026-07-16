import { describe, expect, it } from 'vitest'
import { highlightCodeBlocks } from './syntaxHighlighting'

/** 创建满足语法高亮逻辑所需接口的代码元素 */
function createCodeBlock(source: string, classes: string[] = []) {
  const classNames = new Set(classes)
  const code = {
    classList: {
      [Symbol.iterator]: () => classNames[Symbol.iterator](),
      add: (...tokens: string[]) => tokens.forEach(token => classNames.add(token)),
      contains: (token: string) => classNames.has(token)
    },
    dataset: {
      syntaxHighlightPending: 'true'
    } as DOMStringMap,
    innerHTML: source,
    textContent: source
  } as unknown as HTMLElement

  return { classNames, code }
}

describe('highlightCodeBlocks', () => {
  it.each(['c', 'docker', 'patch', 'toml', 'kt', 'objc', 'objective-c'])(
    '支持显式声明的 %s 语言或别名',
    language => {
      const { classNames, code } = createCodeBlock('const value = 1', [`language-${language}`])

      highlightCodeBlocks([code])

      expect(classNames.has('hljs')).toBe(true)
      expect(code.dataset.highlighted).toBe('yes')
      expect(code.dataset.syntaxHighlightPending).toBeUndefined()
    }
  )

  it.each(['text', 'plaintext'])(`让显式声明的 %s 代码块保持纯文本`, language => {
    const source = '<div>plain text</div>'
    const { classNames, code } = createCodeBlock(source, [`language-${language}`])

    highlightCodeBlocks([code])

    expect(classNames.has('hljs')).toBe(true)
    expect(code.textContent).toBe(source)
    expect(code.innerHTML).not.toContain('<div>')
  })

  it('不自动识别显式声明的未知语言', () => {
    const source = 'const value = 1'
    const { classNames, code } = createCodeBlock(source, ['language-unknown'])

    highlightCodeBlocks([code])

    expect(classNames.has('nohighlight')).toBe(true)
    expect(classNames.has('hljs')).toBe(false)
    expect(code.innerHTML).toBe(source)
    expect(code.dataset.syntaxHighlightPending).toBeUndefined()
  })

  it('存在多个语言类名时优先使用已支持的语言', () => {
    const { classNames, code } = createCodeBlock('const value = 1', [
      'language-unknown',
      'language-js'
    ])

    highlightCodeBlocks([code])

    expect(classNames.has('hljs')).toBe(true)
    expect(classNames.has('nohighlight')).toBe(false)
  })
})
