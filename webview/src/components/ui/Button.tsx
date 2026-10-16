import type { ControlSize } from './controlSize'
import { LoaderCircle } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { mergeClassNames } from './utils'

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮视觉层级 */
  variant?: ButtonVariant
  /** 默认 32px，small 为 28px，large 为 36px */
  size?: ControlSize
  /** 缩小横向内边距，适合紧凑工具栏或纯图标按钮 */
  compact?: boolean
  /** 异步操作进行中 */
  loading?: boolean
  /** 按钮前置图标 */
  icon?: ReactNode
}

/** 使用 VS Code Theme Color 的基础按钮 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    compact = false,
    disabled,
    icon,
    loading = false,
    size = 'default',
    type = 'button',
    variant = 'secondary',
    ...props
  },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={mergeClassNames(
        'v2ex-button',
        `v2ex-button--${variant}`,
        `v2ex-button--${size}`,
        compact && 'v2ex-button--compact',
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <LoaderCircle className="v2ex-button__spinner" aria-hidden="true" />
      ) : (
        icon && <span className="v2ex-button__icon">{icon}</span>
      )}
      {children && <span className="v2ex-button__label">{children}</span>}
    </button>
  )
})
