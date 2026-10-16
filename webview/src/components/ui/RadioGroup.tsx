import { Radio } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import type { ComponentProps, ReactNode } from 'react'
import { Badge, type BadgeVariant } from './Badge'
import { mergeClassNames } from './utils'

export interface RadioGroupProps extends Omit<
  ComponentProps<typeof RadioGroupPrimitive<string>>,
  'className'
> {
  className?: string
  /** 单选组排列方向 */
  orientation?: 'horizontal' | 'vertical'
  /** 单选组视觉样式 */
  variant?: 'default' | 'segmented'
}

/** 基于 Base UI RadioGroup 的单选组 */
export function RadioGroup({
  className,
  variant = 'default',
  orientation = 'horizontal',
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupPrimitive
      aria-orientation={orientation}
      data-orientation={orientation}
      className={mergeClassNames(
        'v2ex-radio-group',
        variant === 'segmented' && 'v2ex-radio-group--segmented',
        className
      )}
      {...props}
    />
  )
}

export interface RadioGroupItemProps extends Omit<
  ComponentProps<typeof Radio.Root>,
  'children' | 'className'
> {
  className?: string
  /** 显示文案 */
  label: ReactNode
  /** 选项徽标 */
  badge?: ReactNode
  /** 徽标语义样式 */
  badgeVariant?: BadgeVariant
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
      <Radio.Root className="v2ex-radio-group__item" {...props}>
        <Radio.Indicator className="v2ex-radio-group__indicator" />
      </Radio.Root>
      <span className="v2ex-radio-group__text">{label}</span>
      {badge !== undefined && badge !== null && (
        <Badge count={badge} countClassName="v2ex-radio-group__badge" variant={badgeVariant} />
      )}
    </label>
  )
}
