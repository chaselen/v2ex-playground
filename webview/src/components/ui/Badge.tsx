import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { mergeClassNames } from './utils'

export type BadgeVariant = 'default' | 'danger'

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** 徽标数字或内容 */
  count: ReactNode
  /** 数字最大显示值 */
  overflowCount?: number
  /** 带徽标的目标元素 */
  children?: ReactNode
  /** 徽标本身的附加类名 */
  countClassName?: string
  /** 徽标本身的内联样式 */
  countStyle?: CSSProperties
  /** 徽标语义样式 */
  variant?: BadgeVariant
}

/** 使用 VS Code Badge Theme Color 的徽标 */
export function Badge({
  children,
  className,
  count,
  countClassName,
  countStyle,
  overflowCount,
  variant = 'default',
  ...props
}: BadgeProps) {
  const displayCount =
    typeof count === 'number' && overflowCount !== undefined && count > overflowCount
      ? `${overflowCount}+`
      : count
  const badge = (
    <span
      {...props}
      className={mergeClassNames(
        'v2ex-badge__count',
        `v2ex-badge__count--${variant}`,
        countClassName
      )}
      style={countStyle}
    >
      {displayCount}
    </span>
  )

  if (!children) {
    return badge
  }

  return (
    <span className={mergeClassNames('v2ex-badge', className)}>
      {children}
      {badge}
    </span>
  )
}

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** 标签强调程度 */
  variant?: 'neutral' | 'badge'
}

/** 使用 VS Code 中性色或 Badge 色的标签 */
export function Tag({ className, variant = 'neutral', ...props }: TagProps) {
  return (
    <span {...props} className={mergeClassNames('v2ex-tag', `v2ex-tag--${variant}`, className)} />
  )
}
