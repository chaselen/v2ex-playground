import { AlertTriangle, CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { Toast as ToastPrimitive } from 'radix-ui'
import { useEffect, useState } from 'react'
import { mergeClassNames } from './utils'

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

type ToastListener = (item: ToastItem) => void

let nextToastId = 0
const toastListeners = new Set<ToastListener>()
const pendingToasts: ToastItem[] = []

/** 发布一条全局 Toast */
function publishToast(variant: ToastVariant, message: string) {
  const item = { id: ++nextToastId, message, variant }
  if (!toastListeners.size) {
    pendingToasts.push(item)
    return
  }
  toastListeners.forEach(listener => listener(item))
}

/** 命令式 Toast 接口，供非组件逻辑使用 */
export const Toast = {
  info: (message: string) => publishToast('info', message),
  success: (message: string) => publishToast('success', message),
  warning: (message: string) => publishToast('warning', message),
  error: (message: string) => publishToast('danger', message)
}

/** 页面级 Toast 宿主；每个 Webview 入口挂载一次 */
export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener: ToastListener = item => {
      setItems(current => [...current, item])
    }
    toastListeners.add(listener)
    if (pendingToasts.length) {
      setItems(current => [...current, ...pendingToasts.splice(0)])
    }
    return () => {
      toastListeners.delete(listener)
    }
  }, [])

  function removeToast(id: number) {
    setItems(current => current.filter(item => item.id !== id))
  }

  return (
    <ToastPrimitive.Provider duration={3000} swipeDirection="right">
      {items.map(item => {
        const Icon = getToastIcon(item.variant)
        return (
          <ToastPrimitive.Root
            className={mergeClassNames('v2ex-toast', `v2ex-toast--${item.variant}`)}
            open
            onOpenChange={open => {
              if (!open) {
                removeToast(item.id)
              }
            }}
            key={item.id}
          >
            <Icon className="v2ex-toast__icon" fill="currentColor" aria-hidden="true" />
            <ToastPrimitive.Title className="v2ex-toast__message">
              {item.message}
            </ToastPrimitive.Title>
            <ToastPrimitive.Close className="v2ex-toast__close" aria-label="关闭通知">
              <X aria-hidden="true" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="v2ex-toast-viewport" />
    </ToastPrimitive.Provider>
  )
}

function getToastIcon(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return CheckCircle2
    case 'warning':
      return AlertTriangle
    case 'danger':
      return CircleAlert
    default:
      return Info
  }
}
