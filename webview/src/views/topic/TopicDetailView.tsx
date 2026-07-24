import { useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  BookmarkPlus,
  Heart,
  Inbox,
  RefreshCw,
  Reply,
  Share2,
  Tag,
  UserRound
} from 'lucide-react'
import EnhancedHtmlContent from '@/components/EnhancedHtmlContent'
import NodeButton from '@/components/NodeButton'
import UserBadge from '@/components/UserBadge'
import {
  Avatar,
  Button,
  ConfirmPopover,
  Empty,
  Pagination,
  RadioGroup,
  RadioGroupItem,
  Spinner,
  Tooltip,
  Toast
} from '@/components/ui'
import { mergeClassNames } from '@/components/ui/utils'
import ReplyComposer, { type ReplyComposerHandle } from './ReplyComposer'
import MemberQuickInfoPopover from './MemberQuickInfoPopover'
import ReplyLoginPrompt from './ReplyLoginPrompt'
import { FloatingActions, floatingActionStyles } from './FloatingActions'
import { buildReplyTree, type ReplyViewMode, type TopicReplyNode } from './replyTree'
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
  /** 是否显示回复展示模式切换 */
  showReplyViewSwitch?: boolean
  /** 是否显示感谢回复和快捷回复操作 */
  showReplyActions?: boolean
  /** 初始回复展示模式 */
  initialReplyViewMode?: ReplyViewMode
  /** 回复展示模式变化 */
  onReplyViewModeChange?: (mode: ReplyViewMode) => void
  /** 打开站内话题预览 */
  onTopicPreview: OpenTopicPreview
  /** 打开话题分享图 */
  onShare?: () => void
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
  showReplyViewSwitch = true,
  showReplyActions = true,
  initialReplyViewMode = 'nested',
  onReplyViewModeChange,
  onTopicPreview,
  onShare
}: TopicDetailViewProps) {
  const { topic, showImages, showAvatar, canOperate } = controller
  const [loadingReplyPage, setLoadingReplyPage] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [cancelingCollect, setCancelingCollect] = useState(false)
  const [thankingTopic, setThankingTopic] = useState(false)
  const [pendingThankReplyIds, setPendingThankReplyIds] = useState<string[]>([])
  const [replyViewMode, setReplyViewMode] = useState<ReplyViewMode>(initialReplyViewMode)
  const replyComposerRef = useRef<ReplyComposerHandle>(null)
  const replyTree = useMemo(() => buildReplyTree(topic.replies), [topic.replies])
  const replies =
    replyViewMode === 'nested'
      ? replyTree
      : topic.replies.map(reply => ({ ...reply, children: [] }))
  const floatingActions = showFloatingActions ? (
    <FloatingActions contained={Boolean(floatingActionsContainer)}>
      {renderTopicActionButtons('floating')}
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

  /** 感谢主题创建者 */
  async function thankTopic() {
    await controller.thankTopic()
  }

  /** 提交话题回复 */
  async function postReply(content: string) {
    await controller.postReply(content)
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
    replyComposerRef.current?.setContent(`@${reply.userName} #${reply.floor} `)
  }

  /** 切换回复列表展示模式 */
  function changeReplyViewMode(mode: ReplyViewMode) {
    setReplyViewMode(mode)
    onReplyViewModeChange?.(mode)
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

  /** 渲染单条回复及其子回复 */
  function renderReply(reply: TopicReplyNode) {
    return (
      <div className="reply-item" key={reply.replyId}>
        <div className="reply-layout">
          {showAvatar && renderMemberAvatar(reply.userName, reply.userAvatar, 'small')}
          <div className="reply-body">
            <div className="reply-meta">
              {renderMemberLink(reply.userName)}
              <UserBadge mod={reply.isMod} op={reply.isOp} pro={reply.isPro} />
              <span className="time" title={reply.repliedAt || reply.time}>
                {reply.time}
              </span>
              {reply.thanks > 0 && (
                <span className="thanks" title={`${reply.thanks} 人感谢`}>
                  <Heart aria-hidden="true" />
                  {reply.thanks}
                </span>
              )}
              <div className="reply-actions">
                {renderReplyActions(reply)}
                <span className="floor">{reply.floor}</span>
              </div>
            </div>
            <EnhancedHtmlContent
              className="topic-content reply-content"
              html={reply.content}
              showImages={showImages}
              onTopicPreview={onTopicPreview}
            />
          </div>
        </div>
        {replyViewMode === 'nested' && reply.children.length > 0 && (
          <div className="reply-children">{reply.children.map(child => renderReply(child))}</div>
        )}
      </div>
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
            title={`确认花费 10 个铜币向 @${reply.userName} 的这条回复发送感谢？`}
            confirmText="确认"
            cancelText="取消"
            onConfirm={() => thankReply(reply.replyId)}
          >
            <span className="reply-action-popconfirm-trigger">
              <Tooltip content="感谢回复者">
                <Button
                  aria-label="感谢回复者"
                  className="reply-action-button"
                  icon={<Heart aria-hidden="true" />}
                  loading={pendingThankReplyIds.includes(reply.replyId)}
                  size="small"
                  variant="ghost"
                />
              </Tooltip>
            </span>
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

    return (
      <>
        {isFloating ? (
          <Tooltip className={floatingTooltipClass} content="刷新页面" side="left">
            {refreshButton}
          </Tooltip>
        ) : (
          refreshButton
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
                loading={cancelingCollect}
                size={buttonSize}
                variant="subtle"
                onClick={() => void requestTopicAction(cancelCollectTopic, setCancelingCollect)}
              >
                取消收藏
              </Button>
            )}

            {topic.canThank && !topic.isThanked && (
              <ConfirmPopover
                title="你确定要向本主题创建者发送谢意？"
                confirmText="确认"
                cancelText="取消"
                onConfirm={() => requestTopicAction(thankTopic, setThankingTopic)}
              >
                <span className={isFloating ? floatingActionStyles.popconfirmTrigger : undefined}>
                  {isFloating ? (
                    <Tooltip className={floatingTooltipClass} content="感谢主题创建者" side="left">
                      <Button
                        aria-label="感谢主题创建者"
                        className={floatingButtonClass}
                        icon={<Heart aria-hidden="true" />}
                        loading={thankingTopic}
                        size={buttonSize}
                        variant="ghost"
                      />
                    </Tooltip>
                  ) : (
                    <Button
                      aria-label="感谢主题创建者"
                      loading={thankingTopic}
                      size={buttonSize}
                      variant="subtle"
                    >
                      感谢
                    </Button>
                  )}
                </span>
              </ConfirmPopover>
            )}

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
      <article className={className}>
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
            <span title={topic.publishedAt || topic.displayTime}>{topic.displayTime}</span> ·{' '}
            {topic.visitCount} 次点击
          </span>
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

        {showTopicToolbar && canOperate && (
          <div className="topic-toolbar">
            {renderTopicActionButtons('toolbar')}
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
                {showReplyViewSwitch && (
                  <RadioGroup
                    aria-label="回复列表展示模式"
                    className="reply-view-switch"
                    variant="segmented"
                    value={replyViewMode}
                    onValueChange={value => changeReplyViewMode(value as ReplyViewMode)}
                  >
                    <RadioGroupItem value="flat" label="普通列表" />
                    <RadioGroupItem
                      value="nested"
                      label="楼中楼"
                      badge="BETA"
                      badgeVariant="danger"
                    />
                  </RadioGroup>
                )}
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

          {replies.map(reply => renderReply(reply))}

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
              ref={replyComposerRef}
              showImages={showImages}
              resetKey={topic.id}
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

      {floatingActionsContainer && floatingActions
        ? createPortal(floatingActions, floatingActionsContainer)
        : floatingActions}
    </>
  )
}
