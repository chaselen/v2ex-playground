import { useEffect, useState, type MouseEvent } from 'react'
import { Avatar, Badge, Button, Empty, Progress, Spin, Tabs } from '@douyinfe/semi-ui'
import { IconHelpCircle, IconUser } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import SimpleBar from 'simplebar-react'
import { postVsCodeMessage, requestVsCodeMessage } from '../shared/vscode'
import LoginPrompt from './LoginPrompt'
import MainPagination from './MainPagination'
import TopicRow from './TopicRow'
import type {
  MyContentTabKey,
  MyNotificationListData,
  MyTopicListData,
  WebviewAccountOverview,
  WebviewNotification,
  WebviewTopic
} from '../../../src/shared/webview'
import { normalizeHtml } from '../shared/topicContent'

interface MyAccountPanelProps {
  /** 是否加载中 */
  loading?: boolean
  /** 是否已登录 */
  loggedIn: boolean
  /** 账户概览 */
  overview?: WebviewAccountOverview
  /** 打开节点收藏 */
  onOpenNodeCollection: () => void
}

/** 收藏统计字段 */
type AccountStatKey = 'nodeCollectionCount' | 'topicCollectionCount' | 'specialFollowingCount'

/** 收藏统计项 */
const statItems: Array<{
  key: AccountStatKey
  label: string
  target: 'nodes' | MyContentTopicTabKey
}> = [
  { key: 'nodeCollectionCount', label: '节点收藏', target: 'nodes' },
  { key: 'topicCollectionCount', label: '主题收藏', target: 'topicCollection' },
  { key: 'specialFollowingCount', label: '特别关注', target: 'specialFollowing' }
]

/** 我的主题内容标签 key */
type MyContentTopicTabKey = Extract<MyContentTabKey, 'topicCollection' | 'specialFollowing'>

/** 我的主题列表状态 */
interface MyTopicListState {
  /** 是否加载中 */
  loading: boolean
  /** 是否已加载 */
  loaded: boolean
  /** 当前页码 */
  page: number
  /** 总页数 */
  totalPage: number
  /** 话题列表 */
  topics: WebviewTopic[]
  /** 错误文案 */
  error: string | null
}

/** 我的主题列表状态映射 */
type MyTopicListsState = Record<MyContentTopicTabKey, MyTopicListState>

/** 我的消息列表状态 */
interface MyNotificationListState {
  /** 是否加载中 */
  loading: boolean
  /** 是否已加载 */
  loaded: boolean
  /** 当前页码 */
  page: number
  /** 总页数 */
  totalPage: number
  /** 消息总数 */
  totalCount: number
  /** 消息列表 */
  notifications: WebviewNotification[]
  /** 错误文案 */
  error: string | null
}

/** 创建我的主题列表状态 */
function createMyTopicListState(): MyTopicListState {
  return {
    loading: false,
    loaded: false,
    page: 1,
    totalPage: 1,
    topics: [],
    error: null
  }
}

/** 创建我的消息列表状态 */
function createMyNotificationListState(): MyNotificationListState {
  return {
    loading: false,
    loaded: false,
    page: 1,
    totalPage: 1,
    totalCount: 0,
    notifications: [],
    error: null
  }
}

/**
 * 打开 V2EX 链接
 * @param path 目标路径
 */
function openExternal(path: string) {
  postVsCodeMessage('openExternal', { path })
}

/**
 * 账户概览面板
 * @param props 组件参数
 */
export default function MyAccountPanel(props: MyAccountPanelProps) {
  const { loading, loggedIn, overview, onOpenNodeCollection } = props
  const [activeContentTab, setActiveContentTab] = useState<MyContentTabKey>('topicCollection')
  const [topicLists, setTopicLists] = useState<MyTopicListsState>({
    topicCollection: createMyTopicListState(),
    specialFollowing: createMyTopicListState()
  })
  const [notificationList, setNotificationList] = useState<MyNotificationListState>(
    createMyNotificationListState
  )

  useEffect(() => {
    if (!loggedIn) {
      return
    }

    if (activeContentTab === 'messages') {
      if (!notificationList.loaded && !notificationList.loading) {
        loadMyNotifications(1)
      }
      return
    }

    const state = topicLists[activeContentTab]
    if (state.loaded || state.loading) {
      return
    }

    loadMyTopics(activeContentTab, 1)
  }, [activeContentTab, loggedIn, notificationList.loaded, notificationList.loading])

  /**
   * 加载我的主题列表
   * @param tab 我的主题内容标签 key
   * @param page 页码
   */
  async function loadMyTopics(tab: MyContentTopicTabKey, page: number) {
    setTopicLists(current => ({
      ...current,
      [tab]: {
        ...current[tab],
        loading: true,
        error: null
      }
    }))

    try {
      const data = await requestVsCodeMessage('getMyTopics', { tab, page })
      onMyTopicListLoaded(data)
    } catch (err) {
      setTopicLists(current => ({
        ...current,
        [tab]: {
          ...current[tab],
          loading: false,
          loaded: true,
          error: (err as Error).message
        }
      }))
    }
  }

  /**
   * 处理我的主题列表加载结果
   * @param data 我的主题列表数据
   */
  function onMyTopicListLoaded(data: MyTopicListData) {
    setTopicLists(current => ({
      ...current,
      [data.tab]: {
        loading: false,
        loaded: true,
        page: data.page || 1,
        totalPage: data.totalPage || 1,
        topics: data.topics || [],
        error: null
      }
    }))
  }

  /**
   * 加载我的消息列表
   * @param page 页码
   */
  async function loadMyNotifications(page: number) {
    setNotificationList(current => ({
      ...current,
      loading: true,
      error: null
    }))

    try {
      const data = await requestVsCodeMessage('getMyNotifications', { page })
      onMyNotificationsLoaded(data)
    } catch (err) {
      setNotificationList(current => ({
        ...current,
        loading: false,
        loaded: true,
        error: (err as Error).message
      }))
    }
  }

  /**
   * 处理我的消息列表加载结果
   * @param data 我的消息列表数据
   */
  function onMyNotificationsLoaded(data: MyNotificationListData) {
    setNotificationList({
      loading: false,
      loaded: true,
      page: data.page || 1,
      totalPage: data.totalPage || 1,
      totalCount: data.totalCount || 0,
      notifications: data.notifications || [],
      error: null
    })
  }

  /**
   * 打开统计项
   * @param target 统计目标
   */
  function openStatTarget(target: 'nodes' | MyContentTopicTabKey) {
    if (target === 'nodes') {
      onOpenNodeCollection()
      return
    }

    setActiveContentTab(target)
  }

  /**
   * 打开我的消息
   */
  function openMessages() {
    setActiveContentTab('messages')
  }

  /**
   * 渲染主题行
   * @param topic 话题
   */
  function renderTopicItem(topic: WebviewTopic) {
    return (
      <TopicRow
        key={topic.id}
        topicId={topic.id}
        as="button"
        className="my-topic-item"
        title={topic.title}
        replies={topic.replies}
      />
    )
  }

  /**
   * 处理消息内容链接点击
   * @param event 鼠标事件
   * @param notification 提醒消息
   */
  function handleNotificationClick(
    event: MouseEvent<HTMLDivElement>,
    notification: WebviewNotification
  ) {
    const target = event.target instanceof Element ? event.target : null
    const anchor = target?.closest('a')

    if (!anchor) {
      return
    }

    event.preventDefault()
    const href = anchor.getAttribute('href') || ''

    if (anchor.classList.contains('topic-link') && notification.topicId) {
      postVsCodeMessage('openTopic', {
        topicId: notification.topicId,
        title: notification.topicTitle || anchor.textContent || ''
      })
      return
    }

    if (href) {
      openExternal(href)
    }
  }

  /**
   * 渲染消息行
   * @param notification 提醒消息
   */
  function renderNotificationItem(notification: WebviewNotification) {
    return (
      <div className="my-notification-item" key={notification.id}>
        <button
          type="button"
          className="my-link my-notification-avatar-link"
          title={notification.username}
          onClick={() =>
            openExternal(notification.memberPath || `/member/${notification.username}`)
          }
        >
          <Avatar
            size="extra-extra-small"
            shape="square"
            src={notification.avatar}
            alt={notification.username}
            className="my-notification-avatar"
          >
            <IconUser />
          </Avatar>
        </button>
        <div
          className="my-notification-body"
          onClick={event => handleNotificationClick(event, notification)}
        >
          <div className="my-notification-meta">
            <span dangerouslySetInnerHTML={{ __html: normalizeHtml(notification.summaryHtml) }} />
            {!!notification.time && <time>{notification.time}</time>}
          </div>
          {!!notification.payloadHtml && (
            <div
              className="my-notification-payload"
              dangerouslySetInnerHTML={{ __html: normalizeHtml(notification.payloadHtml) }}
            />
          )}
        </div>
      </div>
    )
  }

  /**
   * 渲染我的主题列表
   * @param tab 我的主题内容标签 key
   * @param emptyTitle 空状态标题
   */
  function renderMyTopicList(tab: MyContentTopicTabKey, emptyTitle: string) {
    const state = topicLists[tab]
    const totalCount = tab === 'topicCollection' ? overview?.topicCollectionCount : undefined

    if (state.loading && !state.loaded) {
      return (
        <div className="my-content-state">
          <Spin size="middle" />
        </div>
      )
    }

    if (state.error) {
      return (
        <div className="my-content-state">
          <Empty
            title="加载失败"
            description={state.error}
            image={<IllustrationNoContent className="empty-illustration" />}
            darkModeImage={<IllustrationNoContentDark className="empty-illustration" />}
          />
          <Button size="small" onClick={() => loadMyTopics(tab, state.page)}>
            重试
          </Button>
        </div>
      )
    }

    if (!state.topics.length) {
      return (
        <div className="my-content-state">
          <Empty
            title={emptyTitle}
            image={<IllustrationNoContent className="empty-illustration" />}
            darkModeImage={<IllustrationNoContentDark className="empty-illustration" />}
          />
        </div>
      )
    }

    return (
      <>
        <div className="my-topic-list">{state.topics.map(renderTopicItem)}</div>
        {state.totalPage > 1 && (
          <div className="my-content-pagination">
            <MainPagination
              currentPage={state.page}
              totalPage={state.totalPage}
              totalCount={totalCount}
              disabled={state.loading}
              onPageChange={page => {
                if (page !== state.page) {
                  loadMyTopics(tab, page)
                }
              }}
            />
          </div>
        )}
      </>
    )
  }

  function renderMessages() {
    const state = notificationList

    if (state.loading && !state.loaded) {
      return (
        <div className="my-content-state">
          <Spin size="middle" />
        </div>
      )
    }

    if (state.error) {
      return (
        <div className="my-content-state">
          <Empty
            title="加载失败"
            description={state.error}
            image={<IllustrationNoContent className="empty-illustration" />}
            darkModeImage={<IllustrationNoContentDark className="empty-illustration" />}
          />
          <Button size="small" onClick={() => loadMyNotifications(state.page)}>
            重试
          </Button>
        </div>
      )
    }

    if (!state.notifications.length) {
      return (
        <div className="my-content-state">
          <Empty
            title="暂无消息"
            image={<IllustrationNoContent className="empty-illustration" />}
            darkModeImage={<IllustrationNoContentDark className="empty-illustration" />}
          />
        </div>
      )
    }

    return (
      <>
        <div className="my-notification-list">
          {state.notifications.map(renderNotificationItem)}
        </div>
        {state.totalPage > 1 && (
          <div className="my-content-pagination">
            <MainPagination
              currentPage={state.page}
              totalPage={state.totalPage}
              totalCount={state.totalCount}
              disabled={state.loading}
              onPageChange={page => {
                if (page !== state.page) {
                  loadMyNotifications(page)
                }
              }}
            />
          </div>
        )}
      </>
    )
  }

  if (loading) {
    return (
      <section className="my-panel">
        <div className="loading-panel">
          <Spin size="middle" />
        </div>
      </section>
    )
  }

  if (!loggedIn) {
    return (
      <section className="my-panel">
        <LoginPrompt />
      </section>
    )
  }

  if (!overview) {
    return (
      <section className="my-panel">
        <div className="empty-panel">
          <Empty
            title="暂无账户概览"
            image={<IllustrationNoContent className="empty-illustration" />}
            darkModeImage={<IllustrationNoContentDark className="empty-illustration" />}
          />
        </div>
      </section>
    )
  }

  /** 活跃度百分比 */
  const activityPercent = Math.min(Math.max(overview.activityPercent, 0), 100)

  return (
    <section className="my-panel">
      <SimpleBar className="my-scroll" autoHide={false}>
        <article className="my-card">
          <header className="my-profile">
            <button
              type="button"
              className="my-link my-avatar-link"
              title={overview.username}
              onClick={() => openExternal(`/member/${overview.username}`)}
            >
              <Avatar
                size="large"
                shape="square"
                src={overview.avatar}
                alt={overview.username}
                className="my-avatar"
              >
                <IconUser />
              </Avatar>
            </button>
            <button
              type="button"
              className="my-link my-identity"
              title={overview.username}
              onClick={() => openExternal(`/member/${overview.username}`)}
            >
              {overview.username}
            </button>
          </header>

          <div className="my-stats">
            {statItems.map(item => (
              <button
                type="button"
                className="my-link my-stat"
                key={item.key}
                onClick={() => openStatTarget(item.target)}
              >
                <strong>{overview[item.key]}</strong>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="my-activity">
            <Progress
              percent={activityPercent}
              showInfo
              format={() => `${overview.activityPercent}%`}
              stroke="#f59e0b"
              orbitStroke="color-mix(in srgb, #f59e0b 18%, var(--v2ex-widget-bg))"
              style={{ height: 6 }}
              className="my-activity-progress"
              aria-label="活跃度"
            />
          </div>

          <footer className="my-wallet">
            <button type="button" className="my-link my-notice" onClick={openMessages}>
              {overview.unreadNoticeCount} 未读提醒
            </button>
            <button
              type="button"
              className="my-link my-balance"
              aria-label="账户余额"
              onClick={() => openExternal('/balance')}
            >
              <span>{overview.gold}</span>
              <i className="my-coin my-coin--gold" />
              <span>{overview.silver}</span>
              <i className="my-coin my-coin--silver" />
              <span>{overview.bronze}</span>
              <i className="my-coin my-coin--bronze" />
            </button>
            <button
              type="button"
              className="my-link my-help"
              aria-label="余额说明"
              onClick={() => openExternal('/help/currency')}
            >
              <IconHelpCircle className="my-help-icon" />
            </button>
          </footer>
        </article>

        <section className="my-content">
          <Tabs
            activeKey={activeContentTab}
            type="button"
            size="small"
            className="my-content-tabs"
            tabPaneMotion={false}
            onChange={value => setActiveContentTab(value as MyContentTabKey)}
          >
            <Tabs.TabPane itemKey="topicCollection" tab="主题收藏">
              {renderMyTopicList('topicCollection', '暂无收藏主题')}
            </Tabs.TabPane>
            <Tabs.TabPane itemKey="specialFollowing" tab="特别关注">
              {renderMyTopicList('specialFollowing', '暂无特别关注')}
            </Tabs.TabPane>
            <Tabs.TabPane
              itemKey="messages"
              tab={
                <span className="my-message-tab">
                  <span>消息</span>
                  {!!overview.unreadNoticeCount && (
                    <Badge
                      count={overview.unreadNoticeCount}
                      overflowCount={99}
                      countClassName="topic-badge-count"
                    />
                  )}
                </span>
              }
            >
              {renderMessages()}
            </Tabs.TabPane>
          </Tabs>
        </section>
      </SimpleBar>
    </section>
  )
}
