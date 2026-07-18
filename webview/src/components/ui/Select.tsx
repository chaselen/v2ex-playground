import { Select as SelectPrimitive } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { mergeClassNames } from './utils'

export interface SelectOption {
  /** 选项值 */
  value: string
  /** 选项内容 */
  label: ReactNode
  /** 是否禁用 */
  disabled?: boolean
}

export interface SelectProps {
  /** 当前值 */
  value?: string
  /** 默认值 */
  defaultValue?: string
  /** 占位内容 */
  placeholder?: ReactNode
  /** 选项 */
  options: SelectOption[]
  /** 是否禁用 */
  disabled?: boolean
  /** 无障碍名称 */
  'aria-label'?: string
  /** 附加类名 */
  className?: string
  /** 值变化回调 */
  onValueChange?: (value: string) => void
}

/** 基于 Radix Select 的单选下拉框 */
export function Select({
  className,
  defaultValue,
  disabled,
  options,
  placeholder,
  value,
  onValueChange,
  ...props
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      onValueChange={onValueChange}
    >
      <SelectPrimitive.Trigger className={mergeClassNames('v2ex-select', className)} {...props}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="v2ex-select__icon">
          <ChevronDown aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="v2ex-select__content"
          position="popper"
          sideOffset={4}
          collisionPadding={8}
        >
          <SelectPrimitive.Viewport className="v2ex-select__viewport">
            {options.map(option => (
              <SelectPrimitive.Item
                key={option.value}
                className="v2ex-select__item"
                value={option.value}
                disabled={option.disabled}
              >
                <SelectPrimitive.ItemIndicator className="v2ex-select__indicator">
                  <Check aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
