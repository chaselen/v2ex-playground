import { AlertTriangle, CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { useEffect } from 'react'
import { mergeClassNames } from './utils'

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'

interface ToastItem {
  message: string
  variant: ToastVariant
}

type ToastListener = (item: ToastItem) => void

const toastListeners = new Set<ToastListener>()
const pendingToasts: ToastItem[] = []

/** 发布一条全局 Toast */
function publishToast(variant: ToastVariant, message: string) {
  const item = { message, variant }
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
  return (
    <ToastPrimitive.Provider timeout={3000} limit={Infinity}>
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport className="v2ex-toast-viewport">
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  )
}

function ToastList() {
  const { toasts, add } = ToastPrimitive.useToastManager()

  useEffect(() => {
    const listener: ToastListener = item => {
      add({ title: item.message, type: item.variant })
    }
    toastListeners.add(listener)
    pendingToasts.splice(0).forEach(listener)
    return () => {
      toastListeners.delete(listener)
    }
  }, [add])

  return toasts.map(item => {
    const variant = item.type as ToastVariant
    const Icon = getToastIcon(variant)
    return (
      <ToastPrimitive.Root
        className={mergeClassNames('v2ex-toast', `v2ex-toast--${variant}`)}
        toast={item}
        swipeDirection="right"
        key={item.id}
      >
        <ToastPrimitive.Content className="v2ex-toast__content">
          <Icon className="v2ex-toast__icon" fill="currentColor" aria-hidden="true" />
          <ToastPrimitive.Title className="v2ex-toast__message" />
          <ToastPrimitive.Close className="v2ex-toast__close" aria-label="关闭通知">
            <X aria-hidden="true" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Content>
      </ToastPrimitive.Root>
    )
  })
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
