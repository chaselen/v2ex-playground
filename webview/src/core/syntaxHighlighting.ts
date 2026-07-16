import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import markdown from 'highlight.js/lib/languages/markdown'
import objectivec from 'highlight.js/lib/languages/objectivec'
import php from 'highlight.js/lib/languages/php'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

/** 自动检测使用的常见语言 */
const AUTO_DETECT_LANGUAGES = [
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'go',
  'java',
  'javascript',
  'json',
  'markdown',
  'php',
  'python',
  'ruby',
  'rust',
  'sql',
  'typescript',
  'xml',
  'yaml'
]

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('c', c)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('css', css)
hljs.registerLanguage('diff', diff)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('go', go)
hljs.registerLanguage('ini', ini)
hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('kotlin', kotlin)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('objectivec', objectivec)
hljs.registerAliases('objective-c', { languageName: 'objectivec' })
hljs.registerLanguage('php', php)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('python', python)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('yaml', yaml)

/** 代码块语言类名 */
const LANGUAGE_CLASS_PATTERN = /^(?:language|lang)-(.+)$/i

/**
 * 读取代码块显式声明的语言名称
 * @param code 代码元素
 */
function getDeclaredLanguage(code: HTMLElement): string | null | undefined {
  let hasDeclaration = false

  for (const className of code.classList) {
    const language = className.match(LANGUAGE_CLASS_PATTERN)?.[1]
    if (language && hljs.getLanguage(language)) {
      return language
    }
    hasDeclaration ||= Boolean(language)
  }

  return hasDeclaration ? null : undefined
}

/**
 * 高亮单个代码块
 * @param code 代码元素
 */
function highlightCodeBlock(code: HTMLElement) {
  try {
    if (
      code.classList.contains('hljs') ||
      code.classList.contains('nohighlight') ||
      code.classList.contains('no-highlight')
    ) {
      return
    }

    const source = code.textContent || ''
    const language = getDeclaredLanguage(code)
    if (language === null) {
      code.classList.add('nohighlight')
      return
    }

    const result = language
      ? hljs.highlight(source, { language, ignoreIllegals: true })
      : hljs.highlightAuto(source, AUTO_DETECT_LANGUAGES)

    code.innerHTML = result.value
    code.classList.add('hljs')
    code.dataset.highlighted = 'yes'
  } catch {
    // 高亮是渐进增强，单个异常代码块保留原始文本
  } finally {
    delete code.dataset.syntaxHighlightPending
  }
}

/**
 * 高亮 V2EX HTML 内容中的代码块
 * @param codeBlocks 待处理的代码元素
 */
export function highlightCodeBlocks(codeBlocks: Iterable<HTMLElement>) {
  for (const code of codeBlocks) {
    highlightCodeBlock(code)
  }
}
