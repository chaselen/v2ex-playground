import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { TriangleAlert } from 'lucide-react'
import { useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Button } from './Button'
import { FLOATING_ARROW_HEIGHT, FloatingArrow } from './FloatingArrow'
import { getTriggerFocusTarget, mergeClassNames } from './utils'

export interface ConfirmPopoverProps {
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
  /** 确认后是否立即关闭浮层，不等待确认回调完成 */
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
  titleIcon
}: ConfirmPopoverProps) {
  const triggerRef = useRef<HTMLElement>(null)
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

  function changeOpen(nextOpen: boolean) {
    if (!confirming) {
      setOpen(nextOpen)
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={changeOpen}>
      <PopoverPrimitive.Trigger
        ref={(element: HTMLElement | null) => {
          triggerRef.current = element
        }}
        render={children}
        nativeButton={typeof children.type !== 'string' || children.type === 'button'}
        disabled={disabled || confirming}
      />
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
            finalFocus={() => getTriggerFocusTarget(triggerRef.current)}
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
