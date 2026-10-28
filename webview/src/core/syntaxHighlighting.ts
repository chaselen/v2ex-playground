import type { CodeHighlighter } from 'vscode-tint'
import { resolveCodeLanguage } from 'vscode-tint/languages'
import { createTextmateHighlighter } from 'vscode-tint/presets/textmate'
import wasmUrl from 'vscode-oniguruma/release/onig.wasm?url'
import { getSyntaxTheme, onSyntaxThemeChanged } from './syntaxTheme'

let pendingHighlighter: Promise<CodeHighlighter> | undefined
let themeRevision = 0
let themeReady = Promise.resolve()
const rendering = new WeakMap<HTMLElement, number>()

/** 共用 npm 引擎与主题订阅，应用侧仅管理本地资源、DOM 和异步渲染顺序 */
function getHighlighter() {
  pendingHighlighter ??= (async () => {
    const theme = await getSyntaxTheme()
    const highlighter = await createTextmateHighlighter({
      wasm: fetch(wasmUrl),
      theme,
      // HTML 内嵌多语言首次编译较慢，采用演示页验证过的预算，仍保留长度上限
      maxLineTime: 1000,
      maxBlockTime: 1500
    })
    onSyntaxThemeChanged(next => {
      const revision = ++themeRevision
      // 主题更新异步串行完成后再重绘，防止快速切换留下旧主题或纯文本回退
      themeReady = themeReady.catch(() => {}).then(() => highlighter.setTheme(next))
      void themeReady
        .then(() => {
          if (revision !== themeRevision) return
          const blocks = document.querySelectorAll<HTMLElement>('pre > code[data-highlighted]')
          return highlightCodeBlocks(blocks)
        })
        .catch(error => console.error('更新代码高亮主题失败', error))
    })
    // 工厂初始化也会让出执行权；补读快照，覆盖订阅建立前发生的主题切换
    const revision = themeRevision
    const latest = await getSyntaxTheme()
    if (latest !== theme && revision === themeRevision) {
      themeReady = themeReady.catch(() => {}).then(() => highlighter.setTheme(latest))
    }
    await themeReady
    return highlighter
  })().catch(error => {
    pendingHighlighter = undefined
    throw error
  })
  return pendingHighlighter
}

/** 保留显式未知语言，交由引擎回退；只有没有声明时才允许自动识别 */
function getDeclaredLanguage(code: HTMLElement): string | undefined {
  let declared: string | undefined
  for (const className of code.classList) {
    const name = className.match(/^(?:language|lang)-(.+)$/i)?.[1]
    if (!name) continue
    declared ??= name
    const language = resolveCodeLanguage(name)
    if (language) return language
  }
  return declared
}

async function highlightCodeBlock(code: HTMLElement) {
  const generation = (rendering.get(code) || 0) + 1
  rendering.set(code, generation)
  if (code.classList.contains('nohighlight') || code.classList.contains('no-highlight')) {
    delete code.dataset.syntaxHighlightPending
    return
  }
  const source = code.textContent || ''
  try {
    const highlighter = await getHighlighter()
    await themeReady
    const version = themeRevision
    // 重绘只读取原始语言声明，让无声明的代码在内容变化后仍可重新识别
    const result = await highlighter.highlight(source, { language: getDeclaredLanguage(code) })
    if (rendering.get(code) !== generation) return
    if (version !== themeRevision) {
      await highlightCodeBlock(code)
      return
    }
    code.classList.remove('hljs')
    code.classList.add(result.className)
    code.innerHTML = result.html
    code.dataset.highlighted = result.highlighted ? 'textmate' : 'plain'
    if (result.reason) code.dataset.syntaxHighlightFallback = result.reason
    else delete code.dataset.syntaxHighlightFallback
  } catch {
    // 加载或分词失败不影响正文与后续代码块，保留完整代码文本
    if (rendering.get(code) === generation) {
      code.textContent = source
      code.dataset.highlighted = 'plain'
      delete code.dataset.syntaxHighlightFallback
    }
  } finally {
    if (rendering.get(code) === generation) delete code.dataset.syntaxHighlightPending
  }
}

/** highlight.js 仅识别语言，最终 HTML 由 vscode-tint 的 TextMate 引擎生成 */
export async function highlightCodeBlocks(codeBlocks: Iterable<HTMLElement>): Promise<void> {
  // 串行处理，避免大量代码块同时争用同步分词预算
  for (const code of codeBlocks) await highlightCodeBlock(code)
}
