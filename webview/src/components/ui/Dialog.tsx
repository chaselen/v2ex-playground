import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { ScrollArea } from './ScrollArea'
import { mergeClassNames } from './utils'

export interface DialogProps {
  /** 是否打开 */
  open: boolean
  /** 标题 */
  title: ReactNode
  /** 无可见说明时使用的无障碍描述 */
  description?: ReactNode
  /** 主体内容 */
  children: ReactNode
  /** 底部操作区 */
  footer?: ReactNode
  /** 是否允许点击遮罩关闭 */
  closeOnOverlayClick?: boolean
  /** 对话框附加类名 */
  className?: string
  /** 关闭后焦点位置，默认由 Base UI 恢复 */
  finalFocus?: DialogPrimitive.Popup.Props['finalFocus']
  /** 打开后焦点位置，默认由 Base UI 选择 */
  initialFocus?: DialogPrimitive.Popup.Props['initialFocus']
  /** 打开状态变化，可通过事件详情取消关闭 */
  onOpenChange: NonNullable<DialogPrimitive.Root.Props['onOpenChange']>
}

/** 基于 Base UI Dialog、使用 VS Code Widget 颜色的模态框 */
export function Dialog({
  children,
  className,
  closeOnOverlayClick = true,
  description,
  footer,
  finalFocus,
  initialFocus,
  onOpenChange,
  open,
  title
}: DialogProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (!closeOnOverlayClick && details.reason === 'outside-press') {
          details.cancel()
          return
        }
        onOpenChange(nextOpen, details)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="v2ex-dialog__overlay" />
        <DialogPrimitive.Popup
          className={mergeClassNames('v2ex-dialog', className)}
          finalFocus={finalFocus}
          initialFocus={initialFocus}
        >
          <header className="v2ex-dialog__header">
            <DialogPrimitive.Title className="v2ex-dialog__title">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              render={
                <Button
                  className="v2ex-dialog__close"
                  variant="ghost"
                  size="small"
                  icon={<X aria-hidden="true" />}
                  aria-label="关闭"
                />
              }
            />
          </header>
          {description ? (
            <DialogPrimitive.Description className="v2ex-dialog__description">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="v2ex-visually-hidden">
              对话框内容
            </DialogPrimitive.Description>
          )}
          <ScrollArea className="v2ex-dialog__body" contentClassName="v2ex-dialog__body-content">
            {children}
          </ScrollArea>
          {footer && <footer className="v2ex-dialog__footer">{footer}</footer>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
