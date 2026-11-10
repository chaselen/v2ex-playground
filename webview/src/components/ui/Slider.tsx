import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { mergeClassNames } from './utils'

/** 单值滑块属性 */
export interface SliderProps extends Omit<
  SliderPrimitive.Root.Props<number>,
  'className' | 'children'
> {
  className?: string
  /** 滑块的可访问名称与可见标签 */
  label: string
}

/** 基于 Base UI、支持键盘操作的主题化单值滑块 */
export function Slider({ className, label, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root {...props} className={mergeClassNames('v2ex-slider', className)}>
      <div className="v2ex-slider__header">
        <SliderPrimitive.Label>{label}</SliderPrimitive.Label>
        <SliderPrimitive.Value />
      </div>
      <SliderPrimitive.Control className="v2ex-slider__control">
        <SliderPrimitive.Track className="v2ex-slider__track">
          <SliderPrimitive.Indicator className="v2ex-slider__indicator" />
          <SliderPrimitive.Thumb className="v2ex-slider__thumb" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}
