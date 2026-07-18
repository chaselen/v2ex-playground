import { LoaderCircle } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { mergeClassNames } from './utils'

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger'
export type ButtonSize = 'small' | 'default' | 'large'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮视觉层级 */
  variant?: ButtonVariant
  /** 按钮尺寸 */
  size?: ButtonSize
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
