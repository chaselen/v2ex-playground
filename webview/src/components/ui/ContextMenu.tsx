import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu'
import { Fragment, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { mergeClassNames } from './utils'

export interface ContextMenuItem {
  /** 菜单项唯一标识 */
  key: string
  /** 菜单项内容 */
  label: ReactNode
  /** 装饰性前置图标 */
  icon?: ReactNode
  /** 是否禁用 */
  disabled?: boolean
  /** 是否在当前项前显示分隔线 */
  separatorBefore?: boolean
  /** 点击回调 */
  onSelect?: () => void
}

export interface ContextMenuProps {
  /** 触发右键菜单的元素 */
  children: ReactElement
  /** 菜单项 */
  items: ContextMenuItem[]
  /** 菜单尺寸 */
  size?: 'compact' | 'comfortable'
  /** 是否禁用右键菜单 */
  disabled?: boolean
  /** 菜单附加类名 */
  className?: string
}

/** 基于 Base UI Context Menu、使用 VS Code Menu 颜色的通用右键菜单 */
export function ContextMenu({
  children,
  className,
  disabled = false,
  items,
  size = 'comfortable'
}: ContextMenuProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  useEffect(() => {
    if (!open) return

    // 宿主编辑器中的点击不会进入 Webview，需在窗口失焦时收起菜单
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
  }, [open])

  return (
    <ContextMenuPrimitive.Root disabled={disabled} open={open && !disabled} onOpenChange={setOpen}>
      <ContextMenuPrimitive.Trigger render={children} />
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Positioner className="v2ex-floating-positioner" collisionPadding={8}>
          <ContextMenuPrimitive.Popup
            className={mergeClassNames(
              'v2ex-menu',
              'v2ex-context-menu',
              `v2ex-context-menu--${size}`,
              className
            )}
          >
            {items.map(item => (
              <Fragment key={item.key}>
                {item.separatorBefore && (
                  <ContextMenuPrimitive.Separator className="v2ex-menu__separator" />
                )}
                <ContextMenuPrimitive.Item
                  className="v2ex-menu__item"
                  disabled={item.disabled}
                  onClick={item.onSelect}
                >
                  {item.icon && (
                    <span className="v2ex-context-menu__icon" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </ContextMenuPrimitive.Item>
              </Fragment>
            ))}
          </ContextMenuPrimitive.Popup>
        </ContextMenuPrimitive.Positioner>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  )
}
