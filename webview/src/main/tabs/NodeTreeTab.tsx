import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { Button, Empty, Popconfirm, Spin, Tree } from '@douyinfe/semi-ui'
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree'
import { IconDelete, IconPlus, IconRefresh } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import SimpleBar from 'simplebar-react'
import type { MainViewRpcCommands } from '@extension/shared/webview'
import { createVsCodeClient } from '@/shared/vscode'
import LoginPrompt from '../components/LoginPrompt'
import MainPagination from '../components/MainPagination'
import TopicRow from '../components/TopicRow'
import type { MainTabKey, NodeItem, TreeItem } from '@/main/types'
import styles from './NodeTreeTab.module.scss'

/** 主面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<MainViewRpcCommands>()

interface NodeTreeTabProps {
  /** 标签 key */
  tab: MainTabKey
  /** 节点列表 */
  nodes: NodeItem[]
  /** 是否已登录 */
  loggedIn: boolean
  /** 是否加载中 */
  loading?: boolean
  /** 添加自定义节点 */
  onAddNode?: () => void
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

/**
 * 创建节点子项
 * @param tab 标签 key
 * @param node 节点项
 */
function createNodeChildren(tab: MainTabKey, node: NodeItem): TreeItem[] {
  if (node.loading && node.children === null) {
    return [
      {
        key: `loading:${node.name}`,
        label: '加载中',
        type: 'loading',
        isLeaf: true
      }
    ]
  }

  if (node.children === null) {
    return [
      {
        key: `placeholder:${node.name}`,
        label: '',
        type: 'empty',
        isLeaf: true
      }
    ]
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
    return [
      {
        key: `empty:${node.name}`,
        label: '暂无话题',
        type: 'empty',
        isLeaf: true
      }
    ]
  }

  const topicItems: TreeItem[] = node.children.map(topic => ({
    key: `topic:${tab}:${node.name}:${topic.id}`,
    label: topic.title,
    title: topic.title,
    type: 'topic',
    topicId: topic.id,
    replies: topic.replies,
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

/**
 * 读取 Semi 树节点扩展数据
 * @param data Semi 树节点
 */
function getTreeItem(data?: TreeNodeData): TreeItem {
  return data as TreeItem
}

/**
 * 获取节点树项 key
 * @param itemKey 列表项 key
 */
function getNodeKey(itemKey: string): string {
  return `node:${itemKey}`
}

/**
 * 从话题树项 key 中读取节点 key
 * @param topicKey 话题树项 key
 * @param tab 标签 key
 */
function getNodeKeyFromTopicKey(topicKey: string, tab: MainTabKey): string | undefined {
  const prefix = `topic:${tab}:`
  if (!topicKey.startsWith(prefix)) {
    return undefined
  }

  const itemKey = topicKey.slice(prefix.length).split(':')[0]
  return itemKey ? getNodeKey(itemKey) : undefined
}

/**
 * 固定节点标签页
 * @param props 组件参数
 */
export default function NodeTreeTab(props: NodeTreeTabProps) {
  const {
    tab,
    nodes,
    loggedIn,
    loading,
    onAddNode,
    onExpandNode,
    onRefreshNode,
    onPageChange,
    onRemoveNode,
    onCancelCollectNode
  } = props
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [selectedTopicKey, setSelectedTopicKey] = useState<string>()

  /** 树组件数据 */
  const treeData = useMemo(() => nodes.map(node => createNodeTreeItem(tab, node)), [nodes, tab])

  /** 是否显示登录提示 */
  const showLoginPrompt = tab === 'collection' && !loggedIn

  useEffect(() => {
    // 当前节点 key 集合
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

  /**
   * 刷新节点
   * @param data 树项
   */
  function refreshNode(data: TreeItem) {
    if (!data.itemKey || data.loading) {
      return
    }
    onRefreshNode(tab, data.itemKey)
  }

  /**
   * 删除自定义节点
   * @param data 树项
   */
  function removeNode(data: TreeItem) {
    if (!data.itemKey) {
      return
    }
    onRemoveNode(data.itemKey)
  }

  /**
   * 取消收藏节点
   * @param data 树项
   */
  function cancelCollectNode(data: TreeItem): Promise<void> | undefined {
    if (!data.itemKey) {
      return
    }
    return onCancelCollectNode?.(data.itemKey)
  }

  /**
   * 阻止树节点默认点击
   * @param event 鼠标事件
   */
  function stopTreeClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation()
  }

  /**
   * 渲染节点操作区
   * @param data 树项
   */
  function renderNodeActions(data: TreeItem) {
    return (
      <div className={styles['node-actions']} onClick={stopTreeClick}>
        {tab === 'custom' && (
          <Button
            theme="borderless"
            type="tertiary"
            size="small"
            icon={<IconDelete />}
            title="删除"
            aria-label="删除"
            onClick={() => removeNode(data)}
          />
        )}
        {tab === 'collection' && (
          <Popconfirm
            title={`确定取消收藏“${data.label}”节点？`}
            content="取消后该节点将从收藏节点列表中移除"
            okText="取消收藏"
            okType="danger"
            cancelText="保留"
            cancelButtonProps={{ autoFocus: true }}
            onConfirm={() => cancelCollectNode(data)}
          >
            <span>
              <Button
                theme="borderless"
                type="tertiary"
                size="small"
                icon={<IconDelete />}
                title="取消收藏"
                aria-label="取消收藏"
              />
            </span>
          </Popconfirm>
        )}
        <Button
          theme="borderless"
          type="tertiary"
          size="small"
          icon={<IconRefresh />}
          loading={data.loading}
          title="刷新"
          aria-label="刷新"
          disabled={data.loading}
          onClick={() => refreshNode(data)}
        />
      </div>
    )
  }

  /**
   * 渲染话题行
   * @param data 树项
   */
  function renderTopicRow(data: TreeItem) {
    const topicTitle = data.title || data.label

    return (
      <TopicRow
        topicId={data.topicId!}
        title={topicTitle}
        replies={data.replies}
        openOnClick={false}
      />
    )
  }

  /**
   * 渲染节点分页
   * @param data 树项
   */
  function renderPaginationRow(data: TreeItem) {
    if (!data.itemKey || !data.page || !data.totalPage) {
      return null
    }

    return (
      <div
        className={styles['node-pagination']}
        onClick={stopTreeClick}
        onMouseDown={stopTreeClick}
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

  /**
   * 渲染树节点标签
   * @param label 节点标签
   * @param treeNode Semi 树节点
   */
  function renderLabel(label?: React.ReactNode, treeNode?: TreeNodeData) {
    const data = getTreeItem(treeNode)

    return (
      <div className={`${styles['tree-row']} ${styles[`tree-row--${data.type}`] || ''}`}>
        {data.type === 'topic' && renderTopicRow(data)}
        {data.type === 'loading' && <span className={styles['loading-text']}>{label}</span>}
        {data.type === 'error' && <span className={styles['error-text']}>{label}</span>}
        {data.type === 'empty' && <span className={styles['empty-text']}>{label}</span>}
        {data.type === 'pagination' && renderPaginationRow(data)}
        {data.type === 'node' && (
          <>
            <span className={styles['node-label']}>{label}</span>
            {renderNodeActions(data)}
          </>
        )}
      </div>
    )
  }

  /**
   * 处理树展开
   * @param nextExpandedKeys 展开的节点
   * @param context 展开上下文
   */
  function handleExpand(
    nextExpandedKeys: string[],
    context: { node: TreeNodeData; expanded: boolean }
  ) {
    setExpandedKeys(nextExpandedKeys)
    const data = getTreeItem(context.node)
    if (!context.expanded || data.type !== 'node' || !data.itemKey) {
      return
    }

    const node = nodes.find(item => item.name === data.itemKey)
    if (!node || node.loading || node.children !== null) {
      return
    }

    onExpandNode(tab, node.name)
  }

  /**
   * 处理树选中
   * @param selectedKey 选中节点 key
   * @param selected 是否选中
   * @param selectedNode 选中节点
   */
  function handleSelect(selectedKey: string, selected: boolean, selectedNode: TreeNodeData) {
    const data = getTreeItem(selectedNode)
    if (data.type !== 'topic' || !data.topicId) {
      return
    }

    if (selected) {
      setSelectedTopicKey(selectedKey)
    }

    vscode.openTopic({
      topicId: data.topicId,
      title: data.title || data.label
    })
  }

  /** 渲染节点树主体内容 */
  function renderContent() {
    if (loading) {
      return (
        <div className={styles['loading-panel']}>
          <Spin size="middle" />
        </div>
      )
    }

    if (nodes.length) {
      return (
        <Tree
          expandedKeys={expandedKeys}
          value={selectedTopicKey}
          treeData={treeData}
          blockNode
          motion={false}
          expandAction="click"
          className={styles['node-tree']}
          renderLabel={renderLabel}
          onExpand={handleExpand}
          onSelect={handleSelect}
        />
      )
    }

    if (showLoginPrompt) {
      return <LoginPrompt />
    }

    return (
      <div className={styles['empty-panel']}>
        <Empty
          title={emptyTexts[tab]}
          image={<IllustrationNoContent className={styles['empty-illustration']} />}
          darkModeImage={<IllustrationNoContentDark className={styles['empty-illustration']} />}
        />
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
            block
            type="primary"
            theme="solid"
            size="small"
            icon={<IconPlus />}
            onClick={onAddNode}
          >
            添加节点
          </Button>
        </div>
      )}
    </div>
  )
}
