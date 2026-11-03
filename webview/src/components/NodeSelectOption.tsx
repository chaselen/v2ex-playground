import type { ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import { Avatar } from '@/components/ui'
import type { Node } from '@extension/v2ex/types'
import styles from './NodeSelectOption.module.scss'

/** 节点选项展示数据与可选的辅助信息 */
export interface NodeSelectOptionProps {
  node: Pick<Node, 'name' | 'title' | 'avatar'>
  /** 由调用方提供统计或状态，不参与选择逻辑 */
  meta?: ReactNode
}

/** 统一节点下拉选项的头像、标题、名称与辅助信息布局 */
export default function NodeSelectOption({ node, meta }: NodeSelectOptionProps) {
  return (
    <span className={styles.option}>
      <Avatar
        src={node.avatar}
        alt=""
        size="small"
        shape="square"
        fallback={<MapPin aria-hidden="true" />}
      />
      <span className={styles.text}>
        <span className={styles.title}>{node.title}</span>
        <span className={styles.name}>{node.name}</span>
      </span>
      {meta != null && <span className={styles.meta}>{meta}</span>}
    </span>
  )
}
