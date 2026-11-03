import { useRef, useState } from 'react'
import { Bookmark, Check, MapPin, Plus } from 'lucide-react'
import { Avatar, Button } from '@/components/ui'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { createVsCodeClient } from '@/core/vscode'
import type { MainViewRpcCommands, WebviewNode } from '@extension/shared/mainView'
import type { Node } from '@extension/v2ex/types'
import styles from './AddNodeButton.module.scss'

const vscode = createVsCodeClient<MainViewRpcCommands>()

/** 侧栏节点选择器，已添加节点仍可搜索但不可重复选择 */
export default function AddNodeButton({
  nodes,
  collection,
  loading,
  className,
  onAddNode
}: {
  nodes: WebviewNode[]
  collection: boolean
  loading: boolean
  className?: string
  onAddNode?: (nodeName: string) => Promise<void>
}) {
  const [options, setOptions] = useState<Node[]>([])
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const [adding, setAdding] = useState(false)
  const addedNames = new Set(nodes.map(node => node.name))

  async function loadNodes() {
    if (busy.current) return
    busy.current = true
    setFetching(true)
    setError('')
    setOptions([])
    try {
      setOptions(await vscode.getAvailableNodes())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '加载节点失败，请关闭后重试')
    } finally {
      busy.current = false
      setFetching(false)
    }
  }

  return (
    <SearchableSelect
      virtualItemHeight={48}
      loading={fetching}
      error={error}
      disabled={loading || adding}
      onOpenChange={open => {
        if (open) void loadNodes()
      }}
      onValueChange={name => {
        if (addedNames.has(name) || adding) return
        setAdding(true)
        void Promise.resolve(onAddNode?.(name)).finally(() => setAdding(false))
      }}
      options={options.map(node => {
        const added = addedNames.has(node.name)
        return {
          value: node.name,
          searchText: `${node.title} ${node.name}`,
          disabled: added,
          label: (
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
              <span className={styles.meta}>
                {added ? (
                  <>
                    <Check aria-hidden="true" />
                    {collection ? '已收藏' : '已添加'}
                  </>
                ) : typeof node.collectCount === 'number' ? (
                  <>
                    <Bookmark aria-hidden="true" />
                    {node.collectCount.toLocaleString('zh-CN')}
                  </>
                ) : null}
              </span>
            </span>
          )
        }
      })}
      trigger={
        <Button
          className={className}
          variant="primary"
          size="small"
          icon={<Plus aria-hidden="true" />}
          loading={loading || adding}
          aria-label={collection ? '添加收藏节点' : '添加自定义节点'}
        >
          添加节点
        </Button>
      }
    />
  )
}
