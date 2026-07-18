import { X } from 'lucide-react'
import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { mergeClassNames } from './utils'

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'prefix'
> {
  /** 输入框前置内容 */
  prefix?: ReactNode
  /** 是否显示清空按钮 */
  clearable?: boolean
  /** 输入值变化回调 */
  onValueChange?: (value: string) => void
  /** 非输入法组合状态下按下 Enter */
  onEnter?: () => void
}

/** 使用 VS Code 输入框主题色的单行输入 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    clearable = false,
    disabled,
    onEnter,
    onKeyDown,
    onValueChange,
    prefix,
    value,
    ...props
  },
  ref
) {
  const [composing, setComposing] = useState(false)
  const hasValue = value !== undefined && String(value).length > 0

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event)
    if (
      !event.defaultPrevented &&
      event.key === 'Enter' &&
      !composing &&
      !event.nativeEvent.isComposing
    ) {
      onEnter?.()
    }
  }

  return (
    <span className={mergeClassNames('v2ex-input', disabled && 'v2ex-input--disabled', className)}>
      {prefix && <span className="v2ex-input__prefix">{prefix}</span>}
      <input
        {...props}
        ref={ref}
        className="v2ex-input__control"
        disabled={disabled}
        value={value}
        onChange={event => onValueChange?.(event.currentTarget.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        onKeyDown={handleKeyDown}
      />
      {clearable && hasValue && !disabled && (
        <button
          className="v2ex-input__clear"
          type="button"
          aria-label="清空输入"
          onClick={() => onValueChange?.('')}
        >
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  )
})
