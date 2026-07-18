import { HoverCard as HoverCardPrimitive } from 'radix-ui'
import type { ReactElement, ReactNode } from 'react'
import { FloatingArrow } from './FloatingArrow'
import { mergeClassNames } from './utils'

export interface HoverCardProps {
  /** 触发元素 */
  children: ReactElement
  /** 浮层内容 */
  content: ReactNode
  /** 受控打开状态 */
  open?: boolean
  /** 打开延迟 */
  openDelay?: number
  /** 关闭延迟 */
  closeDelay?: number
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

/** 基于 Radix Hover Card 的悬停资料浮层 */
export function HoverCard({
  align = 'start',
  children,
  className,
  closeDelay = 120,
  content,
  onOpenChange,
  open,
  openDelay = 250,
  showArrow = true,
  side = 'bottom'
}: HoverCardProps) {
  return (
    <HoverCardPrimitive.Root
      open={open}
      openDelay={openDelay}
      closeDelay={closeDelay}
      onOpenChange={onOpenChange}
    >
      <HoverCardPrimitive.Trigger asChild>{children}</HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          className={mergeClassNames('v2ex-popover', className)}
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
        >
          {content}
          {showArrow && (
            <HoverCardPrimitive.Arrow asChild>
              <FloatingArrow className="v2ex-popover__arrow" />
            </HoverCardPrimitive.Arrow>
          )}
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  )
}
