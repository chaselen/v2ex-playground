import { useCallback, useEffect, useRef, useState } from 'react'
import { Banner, Button, Modal, Toast } from '@douyinfe/semi-ui'
import { IconRefresh } from '@douyinfe/semi-icons'
import PageSkeleton from '@/shared/PageSkeleton'
import TopicShareContextMenu from '@/shared/TopicShareContextMenu'
import { createVsCodeClient } from '@/shared/vscode'
import TopicDetailView from './TopicDetailView'
import useTopicDetailController from './useTopicDetailController'
import type { TopicDetail } from '@extension/v2ex/types'
import type { TopicPanelRpcCommands } from '@extension/shared/webview'

/** 话题预览 VS Code 通信客户端 */
const vscode = createVsCodeClient<TopicPanelRpcCommands>()

/** 话题预览弹窗属性 */
interface TopicPreviewModalProps {
  /** 当前预览话题 id */
  topicId?: string
  /** 是否显示图片 */
  showImages: boolean
  /** 是否可回复 */
  canOperate: boolean
  /** 关闭弹窗 */
  onClose(): void
  /** 切换到另一个话题预览 */
  onPreviewTopic(topicId: string): void
}

/** 话题预览加载状态 */
type PreviewState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'topic'; topic: TopicDetail }

/**
 * 站内话题预览弹窗
 */
export default function TopicPreviewModal({
  topicId,
  showImages,
  canOperate,
  onClose,
  onPreviewTopic
}: TopicPreviewModalProps) {
  const [state, setState] = useState<PreviewState>({ status: 'idle' })
  const [refreshing, setRefreshing] = useState(false)
  const [floatingActionsContainer, setFloatingActionsContainer] = useState<HTMLDivElement | null>(
    null
  )
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const loadRequestRef = useRef(0)
  const activeTopicIdRef = useRef(topicId)
  const canOperateRef = useRef(canOperate)
  activeTopicIdRef.current = topicId
  const topic = state.status === 'topic' ? state.topic : undefined
  const topicRef = useRef(topic)
  topicRef.current = topic

  /** 应用当前预览的话题详情 */
  const applyTopicChange = useCallback((nextTopic: TopicDetail) => {
    if (activeTopicIdRef.current === String(nextTopic.id)) {
      setState({ status: 'topic', topic: nextTopic })
    }
  }, [])

  /** 刷新当前预览话题 */
  const refreshPreviewTopic = useCallback(async () => {
    const activeTopicId = activeTopicIdRef.current
    if (!activeTopicId) {
      return
    }

    const requestId = ++loadRequestRef.current
    setRefreshing(true)
    try {
      const nextTopic = await vscode.getTopicPreview({
        topicId: activeTopicId,
        replyPage: topicRef.current?.replyCurrentPage
      })
      return requestId === loadRequestRef.current ? nextTopic : undefined
    } finally {
      if (activeTopicIdRef.current === activeTopicId) {
        setRefreshing(false)
      }
    }
  }, [])

  /** 加载当前预览回复页 */
  const loadPreviewReplyPage = useCallback(async (replyPage: number) => {
    const activeTopicId = activeTopicIdRef.current
    if (!activeTopicId) {
      return
    }

    const requestId = ++loadRequestRef.current
    const nextTopic = await vscode.getTopicPreview({ topicId: activeTopicId, replyPage })
    return requestId === loadRequestRef.current ? nextTopic : undefined
  }, [])

  const topicController = useTopicDetailController({
    topic,
    showImages,
    canOperate,
    onTopicChange: applyTopicChange,
    refresh: refreshPreviewTopic,
    loadReplyPage: loadPreviewReplyPage
  })

  /** 加载话题详情 */
  async function loadTopic(replyPage = 1, showLoading = true) {
    if (!topicId) {
      return
    }

    const requestId = ++loadRequestRef.current
    if (showLoading) {
      setState({ status: 'loading' })
    }

    try {
      const nextTopic = await vscode.getTopicPreview({ topicId, replyPage })
      if (requestId === loadRequestRef.current) {
        setState({ status: 'topic', topic: nextTopic })
      }
    } catch (err) {
      if (requestId !== loadRequestRef.current) {
        return
      }
      if (showLoading) {
        setState({ status: 'error', message: (err as Error).message || '帖子预览加载失败' })
      } else {
        Toast.error((err as Error).message || '评论加载失败')
      }
    }
  }

  useEffect(() => {
    loadRequestRef.current++
    setRefreshing(false)
    if (topicId) {
      void loadTopic()
    } else {
      setState({ status: 'idle' })
    }
  }, [topicId])

  useEffect(() => {
    const changed = canOperateRef.current !== canOperate
    canOperateRef.current = canOperate
    if (changed && topicId && topic) {
      void loadTopic(topic.replyCurrentPage, false)
    }
  }, [canOperate])

  /** 打开完整话题面板 */
  function openFullTopic() {
    if (!topicId) {
      return
    }
    vscode.openTopic({ topicId, title: topic?.title })
    onClose()
  }

  /** 复制预览话题链接 */
  function copyPreviewLink() {
    if (topicId) {
      void vscode.copyTopicLink(topicId)
    }
  }

  /** 复制预览话题标题和链接 */
  function copyPreviewTitleLink() {
    if (topicId && topic) {
      void vscode.copyTopicTitleLink({ topicId, title: topic.title })
    }
  }

  /** 在浏览器中打开预览话题 */
  function viewPreviewInBrowser() {
    if (topicId) {
      void vscode.viewTopicInBrowser(topicId)
    }
  }

  return (
    <Modal
      centered
      className="topic-preview-modal"
      cancelText="关闭"
      maskClosable={false}
      maskStyle={{ backgroundColor: 'rgba(22, 22, 26, 0.6)' }}
      okText="进入主题"
      title="帖子预览"
      visible={Boolean(topicId)}
      width="min(1040px, calc(100vw - 48px))"
      onCancel={onClose}
      onOk={openFullTopic}
    >
      <TopicShareContextMenu
        disabled={!topicId || !topic || refreshing}
        onCopyLink={copyPreviewLink}
        onCopyTitleLink={copyPreviewTitleLink}
        onViewInBrowser={viewPreviewInBrowser}
      >
        <div className="topic-preview-body" ref={setFloatingActionsContainer}>
          <div className="topic-preview-scroll" ref={scrollContainerRef}>
            {(state.status === 'loading' || refreshing) && <PageSkeleton variant="topic" />}

            {state.status === 'error' && !refreshing && (
              <div className="topic-preview-state">
                <Banner type="danger" description={state.message} />
                <Button icon={<IconRefresh />} theme="light" onClick={() => void loadTopic()}>
                  重新加载
                </Button>
              </div>
            )}

            {topicController && topicId && !refreshing && (
              <TopicDetailView
                controller={topicController}
                className="topic-preview-container"
                floatingActionsContainer={floatingActionsContainer}
                scrollContainerRef={scrollContainerRef}
                onTopicPreview={onPreviewTopic}
              />
            )}
          </div>
        </div>
      </TopicShareContextMenu>
    </Modal>
  )
}
