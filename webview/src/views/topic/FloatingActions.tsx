import type { ReactNode } from 'react'
import { mergeClassNames } from '@/components/ui/utils'
import styles from './FloatingActions.module.scss'

/** 悬浮操作条按钮等样式，供详情页组装操作项时复用 */
export const floatingActionStyles = styles

export interface FloatingActionsProps {
  children: ReactNode
  /**
   * 挂到局部容器（如预览弹层）时使用绝对定位；
   * 默认 fixed 贴页面视口
   */
  contained?: boolean
}

/** 话题页右侧悬浮操作容器 */
export function FloatingActions({ children, contained = false }: FloatingActionsProps) {
  return (
    <div
      className={mergeClassNames(styles.root, contained && styles.contained)}
      aria-label="话题快捷操作"
    >
      {children}
    </div>
  )
}
