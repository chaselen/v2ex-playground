import { ChevronDown, MapPin } from 'lucide-react'
import { Avatar, Button, type ButtonProps } from '@/components/ui'
import { mergeClassNames } from '@/components/ui/utils'
import { getV2exNodeAvatarUrl } from '@extension/features/nodeAvatars'
import type { Node } from '@extension/v2ex/types'
import { ClearButton } from '@/components/ui/ClearButton'
import styles from './NodeSelectButton.module.scss'

/** 节点选择器触发按钮属性，选择流程由调用方提供 */
export interface NodeSelectButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'variant'> {
  node?: Node
  /** 有已选节点时允许清空 */
  clearable?: boolean
  /** 清空节点，由调用方更新选择状态 */
  onClear?: () => void
}

/** 统一节点选择器的头像、标题、name、箭头和交互样式 */
export default function NodeSelectButton({
  node,
  className,
  clearable = false,
  onClear,
  ...props
}: NodeSelectButtonProps) {
  const canClear = clearable && !!node && !!onClear && !props.disabled && !props.loading

  return (
    <span
      className={mergeClassNames(
        styles.wrapper,
        canClear && 'v2ex-clearable-select--active',
        'v2ex-clearable-select',
        className
      )}
    >
      <Button
        {...props}
        className={styles.trigger}
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
        <ChevronDown
          className={mergeClassNames(styles.chevron, 'v2ex-select__icon')}
          aria-hidden="true"
        />
      </Button>
      {canClear && <ClearButton label="清空节点" onClear={() => onClear?.()} />}
    </span>
  )
}
