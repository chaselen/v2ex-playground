import G from '@/global'
import type { Node } from '@/v2ex'

/** 自定义节点存储 key */
const CUSTOM_NODES_KEY = 'nodes'

/** 获取自定义节点 */
export function getCustomNodes(): Node[] {
  return G.context.globalState.get<Node[]>(CUSTOM_NODES_KEY) || []
}

/**
 * 添加自定义节点
 * @param node 要添加的节点
 * @returns true 表示添加成功，false 表示节点已存在
 */
export async function addCustomNode(node: Node): Promise<boolean> {
  const nodes = getCustomNodes()
  if (nodes.some(item => item.name === node.name)) {
    return false
  }

  await setCustomNodes([...nodes, node])
  return true
}

/**
 * 删除自定义节点
 * @param nodeName 要删除的节点 name
 */
export async function removeCustomNode(nodeName: string): Promise<void> {
  await setCustomNodes(getCustomNodes().filter(node => node.name !== nodeName))
}

/**
 * 保存自定义节点
 * @param nodes 节点列表
 */
async function setCustomNodes(nodes: Node[]): Promise<void> {
  await G.context.globalState.update(CUSTOM_NODES_KEY, nodes)
}
