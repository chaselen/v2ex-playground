import type { HTMLAttributes } from 'react'
import { mergeClassNames } from '@/components/ui/utils'
import styles from './UserBadge.module.scss'

export interface UserBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** 具有管理社区的权限 */
  mod?: boolean
  /** 楼主 */
  op?: boolean
  /** PRO 会员 */
  pro?: boolean
}

/**
 * 用户身份胶囊标签组
 * 按 MOD → OP → PRO 顺序拼接显示，样式对齐 V2EX 站内胶囊
 */
export default function UserBadge({ mod, op, pro, className, ...props }: UserBadgeProps) {
  if (!mod && !op && !pro) {
    return null
  }

  const labels = [mod ? 'MOD' : null, op ? 'OP' : null, pro ? 'PRO' : null].filter(
    (label): label is string => Boolean(label)
  )

  return (
    <span
      {...props}
      className={mergeClassNames(styles.badges, className)}
      aria-label={labels.join('、')}
    >
      {mod && (
        <span className={mergeClassNames(styles.badge, styles.mod)} aria-hidden="true">
          MOD
        </span>
      )}
      {op && (
        <span className={mergeClassNames(styles.badge, styles.op)} aria-hidden="true">
          OP
        </span>
      )}
      {pro && (
        <span className={mergeClassNames(styles.badge, styles.pro)} aria-hidden="true">
          PRO
        </span>
      )}
    </span>
  )
}
