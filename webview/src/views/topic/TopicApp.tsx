import { useCallback, useEffect, useRef, useState } from 'react'
import SimpleBar from 'simplebar-react'
import type SimpleBarCore from 'simplebar-core'
import { Alert, Button, Toast } from '@/components/ui'
import { normalizeHtml } from '@/core/contentEnhancement'
import PageSkeleton from '@/components/PageSkeleton'
import TopicShareContextMenu from '@/components/TopicShareContextMenu'
import { createVsCodeClient, subscribeWebviewState } from '@/core/vscode'
import TopicDetailView from './TopicDetailView'
import TopicPreviewModal from './TopicPreviewModal'
import TopicShareDialog from './TopicShareDialog'
import TopicContentDialog, { topicContentLabels } from './TopicContentDialog'
import TopicManagementPopover from './TopicManagementPopover'
import type { ReplyViewMode } from './replyTree'
import useTopicDetailController from './useTopicDetailController'
import type { TopicDetail, TopicContentAction } from '@extension/v2ex/types'
import type {
  TopicPanelRpcCommands,
  TopicPanelViewState,
  TopicPanelWebviewEvents
} from '@extension/shared/webview'

/** 话题面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<TopicPanelRpcCommands, TopicPanelWebviewEvents>()

/**
 * 话题页面应用
 */
export default function TopicApp() {
  const [state, setState] = useState<TopicPanelViewState>({
    status: 'loading',
    topic: undefined,
    message: '',
    showLogin: false,
    showRefresh: false,
    showImages: true,
    showAvatar: true,
    canOperate: false
  })
  const [previewTopicId, setPreviewTopicId] = useState<string>()
  const [contentAction, setContentAction] = useState<TopicContentAction>()
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [replyViewMode, setReplyViewMode] = useState<ReplyViewMode>('nested')
  const topicScrollRef = useRef<HTMLElement | null>(null)
  const imgurImageFailureHandledRef = useRef(false)
  const topic = state.topic
  const contentActions = topic?.contentActions ?? []
  const managementActions = topic?.managementActions ?? []
  const showImages = state.showImages !== false
  const showAvatar = state.showAvatar !== false

  /** 应用当前主面板的话题详情 */
  const applyTopicChange = useCallback((nextTopic: TopicDetail) => {
    setState(current => {
      if (
        current.status !== 'topic' ||
        !current.topic ||
        String(current.topic.id) !== String(nextTopic.id)
      ) {
        return current
      }

      return { ...current, topic: nextTopic }
    })
  }, [])

  /** 刷新主面板话题 */
  const refreshTopic = useCallback(async () => {
    await vscode.refresh()
  }, [])

  /** 加载主面板回复页 */
  const loadReplyPage = useCallback((replyPage: number) => vscode.loadReplyPage(replyPage), [])

  const topicController = useTopicDetailController({
    topic,
    showImages,
    showAvatar,
    canOperate: Boolean(state.canOperate),
    onTopicChange: applyTopicChange,
    refresh: refreshTopic,
    loadReplyPage
  })

  /** 打开站内话题预览 */
  const openTopicPreview = useCallback((topicId: string) => {
    setPreviewTopicId(topicId)
  }, [])

  /** 检测 Imgur 连通性 */
  function checkImgurConnectivity(target: 'image' | 'upload', refresh = false) {
    return vscode.checkImgurConnectivity(target, refresh)
  }

  useEffect(() => {
    /** 应用扩展侧同步的话题状态 */
    const applyViewState = (nextState: TopicPanelViewState) => {
      setState({
        topic: nextState.topic,
        message: nextState.message || '',
        showLogin: Boolean(nextState.showLogin),
        showRefresh: Boolean(nextState.showRefresh),
        showImages: nextState.showImages !== false,
        showAvatar: nextState.showAvatar !== false,
        canOperate: Boolean(nextState.canOperate),
        status: nextState.status
      })
    }

    return subscribeWebviewState(
      handler => vscode.on('topicStateChanged', data => handler(data.state)),
      () => vscode.ready(),
      applyViewState
    )
  }, [])

  useEffect(() => {
    /** 聚合话题内容中的 Imgur 图片加载错误，单个页面仅提示一次 */
    async function handleImageError(event: Event) {
      const image = event.target
      if (
        imgurImageFailureHandledRef.current ||
        !(image instanceof HTMLImageElement) ||
        !image.closest('.topic-content')
      ) {
        return
      }

      try {
        if (new URL(image.currentSrc || image.src, document.baseURI).hostname !== 'i.imgur.com') {
          return
        }
      } catch {
        return
      }

      imgurImageFailureHandledRef.current = true
      try {
        if (!(await checkImgurConnectivity('image', true))) {
          Toast.warning('Imgur 图片加载失败，请检查网络或代理设置')
        }
      } catch {
        Toast.warning('Imgur 图片加载失败，请检查网络或代理设置')
      }
    }

    const onImageError = (event: Event) => void handleImageError(event)
    document.addEventListener('error', onImageError, true)
    return () => document.removeEventListener('error', onImageError, true)
  }, [])

  useEffect(() => {
    if (!topic) {
      setShowShareDialog(false)
    }
  }, [topic])

  /** 绑定 SimpleBar 实例，并同步真正的滚动容器 */
  function bindSimpleBar(instance: SimpleBarCore | null) {
    topicScrollRef.current = instance?.getScrollElement() ?? null
  }

  const content = (
    <SimpleBar ref={bindSimpleBar} className="topic-shell" role="main" autoHide={false}>
      {state.status === 'loading' && <PageSkeleton variant="topic" showAvatar={showAvatar} />}

      {state.status === 'error' && (
        <div className="state-panel">
          <Alert
            variant="danger"
            title="加载失败"
            description={
              <div
                className="state-message"
                dangerouslySetInnerHTML={{ __html: normalizeHtml(state.message) }}
              />
            }
          />
          <div className="state-actions">
            {state.showLogin && (
              <Button size="small" variant="primary" onClick={() => vscode.login()}>
                登录
              </Button>
            )}
            {state.showRefresh && (
              <Button size="small" onClick={() => vscode.refresh()}>
                刷新页面
              </Button>
            )}
          </div>
        </div>
      )}

      {state.status === 'topic' && topicController && (
        <TopicDetailView
          controller={topicController}
          authorActions={
            state.canOperate && (
              <>
                {contentActions.map(action => (
                  <Button
                    key={action}
                    size="small"
                    variant="secondary"
                    onClick={() => setContentAction(action)}
                  >
                    {topicContentLabels[action]}
                  </Button>
                ))}
                {managementActions.length > 0 && (
                  <TopicManagementPopover
                    key={topicController.topic.id}
                    actions={managementActions}
                  />
                )}
              </>
            )
          }
          initialReplyViewMode={replyViewMode}
          scrollContainerRef={topicScrollRef}
          onReplyViewModeChange={setReplyViewMode}
          onTopicPreview={openTopicPreview}
          onShare={() => setShowShareDialog(true)}
        />
      )}
    </SimpleBar>
  )

  return (
    <>
      {/* SimpleBar 的 ref 返回滚动实例，菜单触发器需绑定真实 DOM */}
      <TopicShareContextMenu
        disabled={!topic}
        onCopyLink={() => topic && vscode.copyTopicLink(topic.id)}
        onCopyTitleLink={() => topic && vscode.copyTopicTitleLink(topic.id, topic.title)}
        onViewInBrowser={() => topic && vscode.viewTopicInBrowser(topic.id)}
      >
        <div>{content}</div>
      </TopicShareContextMenu>
      {contentAction && topic && state.canOperate && (
        <TopicContentDialog
          key={`${topic.id}:${contentAction}`}
          action={contentAction}
          currentNode={topic.node}
          onClose={() => setContentAction(undefined)}
        />
      )}
      <TopicPreviewModal
        topicId={previewTopicId}
        showImages={showImages}
        showAvatar={showAvatar}
        canOperate={Boolean(state.canOperate)}
        onClose={() => setPreviewTopicId(undefined)}
        onPreviewTopic={openTopicPreview}
      />
      {topic && (
        <TopicShareDialog
          key={topic.id}
          open={showShareDialog}
          replyViewMode={replyViewMode}
          topic={topic}
          loadFirstReplyPage={() =>
            topic.replyCurrentPage === 1
              ? Promise.resolve(topic)
              : vscode.getTopicPreview(topic.id, 1)
          }
          loadImages={(imageSources, format) => vscode.loadTopicShareImages(imageSources, format)}
          onCopyLink={() => vscode.copyTopicLink(topic.id)}
          onOpenChange={setShowShareDialog}
          onSave={base64 => vscode.saveTopicShareImage(topic.id, base64)}
        />
      )}
    </>
  )
}
