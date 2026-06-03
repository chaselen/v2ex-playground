import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { Badge, Button, Dropdown, Empty, Pagination, Spin, Tree } from '@douyinfe/semi-ui'
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree'
import { IconDelete, IconPlus, IconRefresh } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import SimpleBar from 'simplebar-react'
import { postVsCodeMessage } from '../shared/vscode'
import LoginPrompt from './LoginPrompt'
import type { MainTabKey, NodeItem, ContextMenuAction, TreeItem } from './types'

interface NodeTreeProps {
  tab: MainTabKey
  nodes: NodeItem[]
  loggedIn: boolean
  loading?: boolean
  onAddNode?: () => void
  onExpandNode: (tab: MainTabKey, nodeId: string) => void
  onRefreshNode: (tab: MainTabKey, nodeId: string) => void
  onPageChange: (tab: MainTabKey, nodeId: string, page: number) => void
  onRemoveNode: (nodeId: string) => void
}

/** 右键菜单项 */
const contextMenuItems: Array<{ action: ContextMenuAction; label: string }> = [
  { action: 'copyLink', label: '复制链接' },
  { action: 'copyTitleLink', label: '复制标题和链接' },
  { action: 'viewInBrowser', label: '在浏览器中打开' }
]

/** 右键菜单命令映射 */
const contextMenuCommands: Record<ContextMenuAction, string> = {
  copyLink: 'ctxCopyLink',
  copyTitleLink: 'ctxCopyTitleLink',
  viewInBrowser: 'ctxViewInBrowser'
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
        key: `loading:${node.id}`,
        label: '加载中',
        type: 'loading',
        isLeaf: true
      }
    ]
  }

  if (node.children === null) {
    return [
      {
        key: `placeholder:${node.id}`,
        label: '',
        type: 'empty',
        isLeaf: true
      }
    ]
  }

  if (node.error && !node.children.length) {
    return [
      {
        key: `error:${node.id}`,
        label: node.error,
        type: 'error',
        isLeaf: true
      }
    ]
  }

  if (!node.children.length) {
    return [
      {
        key: `empty:${node.id}`,
        label: '暂无话题',
        type: 'empty',
        isLeaf: true
      }
    ]
  }

  const topicItems: TreeItem[] = node.children.map(topic => ({
    key: `topic:${tab}:${node.id}:${topic.id}`,
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
      key: `pagination:${tab}:${node.id}`,
      label: `第 ${node.page} / ${node.totalPage} 页`,
      type: 'pagination',
      tab,
      nodeId: node.id,
      page: node.page,
      totalPage: node.totalPage,
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
    key: getNodeKey(node.id),
    label: node.label,
    type: 'node',
    tab,
    nodeId: node.id,
    loading: node.loading,
    page: node.page,
    totalPage: node.totalPage,
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
 * @param nodeId 节点 id
 */
function getNodeKey(nodeId: string): string {
  return `node:${nodeId}`
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

  const nodeId = topicKey.slice(prefix.length).split(':')[0]
  return nodeId ? getNodeKey(nodeId) : undefined
}

/**
 * 节点树
 * @param props 组件参数
 */
export default function NodeTree(props: NodeTreeProps) {
  const {
    tab,
    nodes,
    loggedIn,
    loading,
    onAddNode,
    onExpandNode,
    onRefreshNode,
    onPageChange,
    onRemoveNode
  } = props
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [selectedTopicKey, setSelectedTopicKey] = useState<string>()

  /** 树组件数据 */
  const treeData = useMemo(() => nodes.map(node => createNodeTreeItem(tab, node)), [nodes, tab])

  /** 是否显示登录提示 */
  const showLoginPrompt = tab === 'collection' && !loggedIn

  useEffect(() => {
    // 当前节点 key 集合
    const nodeKeys = new Set(nodes.map(node => getNodeKey(node.id)))

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
   * 打开话题
   * @param data 树项
   */
  function openTopic(data: TreeItem) {
    if (!data.topicId) {
      return
    }
    postVsCodeMessage('openTopic', { topicId: data.topicId, title: data.title || data.label })
  }

  /**
   * 刷新节点
   * @param data 树项
   */
  function refreshNode(data: TreeItem) {
    if (!data.nodeId || data.loading) {
      return
    }
    onRefreshNode(tab, data.nodeId)
  }

  /**
   * 删除自定义节点
   * @param data 树项
   */
  function removeNode(data: TreeItem) {
    if (!data.nodeId) {
      return
    }
    onRemoveNode(data.nodeId)
  }

  /**
   * 发送右键菜单命令
   * @param action 菜单动作
   * @param data 树项
   */
  function postContextMenuCommand(action: ContextMenuAction, data: TreeItem) {
    if (!data.topicId) {
      return
    }

    postVsCodeMessage(contextMenuCommands[action], {
      topicId: data.topicId,
      label: data.title || data.label
    })
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
      <div className="node-actions" onClick={stopTreeClick}>
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
    const menu = (
      <Dropdown.Menu>
        {contextMenuItems.map(item => (
          <Dropdown.Item
            key={item.action}
            onClick={() => postContextMenuCommand(item.action, data)}
          >
            {item.label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    )

    return (
      <Dropdown trigger="contextMenu" position="bottomLeft" clickToHide render={menu}>
        <div className="topic-row" title={topicTitle}>
          <span className="topic-title">{topicTitle}</span>
          {!!data.replies && data.replies > 0 && (
            <Badge
              count={data.replies}
              overflowCount={99}
              countClassName="topic-badge-count"
              countStyle={{
                backgroundColor: 'var(--vscode-badge-background)',
                color: 'var(--vscode-badge-foreground)'
              }}
            />
          )}
        </div>
      </Dropdown>
    )
  }

  /**
   * 渲染节点分页
   * @param data 树项
   */
  function renderPaginationRow(data: TreeItem) {
    if (!data.nodeId || !data.page || !data.totalPage) {
      return null
    }

    return (
      <div className="node-pagination" onClick={stopTreeClick} onMouseDown={stopTreeClick}>
        <Pagination
          size="small"
          pageSize={1}
          total={data.totalPage}
          currentPage={data.page}
          disabled={data.loading}
          hoverShowPageSelect
          onPageChange={page => {
            if (page !== data.page) {
              onPageChange(tab, data.nodeId!, page)
            }
          }}
        />
        <span className="node-page-summary">{`第 ${data.page} / ${data.totalPage} 页`}</span>
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
      <div className={`tree-row tree-row--${data.type}`}>
        {data.type === 'topic' && renderTopicRow(data)}
        {data.type === 'loading' && <span className="loading-text">{label}</span>}
        {data.type === 'error' && <span className="error-text">{label}</span>}
        {data.type === 'empty' && <span className="empty-text">{label}</span>}
        {data.type === 'pagination' && renderPaginationRow(data)}
        {data.type === 'node' && (
          <>
            <span className="node-label">{label}</span>
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
    if (!context.expanded || data.type !== 'node' || !data.nodeId) {
      return
    }

    const node = nodes.find(item => item.id === data.nodeId)
    if (!node || node.loading || node.children !== null) {
      return
    }

    onExpandNode(tab, node.id)
  }

  /**
   * 处理树选中
   * @param selectedKey 选中节点 key
   * @param selected 是否选中
   * @param selectedNode 选中节点
   */
  function handleSelect(selectedKey: string, selected: boolean, selectedNode: TreeNodeData) {
    const data = getTreeItem(selectedNode)
    if (!selected || data.type !== 'topic') {
      return
    }

    setSelectedTopicKey(selectedKey)
    openTopic(data)
  }

  if (loading) {
    return (
      <section className="node-tree-panel">
        <div className="loading-panel">
          <Spin size="middle" />
        </div>
      </section>
    )
  }

  if (!nodes.length) {
    return (
      <section className="node-tree-panel">
        {showLoginPrompt ? (
          <LoginPrompt />
        ) : (
          <div className="empty-panel">
            <Empty
              title={emptyTexts[tab]}
              image={<IllustrationNoContent className="empty-illustration" />}
              darkModeImage={<IllustrationNoContentDark className="empty-illustration" />}
            />
          </div>
        )}
        {tab === 'custom' && (
          <div className="tree-footer">
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
      </section>
    )
  }

  return (
    <section className="node-tree-panel">
      <SimpleBar className="node-tree-scroll" autoHide={false}>
        <Tree
          expandedKeys={expandedKeys}
          value={selectedTopicKey}
          treeData={treeData}
          blockNode
          motion={false}
          expandAction="click"
          className="node-tree"
          renderLabel={renderLabel}
          onExpand={handleExpand}
          onSelect={handleSelect}
        />
      </SimpleBar>

      {tab === 'custom' && (
        <div className="tree-footer">
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
    </section>
  )
}
