import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import { Fragment, type ReactElement, type ReactNode } from 'react'
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

/** 基于 Radix Context Menu、使用 VS Code Menu 颜色的通用右键菜单 */
export function ContextMenu({
  children,
  className,
  disabled = false,
  items,
  size = 'comfortable'
}: ContextMenuProps) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild disabled={disabled}>
        {children}
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
          className={mergeClassNames(
            'v2ex-menu',
            'v2ex-context-menu',
            `v2ex-context-menu--${size}`,
            className
          )}
          collisionPadding={8}
        >
          {items.map(item => (
            <Fragment key={item.key}>
              {item.separatorBefore && (
                <ContextMenuPrimitive.Separator className="v2ex-menu__separator" />
              )}
              <ContextMenuPrimitive.Item
                className="v2ex-menu__item"
                disabled={item.disabled}
                onSelect={item.onSelect}
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
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  )
}
