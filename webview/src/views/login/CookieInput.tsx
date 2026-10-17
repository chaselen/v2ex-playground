import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Textarea } from '@/components/ui'
import { ClearButton } from '@/components/ui/ClearButton'

interface CookieInputProps {
  value: string
  disabled: boolean
  onValueChange(value: string): void
}

/** 保留原生文本编辑，在不可交互的底层高亮 Cookie 名称 */
export default function CookieInput({ value, disabled, onValueChange }: CookieInputProps) {
  const input = useRef<HTMLTextAreaElement>(null)
  const highlight = useRef<HTMLPreElement>(null)

  function syncHighlight() {
    const textarea = input.current
    const backdrop = highlight.current
    if (!textarea || !backdrop) return
    backdrop.style.width = `${textarea.clientWidth}px`
    backdrop.style.height = `${textarea.clientHeight}px`
    backdrop.scrollTop = textarea.scrollTop
    backdrop.scrollLeft = textarea.scrollLeft
  }

  useLayoutEffect(() => {
    const textarea = input.current
    if (!textarea) return
    const observer = new ResizeObserver(syncHighlight)
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(syncHighlight, [value])

  return (
    <div className={`login-cookie-editor${disabled ? ' login-cookie-editor--disabled' : ''}`}>
      <pre ref={highlight} className="login-cookie-highlight" aria-hidden="true">
        {highlightCookieKeys(value)}
        {'\u200b'}
      </pre>
      <Textarea
        ref={input}
        className="login-cookie-input"
        id="login-cookie"
        rows={6}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={value}
        onChange={event => onValueChange(event.target.value)}
        onScroll={syncHighlight}
        disabled={disabled}
        placeholder={'粘贴完整 Cookie、A2="..."、A2 + A2O 或单独的 A2 值'}
      />
      {value && !disabled && (
        <div className="login-cookie-clear">
          <ClearButton
            label="清空 Cookie"
            onClear={() => {
              onValueChange('')
              input.current?.focus()
            }}
          />
        </div>
      )}
    </div>
  )
}

/** 只匹配各 Cookie 分隔段中等号前的名称，不改变值中的等号或空白 */
function highlightCookieKeys(value: string): ReactNode[] {
  const parts: ReactNode[] = []
  let offset = 0
  for (const match of value.matchAll(/(^|;)(\s*)([!#$%&'*+\-.^_`|~0-9A-Za-z]+)(?==)/g)) {
    const start = match.index + match[1].length + match[2].length
    parts.push(value.slice(offset, start))
    parts.push(
      <span className="login-cookie-key" key={start}>
        {match[3]}
      </span>
    )
    offset = start + match[3].length
  }
  parts.push(value.slice(offset))
  return parts
}
