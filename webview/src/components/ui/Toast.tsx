import { AlertTriangle, CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { useEffect } from 'react'
import { Progress } from './Progress'
import { mergeClassNames } from './utils'

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger' | 'loading'

interface ToastItem {
  message: string
  variant: ToastVariant
  id?: string
  progress?: number
  update?: boolean
}

type ToastListener = (item: ToastItem) => void

const toastListeners = new Set<ToastListener>()
const pendingToasts: ToastItem[] = []
let nextProgressId = 0

/** 发布一条全局 Toast */
function publishToast(item: ToastItem) {
  if (!toastListeners.size) {
    pendingToasts.push(item)
    return
  }
  toastListeners.forEach(listener => listener(item))
}

/** 命令式 Toast 接口，供非组件逻辑使用 */
export const Toast = {
  info: (message: string) => publishToast({ variant: 'info', message }),
  success: (message: string) => publishToast({ variant: 'success', message }),
  warning: (message: string) => publishToast({ variant: 'warning', message }),
  error: (message: string) => publishToast({ variant: 'danger', message }),
  /** 显示持续到操作结束的提示，结果沿用同一条通知 */
  progress(message: string, value: number) {
    const id = `progress-${++nextProgressId}`
    const loading = { id, variant: 'loading', message } as const
    publishToast({ ...loading, progress: value })
    return {
      update: (progress: number) => publishToast({ ...loading, progress, update: true }),
      success: (result: string) =>
        publishToast({ id, variant: 'success', message: result, progress: 100, update: true }),
      error: (result: string) =>
        publishToast({ id, variant: 'danger', message: result, update: true })
    }
  }
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
  const { toasts, add, update } = ToastPrimitive.useToastManager()

  useEffect(() => {
    const listener: ToastListener = item => {
      const options = {
        title: item.message,
        type: item.variant,
        data: { progress: item.progress }
      }
      if (item.update && item.id) update(item.id, options)
      else add({ ...options, id: item.id })
    }
    toastListeners.add(listener)
    pendingToasts.splice(0).forEach(listener)
    return () => {
      toastListeners.delete(listener)
    }
  }, [add, update])

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
          <Icon className="v2ex-toast__icon" aria-hidden="true" />
          <ToastPrimitive.Title className="v2ex-toast__message" />
          <ToastPrimitive.Close className="v2ex-toast__close" aria-label="关闭通知">
            <X aria-hidden="true" />
          </ToastPrimitive.Close>
          {typeof item.data?.progress === 'number' && (
            <Progress
              className="v2ex-toast__progress"
              value={item.data.progress}
              showLabel={false}
              aria-label={typeof item.title === 'string' ? item.title : undefined}
            />
          )}
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
