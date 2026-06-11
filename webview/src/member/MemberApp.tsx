import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Avatar, Banner, Button, Empty, Pagination, Spin, Tabs } from '@douyinfe/semi-ui'
import { IconRefresh, IconUser } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import SimpleBar from 'simplebar-react'
import type SimpleBarCore from 'simplebar-core'
import {
  enhanceTopicContentAfterRender,
  normalizeHtml,
  normalizeMemberContentLinks
} from '../shared/topicContent'
import { VscodeBadge, VscodeTag } from '../shared/SemiVscode'
import { createVsCodeClient, resolveWebviewUrl } from '../shared/vscode'
import type {
  MemberContentTabKey,
  MemberPanelRpcCommands,
  MemberPanelViewState,
  MemberPanelWebviewEvents,
  MemberProfile,
  MemberReply
} from '../../../src/shared/webview'

/** 用户面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<MemberPanelRpcCommands, MemberPanelWebviewEvents>()

/** 用户页请求命令 */
type MemberRequestCommand = 'loadMemberTab' | 'loadMemberPage'

/** 用户主题项 */
type MemberTopic = MemberProfile['content']['topics'][number]

/** 用户页固定标签 */
const memberTabs: Array<{ key: MemberContentTabKey; label: string }> = [
  { key: 'topics', label: '最近发帖' },
  { key: 'replies', label: '最近回复' },
  { key: 'qna', label: '提问' },
  { key: 'tech', label: '技术话题' },
  { key: 'play', label: '好玩' },
  { key: 'jobs', label: '工作信息' },
  { key: 'deals', label: '交易信息' },
  { key: 'city', label: '城市相关' }
]

/**
 * 用户页面应用
 */
export default function MemberApp() {
  const [state, setState] = useState<MemberPanelViewState>({
    status: 'loading',
    profile: undefined,
    message: '',
    showRefresh: false
  })
  const [activeTab, setActiveTab] = useState<MemberContentTabKey>('topics')
  const [loadingContent, setLoadingContent] = useState(false)
  const scrollRef = useRef<SimpleBarCore | null>(null)
  const profileCacheRef = useRef(new Map<string, MemberProfile>())
  const requestIdRef = useRef(0)
  const profile = state.profile

  /**
   * 缓存用户内容
   * @param profile 用户资料
   */
  function cacheProfile(profile: MemberProfile) {
    profileCacheRef.current.set(
      getProfileCacheKey(profile.content.tab, profile.content.page),
      profile
    )
  }

  /**
   * 刷新用户页
   */
  function refreshMember() {
    profileCacheRef.current.clear()
    vscode.refresh()
  }

  /**
   * 滚动到顶部
   */
  function scrollToTop() {
    scrollRef.current?.getScrollElement()?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /**
   * 执行用户页请求
   * @param command 命令名
   * @param tab 标签
   * @param page 页码
   */
  async function requestMemberContent(
    command: MemberRequestCommand,
    tab: MemberContentTabKey,
    page = 1
  ) {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const cachedProfile = profileCacheRef.current.get(getProfileCacheKey(tab, page))
    if (cachedProfile) {
      setLoadingContent(false)
      setState({
        status: 'member',
        profile: cachedProfile,
        message: '',
        showRefresh: true
      })
      scrollToTop()
      return cachedProfile
    }

    setLoadingContent(true)
    try {
      const nextProfile = await vscode[command]({ tab, page })
      if (requestId !== requestIdRef.current) {
        return undefined
      }

      cacheProfile(nextProfile)
      setState({
        status: 'member',
        profile: nextProfile,
        message: '',
        showRefresh: true
      })
      scrollToTop()
      return nextProfile
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingContent(false)
      }
    }
  }

  /**
   * 切换标签
   * @param tab 标签
   */
  async function changeTab(tab: MemberContentTabKey) {
    setActiveTab(tab)
    await requestMemberContent('loadMemberTab', tab, 1)
  }

  /**
   * 加载分页
   * @param page 页码
   */
  function loadPage(page: number) {
    requestMemberContent('loadMemberPage', activeTab, page).catch(err => console.error(err))
  }

  /**
   * 打开话题
   * @param topicId 话题 id
   * @param title 话题标题
   */
  function openTopic(topicId: number, title: string) {
    vscode.openTopic({ topicId, title })
  }

  /**
   * 打开用户
   * @param username 用户名
   */
  function openMember(username: string) {
    vscode.openMember({ username })
  }

  useEffect(() => {
    const dispose = vscode.on('memberStateChanged', ({ state: nextState }) => {
      setState({
        profile: nextState.profile,
        message: nextState.message || '',
        showRefresh: Boolean(nextState.showRefresh),
        status: nextState.status
      })
      if (nextState.profile?.content.tab) {
        cacheProfile(nextState.profile)
        setActiveTab(nextState.profile.content.tab)
      }
    })

    enhanceTopicContentAfterRender(true)

    return dispose
  }, [])

  useEffect(() => {
    if (!profile) {
      return
    }
    enhanceTopicContentAfterRender(true)
    scrollRef.current?.recalculate()
  }, [profile])

  return (
    <SimpleBar ref={scrollRef} className="member-scroll" role="main" autoHide={false}>
      {state.status === 'loading' && (
        <div className="member-state member-state--loading">
          <Spin size="middle" />
          <span>加载中</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="member-state">
          <Banner
            type="danger"
            title="加载失败"
            description={<div dangerouslySetInnerHTML={{ __html: normalizeHtml(state.message) }} />}
          />
          {state.showRefresh && (
            <div className="member-state-actions">
              <Button size="small" theme="light" icon={<IconRefresh />} onClick={refreshMember}>
                刷新页面
              </Button>
            </div>
          )}
        </div>
      )}

      {state.status === 'member' && profile && (
        <article className="member-container">
          <header className="member-profile">
            <Avatar
              size="large"
              shape="square"
              src={profile.member.avatar}
              alt={profile.member.username}
            >
              <IconUser />
            </Avatar>
            <div className="member-profile-main">
              <h1>{profile.member.username}</h1>
              <div className="member-meta">
                {!!profile.member.memberNumber && (
                  <VscodeTag>第 {profile.member.memberNumber} 号会员</VscodeTag>
                )}
                {!!profile.member.joinedAt && <span>加入于 {profile.member.joinedAt}</span>}
              </div>
              {!!profile.member.activityRank && (
                <div className="member-rank">活跃度排名 {profile.member.activityRank}</div>
              )}
            </div>
            <Button
              size="small"
              theme="borderless"
              icon={<IconRefresh />}
              onClick={refreshMember}
            />
          </header>

          <section className="member-content">
            <Tabs
              activeKey={activeTab}
              className="member-tabs"
              tabPaneMotion={false}
              onChange={value =>
                changeTab(value as MemberContentTabKey).catch(err => console.error(err))
              }
            >
              {memberTabs.map(tab => (
                <Tabs.TabPane itemKey={tab.key} tab={tab.label} key={tab.key}>
                  {tab.key === activeTab
                    ? renderContent(
                        profile,
                        activeTab,
                        loadingContent,
                        loadPage,
                        openTopic,
                        openMember
                      )
                    : null}
                </Tabs.TabPane>
              ))}
            </Tabs>
          </section>
        </article>
      )}
    </SimpleBar>
  )
}

/**
 * 获取用户内容缓存 key
 * @param tab 标签
 * @param page 页码
 */
function getProfileCacheKey(tab: MemberContentTabKey, page: number): string {
  return `${tab}:${page}`
}

/**
 * 渲染用户页内容
 * @param profile 用户资料
 * @param activeTab 当前标签
 * @param loading 是否加载中
 * @param loadPage 加载页码
 * @param openTopic 打开话题
 * @param openMember 打开用户
 */
function renderContent(
  profile: MemberProfile,
  activeTab: MemberContentTabKey,
  loading: boolean,
  loadPage: (page: number) => void,
  openTopic: (topicId: number, title: string) => void,
  openMember: (username: string) => void
) {
  const content = profile.content

  if (loading && content.tab !== activeTab) {
    return (
      <div className="member-content-state">
        <Spin size="middle" />
      </div>
    )
  }

  if (content.tab === 'replies') {
    return renderReplies(profile, loading, loadPage, openTopic, openMember)
  }

  return renderTopics(profile, loading, loadPage, openTopic, openMember)
}

/**
 * 渲染主题内容
 * @param profile 用户资料
 * @param loading 是否加载中
 * @param loadPage 加载页码
 * @param openTopic 打开话题
 * @param openMember 打开用户
 */
function renderTopics(
  profile: MemberProfile,
  loading: boolean,
  loadPage: (page: number) => void,
  openTopic: (topicId: number, title: string) => void,
  openMember: (username: string) => void
) {
  const content = profile.content

  if (!content.topics.length) {
    return (
      <div className="member-content-state">
        <Empty
          title={content.hidden ? '主题列表已隐藏' : '暂无主题'}
          description={content.hidden ? content.message : undefined}
          image={<IllustrationNoContent className="member-empty-illustration" />}
          darkModeImage={<IllustrationNoContentDark className="member-empty-illustration" />}
        />
      </div>
    )
  }

  return (
    <>
      <div className="member-topic-list">
        {content.topics.map(topic => renderTopicItem(topic, openTopic, openMember))}
      </div>
      {renderMemberPagination(content, loading, loadPage)}
    </>
  )
}

/**
 * 渲染回复内容
 * @param profile 用户资料
 * @param loading 是否加载中
 * @param loadPage 加载页码
 * @param openTopic 打开话题
 * @param openMember 打开用户
 */
function renderReplies(
  profile: MemberProfile,
  loading: boolean,
  loadPage: (page: number) => void,
  openTopic: (topicId: number, title: string) => void,
  openMember: (username: string) => void
) {
  const content = profile.content

  if (!content.replies.length) {
    return (
      <div className="member-content-state">
        <Empty
          title="暂无回复"
          image={<IllustrationNoContent className="member-empty-illustration" />}
          darkModeImage={<IllustrationNoContentDark className="member-empty-illustration" />}
        />
      </div>
    )
  }

  return (
    <>
      <div className="member-reply-list">
        {content.replies.map((reply, index) =>
          renderReplyItem(reply, index, openTopic, openMember)
        )}
      </div>
      {renderMemberPagination(content, loading, loadPage)}
    </>
  )
}

/**
 * 渲染用户内容分页
 * @param content 用户页内容
 * @param loading 是否加载中
 * @param loadPage 加载页码
 */
function renderMemberPagination(
  content: MemberProfile['content'],
  loading: boolean,
  loadPage: (page: number) => void
) {
  if (content.totalPage <= 1) {
    return null
  }

  return (
    <div className="member-pagination">
      <span className="member-pagination-summary">
        总条数：{content.totalCount.toLocaleString('en-US')}
      </span>
      <Pagination
        currentPage={content.page}
        disabled={loading}
        hideOnSinglePage
        pageSize={1}
        showQuickJumper
        total={content.totalPage}
        onPageChange={loadPage}
      />
    </div>
  )
}

/**
 * 渲染主题项
 * @param topic 主题
 * @param openTopic 打开话题
 * @param openMember 打开用户
 */
function renderTopicItem(
  topic: MemberTopic,
  openTopic: (topicId: number, title: string) => void,
  openMember: (username: string) => void
) {
  const lastReplyUser = topic.lastReplyUser

  return (
    <article className="member-topic-item" key={topic.id}>
      <span className="member-topic-main">
        <a
          className="member-topic-title"
          href="javascript:;"
          onClick={() => openTopic(topic.id, topic.title)}
        >
          {topic.title}
        </a>
        {!!topic.replies && (
          <VscodeBadge
            count={topic.replies}
            overflowCount={99}
            countClassName="member-topic-count"
          />
        )}
      </span>
      <span className="member-topic-meta">
        {!!topic.node.title && (
          <span className="member-topic-node" onClick={() => vscode.openNode(topic.node)}>
            <VscodeTag size="small">{topic.node.title}</VscodeTag>
          </span>
        )}
        {!!topic.displayTime && <span>{topic.displayTime}</span>}
        {!!lastReplyUser && (
          <span>
            最后回复{' '}
            <a href="javascript:;" onClick={() => openMember(lastReplyUser)}>
              {lastReplyUser}
            </a>
          </span>
        )}
      </span>
    </article>
  )
}

/**
 * 渲染回复项
 * @param reply 回复
 * @param index 序号
 * @param openTopic 打开话题
 * @param openMember 打开用户
 */
function renderReplyItem(
  reply: MemberReply,
  index: number,
  openTopic: (topicId: number, title: string) => void,
  openMember: (username: string) => void
) {
  const summaryHtml = normalizeMemberContentLinks(reply.summaryHtml)

  return (
    <article className="member-reply-item" key={`${reply.topicPath}-${index}`}>
      <header className="member-reply-meta">
        <div
          className="member-reply-summary"
          onClick={event => handleContentClick(event, reply, openTopic, openMember)}
          dangerouslySetInnerHTML={{ __html: summaryHtml }}
        />
        {!!reply.time && <time>{reply.time}</time>}
      </header>
      <div
        className="topic-content member-reply-content"
        onClick={event => handleContentClick(event, reply, openTopic, openMember)}
        dangerouslySetInnerHTML={{ __html: normalizeMemberContentLinks(reply.contentHtml) }}
      />
    </article>
  )
}

/**
 * 处理内容链接点击
 * @param event 鼠标事件
 * @param reply 回复
 * @param openTopic 打开话题
 * @param openMember 打开用户
 */
function handleContentClick(
  event: MouseEvent<HTMLElement>,
  reply: MemberReply,
  openTopic: (topicId: number, title: string) => void,
  openMember: (username: string) => void
) {
  const target = event.target instanceof Element ? event.target : null
  const anchor = target?.closest('a')

  if (!anchor) {
    return
  }

  const topicId = anchor.getAttribute('data-topic-id')
  const username = anchor.getAttribute('data-member-username')
  const nodeName = anchor.getAttribute('data-node-name')

  if (topicId) {
    event.preventDefault()
    openTopic(Number(topicId), anchor.textContent || reply.topicTitle)
    return
  }

  if (username) {
    event.preventDefault()
    openMember(username)
    return
  }

  if (nodeName) {
    event.preventDefault()
    vscode.openNode({ name: nodeName, title: anchor.textContent?.trim() || nodeName })
    return
  }

  const href = anchor.getAttribute('href') || ''
  const hrefNodeName = href.match(/\/go\/([A-Za-z0-9_-]+)/)?.[1]
  if (hrefNodeName) {
    event.preventDefault()
    vscode.openNode({
      name: decodeURIComponent(hrefNodeName),
      title: anchor.textContent?.trim() || decodeURIComponent(hrefNodeName)
    })
    return
  }

  if (href && href !== 'javascript:;') {
    event.preventDefault()
    vscode.openExternal({ path: resolveWebviewUrl(href) })
  }
}
