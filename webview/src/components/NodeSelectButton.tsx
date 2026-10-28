import { forwardRef, useRef, useState } from 'react'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { ChevronDown, MapPin } from 'lucide-react'
import { Avatar, Button, type ButtonProps } from '@/components/ui'
import { mergeClassNames } from '@/components/ui/utils'
import { getV2exNodeAvatarUrl } from '@extension/features/nodeAvatars'
import type { Node } from '@extension/v2ex/types'
import { ClearButton } from '@/components/ui/ClearButton'
import styles from './NodeSelectButton.module.scss'

/** 节点选择器属性，节点来源与选中状态由调用方提供 */
export interface NodeSelectButtonProps extends Omit<
  ButtonProps,
  'children' | 'icon' | 'variant' | 'onChange'
> {
  node?: Node
  /** 按需获取当前页面允许选择的节点 */
  loadNodes: () => Promise<Node[]>
  /** 选择节点后更新页面状态 */
  onValueChange?: (node: Node) => void
  /** 有已选节点时允许清空 */
  clearable?: boolean
  /** 清空节点，由调用方更新选择状态 */
  onClear?: () => void
}

/** 统一节点选择器的头像、标题、name、箭头和交互样式 */
const NodeSelectButton = forwardRef<HTMLButtonElement, NodeSelectButtonProps>(
  function NodeSelectButton(
    {
      node,
      className,
      clearable = false,
      onClear,
      loadNodes,
      onValueChange,
      ...props
    }: NodeSelectButtonProps,
    ref
  ) {
    const [nodes, setNodes] = useState<Node[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const loadingRef = useRef(false)

    async function loadOptions() {
      if (loadingRef.current) return
      loadingRef.current = true
      setLoading(true)
      setError('')
      try {
        const result = await loadNodes()
        setNodes(
          [...result].sort(
            (left, right) =>
              (right.topicCount ?? -1) - (left.topicCount ?? -1) ||
              left.title.localeCompare(right.title, 'zh-CN')
          )
        )
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '加载节点失败，请关闭后重试')
        setNodes([])
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    }

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
        <SearchableSelect
          value={node?.name}
          disabled={props.disabled || props.loading}
          loading={loading}
          error={error}
          options={nodes.map(node => ({
            value: node.name,
            searchText: `${node.title} ${node.name}`,
            label: (
              <>
                <span>{node.title}</span>
                <span className={styles.optionName}>{node.name}</span>
              </>
            )
          }))}
          onOpenChange={open => {
            if (open) void loadOptions()
          }}
          onValueChange={name => {
            const selected = nodes.find(node => node.name === name)
            if (selected) onValueChange?.(selected)
          }}
          trigger={
            <Button
              {...props}
              ref={ref}
              className={mergeClassNames(styles.trigger, !node && styles.placeholder)}
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
          }
        />
        {canClear && <ClearButton label="清空节点" onClear={() => onClear?.()} />}
      </span>
    )
  }
)

export default NodeSelectButton
