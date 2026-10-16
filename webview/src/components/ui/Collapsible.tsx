import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import type { ComponentProps } from 'react'
import { withBaseClassName } from './utils'

/** 基于 Base UI Collapsible 的折叠容器 */
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
      className={withBaseClassName('v2ex-collapsible__trigger', className)}
      {...props}
    />
  )
}

/** 折叠内容 */
export function CollapsibleContent({
  className,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Panel>) {
  return (
    <CollapsiblePrimitive.Panel
      className={withBaseClassName('v2ex-collapsible__content', className)}
      {...props}
    />
  )
}
