import { Check } from 'lucide-react'
import { Menu as DropdownMenuPrimitive } from '@base-ui/react/menu'
import type { ReactElement, ReactNode } from 'react'
import { mergeClassNames } from './utils'

export interface DropdownMenuItem {
  /** 菜单项唯一标识 */
  key: string
  /** 菜单项内容 */
  label: ReactNode
  /** 是否禁用 */
  disabled?: boolean
  /** 是否选中 */
  active?: boolean
  /** 点击回调 */
  onSelect?: () => void
}

export interface DropdownMenuProps {
  /** 触发元素 */
  children: ReactElement
  /** 菜单项 */
  items: DropdownMenuItem[]
  /** 弹出方向 */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** 弹出方向内的对齐方式 */
  align?: 'start' | 'center' | 'end'
  /** 菜单附加类名 */
  className?: string
}

/** 基于 Base UI Dropdown Menu、使用 VS Code Menu 颜色的菜单 */
export function DropdownMenu({
  align = 'start',
  children,
  className,
  items,
  side = 'bottom'
}: DropdownMenuProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger
        render={children}
        nativeButton={typeof children.type !== 'string' || children.type === 'button'}
      />
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Positioner
          className="v2ex-floating-positioner"
          side={side}
          align={align}
          sideOffset={4}
          collisionPadding={8}
        >
          <DropdownMenuPrimitive.Popup className={mergeClassNames('v2ex-menu', className)}>
            {items.map(item => (
              <DropdownMenuPrimitive.Item
                className={mergeClassNames(
                  'v2ex-menu__item',
                  item.active && 'v2ex-menu__item--active'
                )}
                disabled={item.disabled}
                onClick={item.onSelect}
                key={item.key}
              >
                <span className="v2ex-menu__indicator" aria-hidden="true">
                  {item.active && <Check />}
                </span>
                {item.label}
              </DropdownMenuPrimitive.Item>
            ))}
          </DropdownMenuPrimitive.Popup>
        </DropdownMenuPrimitive.Positioner>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
