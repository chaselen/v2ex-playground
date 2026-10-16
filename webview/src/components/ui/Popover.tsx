import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { useRef, type ReactElement, type ReactNode } from 'react'
import { FLOATING_ARROW_HEIGHT, FloatingArrow } from './FloatingArrow'
import { getTriggerFocusTarget, mergeClassNames } from './utils'

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

/** 基于 Base UI Popover、使用 VS Code Widget 颜色的点击浮层 */
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
  const triggerRef = useRef<HTMLElement>(null)
  return (
    <PopoverPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger
        ref={(element: HTMLElement | null) => {
          triggerRef.current = element
        }}
        render={children}
        nativeButton={typeof children.type !== 'string' || children.type === 'button'}
      />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          className="v2ex-floating-positioner"
          side={side}
          align={align}
          sideOffset={6 + (showArrow ? FLOATING_ARROW_HEIGHT : 0)}
          collisionPadding={8}
        >
          <PopoverPrimitive.Popup
            className={mergeClassNames('v2ex-popover', className)}
            finalFocus={() => getTriggerFocusTarget(triggerRef.current)}
          >
            {content}
            {showArrow && (
              <PopoverPrimitive.Arrow render={<FloatingArrow className="v2ex-popover__arrow" />} />
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
