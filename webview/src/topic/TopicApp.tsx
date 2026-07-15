import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Banner,
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
  IconRefresh,
  IconReply,
  IconUserCircleStroked
} from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import { enhanceHtmlContentAfterRender, normalizeHtml } from '@/shared/contentEnhancement'
import PageSkeleton from '@/shared/PageSkeleton'
import { VscodeProTag } from '@/shared/SemiVscode'
import TopicShareContextMenu from '@/shared/TopicShareContextMenu'
import { createVsCodeClient, resolveWebviewUrl, subscribeWebviewState } from '@/shared/vscode'
import ReplyComposer, { type ReplyComposerHandle, type ReplyComposerMode } from './ReplyComposer'
import { replaceImageEmoticonTokens } from './emoticons'
import { buildReplyTree, type TopicReplyNode } from './replyTree'
import MemberQuickInfoPopover from './MemberQuickInfoPopover'
import type {
  TopicPanelRpcCommands,
  TopicPanelViewState,
  TopicPanelWebviewEvents
} from '@extension/shared/webview'

/** 话题面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<TopicPanelRpcCommands, TopicPanelWebviewEvents>()

type ReplyViewMode = 'flat' | 'nested'

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
    canOperate: false
  })
  const [replyContent, setReplyContent] = useState('')
  const [collecting, setCollecting] = useState(false)
  const [cancelingCollect, setCancelingCollect] = useState(false)
  const [thankingTopic, setThankingTopic] = useState(false)
  const [postingReply, setPostingReply] = useState(false)
  const [loadingReplyPage, setLoadingReplyPage] = useState(false)
  const [replyComposerMode, setReplyComposerMode] = useState<ReplyComposerMode>('edit')
  const [previewingReply, setPreviewingReply] = useState(false)
  const [replyPreviewHtml, setReplyPreviewHtml] = useState('')
  const [replyPreviewSource, setReplyPreviewSource] = useState('')
  const [pendingThankReplyIds, setPendingThankReplyIds] = useState<string[]>([])
  const [replyViewMode, setReplyViewMode] = useState<ReplyViewMode>('nested')
  const topicShellRef = useRef<HTMLElement>(null)
  const replyComposerRef = useRef<ReplyComposerHandle>(null)
  const imgurImageFailureHandledRef = useRef(false)
  const topic = state.topic
  const showImages = state.showImages !== false

  /** 话题正文内容 */
  const topicContentHtml = useMemo(() => normalizeHtml(topic?.content), [topic?.content])

  /** 当前回复页的楼中楼结构 */
  const replyTree = useMemo(() => buildReplyTree(topic?.replies || []), [topic?.replies])

  /**
   * 在浏览器中打开链接
   * @param src 链接地址
   */
  function openExternal(src: string) {
    vscode.openExternal({ path: resolveWebviewUrl(src) })
  }

  /**
   * 打开用户页
   * @param username 用户名
   */
  function openMember(username: string) {
    vscode.openMember({ username })
  }

  /**
   * 加载用户快速信息
   * @param username 用户名
   */
  function loadMemberQuickInfo(username: string) {
    return vscode.loadMemberQuickInfo({ username })
  }

  /**
   * 滚动到帖子顶部
   */
  function scrollToTop() {
    topicShellRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /**
   * 滚动到帖子底部
   */
  function scrollToBottom() {
    const topicShell = topicShellRef.current

    topicShell?.scrollTo({ top: topicShell.scrollHeight, behavior: 'smooth' })
  }

  /**
   * 执行话题请求
   * @param task 请求任务
   * @param setLoading 加载状态更新函数
   * @param onSuccess 成功回调
   */
  async function requestTopicAction(
    task: () => Promise<void>,
    setLoading: (loading: boolean) => void,
    onSuccess?: () => void
  ) {
    setLoading(true)
    try {
      await task()
      onSuccess?.()
    } catch (err) {
      Toast.error((err as Error).message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 提交回复
   */
  async function onSubmit() {
    const content = replaceImageEmoticonTokens(replyContent)

    if (!content) {
      Toast.warning('回复内容不能为空')
      requestAnimationFrame(() => {
        replyComposerRef.current?.focus()
      })
      return
    }

    await requestTopicAction(
      () => vscode.postReply({ content }),
      setPostingReply,
      () => {
        setReplyContent('')
        setReplyPreviewHtml('')
        setReplyPreviewSource('')
        setReplyComposerMode('edit')
      }
    )
  }

  /**
   * 上传回复图片
   * @param file 图片文件
   */
  async function uploadReplyImage(file: File) {
    return vscode.uploadImage({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64: await readFileAsBase64(file)
    })
  }

  /** 检测 Imgur 连通性 */
  function checkImgurConnectivity(target: 'image' | 'upload', refresh = false) {
    return vscode.checkImgurConnectivity({ target, refresh })
  }

  /**
   * 读取文件为 base64 内容
   * @param file 文件对象
   */
  function readFileAsBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => {
        const result = String(reader.result || '')
        resolve(result.replace(/^data:[^,]*,/, ''))
      }
      reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * 更新回复内容
   * @param value 输入内容
   */
  function updateReplyContent(value: string) {
    setReplyContent(value)
    if (value !== replyPreviewSource) {
      setReplyPreviewHtml('')
    }
  }

  /**
   * 预览回复内容
   */
  async function previewReply() {
    const content = replyContent
    const previewContent = replaceImageEmoticonTokens(content)

    if (!content.trim()) {
      Toast.warning('回复内容不能为空')
      setReplyComposerMode('edit')
      requestAnimationFrame(() => {
        replyComposerRef.current?.focus()
      })
      return
    }

    if (replyPreviewHtml && replyPreviewSource === content) {
      setReplyComposerMode('preview')
      return
    }

    setReplyComposerMode('preview')
    setPreviewingReply(true)
    try {
      const html = await vscode.previewReply({ content: previewContent })
      setReplyPreviewHtml(html)
      setReplyPreviewSource(content)
    } catch (err) {
      Toast.error((err as Error).message || '预览失败')
      setReplyComposerMode('edit')
    } finally {
      setPreviewingReply(false)
    }
  }

  /**
   * 感谢回复者
   * @param replyId 回复 id
   */
  async function thankReply(replyId: string) {
    setPendingThankReplyIds(current => [...current, replyId])
    try {
      await vscode.thankReply({ replyId })
    } catch (err) {
      Toast.error((err as Error).message || '操作失败')
    } finally {
      setPendingThankReplyIds(current => current.filter(id => id !== replyId))
    }
  }

  /**
   * 感谢主题创建者
   */
  function thankTopic() {
    requestTopicAction(() => vscode.thank(), setThankingTopic)
  }

  /**
   * 收藏主题
   */
  function collectTopic() {
    requestTopicAction(() => vscode.collect(), setCollecting)
  }

  /**
   * 取消收藏主题
   */
  function cancelCollectTopic() {
    requestTopicAction(() => vscode.cancelCollect(), setCancelingCollect)
  }

  /**
   * 快捷回复楼层
   * @param replyAuthor 回复作者
   * @param replyFloor 楼层
   */
  function floorReply(replyAuthor: string, replyFloor: string) {
    setReplyContent(`@${replyAuthor} #${replyFloor} `)
    setReplyPreviewHtml('')
    setReplyComposerMode('edit')
    requestAnimationFrame(() => {
      replyComposerRef.current?.focus()
    })
  }

  /**
   * 渲染单条回复及其子回复
   * @param reply 回复节点
   */
  function renderReply(reply: TopicReplyNode) {
    return (
      <div key={reply.replyId} className="reply-item">
        <div className="reply-body">
          <div className="reply-meta">
            <MemberQuickInfoPopover
              username={reply.userName}
              loadMemberInfo={loadMemberQuickInfo}
              openMember={openMember}
            >
              <a
                className={`user ${topic?.authorName === reply.userName ? 'user--author' : ''}`}
                href="javascript:;"
                onClick={() => openMember(reply.userName)}
              >
                {reply.userName}
              </a>
            </MemberQuickInfoPopover>
            <span className="time" title={reply.repliedAt || reply.time}>
              {reply.time}
            </span>
            {reply.thanks > 0 && <span className="thanks">♥ {reply.thanks}</span>}
            <div className="reply-actions">
              {state.canOperate && (
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
                  <Tooltip content="回复">
                    <Button
                      aria-label="回复"
                      className="reply-action-button"
                      icon={<IconReply />}
                      size="small"
                      theme="borderless"
                      type="tertiary"
                      onClick={() => floorReply(reply.userName, reply.floor)}
                    />
                  </Tooltip>
                </>
              )}
              <span className="floor">{reply.floor}</span>
            </div>
          </div>
          <div
            className="topic-content reply-content"
            dangerouslySetInnerHTML={{ __html: normalizeHtml(reply.content) }}
          />
        </div>
        {replyViewMode === 'nested' && reply.children.length > 0 && (
          <div className="reply-children">{reply.children.map(child => renderReply(child))}</div>
        )}
      </div>
    )
  }

  /**
   * 加载回复页
   * @param replyPage 回复页码
   */
  async function loadReplyPage(replyPage: number) {
    if (!topic || replyPage === topic.replyCurrentPage) {
      return
    }

    await requestTopicAction(
      () => vscode.loadReplyPage({ replyPage }),
      setLoadingReplyPage,
      () => {
        document.querySelector('.reply')?.scrollIntoView({ block: 'start' })
      }
    )
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
        canOperate: Boolean(nextState.canOperate),
        status: nextState.status
      })
    }

    const dispose = subscribeWebviewState(
      handler => vscode.on('topicStateChanged', data => handler(data.state)),
      () => vscode.ready(),
      applyViewState
    )

    enhanceHtmlContentAfterRender(showImages)

    return dispose
  }, [])

  useEffect(() => {
    if (!topic) {
      return
    }
    enhanceHtmlContentAfterRender(showImages)
  }, [topic, showImages, replyViewMode])

  useEffect(() => {
    if (replyComposerMode !== 'preview' || !replyPreviewHtml) {
      return
    }
    enhanceHtmlContentAfterRender(showImages)
  }, [replyComposerMode, replyPreviewHtml, showImages])

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

  /**
   * 渲染主题操作按钮
   * @param variant 操作按钮形态
   */
  function renderTopicActionButtons(variant: 'toolbar' | 'floating') {
    if (!topic) {
      return null
    }

    const isFloating = variant === 'floating'
    const buttonSize = isFloating ? 'large' : 'small'
    const buttonTheme = isFloating ? 'solid' : 'light'
    const buttonType = isFloating ? 'tertiary' : 'secondary'
    const refreshButton = (
      <Button
        aria-label="刷新页面"
        className={isFloating ? 'floating-action-button' : undefined}
        icon={isFloating ? <IconRefresh /> : undefined}
        size={buttonSize}
        theme={buttonTheme}
        type={buttonType}
        onClick={() => vscode.refresh()}
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

        {state.canOperate && (
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
                    onClick={collectTopic}
                  />
                </Tooltip>
              ) : (
                <Button
                  aria-label="加入收藏"
                  loading={collecting}
                  size={buttonSize}
                  theme={buttonTheme}
                  type={buttonType}
                  onClick={collectTopic}
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
                  onClick={cancelCollectTopic}
                />
              </Tooltip>
            ) : (
              <Button
                aria-label="取消收藏"
                loading={cancelingCollect}
                size={buttonSize}
                theme={buttonTheme}
                type={buttonType}
                onClick={cancelCollectTopic}
              >
                取消收藏
              </Button>
            )}

            {topic.canThank && !topic.isThanked && (
              <Popconfirm
                title="你确定要向本主题创建者发送谢意？"
                okText="确认"
                cancelText="取消"
                onConfirm={thankTopic}
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

  /**
   * 渲染未登录回复提示
   */
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
            onClick={() => vscode.login()}
          >
            登录 V2EX
          </Button>
          <Button
            icon={<IconRefresh />}
            size="small"
            theme="light"
            type="tertiary"
            onClick={() => vscode.refresh()}
          >
            刷新
          </Button>
        </div>
      </section>
    )
  }

  const content = (
    <main className="topic-shell" ref={topicShellRef}>
      {state.status === 'loading' && <PageSkeleton variant="topic" />}

      {state.status === 'error' && (
        <div className="state-panel">
          <Banner
            type="danger"
            description={
              <div
                className="state-message"
                dangerouslySetInnerHTML={{ __html: normalizeHtml(state.message) }}
              />
            }
          />
          <div className="state-actions">
            {state.showLogin && (
              <Button size="small" type="primary" onClick={() => vscode.login()}>
                登录
              </Button>
            )}
            {state.showRefresh && (
              <Button size="small" theme="light" onClick={() => vscode.refresh()}>
                刷新页面
              </Button>
            )}
          </div>
        </div>
      )}

      {state.status === 'topic' && topic && (
        <article className="topic-container">
          <header className="topic-header">
            <h1>{topic.title}</h1>
          </header>

          <div className="topic-meta">
            <Button
              className="topic-node-tag"
              size="small"
              type="tertiary"
              onClick={() => vscode.openNode(topic.node)}
            >
              {topic.node.title}
            </Button>
            <MemberQuickInfoPopover
              username={topic.authorName}
              loadMemberInfo={loadMemberQuickInfo}
              openMember={openMember}
            >
              <a
                className="user text-bold"
                href="javascript:;"
                onClick={() => openMember(topic.authorName)}
              >
                {topic.authorName}
              </a>
            </MemberQuickInfoPopover>
            {topic.isAuthorPro && <VscodeProTag />}
            <span className="time">
              <span title={topic.publishedAt || topic.displayTime}>{topic.displayTime}</span> ·{' '}
              {topic.visitCount} 次点击
            </span>
          </div>

          <Divider className="topic-divider topic-divider--content-start" />

          {topic.content ? (
            <section
              className="topic-content"
              dangerouslySetInnerHTML={{ __html: topicContentHtml }}
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

          {state.canOperate && (
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
                <div dangerouslySetInnerHTML={{ __html: normalizeHtml(append.content) }} />
              </section>
            </div>
          ))}

          <Divider className="topic-divider topic-divider--reply-start" />

          <section className="reply">
            <div className="reply-heading">
              {topic.replies.length ? <h2>共 {topic.replyCount} 条回复</h2> : <h2>暂无回复</h2>}
              <div className="reply-heading-actions">
                {loadingReplyPage && <Spin size="small" />}
                {!!topic.replies.length && (
                  <RadioGroup
                    aria-label="回复列表展示模式"
                    buttonSize="small"
                    className="reply-view-switch"
                    name="reply-view-mode"
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
                onPageChange={loadReplyPage}
              />
            )}

            {(replyViewMode === 'nested'
              ? replyTree
              : topic.replies.map(reply => ({ ...reply, children: [] }))
            ).map(reply => renderReply(reply))}

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
                onPageChange={loadReplyPage}
              />
            )}
          </section>

          {state.canOperate ? (
            <ReplyComposer
              ref={replyComposerRef}
              value={replyContent}
              mode={replyComposerMode}
              previewHtml={replyPreviewHtml}
              previewing={previewingReply}
              posting={postingReply}
              onChange={updateReplyContent}
              onModeChange={setReplyComposerMode}
              onPreview={previewReply}
              onSubmit={onSubmit}
              onUploadImage={uploadReplyImage}
              onCheckImgurConnectivity={checkImgurConnectivity}
            />
          ) : (
            renderLoginReplyPrompt()
          )}
        </article>
      )}

      {state.status === 'topic' && topic && (
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
      )}
    </main>
  )

  return (
    <TopicShareContextMenu
      disabled={!topic}
      onCopyLink={() => vscode.copyLink()}
      onCopyTitleLink={() => vscode.copyTitleLink()}
      onViewInBrowser={() => vscode.viewInBrowser()}
    >
      {content}
    </TopicShareContextMenu>
  )
}
