import { useId, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  Badge,
  Button,
  Divider,
  Empty,
  Pagination,
  Popconfirm,
  Radio,
  RadioGroup,
  Spin,
  Toast,
  Tooltip
} from '@douyinfe/semi-ui'
import {
  IconArrowDown,
  IconArrowUp,
  IconBookmark,
  IconBookmarkAddStroked,
  IconHeartStroked,
  IconLikeHeart,
  IconLockStroked,
  IconPriceTag,
  IconRefresh,
  IconReply,
  IconUserCircleStroked
} from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import EnhancedHtmlContent from '@/components/EnhancedHtmlContent'
import NodeButton from '@/components/NodeButton'
import { VscodeProTag } from '@/components/SemiVscode'
import ReplyComposer, { type ReplyComposerHandle } from './ReplyComposer'
import MemberQuickInfoPopover from './MemberQuickInfoPopover'
import { buildReplyTree, type TopicReplyNode } from './replyTree'
import type { OpenTopicPreview } from '@/core/contentEnhancement'
import type { TopicReply } from '@extension/v2ex/types'
import type { TopicDetailController } from './useTopicDetailController'

/** 回复列表展示模式 */
export type ReplyViewMode = 'flat' | 'nested'

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
  /** 打开站内话题预览 */
  onTopicPreview: OpenTopicPreview
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
  onTopicPreview
}: TopicDetailViewProps) {
  const { topic, showImages, canOperate } = controller
  const [loadingReplyPage, setLoadingReplyPage] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [cancelingCollect, setCancelingCollect] = useState(false)
  const [thankingTopic, setThankingTopic] = useState(false)
  const [pendingThankReplyIds, setPendingThankReplyIds] = useState<string[]>([])
  const [replyViewMode, setReplyViewMode] = useState<ReplyViewMode>(initialReplyViewMode)
  const replyComposerRef = useRef<ReplyComposerHandle>(null)
  const replyViewModeName = useId()
  const replyTree = useMemo(() => buildReplyTree(topic.replies), [topic.replies])
  const replies =
    replyViewMode === 'nested'
      ? replyTree
      : topic.replies.map(reply => ({ ...reply, children: [] }))
  const floatingActions = showFloatingActions ? (
    <div className="floating-actions" aria-label="话题快捷操作">
      {renderTopicActionButtons('floating')}
      <Tooltip content="滚动到顶部" position="left">
        <Button
          aria-label="滚动到顶部"
          className="floating-action-button"
          icon={<IconArrowUp />}
          size="large"
          theme="solid"
          type="tertiary"
          onClick={scrollToTop}
        />
      </Tooltip>
      <Tooltip content="滚动到底部" position="left">
        <Button
          aria-label="滚动到底部"
          className="floating-action-button"
          icon={<IconArrowDown />}
          size="large"
          theme="solid"
          type="tertiary"
          onClick={scrollToBottom}
        />
      </Tooltip>
    </div>
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

  /** 渲染用户链接和快速信息 */
  function renderMemberLink(username: string, isReplyAuthor = false, isTopicAuthor = false) {
    const link = (
      <a
        className={`user ${isReplyAuthor ? 'user--author' : ''} ${isTopicAuthor ? 'text-bold' : ''}`}
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

  /** 渲染单条回复及其子回复 */
  function renderReply(reply: TopicReplyNode) {
    return (
      <div className="reply-item" key={reply.replyId}>
        <div className="reply-body">
          <div className="reply-meta">
            {renderMemberLink(reply.userName, topic.authorName === reply.userName)}
            <span className="time" title={reply.repliedAt || reply.time}>
              {reply.time}
            </span>
            {reply.thanks > 0 && <span className="thanks">♥ {reply.thanks}</span>}
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
          <span className="thanked">感谢已发送</span>
        ) : (
          <Popconfirm
            title={`确认花费 10 个铜币向 @${reply.userName} 的这条回复发送感谢？`}
            okText="确认"
            cancelText="取消"
            onConfirm={() => thankReply(reply.replyId)}
          >
            <span className="reply-action-popconfirm-trigger">
              <Tooltip content="感谢回复者">
                <Button
                  aria-label="感谢回复者"
                  className="reply-action-button"
                  icon={<IconHeartStroked />}
                  loading={pendingThankReplyIds.includes(reply.replyId)}
                  size="small"
                  theme="borderless"
                  type="tertiary"
                />
              </Tooltip>
            </span>
          </Popconfirm>
        )}
        {showReplyComposer && (
          <Tooltip content="回复">
            <Button
              aria-label="回复"
              className="reply-action-button"
              icon={<IconReply />}
              size="small"
              theme="borderless"
              type="tertiary"
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
    const buttonTheme = isFloating ? 'solid' : 'light'
    const buttonType = isFloating ? 'tertiary' : 'secondary'
    const refreshButton = (
      <Button
        aria-label="刷新页面"
        className={isFloating ? 'floating-action-button' : undefined}
        icon={isFloating ? <IconRefresh /> : undefined}
        loading={refreshing}
        size={buttonSize}
        theme={buttonTheme}
        type={buttonType}
        onClick={() => void requestTopicAction(refreshTopic, setRefreshing)}
      >
        {isFloating ? null : '刷新页面'}
      </Button>
    )

    return (
      <>
        {isFloating ? (
          <Tooltip content="刷新页面" position="left">
            {refreshButton}
          </Tooltip>
        ) : (
          refreshButton
        )}

        {canOperate && (
          <>
            {!topic.isCollected ? (
              isFloating ? (
                <Tooltip content="加入收藏" position="left">
                  <Button
                    aria-label="加入收藏"
                    className="floating-action-button"
                    icon={<IconBookmarkAddStroked />}
                    loading={collecting}
                    size={buttonSize}
                    theme={buttonTheme}
                    type={buttonType}
                    onClick={() => void requestTopicAction(collectTopic, setCollecting)}
                  />
                </Tooltip>
              ) : (
                <Button
                  aria-label="加入收藏"
                  loading={collecting}
                  size={buttonSize}
                  theme={buttonTheme}
                  type={buttonType}
                  onClick={() => void requestTopicAction(collectTopic, setCollecting)}
                >
                  加入收藏
                </Button>
              )
            ) : isFloating ? (
              <Tooltip content="取消收藏" position="left">
                <Button
                  aria-label="取消收藏"
                  className="floating-action-button is-active"
                  icon={<IconBookmark />}
                  loading={cancelingCollect}
                  size={buttonSize}
                  theme={buttonTheme}
                  type={buttonType}
                  onClick={() => void requestTopicAction(cancelCollectTopic, setCancelingCollect)}
                />
              </Tooltip>
            ) : (
              <Button
                aria-label="取消收藏"
                loading={cancelingCollect}
                size={buttonSize}
                theme={buttonTheme}
                type={buttonType}
                onClick={() => void requestTopicAction(cancelCollectTopic, setCancelingCollect)}
              >
                取消收藏
              </Button>
            )}

            {topic.canThank && !topic.isThanked && (
              <Popconfirm
                title="你确定要向本主题创建者发送谢意？"
                okText="确认"
                cancelText="取消"
                onConfirm={() => requestTopicAction(thankTopic, setThankingTopic)}
              >
                <span className={isFloating ? 'floating-action-popconfirm-trigger' : undefined}>
                  {isFloating ? (
                    <Tooltip content="感谢主题创建者" position="left">
                      <Button
                        aria-label="感谢主题创建者"
                        className="floating-action-button"
                        icon={<IconHeartStroked />}
                        loading={thankingTopic}
                        size={buttonSize}
                        theme={buttonTheme}
                        type={buttonType}
                      />
                    </Tooltip>
                  ) : (
                    <Button
                      aria-label="感谢主题创建者"
                      loading={thankingTopic}
                      size={buttonSize}
                      theme={buttonTheme}
                      type={buttonType}
                    >
                      感谢
                    </Button>
                  )}
                </span>
              </Popconfirm>
            )}

            {topic.canThank &&
              topic.isThanked &&
              (isFloating ? (
                <Tooltip content="感谢已发送" position="left">
                  <Button
                    aria-label="感谢已发送"
                    className="floating-action-button is-active"
                    disabled
                    icon={<IconLikeHeart />}
                    size="large"
                    theme="solid"
                    type="tertiary"
                  />
                </Tooltip>
              ) : (
                <span className="toolbar-text">感谢已发送</span>
              ))}
          </>
        )}
      </>
    )
  }

  /** 渲染未登录回复提示 */
  function renderLoginReplyPrompt() {
    return (
      <section className="reply-login-prompt" aria-label="登录后回复">
        <div className="reply-login-icon">
          <IconLockStroked />
        </div>
        <div className="reply-login-content">
          <h2>登录后参与回复</h2>
          <p>登录 V2EX 账号后，才能回复话题、感谢回复者，并使用收藏等话题操作。</p>
        </div>
        <div className="reply-login-actions">
          <Button
            icon={<IconUserCircleStroked />}
            size="small"
            theme="solid"
            type="primary"
            onClick={() =>
              void requestTopicAction(
                () => controller.login(),
                () => undefined
              )
            }
          >
            登录 V2EX
          </Button>
          <Button
            icon={<IconRefresh />}
            loading={refreshing}
            size="small"
            theme="light"
            type="tertiary"
            onClick={() => void requestTopicAction(refreshTopic, setRefreshing)}
          >
            刷新
          </Button>
        </div>
      </section>
    )
  }

  return (
    <>
      <article className={className}>
        <header className="topic-header">
          <h1>{topic.title}</h1>
        </header>

        <div className="topic-meta">
          <NodeButton className="topic-node-tag" onClick={() => void controller.openNode()}>
            {topic.node.title}
          </NodeButton>
          {renderMemberLink(topic.authorName, false, true)}
          {topic.isAuthorPro && <VscodeProTag />}
          <span className="time">
            <span title={topic.publishedAt || topic.displayTime}>{topic.displayTime}</span> ·{' '}
            {topic.visitCount} 次点击
          </span>
          {!!topic.tags.length && (
            <div className="topic-tags" aria-label="帖子标签">
              {topic.tags.map(tag => (
                <Button
                  className="topic-tag"
                  icon={<IconPriceTag className="topic-tag-icon" />}
                  key={tag}
                  size="small"
                  type="tertiary"
                  onClick={() => void controller.openTag(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          )}
        </div>

        <Divider className="topic-divider topic-divider--content-start" />

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
              image={<IllustrationNoContent className="topic-empty-illustration" />}
              darkModeImage={<IllustrationNoContentDark className="topic-empty-illustration" />}
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

        {!!topic.appends.length && (
          <Divider className="topic-divider topic-divider--append-start" />
        )}

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

        <Divider className="topic-divider topic-divider--reply-start" />

        <section className="reply">
          {!!topic.replies.length && (
            <div className="reply-heading">
              <h2>共 {topic.replyCount} 条回复</h2>
              <div className="reply-heading-actions">
                {loadingReplyPage && <Spin size="small" />}
                {showReplyViewSwitch && (
                  <RadioGroup
                    aria-label="回复列表展示模式"
                    buttonSize="small"
                    className="reply-view-switch"
                    name={replyViewModeName}
                    type="button"
                    value={replyViewMode}
                    onChange={event => setReplyViewMode(event.target.value as ReplyViewMode)}
                  >
                    <Radio value="flat">普通列表</Radio>
                    <Radio value="nested">
                      <Badge
                        count="BETA"
                        countClassName="reply-view-beta"
                        position="rightTop"
                        theme="solid"
                        type="danger"
                      >
                        <span className="reply-view-nested-label">楼中楼</span>
                      </Badge>
                    </Radio>
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
                image={<IllustrationNoContent className="reply-empty-illustration" />}
                darkModeImage={<IllustrationNoContentDark className="reply-empty-illustration" />}
              />
            </div>
          )}

          {topic.replyTotalPage > 1 && (
            <Pagination
              className="reply-pagination reply-pagination--top"
              currentPage={topic.replyCurrentPage}
              disabled={loadingReplyPage}
              hideOnSinglePage
              pageSize={1}
              showQuickJumper
              showTotal
              total={topic.replyTotalPage}
              onPageChange={page => void loadReplyPage(page)}
            />
          )}

          {replies.map(reply => renderReply(reply))}

          {topic.replyTotalPage > 1 && (
            <Pagination
              className="reply-pagination reply-pagination--bottom"
              currentPage={topic.replyCurrentPage}
              disabled={loadingReplyPage}
              hideOnSinglePage
              pageSize={1}
              showQuickJumper
              showTotal
              total={topic.replyTotalPage}
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
            renderLoginReplyPrompt()
          ))}
      </article>

      {floatingActionsContainer && floatingActions
        ? createPortal(floatingActions, floatingActionsContainer)
        : floatingActions}
    </>
  )
}
