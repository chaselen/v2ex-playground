import { AlertCircle, CircleAlert, Info } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { mergeClassNames } from './utils'

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 提示语义 */
  variant?: 'info' | 'warning' | 'danger'
  /** 提示标题 */
  title: ReactNode
  /** 提示详情 */
  description?: ReactNode
}

const icons = {
  info: Info,
  warning: CircleAlert,
  danger: AlertCircle
}

/** 使用 VS Code 输入校验主题色的提示条 */
export function Alert({ className, description, title, variant = 'info', ...props }: AlertProps) {
  const Icon = icons[variant]

  return (
    <div
      {...props}
      className={mergeClassNames('v2ex-alert', `v2ex-alert--${variant}`, className)}
      role={variant === 'danger' ? 'alert' : 'status'}
    >
      <Icon className="v2ex-alert__icon" aria-hidden="true" />
      <div className="v2ex-alert__content">
        <strong className="v2ex-alert__title">{title}</strong>
        {description && <div className="v2ex-alert__description">{description}</div>}
      </div>
    </div>
  )
}
