import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'
import type { ComponentPropsWithoutRef, Ref } from 'react'
import { mergeClassNames } from './utils'

export interface ScrollAreaProps extends ComponentPropsWithoutRef<'div'> {
  /** 内容不足时至少填满滚动视口，默认 false；需由外部布局约束视口高度 */
  fillViewport?: boolean
  /** 原生滚动容器，可用于 scrollTo、滚动位置读取与事件监听 */
  viewportRef?: Ref<HTMLDivElement>
  /** 滚动容器的无障碍属性、事件和局部样式 */
  viewportProps?: ComponentPropsWithoutRef<'div'>
  /** 内容布局类名；尺寸变化由 Base UI 自动监听 */
  contentClassName?: string
}

/** 使用原生滚动和 VS Code 主题滚动条，溢出时持续显示 */
export function ScrollArea({
  children,
  className,
  contentClassName,
  fillViewport = false,
  viewportProps,
  viewportRef,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root className={mergeClassNames('v2ex-scroll-area', className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        {...viewportProps}
        className={mergeClassNames('v2ex-scroll-area__viewport', viewportProps?.className)}
        ref={viewportRef}
      >
        <ScrollAreaPrimitive.Content
          className={mergeClassNames(
            'v2ex-scroll-area__content',
            fillViewport && 'v2ex-scroll-area__content--fill-viewport',
            contentClassName
          )}
          style={{ minWidth: '100%' }}
        >
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar className="v2ex-scroll-area__scrollbar" orientation="vertical">
        <ScrollAreaPrimitive.Thumb className="v2ex-scroll-area__thumb" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Scrollbar
        className="v2ex-scroll-area__scrollbar"
        orientation="horizontal"
      >
        <ScrollAreaPrimitive.Thumb className="v2ex-scroll-area__thumb" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner className="v2ex-scroll-area__corner" />
    </ScrollAreaPrimitive.Root>
  )
}
