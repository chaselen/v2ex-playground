import { Popover as PopoverPrimitive } from 'radix-ui'
import type { ReactElement, ReactNode } from 'react'
import { mergeClassNames } from './utils'

export interface PopoverProps {
  /** 触发元素 */
  children: ReactElement
  /** 浮层内容 */
  content: ReactNode
  /** 受控打开状态 */
  open?: boolean
  /** 默认打开状态 */
  defaultOpen?: boolean
  /** 弹出方向 */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** 弹出方向内的对齐方式 */
  align?: 'start' | 'center' | 'end'
  /** 是否展示箭头 */
  showArrow?: boolean
  /** 浮层附加类名 */
  className?: string
  /** 打开状态变化 */
  onOpenChange?: (open: boolean) => void
}

/** 基于 Radix Popover、使用 VS Code Widget 颜色的点击浮层 */
export function Popover({
  align = 'center',
  children,
  className,
  content,
  defaultOpen,
  onOpenChange,
  open,
  showArrow = false,
  side = 'bottom'
}: PopoverProps) {
  return (
    <PopoverPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={mergeClassNames('v2ex-popover', className)}
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
        >
          {content}
          {showArrow && <PopoverPrimitive.Arrow className="v2ex-popover__arrow" />}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
