import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { useRender } from '@base-ui/react/use-render'
import {
  cloneElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback
} from 'react'
import { Tooltip, type TooltipProps } from './Tooltip'

export interface PopoverTooltipProps {
  /** 触发按钮的补充提示，不替代按钮的无障碍名称 */
  tooltip?: ReactNode
  /** 提示的位置、延迟与样式 */
  tooltipProps?: Omit<TooltipProps, 'children' | 'content' | 'disabled'>
}

interface PopoverTriggerProps
  extends Omit<PopoverPrimitive.Trigger.Props, 'render' | 'children'>, PopoverTooltipProps {
  children: ReactElement
  triggerRef: RefCallback<HTMLElement>
  popupOpen: boolean
}

/** 两种触发器通过 render 共用真实按钮，保留 Popover 的焦点守卫和 Tooltip 的描述关联 */
export function PopoverTrigger({
  children,
  triggerRef,
  popupOpen,
  tooltip,
  tooltipProps,
  ...props
}: PopoverTriggerProps) {
  const hasTooltip = tooltip !== undefined && tooltip !== null && tooltip !== false
  // 缺省提示也保留同一组件树，动态增删内容时不重建按钮和焦点守卫
  return (
    <Tooltip {...tooltipProps} content={tooltip} disabled={popupOpen || !hasTooltip}>
      <PopoverPrimitive.Trigger
        {...props}
        ref={triggerRef}
        render={<TooltipTriggerButton render={children} />}
        nativeButton={typeof children.type !== 'string' || children.type === 'button'}
      />
    </Tooltip>
  )
}

/** 保留按钮已有描述，同时接收外层 Tooltip 注入的描述与两套触发器的 ref */
function TooltipTriggerButton({
  render,
  ref,
  ...props
}: HTMLAttributes<HTMLElement> & { render: ReactElement; ref?: Ref<HTMLElement> }) {
  const button = render as ReactElement<{ 'aria-describedby'?: string }>
  const describedBy =
    [
      ...new Set(
        [props['aria-describedby'], button.props['aria-describedby']]
          .flatMap(value => value?.split(/\s+/) ?? [])
          .filter(Boolean)
      )
    ].join(' ') || undefined
  return useRender({
    defaultTagName: 'button',
    ref,
    props,
    render: cloneElement(button, { 'aria-describedby': describedBy })
  })
}
