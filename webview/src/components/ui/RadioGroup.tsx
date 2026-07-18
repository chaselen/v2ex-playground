import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { Badge } from './Badge'
import { mergeClassNames } from './utils'

export interface RadioGroupProps extends ComponentProps<typeof RadioGroupPrimitive.Root> {
  /** 单选组视觉样式 */
  variant?: 'default' | 'segmented'
}

/** 基于 Radix RadioGroup 的单选组 */
export function RadioGroup({ className, variant = 'default', ...props }: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      className={mergeClassNames(
        'v2ex-radio-group',
        variant === 'segmented' ? 'v2ex-radio-group--segmented' : undefined,
        className
      )}
      {...props}
    />
  )
}

export interface RadioGroupItemProps extends Omit<
  ComponentProps<typeof RadioGroupPrimitive.Item>,
  'children'
> {
  /** 显示文案 */
  label: ReactNode
  /** 选项徽标 */
  badge?: ReactNode
  /** 徽标语义样式 */
  badgeVariant?: 'default' | 'danger'
}

/** 单选项 */
export function RadioGroupItem({
  badge,
  badgeVariant = 'default',
  className,
  label,
  ...props
}: RadioGroupItemProps) {
  return (
    <label className={mergeClassNames('v2ex-radio-group__label', className)}>
      <RadioGroupPrimitive.Item className="v2ex-radio-group__item" {...props}>
        <RadioGroupPrimitive.Indicator className="v2ex-radio-group__indicator" />
      </RadioGroupPrimitive.Item>
      <span className="v2ex-radio-group__text">{label}</span>
      {badge !== undefined && badge !== null && (
        <Badge
          count={badge}
          countClassName={mergeClassNames(
            'v2ex-radio-group__badge',
            `v2ex-radio-group__badge--${badgeVariant}`
          )}
        />
      )}
    </label>
  )
}
