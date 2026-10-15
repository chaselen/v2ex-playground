import { ChevronDown, MapPin } from 'lucide-react'
import { Avatar, Button, type ButtonProps } from '@/components/ui'
import { mergeClassNames } from '@/components/ui/utils'
import { getV2exNodeAvatarUrl } from '@extension/features/nodeAvatars'
import type { Node } from '@extension/v2ex/types'
import styles from './NodeSelectButton.module.scss'

/** 节点选择器触发按钮属性，选择流程由调用方提供 */
export interface NodeSelectButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'variant'> {
  node?: Node
}

/** 统一节点选择器的头像、标题、name、箭头和交互样式 */
export default function NodeSelectButton({ node, className, ...props }: NodeSelectButtonProps) {
  return (
    <Button
      {...props}
      className={mergeClassNames(styles.trigger, className)}
      icon={
        node ? (
          <Avatar
            className={styles.avatar}
            src={node.avatar || getV2exNodeAvatarUrl(node.name)}
            alt=""
            shape="square"
            fallback={<MapPin aria-hidden="true" />}
          />
        ) : (
          <MapPin aria-hidden="true" />
        )
      }
    >
      <span className={styles.title}>{node?.title || '选择节点'}</span>
      {node && <span className={styles.name}>{node.name}</span>}
      <ChevronDown className={styles.chevron} aria-hidden="true" />
    </Button>
  )
}
