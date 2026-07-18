import { Popover as PopoverPrimitive } from 'radix-ui'
import { useState, type ReactElement, type ReactNode } from 'react'
import { Button } from './Button'
import { mergeClassNames } from './utils'

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
  /** 确认按钮是否为危险操作 */
  danger?: boolean
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

/** 基于 Radix Popover 的就地确认框 */
export function ConfirmPopover({
  align = 'center',
  cancelText = '取消',
  children,
  className,
  confirmText = '确认',
  danger = false,
  description,
  disabled = false,
  onCancel,
  onConfirm,
  side = 'top',
  title
}: ConfirmPopoverProps) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function confirm() {
    setConfirming(true)
    try {
      await onConfirm()
      setOpen(false)
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
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        {children}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={mergeClassNames('v2ex-popover v2ex-confirm-popover', className)}
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          role="alertdialog"
          aria-busy={confirming}
        >
          <strong className="v2ex-confirm-popover__title">{title}</strong>
          {description && <div className="v2ex-confirm-popover__description">{description}</div>}
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
          <PopoverPrimitive.Arrow className="v2ex-popover__arrow" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
