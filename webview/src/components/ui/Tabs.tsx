import { Tabs as TabsPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { mergeClassNames } from './utils'

export interface TabsProps extends Omit<
  ComponentProps<typeof TabsPrimitive.Root>,
  'onValueChange'
> {
  /** 标签切换回调 */
  onValueChange?: (value: string) => void
}

/** 基于 Radix Tabs 的受控标签容器 */
export function Tabs({ className, orientation = 'horizontal', ...props }: TabsProps) {
  return (
    <TabsPrimitive.Root
      className={mergeClassNames('v2ex-tabs', className)}
      orientation={orientation}
      {...props}
    />
  )
}

export interface TabsListProps extends ComponentProps<typeof TabsPrimitive.List> {
  /** 标签栏右侧附加内容 */
  extra?: ReactNode
}

/** 标签列表及可选工具区 */
export function TabsList({ children, className, extra, ...props }: TabsListProps) {
  return (
    <div className={mergeClassNames('v2ex-tabs__bar', className)}>
      <TabsPrimitive.List className="v2ex-tabs__list" {...props}>
        {children}
      </TabsPrimitive.List>
      {extra && <div className="v2ex-tabs__extra">{extra}</div>}
    </div>
  )
}

/** 单个标签按钮 */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={mergeClassNames('v2ex-tabs__trigger', className)}
      {...props}
    />
  )
}

/** 标签内容 */
export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={mergeClassNames('v2ex-tabs__content', className)}
      {...props}
    />
  )
}
