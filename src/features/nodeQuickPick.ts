import vscode from 'vscode'
import type { Node } from '@/v2ex'

/** 节点 QuickPick 项 */
export interface NodeQuickPickItem extends vscode.QuickPickItem {
  /** 节点 name */
  name: string
  /** 节点标题 */
  title: string
  /** 节点图标远程地址 */
  avatar?: string
}

/** 节点 QuickPick 选项 */
export interface NodeQuickPickOptions {
  /** 选择器标题 */
  title: string
  /** 输入框占位文案 */
  placeHolder: string
  /** 需要显示已选择标记的节点 */
  markedNodeNames?: ReadonlySet<string>
  /** 当前选择的节点 name */
  currentNodeName?: string
  /** 标签中展示的节点统计字段，默认收藏人数 */
  countField?: 'collectCount' | 'topicCount'
  /** 是否按展示的统计字段降序排列 */
  sortByCountDescending?: boolean
}

/** 添加自定义节点时的 QuickPick 项 */
export type AddCustomNodeQuickPickItem = NodeQuickPickItem

/**
 * 打开通用节点 QuickPick
 * @param nodes 全部节点
 * @param options 选择器选项
 */
export function showNodeQuickPick(
  nodes: Node[],
  options: NodeQuickPickOptions
): Thenable<NodeQuickPickItem | undefined> {
  const markedNodeNames = options.markedNodeNames || new Set<string>()
  const countField = options.countField || 'collectCount'
  const sourceNodes = options.sortByCountDescending
    ? [...nodes].sort(
        (left, right) =>
          (right[countField] ?? -1) - (left[countField] ?? -1) ||
          left.title.localeCompare(right.title, 'zh-CN')
      )
    : nodes
  const items: NodeQuickPickItem[] = sourceNodes.map(node => ({
    label: formatNodeQuickPickLabel(
      node,
      markedNodeNames.has(node.name) || node.name === options.currentNodeName,
      countField
    ),
    name: node.name,
    title: node.title,
    avatar: node.avatar
  }))

  return vscode.window.showQuickPick(items, {
    title: options.title,
    placeHolder: options.placeHolder,
    matchOnDescription: true
  })
}

/**
 * 打开添加自定义节点的 QuickPick
 * @param nodes 全部节点
 * @param customNodeNames 已添加的自定义节点 name
 */
export function showAddCustomNodeQuickPick(
  nodes: Node[],
  customNodeNames: ReadonlySet<string>
): Thenable<AddCustomNodeQuickPickItem | undefined> {
  return showNodeQuickPick(nodes, {
    title: '添加自定义节点',
    placeHolder: '搜索节点',
    markedNodeNames: customNodeNames
  })
}

/**
 * 组装节点 QuickPick 标签
 * @param node 节点
 * @param alreadyAdded 是否已在自定义节点中
 * @param countField 展示的统计字段
 */
function formatNodeQuickPickLabel(
  node: Node,
  alreadyAdded: boolean,
  countField: 'collectCount' | 'topicCount'
): string {
  const title = `${node.title} (${node.name})`
  const label = alreadyAdded ? `$(check) ${title}` : title
  const count = node[countField]

  if (typeof count !== 'number') {
    return label
  }

  const icon = countField === 'topicCount' ? 'comment-discussion' : 'bookmark'
  return `${label} · $(${icon}) ${count.toLocaleString('zh-CN')}`
}
