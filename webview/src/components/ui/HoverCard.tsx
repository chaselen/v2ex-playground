import { PreviewCard as HoverCardPrimitive } from '@base-ui/react/preview-card'
import type { ReactElement, ReactNode } from 'react'
import { FLOATING_ARROW_HEIGHT, FloatingArrow } from './FloatingArrow'
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

/** 基于 Base UI Hover Card 的悬停资料浮层 */
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
    <HoverCardPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <HoverCardPrimitive.Trigger render={children} delay={openDelay} closeDelay={closeDelay} />
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Positioner
          className="v2ex-floating-positioner"
          side={side}
          align={align}
          sideOffset={6 + (showArrow ? FLOATING_ARROW_HEIGHT : 0)}
          collisionPadding={8}
        >
          <HoverCardPrimitive.Popup className={mergeClassNames('v2ex-popover', className)}>
            {content}
            {showArrow && (
              <HoverCardPrimitive.Arrow
                render={<FloatingArrow className="v2ex-popover__arrow" />}
              />
            )}
          </HoverCardPrimitive.Popup>
        </HoverCardPrimitive.Positioner>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  )
}
