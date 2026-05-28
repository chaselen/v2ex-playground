import { useEffect, useMemo, useState } from 'react'
import {
  Banner,
  Button,
  Divider,
  Popconfirm,
  Spin,
  TextArea,
  Toast,
  Tooltip
} from '@douyinfe/semi-ui'
import { IconHeartStroked, IconReply } from '@douyinfe/semi-icons'
import { enhanceTopicContentAfterRender, normalizeHtml } from '../shared/topicContent'
import { postVsCodeMessage, requestVsCodeMessage } from '../shared/vscode'
import type { TopicPanelViewState } from '../../../src/shared/webview'

/** 话题请求命令 */
type TopicRequestCommand = 'collect' | 'cancelCollect' | 'thank' | 'postReply'

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
  const [pendingThankReplyIds, setPendingThankReplyIds] = useState<string[]>([])
  const topic = state.topic
  const showImages = state.showImages !== false

  /** 话题正文内容 */
  const topicContentHtml = useMemo(() => normalizeHtml(topic?.content), [topic?.content])

  /**
   * 向扩展侧发送简单命令
   * @param command 命令名
   */
  function postCommand(command: string) {
    postVsCodeMessage(command)
  }

  /**
   * 在浏览器中打开链接
   * @param src 链接地址
   */
  function openExternal(src: string) {
    postVsCodeMessage('openExternal', { src: new URL(src, document.baseURI).toString() })
  }

  /**
   * 执行话题请求
   * @param command 命令名
   * @param setLoading 加载状态更新函数
   * @param payload 附加参数
   * @param onSuccess 成功回调
   */
  async function requestTopicAction(
    command: TopicRequestCommand,
    setLoading: (loading: boolean) => void,
    payload: object = {},
    onSuccess?: () => void
  ) {
    setLoading(true)
    try {
      await requestVsCodeMessage(command, payload)
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

    await requestTopicAction('postReply', setPostingReply, { content }, () => setReplyContent(''))
  }

  /**
   * 感谢回复者
   * @param replyId 回复 id
   */
  async function thankReply(replyId: string) {
    setPendingThankReplyIds(current => [...current, replyId])
    try {
      await requestVsCodeMessage('thankReply', { replyId })
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
    requestTopicAction('thank', setThankingTopic)
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

  useEffect(() => {
    /**
     * 处理扩展侧发送的视图状态
     * @param event 消息事件
     */
    function onMessage(event: MessageEvent<{ command?: string; state?: TopicPanelViewState }>) {
      if (event.data.command !== 'renderState' || !event.data.state) {
        return
      }

      const nextState = event.data.state
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

    window.addEventListener('message', onMessage)
    enhanceTopicContentAfterRender(showImages)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [])

  useEffect(() => {
    if (!topic) {
      return
    }
    enhanceTopicContentAfterRender(showImages)
  }, [topic, showImages])

  return (
    <main className="topic-shell">
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
              <Button size="small" type="primary" onClick={() => postCommand('login')}>
                登录
              </Button>
            )}
            {state.showRefresh && (
              <Button size="small" theme="light" onClick={() => postCommand('refresh')}>
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
              onClick={() => openExternal('/go/' + topic.node.name)}
            >
              {topic.node.title}
            </Button>
            <a
              className="user text-bold"
              href="javascript:;"
              onClick={() => openExternal('/member/' + topic.authorName)}
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
            <section className="topic-content muted">正文无内容</section>
          )}

          {state.canOperate && (
            <div className="topic-toolbar">
              <Button size="small" type="secondary" onClick={() => postCommand('refresh')}>
                刷新页面
              </Button>
              {!topic.isCollected ? (
                <Button
                  size="small"
                  type="secondary"
                  loading={collecting}
                  onClick={() => requestTopicAction('collect', setCollecting)}
                >
                  加入收藏
                </Button>
              ) : (
                <Button
                  size="small"
                  type="secondary"
                  loading={cancelingCollect}
                  onClick={() => requestTopicAction('cancelCollect', setCancelingCollect)}
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

          <Divider className="topic-divider topic-divider--reply-start" />

          {topic.appends.map((append, index) => (
            <div key={`append-${index}`}>
              <section className="topic-content append">
                <h2>第 {index + 1} 条附言</h2>
                <div dangerouslySetInnerHTML={{ __html: normalizeHtml(append.content) }} />
              </section>
              <Divider />
            </div>
          ))}

          <section className="reply">
            {topic.replies.length ? <h2>共 {topic.replyCount} 条回复</h2> : <h2>暂无回复</h2>}

            {topic.replies.map(reply => (
              <div key={reply.replyId} className="reply-item">
                <div className="reply-meta">
                  <a
                    className={`user ${topic.authorName === reply.userName ? 'user--author' : ''}`}
                    href="javascript:;"
                    onClick={() => openExternal('/member/' + reply.userName)}
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
    </main>
  )
}
