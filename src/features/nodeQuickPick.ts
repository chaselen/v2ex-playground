import vscode from 'vscode'
import type { Node } from '@/v2ex'

/** 添加自定义节点时的 QuickPick 项 */
export interface AddCustomNodeQuickPickItem extends vscode.QuickPickItem {
  /** 节点 name */
  name: string
  /** 节点标题 */
  title: string
  /** 节点图标远程地址 */
  avatar?: string
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
  const items: AddCustomNodeQuickPickItem[] = nodes.map(node => ({
    label: formatNodeQuickPickLabel(node, customNodeNames.has(node.name)),
    name: node.name,
    title: node.title,
    avatar: node.avatar
  }))

  return vscode.window.showQuickPick(items, {
    title: '添加自定义节点',
    placeHolder: '搜索节点'
  })
}

/**
 * 组装节点 QuickPick 标签：`✓ 标题 (name) · 🔖 收藏数`
 * @param node 节点
 * @param alreadyAdded 是否已在自定义节点中
 */
function formatNodeQuickPickLabel(node: Node, alreadyAdded: boolean): string {
  const title = `${node.title} (${node.name})`
  const label = alreadyAdded ? `$(check) ${title}` : title

  if (typeof node.collectCount !== 'number') {
    return label
  }

  return `${label} · $(bookmark) ${node.collectCount.toLocaleString('zh-CN')}`
}
