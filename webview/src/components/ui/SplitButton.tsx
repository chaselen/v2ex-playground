import { ChevronDown } from 'lucide-react'
import { Button, type ButtonProps } from './Button'
import { DropdownMenu, type DropdownMenuProps } from './DropdownMenu'

/** 主按钮执行固定操作，菜单提供独立的附加操作 */
export interface SplitButtonProps extends Pick<
  ButtonProps,
  'icon' | 'title' | 'onClick' | 'disabled' | 'size' | 'variant'
> {
  children: string
  menuLabel: string
  items: DropdownMenuProps['items']
  side?: DropdownMenuProps['side']
}

/** 将主操作和菜单触发按钮组合成一组 */
export function SplitButton({
  children,
  menuLabel,
  items,
  side,
  disabled,
  size,
  variant,
  ...mainProps
}: SplitButtonProps) {
  return (
    <div className="v2ex-split-button" role="group" aria-label={children}>
      <Button {...mainProps} disabled={disabled} size={size} variant={variant}>
        {children}
      </Button>
      <DropdownMenu items={items} side={side} align="end">
        <Button
          compact
          disabled={disabled}
          size={size}
          variant={variant}
          aria-label={menuLabel}
          icon={<ChevronDown aria-hidden="true" />}
        />
      </DropdownMenu>
    </div>
  )
}
