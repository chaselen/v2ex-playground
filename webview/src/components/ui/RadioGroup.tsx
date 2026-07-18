import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { mergeClassNames } from './utils'

/** 基于 Radix RadioGroup 的单选组 */
export function RadioGroup({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      className={mergeClassNames('v2ex-radio-group', className)}
      {...props}
    />
  )
}

export interface RadioGroupItemProps extends ComponentProps<typeof RadioGroupPrimitive.Item> {
  /** 显示文案 */
  label: string
}

/** 单选项 */
export function RadioGroupItem({ className, label, ...props }: RadioGroupItemProps) {
  return (
    <label className={mergeClassNames('v2ex-radio-group__label', className)}>
      <RadioGroupPrimitive.Item className="v2ex-radio-group__item" {...props}>
        <RadioGroupPrimitive.Indicator className="v2ex-radio-group__indicator" />
      </RadioGroupPrimitive.Item>
      <span>{label}</span>
    </label>
  )
}
