import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'
import { FLOATING_ARROW_HEIGHT, FloatingArrow } from './FloatingArrow'
import { mergeClassNames } from './utils'

export interface TooltipProps {
  /** 触发元素 */
  children: ReactElement
  /** 提示内容 */
  content: ReactNode
  /** 弹出方向 */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** 弹出方向内的对齐方式 */
  align?: 'start' | 'center' | 'end'
  /** 打开延迟 */
  delayDuration?: number
  /** 浮层附加类名 */
  className?: string
}

/** 基于 Base UI Tooltip、使用 VS Code Hover Widget 颜色的提示浮层 */
export function Tooltip({
  align = 'center',
  children,
  className,
  content,
  delayDuration = 300,
  side = 'top'
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delay={delayDuration} timeout={100}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger render={children} />
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner
            className="v2ex-floating-positioner"
            side={side}
            align={align}
            sideOffset={6 + FLOATING_ARROW_HEIGHT}
          >
            <TooltipPrimitive.Popup className={mergeClassNames('v2ex-tooltip', className)}>
              {content}
              <TooltipPrimitive.Arrow render={<FloatingArrow className="v2ex-tooltip__arrow" />} />
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
