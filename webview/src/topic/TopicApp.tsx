import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Banner,
  Button,
  Divider,
  Empty,
  Pagination,
  Popconfirm,
  Spin,
  TextArea,
  Toast,
  Tooltip
} from '@douyinfe/semi-ui'
import { IconArrowDown, IconArrowUp, IconHeartStroked, IconReply } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import { enhanceHtmlContentAfterRender, normalizeHtml } from '@/shared/contentEnhancement'
import { createVsCodeClient, resolveWebviewUrl } from '@/shared/vscode'
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
    canOperate: false
  })
  const [replyContent, setReplyContent] = useState('')
  const [collecting, setCollecting] = useState(false)
  const [cancelingCollect, setCancelingCollect] = useState(false)
  const [thankingTopic, setThankingTopic] = useState(false)
  const [postingReply, setPostingReply] = useState(false)
  const [loadingReplyPage, setLoadingReplyPage] = useState(false)
  const [pendingThankReplyIds, setPendingThankReplyIds] = useState<string[]>([])
  const topicShellRef = useRef<HTMLElement>(null)
  const topic = state.topic
  const showImages = state.showImages !== false

  /** 话题正文内容 */
  const topicContentHtml = useMemo(() => normalizeHtml(topic?.content), [topic?.content])

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
    const content = replyContent.trim()

    if (!content) {
      Toast.warning('回复内容不能为空')
      requestAnimationFrame(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>('.post-reply textarea')
        textarea?.focus()
      })
      return
    }

    await requestTopicAction(
      () => vscode.postReply({ content }),
      setPostingReply,
      () => setReplyContent('')
    )
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
   * 快捷回复楼层
   * @param replyAuthor 回复作者
   * @param replyFloor 楼层
   */
  function floorReply(replyAuthor: string, replyFloor: string) {
    setReplyContent(`@${replyAuthor} #${replyFloor} `)
    requestAnimationFrame(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('.post-reply textarea')
      textarea?.focus()
    })
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
    const dispose = vscode.on('topicStateChanged', ({ state: nextState }) => {
      setState({
        topic: nextState.topic,
        message: nextState.message || '',
        showLogin: Boolean(nextState.showLogin),
        showRefresh: Boolean(nextState.showRefresh),
        showImages: nextState.showImages !== false,
        canOperate: Boolean(nextState.canOperate),
        status: nextState.status
      })
    })

    enhanceHtmlContentAfterRender(showImages)

    return dispose
  }, [])

  useEffect(() => {
    if (!topic) {
      return
    }
    enhanceHtmlContentAfterRender(showImages)
  }, [topic, showImages])

  return (
    <main className="topic-shell" ref={topicShellRef}>
      {state.status === 'loading' && (
        <div className="state-panel state-panel--loading">
          <Spin size="middle" />
          <span className="state-loading-text">加载中</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="state-panel">
          <Banner
            type="danger"
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
            <a
              className="user text-bold"
              href="javascript:;"
              onClick={() => openMember(topic.authorName)}
            >
              {topic.authorName}
            </a>
            <span className="time">
              {topic.displayTime} · {topic.visitCount} 次点击
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
              <Button size="small" type="secondary" onClick={() => vscode.refresh()}>
                刷新页面
              </Button>
              {!topic.isCollected ? (
                <Button
                  size="small"
                  type="secondary"
                  loading={collecting}
                  onClick={() => requestTopicAction(() => vscode.collect(), setCollecting)}
                >
                  加入收藏
                </Button>
              ) : (
                <Button
                  size="small"
                  type="secondary"
                  loading={cancelingCollect}
                  onClick={() =>
                    requestTopicAction(() => vscode.cancelCollect(), setCancelingCollect)
                  }
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
                  <Button size="small" type="secondary" loading={thankingTopic}>
                    感谢
                  </Button>
                </Popconfirm>
              )}
              {topic.canThank && topic.isThanked && (
                <span className="toolbar-text">感谢已发送</span>
              )}
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
            <div key={`append-${index}`}>
              <section className="topic-content append">
                <h2>
                  第 {index + 1} 条附言
                  {append.time && <span className="append-time"> · {append.time}</span>}
                </h2>
                <div dangerouslySetInnerHTML={{ __html: normalizeHtml(append.content) }} />
              </section>
              {index < topic.appends.length - 1 && (
                <Divider className="topic-divider topic-divider--append-end" />
              )}
            </div>
          ))}

          <Divider className="topic-divider topic-divider--reply-start" />

          <section className="reply">
            <div className="reply-heading">
              {topic.replies.length ? <h2>共 {topic.replyCount} 条回复</h2> : <h2>暂无回复</h2>}
              {loadingReplyPage && <Spin size="small" />}
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

            {topic.replies.map(reply => (
              <div key={reply.replyId} className="reply-item">
                <div className="reply-meta">
                  <a
                    className={`user ${topic.authorName === reply.userName ? 'user--author' : ''}`}
                    href="javascript:;"
                    onClick={() => openMember(reply.userName)}
                  >
                    {reply.userName}
                  </a>
                  <span className="time">{reply.time}</span>
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
                  className="topic-content"
                  dangerouslySetInnerHTML={{ __html: normalizeHtml(reply.content) }}
                />
              </div>
            ))}

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
            <form
              className="post-reply"
              onSubmit={event => {
                event.preventDefault()
                onSubmit()
              }}
            >
              <TextArea
                value={replyContent}
                maxCount={10000}
                autosize={{ minRows: 5, maxRows: 12 }}
                placeholder="请尽量让自己的回复能够对别人有帮助"
                showClear
                onChange={value => setReplyContent(String(value || ''))}
              />
              <Button
                className="submit"
                theme="solid"
                type="primary"
                htmlType="submit"
                loading={postingReply}
              >
                回复
              </Button>
            </form>
          ) : (
            <p className="muted">您目前还不能回复，请先登录</p>
          )}
        </article>
      )}

      {state.status === 'topic' && topic && (
        <div className="scroll-actions">
          <Button
            aria-label="滚动到顶部"
            className="scroll-action-button"
            icon={<IconArrowUp />}
            size="large"
            theme="solid"
            type="tertiary"
            onClick={scrollToTop}
          />
          <Button
            aria-label="滚动到底部"
            className="scroll-action-button"
            icon={<IconArrowDown />}
            size="large"
            theme="solid"
            type="tertiary"
            onClick={scrollToBottom}
          />
        </div>
      )}
    </main>
  )
}
