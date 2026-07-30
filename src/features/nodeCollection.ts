import G from '@/global'
import { logger } from '@/core/logger'
import type { NodeListData } from '@/shared/webview'

/** 收藏节点列表变化回调 */
type CollectionNodesChangedHandler = (data: NodeListData) => void | Promise<void>

/** 收藏节点列表变化监听器 */
const collectionNodesChangedHandlers = new Set<CollectionNodesChangedHandler>()

/**
 * 监听收藏节点列表变化
 * @param handler 列表变化回调
 */
export function onCollectionNodesChanged(handler: CollectionNodesChangedHandler): {
  dispose: () => void
} {
  collectionNodesChangedHandlers.add(handler)
  return {
    dispose: () => {
      collectionNodesChangedHandlers.delete(handler)
    }
  }
}

/**
 * 拉取最新收藏节点列表并通知监听方
 * 用于节点面板收藏/取消收藏后同步主面板收藏节点标签
 */
export async function notifyCollectionNodesChanged(): Promise<void> {
  try {
    if (!G.V2ex.hasLoginSession()) {
      await dispatchCollectionNodesChanged({ nodes: [] })
      return
    }

    const nodes = await G.V2ex.getCollectionNodes()
    await dispatchCollectionNodesChanged({
      nodes: nodes.map(node => ({
        name: node.name,
        title: node.title
      }))
    })
  } catch (err) {
    logger.error('同步收藏节点列表失败', err)
  }
}

/**
 * 向监听方派发收藏节点列表
 * @param data 节点列表
 */
async function dispatchCollectionNodesChanged(data: NodeListData): Promise<void> {
  await Promise.all(
    [...collectionNodesChangedHandlers].map(async handler => {
      try {
        await handler(data)
      } catch (err) {
        logger.error('收藏节点列表变化回调失败', err)
      }
    })
  )
}
