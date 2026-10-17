import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { TriangleAlert } from 'lucide-react'
import { cloneElement, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Button, type ButtonProps } from './Button'
import { FLOATING_ARROW_HEIGHT, FloatingArrow } from './FloatingArrow'
import { PopoverTrigger, type PopoverTooltipProps } from './PopoverTrigger'
import { getTriggerFocusTarget, mergeClassNames } from './utils'

export interface ConfirmPopoverProps extends PopoverTooltipProps {
  /** 触发元素 */
  children: ReactElement
  /** 确认标题 */
  title: ReactNode
  /** 补充说明 */
  description?: ReactNode
  /** 确认按钮文字 */
  confirmText?: string
  /** 取消按钮文字 */
  cancelText?: string
  /** 标题图标 */
  titleIcon?: ReactNode
  /** 确认按钮是否为危险操作 */
  danger?: boolean
  /** 确认后立即关闭浮层；共享 Button 在请求期间保留焦点，但不可重复激活 */
  closeImmediately?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 弹出方向 */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** 弹出方向内的对齐方式 */
  align?: 'start' | 'center' | 'end'
  /** 浮层附加类名 */
  className?: string
  /** 确认回调 */
  onConfirm: () => void | Promise<void>
  /** 取消回调 */
  onCancel?: () => void
}

/** 基于 Base UI Popover 的就地确认框 */
export function ConfirmPopover({
  align = 'center',
  cancelText = '取消',
  children,
  className,
  closeImmediately = false,
  confirmText = '确认',
  danger = false,
  description,
  disabled = false,
  onCancel,
  onConfirm,
  side = 'top',
  title,
  titleIcon,
  tooltip,
  tooltipProps
}: ConfirmPopoverProps) {
  const triggerRef = useRef<HTMLElement>(null)
  const restoreTriggerFocus = useRef(true)
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const resolvedTitleIcon =
    titleIcon === undefined ? (
      <TriangleAlert className="v2ex-confirm-popover__default-icon" aria-hidden="true" />
    ) : (
      titleIcon
    )

  async function confirm() {
    setConfirming(true)
    if (closeImmediately) {
      setOpen(false)
    }
    try {
      await onConfirm()
      if (!closeImmediately) {
        setOpen(false)
      }
    } finally {
      setConfirming(false)
    }
  }

  function changeOpen(nextOpen: boolean, details: PopoverPrimitive.Root.ChangeEventDetails) {
    // 请求继续执行，但允许离开浮层；完成时不抢回用户已经移走的焦点
    if (!confirming || !nextOpen) {
      restoreTriggerFocus.current =
        nextOpen || (details.reason !== 'focus-out' && details.reason !== 'outside-press')
      setOpen(nextOpen)
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        popupOpen={open}
        tooltip={tooltip}
        tooltipProps={tooltipProps}
        triggerRef={(element: HTMLElement | null) => {
          triggerRef.current = element
        }}
        disabled={disabled || (confirming && !closeImmediately)}
        aria-disabled={confirming && closeImmediately ? true : undefined}
        aria-busy={confirming || undefined}
      >
        {confirming && children.type === Button
          ? cloneElement(children as ReactElement<ButtonProps>, { focusableWhenDisabled: true })
          : children}
      </PopoverTrigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          className="v2ex-floating-positioner"
          side={side}
          align={align}
          sideOffset={6 + FLOATING_ARROW_HEIGHT}
          collisionPadding={8}
        >
          <PopoverPrimitive.Popup
            className={mergeClassNames('v2ex-popover v2ex-confirm-popover', className)}
            finalFocus={() =>
              restoreTriggerFocus.current ? getTriggerFocusTarget(triggerRef.current) : false
            }
            role="alertdialog"
            aria-busy={confirming}
          >
            <div className="v2ex-confirm-popover__body">
              {resolvedTitleIcon && (
                <span
                  className={mergeClassNames(
                    'v2ex-confirm-popover__icon',
                    danger && 'v2ex-confirm-popover__icon--danger'
                  )}
                >
                  {resolvedTitleIcon}
                </span>
              )}
              <PopoverPrimitive.Title className="v2ex-confirm-popover__title" render={<strong />}>
                {title}
              </PopoverPrimitive.Title>
              {description && (
                <PopoverPrimitive.Description
                  className="v2ex-confirm-popover__description"
                  render={<div />}
                >
                  {description}
                </PopoverPrimitive.Description>
              )}
            </div>
            <div className="v2ex-confirm-popover__actions">
              <Button
                size="small"
                disabled={confirming}
                onClick={() => {
                  setOpen(false)
                  onCancel?.()
                }}
              >
                {cancelText}
              </Button>
              <Button
                size="small"
                variant={danger ? 'danger' : 'primary'}
                loading={confirming}
                focusableWhenDisabled
                onClick={() => void confirm()}
              >
                {confirmText}
              </Button>
            </div>
            <PopoverPrimitive.Arrow render={<FloatingArrow className="v2ex-popover__arrow" />} />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
