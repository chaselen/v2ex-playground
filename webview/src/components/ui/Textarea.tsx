import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { mergeClassNames } from './utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 错误状态 */
  invalid?: boolean
}

/** 使用 VS Code 输入框主题变量的多行输入框 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid = false, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={mergeClassNames('v2ex-textarea', invalid && 'v2ex-textarea--invalid', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})
