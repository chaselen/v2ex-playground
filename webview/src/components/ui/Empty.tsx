import { Inbox } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { mergeClassNames } from './utils'

export interface EmptyProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 空状态标题 */
  title: ReactNode
  /** 空状态详情 */
  description?: ReactNode
  /** 自定义空状态图标 */
  icon?: ReactNode
}

/** 轻量、主题无关的空状态 */
export function Empty({ children, className, description, icon, title, ...props }: EmptyProps) {
  return (
    <div {...props} className={mergeClassNames('v2ex-empty', className)}>
      <div className="v2ex-empty__icon" aria-hidden="true">
        {icon ?? <Inbox />}
      </div>
      <div className="v2ex-empty__title">{title}</div>
      {description && <div className="v2ex-empty__description">{description}</div>}
      {children && <div className="v2ex-empty__content">{children}</div>}
    </div>
  )
}
