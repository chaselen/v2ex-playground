import { Progress as ProgressPrimitive } from 'radix-ui'
import type { ComponentPropsWithoutRef } from 'react'
import { mergeClassNames } from './utils'

export interface ProgressProps extends Omit<
  ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
  'value'
> {
  /** 0 至 100 的进度 */
  value: number
  /** 是否显示进度文本 */
  showLabel?: boolean
}

/** 基于 Radix Progress、适配 VS Code 主题的进度条 */
export function Progress({ className, showLabel = true, value, ...props }: ProgressProps) {
  const normalizedValue = Math.max(0, Math.min(100, value))

  return (
    <div className={mergeClassNames('v2ex-progress', className)}>
      <ProgressPrimitive.Root
        {...props}
        className="v2ex-progress__track"
        value={normalizedValue}
        max={100}
      >
        <ProgressPrimitive.Indicator
          className="v2ex-progress__indicator"
          style={{ transform: `translateX(-${100 - normalizedValue}%)` }}
        />
      </ProgressPrimitive.Root>
      {showLabel && <span className="v2ex-progress__label">{normalizedValue}%</span>}
    </div>
  )
}
