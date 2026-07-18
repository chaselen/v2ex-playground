import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ReactElement, ReactNode } from 'react'
import { FloatingArrow } from './FloatingArrow'
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

/** 基于 Radix Tooltip、使用 VS Code Hover Widget 颜色的提示浮层 */
export function Tooltip({
  align = 'center',
  children,
  className,
  content,
  delayDuration = 300,
  side = 'top'
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={100}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className={mergeClassNames('v2ex-tooltip', className)}
            side={side}
            align={align}
            sideOffset={6}
          >
            {content}
            <TooltipPrimitive.Arrow asChild>
              <FloatingArrow className="v2ex-tooltip__arrow" />
            </TooltipPrimitive.Arrow>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
