import { Select as SelectPrimitive } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ClearButton } from './ClearButton'
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
  /** 允许清空选择，清空时通过 onValueChange 返回空字符串 */
  clearable?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 无障碍名称 */
  'aria-label'?: string
  /** 附加类名 */
  className?: string
  /** 值变化回调 */
  onValueChange?: (value: string) => void
}

/** 基于 Base UI Select 的单选下拉框 */
export function Select({
  className,
  clearable = false,
  defaultValue,
  disabled,
  options,
  placeholder,
  value,
  onValueChange,
  ...props
}: SelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const currentValue = value ?? internalValue
  const canClear = clearable && !!currentValue && !disabled

  function changeValue(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue)
    onValueChange?.(nextValue)
  }

  return (
    <SelectPrimitive.Root
      value={currentValue || null}
      items={options}
      disabled={disabled}
      onValueChange={nextValue => changeValue(nextValue ?? '')}
    >
      <span
        className={mergeClassNames(
          'v2ex-clearable-select v2ex-select-container',
          canClear && 'v2ex-clearable-select--active',
          className
        )}
      >
        <SelectPrimitive.Trigger className="v2ex-select" {...props}>
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="v2ex-select__icon">
            <ChevronDown aria-hidden="true" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        {canClear && <ClearButton label="清空选择" onClear={() => changeValue('')} />}
      </span>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          className="v2ex-floating-positioner"
          alignItemWithTrigger={false}
          sideOffset={4}
          collisionPadding={8}
        >
          <SelectPrimitive.Popup className="v2ex-select__content">
            <SelectPrimitive.List className="v2ex-select__viewport">
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
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
