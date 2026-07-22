import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { ChevronRight, Inbox, Plus, RefreshCw, Trash2 } from 'lucide-react'
import SimpleBar from 'simplebar-react'
import PageSkeleton from '@/components/PageSkeleton'
import { Button, ConfirmPopover, Empty } from '@/components/ui'
import LoginPrompt from '../components/LoginPrompt'
import MainPagination from '../components/MainPagination'
import TopicRow from '../components/TopicRow'
import type { MainTabKey, NodeItem, TreeItem } from '@/views/main/types'
import styles from './NodeTreeTab.module.scss'

interface NodeTreeTabProps {
  /** 标签 key */
  tab: MainTabKey
  /** 节点列表 */
  nodes: NodeItem[]
  /** 是否已登录 */
  loggedIn: boolean
  /** 是否加载中 */
  loading?: boolean
  /** 标签加载错误 */
  error?: string | null
  /** 添加自定义节点 */
  onAddNode?: () => void
  /** 重试加载标签 */
  onRetryTab?: () => void
  /** 展开节点 */
  onExpandNode: (tab: MainTabKey, itemKey: string) => void
  /** 刷新节点 */
  onRefreshNode: (tab: MainTabKey, itemKey: string) => void
  /** 切换节点页码 */
  onPageChange: (tab: MainTabKey, itemKey: string, page: number) => void
  /** 删除自定义节点 */
  onRemoveNode: (nodeName: string) => void
  /** 取消收藏节点 */
  onCancelCollectNode?: (nodeName: string) => Promise<void>
}

/** 主面板空状态文案 */
const emptyTexts: Record<MainTabKey, string> = {
  explore: '暂无数据',
  custom: '还没有添加自定义节点',
  collection: '还没有收藏的节点'
}

/** 主面板节点树无障碍名称 */
const treeLabels: Record<MainTabKey, string> = {
  explore: '首页节点列表',
  custom: '自定义节点列表',
  collection: '收藏节点列表'
}

/**
 * 创建节点子项
 * @param tab 标签 key
 * @param node 节点项
 */
function createNodeChildren(tab: MainTabKey, node: NodeItem): TreeItem[] {
  if (node.loading && node.children === null) {
    return [{ key: `loading:${node.name}`, label: '加载中', type: 'loading', isLeaf: true }]
  }

  if (node.children === null) {
    return [{ key: `placeholder:${node.name}`, label: '', type: 'empty', isLeaf: true }]
  }

  if (node.error && !node.children.length) {
    return [
      {
        key: `error:${node.name}`,
        label: node.error,
        type: 'error',
        isLeaf: true
      }
    ]
  }

  if (!node.children.length) {
    return [{ key: `empty:${node.name}`, label: '暂无话题', type: 'empty', isLeaf: true }]
  }

  const topicItems: TreeItem[] = node.children.map(topic => ({
    key: `topic:${tab}:${node.name}:${topic.id}`,
    label: topic.title,
    title: topic.title,
    type: 'topic',
    topicId: topic.id,
    replies: topic.replies,
    isRead: topic.isRead,
    isLeaf: true
  }))

  if (tab === 'explore' || node.totalPage <= 1) {
    return topicItems
  }

  return [
    ...topicItems,
    {
      key: `pagination:${tab}:${node.name}`,
      label: '分页',
      type: 'pagination',
      tab,
      itemKey: node.name,
      page: node.page,
      totalPage: node.totalPage,
      totalCount: node.totalCount,
      loading: node.loading,
      isLeaf: true
    }
  ]
}

/**
 * 创建节点树项
 * @param tab 标签 key
 * @param node 节点项
 */
function createNodeTreeItem(tab: MainTabKey, node: NodeItem): TreeItem {
  return {
    key: getNodeKey(node.name),
    label: node.title,
    type: 'node',
    tab,
    itemKey: node.name,
    loading: node.loading,
    page: node.page,
    totalPage: node.totalPage,
    totalCount: node.totalCount,
    isLeaf: false,
    children: createNodeChildren(tab, node)
  }
}

/** 获取节点树项 key */
function getNodeKey(itemKey: string): string {
  return `node:${itemKey}`
}

/** 从话题树项 key 中读取节点 key */
function getNodeKeyFromTopicKey(topicKey: string, tab: MainTabKey): string | undefined {
  const prefix = `topic:${tab}:`
  if (!topicKey.startsWith(prefix)) {
    return undefined
  }

  const itemKey = topicKey.slice(prefix.length).split(':')[0]
  return itemKey ? getNodeKey(itemKey) : undefined
}

/** 固定节点标签页 */
export default function NodeTreeTab(props: NodeTreeTabProps) {
  const {
    tab,
    nodes,
    loggedIn,
    loading,
    error,
    onAddNode,
    onRetryTab,
    onExpandNode,
    onRefreshNode,
    onPageChange,
    onRemoveNode,
    onCancelCollectNode
  } = props
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [selectedTopicKey, setSelectedTopicKey] = useState<string>()
  const treeData = useMemo(() => nodes.map(node => createNodeTreeItem(tab, node)), [nodes, tab])
  const showLoginPrompt = tab === 'collection' && !loggedIn

  useEffect(() => {
    const nodeKeys = new Set(nodes.map(node => getNodeKey(node.name)))
    setExpandedKeys(current => {
      const next = current.filter(key => nodeKeys.has(key))
      return next.length === current.length ? current : next
    })

    if (!selectedTopicKey) {
      return
    }

    const selectedNodeKey = getNodeKeyFromTopicKey(selectedTopicKey, tab)
    if (selectedNodeKey && !nodeKeys.has(selectedNodeKey)) {
      setSelectedTopicKey(undefined)
    }
  }, [nodes, selectedTopicKey, tab])

  function stopTreeClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation()
  }

  function toggleNode(data: TreeItem) {
    const expanded = expandedKeys.includes(data.key)
    setExpandedKeys(current =>
      expanded ? current.filter(key => key !== data.key) : [...current, data.key]
    )

    if (expanded || !data.itemKey) {
      return
    }

    const node = nodes.find(item => item.name === data.itemKey)
    if (node && !node.loading && node.children === null) {
      onExpandNode(tab, node.name)
    }
  }

  function renderNodeActions(data: TreeItem) {
    return (
      <div
        className={`${styles['node-actions']}${data.loading ? ` ${styles['node-actions--loading']}` : ''}`}
        onClick={stopTreeClick}
      >
        {/* 刷新中只保留刷新按钮，避免删除/取消收藏一并露出 */}
        {!data.loading && tab === 'custom' && (
          <ConfirmPopover
            title={`确定删除“${data.label}”节点？`}
            description="删除后该节点将从自定义节点列表中移除"
            confirmText="删除"
            cancelText="取消"
            danger
            onConfirm={() => {
              if (data.itemKey) {
                onRemoveNode(data.itemKey)
              }
            }}
          >
            <span>
              <Button
                variant="ghost"
                size="small"
                icon={<Trash2 aria-hidden="true" />}
                title="删除"
                aria-label="删除"
              />
            </span>
          </ConfirmPopover>
        )}
        {!data.loading && tab === 'collection' && (
          <ConfirmPopover
            title={`确定取消收藏“${data.label}”节点？`}
            description="取消后该节点将从收藏节点列表中移除"
            confirmText="取消收藏"
            cancelText="保留"
            danger
            onConfirm={() => (data.itemKey ? onCancelCollectNode?.(data.itemKey) : undefined)}
          >
            <span>
              <Button
                variant="ghost"
                size="small"
                icon={<Trash2 aria-hidden="true" />}
                title="取消收藏"
                aria-label="取消收藏"
              />
            </span>
          </ConfirmPopover>
        )}
        <Button
          variant="ghost"
          size="small"
          icon={<RefreshCw aria-hidden="true" />}
          loading={data.loading}
          title="刷新"
          aria-label="刷新"
          disabled={data.loading}
          onClick={() => data.itemKey && onRefreshNode(tab, data.itemKey)}
        />
      </div>
    )
  }

  function renderTreeItem(data: TreeItem) {
    if (data.type === 'topic') {
      const title = data.title || data.label
      return (
        <div
          role="treeitem"
          aria-selected={selectedTopicKey === data.key}
          className={`${styles['tree-item']} ${styles['tree-item--topic']}`}
          onClickCapture={() => setSelectedTopicKey(data.key)}
          key={data.key}
        >
          <TopicRow
            as="button"
            topicId={data.topicId!}
            title={title}
            replies={data.replies}
            isRead={data.isRead}
          />
        </div>
      )
    }

    if (data.type === 'pagination' && data.itemKey && data.page && data.totalPage) {
      return (
        <div
          role="treeitem"
          className={`${styles['tree-item']} ${styles['tree-item--pagination']}`}
          onClick={stopTreeClick}
          onMouseDown={stopTreeClick}
          key={data.key}
        >
          <MainPagination
            currentPage={data.page}
            totalPage={data.totalPage}
            totalCount={data.totalCount}
            disabled={data.loading}
            onPageChange={page => {
              if (page !== data.page) {
                onPageChange(tab, data.itemKey!, page)
              }
            }}
          />
        </div>
      )
    }

    return (
      <div
        role="treeitem"
        className={`${styles['tree-item']} ${styles[`tree-item--${data.type}`]}`}
        key={data.key}
      >
        <span>{data.label}</span>
      </div>
    )
  }

  function renderTree() {
    return (
      <div className={styles['node-tree']} role="tree" aria-label={treeLabels[tab]}>
        {treeData.map(data => {
          const expanded = expandedKeys.includes(data.key)
          return (
            <div className={styles['node-group']} key={data.key}>
              <div
                role="treeitem"
                aria-expanded={expanded}
                className={`${styles['tree-item']} ${styles['tree-item--node']}${expanded ? ` ${styles['tree-item--node-expanded']}` : ''}`}
              >
                <button
                  type="button"
                  className={styles['node-toggle']}
                  onClick={() => toggleNode(data)}
                >
                  <ChevronRight
                    className={expanded ? styles['node-chevron--expanded'] : undefined}
                    aria-hidden="true"
                  />
                  <span className={styles['node-label']}>{data.label}</span>
                </button>
                {renderNodeActions(data)}
              </div>
              {expanded && (
                <div role="group" className={styles['node-children']}>
                  {data.children?.map(renderTreeItem)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  function renderContent() {
    if (loading) {
      return <PageSkeleton variant="node-tree" rows={7} />
    }

    if (nodes.length) {
      return renderTree()
    }

    if (showLoginPrompt) {
      return <LoginPrompt />
    }

    if (error) {
      return (
        <div className={styles['empty-panel']}>
          <Empty title="加载失败" description={error} icon={<Inbox aria-hidden="true" />} />
          <Button size="small" loading={loading} onClick={onRetryTab}>
            重试
          </Button>
        </div>
      )
    }

    return (
      <div className={styles['empty-panel']}>
        <Empty title={emptyTexts[tab]} icon={<Inbox aria-hidden="true" />} />
      </div>
    )
  }

  return (
    <div className={styles['node-tree-layout']}>
      <SimpleBar className={styles['node-tree-panel']} autoHide={false}>
        {renderContent()}
      </SimpleBar>
      {!loading && tab === 'custom' && (
        <div className={styles['tree-footer']}>
          <Button
            className={styles['add-node-button']}
            variant="primary"
            size="small"
            icon={<Plus aria-hidden="true" />}
            onClick={onAddNode}
          >
            添加节点
          </Button>
        </div>
      )}
    </div>
  )
}
