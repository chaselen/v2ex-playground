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
  /** 浮层的无障碍名称 */
  'aria-label'?: string
  /** 关闭后焦点位置，默认为触发按钮 */
  finalFocus?: PopoverPrimitive.Popup.Props['finalFocus']
  /** 打开状态变化，可通过事件详情取消关闭 */
  onOpenChange?: PopoverPrimitive.Root.Props['onOpenChange']
}

/** 基于 Base UI Popover、使用 VS Code Widget 颜色的点击浮层 */
export function Popover({
  align = 'center',
  'aria-label': ariaLabel,
  children,
  className,
  content,
  defaultOpen,
  finalFocus,
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
            finalFocus={finalFocus ?? (() => getTriggerFocusTarget(triggerRef.current))}
            aria-label={ariaLabel}
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
