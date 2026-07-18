import { Collapsible as CollapsiblePrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { mergeClassNames } from './utils'

/** 基于 Radix Collapsible 的折叠容器 */
export function Collapsible(props: ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root {...props} />
}

/** 折叠触发器 */
export function CollapsibleTrigger({
  className,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return (
    <CollapsiblePrimitive.Trigger
      className={mergeClassNames('v2ex-collapsible__trigger', className)}
      {...props}
    />
  )
}

/** 折叠内容 */
export function CollapsibleContent({
  className,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      className={mergeClassNames('v2ex-collapsible__content', className)}
      {...props}
    />
  )
}
