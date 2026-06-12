import { useCallback, useRef, useState } from 'react'
import { createVsCodeClient } from '@/shared/vscode'
import type { MainViewRpcCommands, NodeTopicListData, WebviewNode } from '@extension/shared/webview'
import { normalizeTopics } from '../nodeData'
import type { NodeTopicTabState } from '../types'

/** 主面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<MainViewRpcCommands>()

/**
 * 管理动态节点主题标签
 */
export function useNodeTopicTab() {
  const [nodeTab, setNodeTab] = useState<NodeTopicTabState>()
  const nodeTabRef = useRef<NodeTopicTabState | undefined>(undefined)
  const requestSeq = useRef(0)

  /**
   * 处理节点主题列表
   * @param data 节点主题列表数据
   * @param currentRequestSeq 请求序号
   */
  const onNodeTopics = useCallback((data: NodeTopicListData, currentRequestSeq: number) => {
    if (requestSeq.current !== currentRequestSeq) {
      return
    }

    setNodeTab(current => {
      if (current?.name !== data.node.name) {
        return current
      }

      const next = {
        ...current,
        ...data.node,
        loading: false,
        page: data.page,
        totalPage: data.totalPage,
        totalCount: data.totalCount,
        topics: normalizeTopics(data.topics),
        error: null
      }
      nodeTabRef.current = next
      return next
    })
  }, [])

  /**
   * 请求节点主题列表
   * @param node 节点
   * @param page 页码
   */
  const requestNodeTopics = useCallback(
    async (node: WebviewNode, page: number) => {
      const currentRequestSeq = requestSeq.current + 1
      requestSeq.current = currentRequestSeq
      setNodeTab(current =>
        current?.name === node.name ? { ...current, loading: true, error: null } : current
      )

      try {
        const data = await vscode.getNodeTopics({ nodeName: node.name, page })
        onNodeTopics(data, currentRequestSeq)
      } catch (err) {
        if (requestSeq.current !== currentRequestSeq) {
          return
        }
        setNodeTab(current => {
          if (current?.name !== node.name) {
            return current
          }

          const next = {
            ...current,
            loading: false,
            error: (err as Error).message || '加载失败'
          }
          nodeTabRef.current = next
          return next
        })
      }
    },
    [onNodeTopics]
  )

  /**
   * 打开节点主题标签
   * @param node 节点
   */
  const openNodeTab = useCallback(
    (node: WebviewNode) => {
      if (nodeTabRef.current?.name === node.name) {
        return
      }

      const next: NodeTopicTabState = {
        ...node,
        loading: true,
        page: 1,
        totalPage: 1,
        totalCount: 0,
        topics: [],
        error: null
      }
      nodeTabRef.current = next
      setNodeTab(next)
      requestNodeTopics(node, 1)
    },
    [requestNodeTopics]
  )

  /**
   * 关闭节点主题标签
   */
  const closeNodeTab = useCallback(() => {
    requestSeq.current += 1
    nodeTabRef.current = undefined
    setNodeTab(undefined)
  }, [])

  return {
    nodeTab,
    closeNodeTab,
    openNodeTab,
    requestNodeTopics
  }
}
