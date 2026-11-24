import { Check } from 'lucide-react'
import { Menu as DropdownMenuPrimitive } from '@base-ui/react/menu'
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
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
  /** Webview 窗口失焦或页面隐藏时关闭菜单，默认不开启 */
  closeOnWindowBlur?: boolean
}

/** 基于 Base UI Dropdown Menu、使用 VS Code Menu 颜色的菜单 */
export function DropdownMenu({
  align = 'start',
  children,
  className,
  closeOnWindowBlur = false,
  items,
  side = 'bottom'
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || !closeOnWindowBlur) return

    // 点击宿主编辑器时，Webview 只会收到窗口失焦事件
    const closeMenu = () => setOpen(false)
    const handleVisibilityChange = () => {
      if (document.hidden) closeMenu()
    }

    window.addEventListener('blur', closeMenu)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('blur', closeMenu)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [closeOnWindowBlur, open])

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
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
