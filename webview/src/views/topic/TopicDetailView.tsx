import TopicInfoDialog from './TopicInfoDialog'
import { useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  BookmarkPlus,
  Eye,
  EyeOff,
  Heart,
  Inbox,
  Info,
  RefreshCw,
  Reply,
  Settings,
  Share2,
  Sparkles,
  Tag,
  UserRound
} from 'lucide-react'
import EnhancedHtmlContent from '@/components/EnhancedHtmlContent'
import { handleWebviewLinkClick } from '@/core/linkNavigation'
import { resolveWebviewUrl } from '@/core/vscode'
import NodeButton from '@/components/NodeButton'
import UserBadge from '@/components/UserBadge'
import TimeWithSource from '@/components/TimeWithSource'
import CollapsibleReplyContent from './CollapsibleReplyContent'
import ReplyFrame from './ReplyFrame'
import {
  Avatar,
  Button,
  ConfirmPopover,
  Empty,
  Pagination,
  Spinner,
  Tooltip,
  Toast
} from '@/components/ui'
import { mergeClassNames } from '@/components/ui/utils'
import ReplyComposer, { type ReplyComposerHandle } from './ReplyComposer'
import MemberQuickInfoHoverLayer from './MemberQuickInfoHoverLayer'
import MemberQuickInfoPopover from './MemberQuickInfoPopover'
import ReplyLoginPrompt from './ReplyLoginPrompt'
import { FloatingActions, floatingActionStyles } from './FloatingActions'
import ReplyList, { type ReplyDecorations } from './ReplyList'
import { replyThreadStyleLabels } from './replyTree'
import type { OpenTopicPreview } from '@/core/contentEnhancement'
import type { TopicReply } from '@extension/v2ex/types'
import type { TopicDetailController } from './useTopicDetailController'

/** 话题详情视图属性 */
export interface TopicDetailViewProps {
  /** 话题详情交互控制器 */
  controller: TopicDetailController
  /** 外层容器类名 */
  className?: string
  /** 页面滚动容器 */
  scrollContainerRef?: RefObject<HTMLElement | null>
  /** 悬浮操作挂载容器，省略时定位到页面视口 */
  floatingActionsContainer?: HTMLElement | null
  /** 是否显示回复框或未登录提示 */
  showReplyComposer?: boolean
  /** 是否显示右侧悬浮操作 */
  showFloatingActions?: boolean
  /** 是否显示正文后的主题工具栏 */
  showTopicToolbar?: boolean
  /** 是否显示感谢回复和快捷回复操作 */
  showReplyActions?: boolean
  /** 打开站内话题预览 */
  onTopicPreview: OpenTopicPreview
  /** 主面板作者操作入口 */
  authorActions?: ReactNode
  /** 打开话题分享图 */
  onShare?: () => void
  /** 打开话题 AI 总结 */
  onSummarize?: () => void
  hasCachedSummary?: boolean
}

/**
 * 完整话题详情视图
 */
export default function TopicDetailView({
  controller,
  className = 'topic-container',
  scrollContainerRef,
  floatingActionsContainer,
  showReplyComposer = true,
  showFloatingActions = true,
  showTopicToolbar = true,
  showReplyActions = true,
  onTopicPreview,
  onShare,
  onSummarize,
  hasCachedSummary,
  authorActions
}: TopicDetailViewProps) {
  const { topic, showImages, showAvatar, canOperate } = controller
  const [infoTopicId, setInfoTopicId] = useState<number>()
  const [loadingReplyPage, setLoadingReplyPage] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [cancelingCollect, setCancelingCollect] = useState(false)
  const [updatingIgnore, setUpdatingIgnore] = useState(false)
  const [thankingTopic, setThankingTopic] = useState(false)
  const [pendingThankReplyIds, setPendingThankReplyIds] = useState<string[]>([])
  const replyComposerRef = useRef<ReplyComposerHandle>(null)
  /** 话题详情根节点，供内容区用户链接悬停浮层委托事件 */
  const [topicRoot, setTopicRoot] = useState<HTMLElement | null>(null)
  const floatingActions = showFloatingActions ? (
    <FloatingActions contained={Boolean(floatingActionsContainer)}>
      {renderTopicActionButtons('floating')}
      {onSummarize && (
        <Tooltip
          className={floatingActionStyles.tooltip}
          content={hasCachedSummary ? '查看 AI 总结' : '生成 AI 总结'}
          side="left"
        >
          <Button
            aria-label={hasCachedSummary ? '查看 AI 总结' : '生成 AI 总结'}
            className={floatingActionStyles.button}
            icon={
              <Sparkles
                aria-hidden="true"
                className={hasCachedSummary ? floatingActionStyles.iconHighlighted : undefined}
              />
            }
            size="large"
            variant="ghost"
            onClick={onSummarize}
          />
        </Tooltip>
      )}
      {onShare && (
        <Tooltip className={floatingActionStyles.tooltip} content="生成分享图" side="left">
          <Button
            aria-label="生成分享图"
            className={floatingActionStyles.button}
            icon={<Share2 aria-hidden="true" />}
            size="large"
            variant="ghost"
            onClick={onShare}
          />
        </Tooltip>
      )}
      <Tooltip className={floatingActionStyles.tooltip} content="滚动到顶部" side="left">
        <Button
          aria-label="滚动到顶部"
          className={floatingActionStyles.button}
          icon={<ArrowUp aria-hidden="true" />}
          size="large"
          variant="ghost"
          onClick={scrollToTop}
        />
      </Tooltip>
      <Tooltip className={floatingActionStyles.tooltip} content="滚动到底部" side="left">
        <Button
          aria-label="滚动到底部"
          className={floatingActionStyles.button}
          icon={<ArrowDown aria-hidden="true" />}
          size="large"
          variant="ghost"
          onClick={scrollToBottom}
        />
      </Tooltip>
    </FloatingActions>
  ) : null

  /** 刷新话题 */
  async function refreshTopic() {
    await controller.refresh()
  }

  /** 收藏话题 */
  async function collectTopic() {
    await controller.collect()
  }

  /** 取消收藏话题 */
  async function cancelCollectTopic() {
    await controller.cancelCollect()
  }

  /** 忽略话题 */
  async function ignoreTopic() {
    await controller.ignore()
  }

  /** 取消忽略话题 */
  async function cancelIgnoreTopic() {
    await controller.cancelIgnore()
  }

  /** 感谢主题创建者 */
  async function thankTopic() {
    await controller.thankTopic()
  }

  /** 提交话题回复 */
  async function postReply(content: string, parentReplyId?: string) {
    await controller.postReply(content, parentReplyId)
  }

  /** 加载回复页 */
  async function loadReplyPage(replyPage: number) {
    if (replyPage === topic.replyCurrentPage) {
      return
    }

    setLoadingReplyPage(true)
    try {
      await controller.loadReplyPage(replyPage)
      scrollContainerRef?.current?.querySelector('.reply')?.scrollIntoView({ block: 'start' })
    } catch (err) {
      Toast.error((err as Error).message || '评论加载失败')
    } finally {
      setLoadingReplyPage(false)
    }
  }

  /**
   * 执行话题操作
   * @param task 请求任务
   * @param setLoading 加载状态更新函数
   */
  async function requestTopicAction(
    task: () => Promise<void>,
    setLoading: (loading: boolean) => void
  ) {
    setLoading(true)
    try {
      await task()
    } catch (err) {
      Toast.error((err as Error).message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  /** 感谢回复者 */
  async function thankReply(replyId: string) {
    setPendingThankReplyIds(current => [...current, replyId])
    try {
      await controller.thankReply(replyId)
    } catch (err) {
      Toast.error((err as Error).message || '操作失败')
    } finally {
      setPendingThankReplyIds(current => current.filter(id => id !== replyId))
    }
  }

  /** 快捷回复楼层 */
  function floorReply(reply: TopicReply) {
    replyComposerRef.current?.replyTo(reply)
  }

  /** 渲染用户链接和快速信息 */
  function renderMemberLink(username: string, isTopicAuthor = false) {
    const link = (
      <a
        className={`user ${isTopicAuthor ? 'text-bold' : ''}`}
        href="javascript:;"
        onClick={event => {
          event.preventDefault()
          event.stopPropagation()
          void controller.openMember(username)
        }}
      >
        {username}
      </a>
    )

    return (
      <MemberQuickInfoPopover
        username={username}
        loadMemberInfo={controller.loadMemberQuickInfo}
        blockMember={controller.blockMember}
        unblockMember={controller.unblockMember}
        openMember={username => void controller.openMember(username)}
      >
        {link}
      </MemberQuickInfoPopover>
    )
  }

  /** 渲染用户头像和快速信息 */
  function renderMemberAvatar(
    username: string,
    avatar: string,
    size: 'small' | 'default' | 'large'
  ) {
    return (
      <MemberQuickInfoPopover
        username={username}
        loadMemberInfo={controller.loadMemberQuickInfo}
        blockMember={controller.blockMember}
        unblockMember={controller.unblockMember}
        openMember={username => void controller.openMember(username)}
      >
        <button
          type="button"
          className="member-avatar-button"
          aria-label={`打开 ${username} 的用户资料`}
          onClick={() => void controller.openMember(username)}
        >
          <Avatar
            className="member-avatar"
            size={size}
            shape="square"
            src={avatar}
            alt={username}
            fallback={<UserRound aria-hidden="true" />}
          />
        </button>
      </MemberQuickInfoPopover>
    )
  }

  /** 渲染回复正文，布局与官方关联交由 ReplyList 统一管理 */
  function renderReply(reply: TopicReply, decorations: ReplyDecorations) {
    const displayContent = decorations.content
    return (
      <ReplyFrame
        avatar={
          showAvatar ? renderMemberAvatar(reply.userName, reply.userAvatar, 'small') : undefined
        }
        author={renderMemberLink(reply.userName)}
        metadata={
          <>
            <UserBadge mod={reply.isMod} op={reply.isOp} pro={reply.isPro} />
            {decorations.beforeTime}
            <TimeWithSource
              className="time"
              time={reply.time}
              title={reply.repliedAt || reply.time}
              via={reply.via}
            />
            {decorations.meta}
            {reply.thanks > 0 && (
              <span className="thanks" title={`${reply.thanks} 人感谢`}>
                <Heart aria-hidden="true" />
                {reply.thanks}
              </span>
            )}
          </>
        }
        actions={
          <>
            {renderReplyActions(reply)}
            <span className="floor">{reply.floor}</span>
          </>
        }
      >
        {decorations.before}
        <CollapsibleReplyContent contentKey={displayContent} showImages={showImages}>
          <EnhancedHtmlContent
            className="topic-content reply-content"
            html={displayContent}
            showImages={showImages}
            onTopicPreview={onTopicPreview}
          />
        </CollapsibleReplyContent>
        {decorations.after}
      </ReplyFrame>
    )
  }

  /** 滚动到帖子顶部 */
  function scrollToTop() {
    scrollContainerRef?.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** 滚动到帖子底部 */
  function scrollToBottom() {
    const container = scrollContainerRef?.current
    container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }

  /** 渲染回复操作 */
  function renderReplyActions(reply: TopicReply) {
    if (!canOperate || !showReplyActions) {
      return null
    }

    return (
      <>
        {reply.thanked ? (
          <Tooltip content="感谢已发送">
            <span className="reply-thanked" aria-label="感谢已发送">
              <Heart aria-hidden="true" fill="currentColor" />
            </span>
          </Tooltip>
        ) : (
          <ConfirmPopover
            tooltip="感谢回复者"
            title={`确认花费 10 个铜币向 @${reply.userName} 的这条回复发送感谢？`}
            cancelText="取消"
            onConfirm={() => thankReply(reply.replyId)}
          >
            <Button
              aria-label="感谢回复者"
              className="reply-action-button"
              icon={<Heart aria-hidden="true" />}
              loading={pendingThankReplyIds.includes(reply.replyId)}
              size="small"
              variant="ghost"
            />
          </ConfirmPopover>
        )}
        {showReplyComposer && (
          <Tooltip content="回复">
            <Button
              aria-label="回复"
              className="reply-action-button"
              icon={<Reply aria-hidden="true" />}
              size="small"
              variant="ghost"
              onClick={() => floorReply(reply)}
            />
          </Tooltip>
        )}
      </>
    )
  }

  /** 渲染主题操作按钮 */
  function renderTopicActionButtons(variant: 'toolbar' | 'floating') {
    const isFloating = variant === 'floating'
    const buttonSize = isFloating ? 'large' : 'small'
    const floatingButtonClass = floatingActionStyles.button
    const floatingTooltipClass = floatingActionStyles.tooltip
    const refreshButton = (
      <Button
        aria-label="刷新页面"
        className={isFloating ? floatingButtonClass : undefined}
        icon={isFloating ? <RefreshCw aria-hidden="true" /> : undefined}
        loading={refreshing}
        size={buttonSize}
        variant={isFloating ? 'ghost' : 'subtle'}
        onClick={() => void requestTopicAction(refreshTopic, setRefreshing)}
      >
        {isFloating ? null : '刷新页面'}
      </Button>
    )

    const thankAction = (
      <ConfirmPopover
        tooltip={isFloating ? '感谢主题创建者' : undefined}
        tooltipProps={{ className: floatingTooltipClass, side: 'left' }}
        title="你确定要向本主题创建者发送谢意？"
        cancelText="取消"
        onConfirm={() => requestTopicAction(thankTopic, setThankingTopic)}
      >
        <Button
          aria-label="感谢主题创建者"
          className={isFloating ? floatingButtonClass : undefined}
          icon={<Heart aria-hidden="true" />}
          loading={thankingTopic}
          size={buttonSize}
          variant={isFloating ? 'ghost' : 'subtle'}
        >
          {isFloating ? null : '感谢'}
        </Button>
      </ConfirmPopover>
    )

    return (
      <>
        {isFloating && (
          <Tooltip className={floatingTooltipClass} content="刷新页面" side="left">
            {refreshButton}
          </Tooltip>
        )}

        {canOperate && (
          <>
            {!topic.isCollected ? (
              isFloating ? (
                <Tooltip className={floatingTooltipClass} content="加入收藏" side="left">
                  <Button
                    aria-label="加入收藏"
                    className={floatingButtonClass}
                    icon={<BookmarkPlus aria-hidden="true" />}
                    loading={collecting}
                    size={buttonSize}
                    variant="ghost"
                    onClick={() => void requestTopicAction(collectTopic, setCollecting)}
                  />
                </Tooltip>
              ) : (
                <Button
                  aria-label="加入收藏"
                  icon={<BookmarkPlus aria-hidden="true" />}
                  loading={collecting}
                  size={buttonSize}
                  variant="subtle"
                  onClick={() => void requestTopicAction(collectTopic, setCollecting)}
                >
                  加入收藏
                </Button>
              )
            ) : isFloating ? (
              <Tooltip className={floatingTooltipClass} content="取消收藏" side="left">
                <Button
                  aria-label="取消收藏"
                  className={mergeClassNames(
                    floatingButtonClass,
                    floatingActionStyles.buttonActive
                  )}
                  icon={<Bookmark aria-hidden="true" fill="currentColor" />}
                  loading={cancelingCollect}
                  size={buttonSize}
                  variant="ghost"
                  onClick={() => void requestTopicAction(cancelCollectTopic, setCancelingCollect)}
                />
              </Tooltip>
            ) : (
              <Button
                aria-label="取消收藏"
                icon={<Bookmark aria-hidden="true" fill="currentColor" />}
                loading={cancelingCollect}
                size={buttonSize}
                variant="subtle"
                onClick={() => void requestTopicAction(cancelCollectTopic, setCancelingCollect)}
              >
                取消收藏
              </Button>
            )}

            {!isFloating && topic.canIgnore && (
              <ConfirmPopover
                title={topic.isIgnored ? '确定撤销对这个主题的忽略？' : '确定不想再看到这个主题？'}
                cancelText="取消"
                onConfirm={() =>
                  requestTopicAction(
                    topic.isIgnored ? cancelIgnoreTopic : ignoreTopic,
                    setUpdatingIgnore
                  )
                }
              >
                <Button
                  aria-label={topic.isIgnored ? '取消忽略' : '忽略主题'}
                  icon={
                    topic.isIgnored ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />
                  }
                  loading={updatingIgnore}
                  size={buttonSize}
                  variant="subtle"
                >
                  {topic.isIgnored ? '取消忽略' : '忽略主题'}
                </Button>
              </ConfirmPopover>
            )}

            {topic.canThank && !topic.isThanked && thankAction}

            {topic.canThank &&
              topic.isThanked &&
              (isFloating ? (
                <Tooltip className={floatingTooltipClass} content="感谢已发送" side="left">
                  <Button
                    aria-label="感谢已发送"
                    className={mergeClassNames(
                      floatingButtonClass,
                      floatingActionStyles.buttonActive
                    )}
                    disabled
                    icon={<Heart aria-hidden="true" fill="currentColor" />}
                    size="large"
                    variant="ghost"
                  />
                </Tooltip>
              ) : (
                <span className="topic-action-status">
                  <Heart aria-hidden="true" fill="currentColor" />
                  感谢已发送
                </span>
              ))}
          </>
        )}
      </>
    )
  }

  return (
    <>
      {infoTopicId === topic.id && (
        <TopicInfoDialog
          key={topic.id}
          topicId={topic.id}
          onClose={() => setInfoTopicId(undefined)}
        />
      )}
      <article ref={setTopicRoot} className={className}>
        <header className="topic-header">
          <h1>{topic.title}</h1>
          {showAvatar && renderMemberAvatar(topic.authorName, topic.authorAvatar, 'large')}
        </header>

        <div className="topic-meta">
          <NodeButton className="topic-node-tag" onClick={() => void controller.openNode()}>
            {topic.node.title}
          </NodeButton>
          {renderMemberLink(topic.authorName, true)}
          <UserBadge pro={topic.isAuthorPro} />
          <span className="time">
            <TimeWithSource
              time={topic.displayTime}
              title={topic.publishedAt || topic.displayTime}
              via={topic.via}
            />
            <span>· {topic.visitCount} 次点击</span>
          </span>
          {topic.canViewInfo && canOperate && (
            <Tooltip content="帖子信息">
              <Button
                className="topic-info-button"
                compact
                aria-label="帖子信息"
                icon={<Info aria-hidden="true" />}
                size="small"
                variant="ghost"
                onClick={() => setInfoTopicId(topic.id)}
              />
            </Tooltip>
          )}
          {authorActions}
          {!!topic.tags.length && (
            <div className="topic-tags" aria-label="帖子标签">
              {topic.tags.map(tag => (
                <Button
                  className="topic-tag"
                  icon={<Tag className="topic-tag-icon" aria-hidden="true" />}
                  key={tag}
                  size="small"
                  variant="subtle"
                  onClick={() => void controller.openTag(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          )}
        </div>

        <hr className="topic-divider topic-divider--content-start" />

        {topic.outdatedNotice && <p className="topic-outdated-notice">{topic.outdatedNotice}</p>}

        {topic.content ? (
          <EnhancedHtmlContent
            as="section"
            className="topic-content"
            html={topic.content}
            showImages={showImages}
            onTopicPreview={onTopicPreview}
          />
        ) : (
          <section className="topic-empty-content">
            <Empty
              title="正文无内容"
              description="这个话题没有填写正文，可以直接查看回复"
              icon={<Inbox aria-hidden="true" />}
            />
          </section>
        )}

        {showTopicToolbar && (canOperate || onShare) && (
          <div className="topic-toolbar">
            {renderTopicActionButtons('toolbar')}
            {onShare && (
              <Button
                aria-label="生成分享图"
                icon={<Share2 aria-hidden="true" />}
                size="small"
                variant="subtle"
                onClick={onShare}
              >
                分享
              </Button>
            )}
            <span className="toolbar-count">
              {topic.visitCount} 次点击
              {!!topic.collectCount && ` · ${topic.collectCount} 人收藏`}
              {!!topic.thankCount && ` · ${topic.thankCount} 人感谢`}
            </span>
          </div>
        )}

        {!!topic.appends.length && <hr className="topic-divider topic-divider--append-start" />}

        {topic.appends.map((append, index) => (
          <div className="topic-append" key={`append-${index}`}>
            <section className="topic-content append">
              <h2 className="append-heading">
                <span>第 {index + 1} 条附言</span>
                {append.time && <span className="append-time">{append.time}</span>}
              </h2>
              <EnhancedHtmlContent
                html={append.content}
                showImages={showImages}
                onTopicPreview={onTopicPreview}
              />
            </section>
          </div>
        ))}

        <hr className="topic-divider topic-divider--reply-start" />

        <section className="reply">
          {!!topic.replies.length && (
            <div className="reply-heading">
              <h2>共 {topic.replyCount} 条回复</h2>
              <div className="reply-heading-actions">
                {loadingReplyPage && (
                  <Spinner className="reply-loading-spinner" aria-label="加载回复" />
                )}
                <span className="thread-mode-label">
                  当前模式：{replyThreadStyleLabels[topic.replyThreadStyle]}
                  <Tooltip content="前往官网设置回复显示方式" side="bottom">
                    <a
                      className="thread-mode-settings"
                      href={resolveWebviewUrl('https://www.v2ex.com/settings#reply_thread_style')}
                      aria-label="前往官网设置回复显示方式"
                      onClick={event => handleWebviewLinkClick(event)}
                    >
                      <Settings aria-hidden="true" />
                    </a>
                  </Tooltip>
                </span>
              </div>
            </div>
          )}

          {!topic.replies.length && (
            <div className="reply-empty-state">
              <Empty
                title="还没有人回复"
                description={
                  canOperate
                    ? '来聊聊你的看法，成为第一个参与讨论的人'
                    : '登录后即可参与讨论，成为第一个回复的人'
                }
                icon={<Inbox aria-hidden="true" />}
              />
            </div>
          )}

          {topic.replyTotalPage > 1 && (
            <Pagination
              className="reply-pagination reply-pagination--top"
              page={topic.replyCurrentPage}
              disabled={loadingReplyPage}
              hideOnSinglePage
              showQuickJumper
              totalPages={topic.replyTotalPage}
              onPageChange={page => void loadReplyPage(page)}
            />
          )}

          <ReplyList
            key={topic.id}
            topicId={topic.id}
            replies={topic.replies}
            style={topic.replyThreadStyle}
            showAvatar={showAvatar}
            showImages={showImages}
            onTopicPreview={onTopicPreview}
            onLoadPage={controller.loadReplyPage}
            locateReplyId={controller.postedReplyId}
            renderReply={renderReply}
          />

          {topic.replyTotalPage > 1 && (
            <Pagination
              className="reply-pagination reply-pagination--bottom"
              page={topic.replyCurrentPage}
              disabled={loadingReplyPage}
              hideOnSinglePage
              showQuickJumper
              totalPages={topic.replyTotalPage}
              onPageChange={page => void loadReplyPage(page)}
            />
          )}
        </section>

        {showReplyComposer &&
          (canOperate ? (
            <ReplyComposer
              showAvatar={showAvatar}
              mentionUsers={[
                { name: topic.authorName, avatar: topic.authorAvatar },
                ...topic.replies.map(reply => ({ name: reply.userName, avatar: reply.userAvatar }))
              ]}
              ref={replyComposerRef}
              showImages={showImages}
              resetKey={topic.id}
              draftKey={`${className}:${topic.id}`}
              onSubmit={postReply}
            />
          ) : (
            <ReplyLoginPrompt
              refreshing={refreshing}
              onLogin={() =>
                void requestTopicAction(
                  () => controller.login(),
                  () => undefined
                )
              }
              onRefresh={() => void requestTopicAction(refreshTopic, setRefreshing)}
            />
          ))}
      </article>

      <MemberQuickInfoHoverLayer
        container={topicRoot}
        scrollContainerRef={scrollContainerRef}
        dismissKey={`${topic.id}:${topic.replyCurrentPage}`}
        loadMemberInfo={controller.loadMemberQuickInfo}
        blockMember={controller.blockMember}
        unblockMember={controller.unblockMember}
        openMember={username => void controller.openMember(username)}
      />

      {floatingActionsContainer && floatingActions
        ? createPortal(floatingActions, floatingActionsContainer)
        : floatingActions}
    </>
  )
}
