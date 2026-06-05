import { useEffect, useState, type MouseEvent } from 'react'
import { Avatar, Badge, Button, Empty, Progress, Spin, Tabs } from '@douyinfe/semi-ui'
import { IconGiftStroked, IconHelpCircle, IconTickCircle, IconUser } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import SimpleBar from 'simplebar-react'
import { postVsCodeMessage, requestVsCodeMessage } from '../../shared/vscode'
import LoginPrompt from './LoginPrompt'
import MainPagination from './MainPagination'
import TopicRow from './TopicRow'
import type {
  MyContentTabKey,
  MyNotificationListData,
  MyTopicListData,
  WebviewAccountOverview,
  WebviewDailySignInData,
  WebviewNotification,
  WebviewTopic
} from '../../../../src/shared/webview'
import { normalizeHtml } from '../../shared/topicContent'
import styles from './MyAccountPanel.module.scss'

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
 * 打开用户页
 * @param username 用户名
 */
function openMember(username: string) {
  postVsCodeMessage('openMember', { username })
}

/**
 * 判断消息是否为每日签到状态变化
 * @param msg 扩展侧消息
 */
function isDailySignInStatusChangedMessage(
  msg: unknown
): msg is WebviewDailySignInData & { command: 'dailySignInStatusChanged' } {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'command' in msg &&
    msg.command === 'dailySignInStatusChanged' &&
    'signedIn' in msg
  )
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
  const [dailySignedIn, setDailySignedIn] = useState(false)
  const [dailySignInLoading, setDailySignInLoading] = useState(false)

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

  useEffect(() => {
    let disposed = false

    if (!loggedIn) {
      setDailySignedIn(false)
      setDailySignInLoading(false)
      return
    }

    setDailySignInLoading(true)
    requestVsCodeMessage('getDailySignInStatus')
      .then(data => {
        if (!disposed) {
          setDailySignedIn(data.signedIn)
        }
      })
      .catch(err => console.error(err))
      .finally(() => {
        if (!disposed) {
          setDailySignInLoading(false)
        }
      })

    return () => {
      disposed = true
    }
  }, [loggedIn])

  useEffect(() => {
    /**
     * 处理扩展侧每日签到状态变化
     * @param event 消息事件
     */
    function onMessage(event: MessageEvent) {
      const msg = event.data
      if (isDailySignInStatusChangedMessage(msg)) {
        setDailySignedIn(msg.signedIn)
      }
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [])

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
   * 切换我的内容标签
   * @param tab 内容标签 key
   */
  function changeContentTab(tab: MyContentTabKey) {
    // 有未读提醒时强制刷新第一页，避免展示已缓存的旧消息
    if (tab === 'messages' && overview?.unreadNoticeCount && !notificationList.loading) {
      loadMyNotifications(1)
    }

    setActiveContentTab(tab)
  }

  /**
   * 执行每日签到
   */
  async function handleDailySignIn() {
    if (dailySignedIn || dailySignInLoading) {
      return
    }

    setDailySignInLoading(true)

    try {
      const data = await requestVsCodeMessage('dailySignIn')
      setDailySignedIn(data.signedIn)
    } catch (err) {
      console.error(err)
    } finally {
      setDailySignInLoading(false)
    }
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
        className={styles['my-topic-item']}
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

    const memberMatch = href.match(/\/member\/([A-Za-z0-9_-]+)/)
    if (memberMatch) {
      openMember(decodeURIComponent(memberMatch[1]))
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
      <div className={styles['my-notification-item']} key={notification.id}>
        <button
          type="button"
          className={`${styles['my-link']} ${styles['my-notification-avatar-link']}`}
          title={notification.username}
          onClick={() => openMember(notification.username)}
        >
          <Avatar
            size="extra-extra-small"
            shape="square"
            src={notification.avatar}
            alt={notification.username}
            className={styles['my-notification-avatar']}
          >
            <IconUser />
          </Avatar>
        </button>
        <div
          className={styles['my-notification-body']}
          onClick={event => handleNotificationClick(event, notification)}
        >
          <div className={styles['my-notification-meta']}>
            <span dangerouslySetInnerHTML={{ __html: normalizeHtml(notification.summaryHtml) }} />
            {!!notification.time && <time>{notification.time}</time>}
          </div>
          {!!notification.payloadHtml && (
            <div
              className={styles['my-notification-payload']}
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
        <div className={styles['my-content-state']}>
          <Spin size="middle" />
        </div>
      )
    }

    if (state.error) {
      return (
        <div className={styles['my-content-state']}>
          <Empty
            title="加载失败"
            description={state.error}
            image={<IllustrationNoContent className={styles['empty-illustration']} />}
            darkModeImage={<IllustrationNoContentDark className={styles['empty-illustration']} />}
          />
          <Button size="small" onClick={() => loadMyTopics(tab, state.page)}>
            重试
          </Button>
        </div>
      )
    }

    if (!state.topics.length) {
      return (
        <div className={styles['my-content-state']}>
          <Empty
            title={emptyTitle}
            image={<IllustrationNoContent className={styles['empty-illustration']} />}
            darkModeImage={<IllustrationNoContentDark className={styles['empty-illustration']} />}
          />
        </div>
      )
    }

    return (
      <>
        <div className={styles['my-topic-list']}>{state.topics.map(renderTopicItem)}</div>
        {state.totalPage > 1 && (
          <div className={styles['my-content-pagination']}>
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
        <div className={styles['my-content-state']}>
          <Spin size="middle" />
        </div>
      )
    }

    if (state.error) {
      return (
        <div className={styles['my-content-state']}>
          <Empty
            title="加载失败"
            description={state.error}
            image={<IllustrationNoContent className={styles['empty-illustration']} />}
            darkModeImage={<IllustrationNoContentDark className={styles['empty-illustration']} />}
          />
          <Button size="small" onClick={() => loadMyNotifications(state.page)}>
            重试
          </Button>
        </div>
      )
    }

    if (!state.notifications.length) {
      return (
        <div className={styles['my-content-state']}>
          <Empty
            title="暂无消息"
            image={<IllustrationNoContent className={styles['empty-illustration']} />}
            darkModeImage={<IllustrationNoContentDark className={styles['empty-illustration']} />}
          />
        </div>
      )
    }

    return (
      <>
        <div className={styles['my-notification-list']}>
          {state.notifications.map(renderNotificationItem)}
        </div>
        {state.totalPage > 1 && (
          <div className={styles['my-content-pagination']}>
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
      <section className={styles['my-panel']}>
        <div className={styles['loading-panel']}>
          <Spin size="middle" />
        </div>
      </section>
    )
  }

  if (!loggedIn) {
    return (
      <section className={styles['my-panel']}>
        <LoginPrompt />
      </section>
    )
  }

  if (!overview) {
    return (
      <section className={styles['my-panel']}>
        <div className={styles['empty-panel']}>
          <Empty
            title="暂无账户概览"
            image={<IllustrationNoContent className={styles['empty-illustration']} />}
            darkModeImage={<IllustrationNoContentDark className={styles['empty-illustration']} />}
          />
        </div>
      </section>
    )
  }

  /** 活跃度百分比 */
  const activityPercent = Math.min(Math.max(overview.activityPercent, 0), 100)

  return (
    <section className={styles['my-panel']}>
      <SimpleBar className={styles['my-scroll']} autoHide={false}>
        <article className={styles['my-card']}>
          <header className={styles['my-profile']}>
            <button
              type="button"
              className={`${styles['my-link']} ${styles['my-avatar-link']}`}
              title={overview.username}
              onClick={() => openMember(overview.username)}
            >
              <Avatar
                size="large"
                shape="square"
                src={overview.avatar}
                alt={overview.username}
                className={styles['my-avatar']}
              >
                <IconUser />
              </Avatar>
            </button>
            <button
              type="button"
              className={`${styles['my-link']} ${styles['my-identity']}`}
              title={overview.username}
              onClick={() => openMember(overview.username)}
            >
              {overview.username}
            </button>
          </header>

          <div className={styles['my-stats']}>
            {statItems.map(item => (
              <button
                type="button"
                className={`${styles['my-link']} ${styles['my-stat']}`}
                key={item.key}
                onClick={() => openStatTarget(item.target)}
              >
                <strong>{overview[item.key]}</strong>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className={styles['my-activity']}>
            <Progress
              percent={activityPercent}
              showInfo
              format={() => `${overview.activityPercent}%`}
              stroke="#f59e0b"
              orbitStroke="color-mix(in srgb, #f59e0b 18%, var(--v2ex-widget-bg))"
              style={{ height: 6 }}
              className={styles['my-activity-progress']}
              aria-label="活跃度"
            />
          </div>

          <footer className={styles['my-wallet']}>
            <button
              type="button"
              className={`${styles['my-link']} ${styles['my-notice']}`}
              onClick={() => changeContentTab('messages')}
            >
              {overview.unreadNoticeCount} 未读提醒
            </button>
            <button
              type="button"
              className={`${styles['my-link']} ${styles['my-balance']}`}
              aria-label="账户余额"
              onClick={() => openExternal('/balance')}
            >
              <span>{overview.gold}</span>
              <i className={`${styles['my-coin']} ${styles['my-coin--gold']}`} />
              <span>{overview.silver}</span>
              <i className={`${styles['my-coin']} ${styles['my-coin--silver']}`} />
              <span>{overview.bronze}</span>
              <i className={`${styles['my-coin']} ${styles['my-coin--bronze']}`} />
            </button>
            <button
              type="button"
              className={`${styles['my-link']} ${styles['my-help']}`}
              aria-label="余额说明"
              onClick={() => openExternal('/help/currency')}
            >
              <IconHelpCircle className={styles['my-help-icon']} />
            </button>
          </footer>

          <div className={styles['my-daily-sign-in']}>
            <Button
              theme={dailySignedIn ? 'light' : 'solid'}
              type={dailySignedIn ? 'tertiary' : 'primary'}
              size="small"
              icon={dailySignedIn ? <IconTickCircle /> : <IconGiftStroked />}
              loading={dailySignInLoading}
              disabled={dailySignedIn}
              onClick={handleDailySignIn}
            >
              {dailySignedIn ? '今日已签到' : '签到'}
            </Button>
          </div>
        </article>

        <section className={styles['my-content']}>
          <Tabs
            activeKey={activeContentTab}
            type="button"
            size="small"
            className={styles['my-content-tabs']}
            tabPaneMotion={false}
            onChange={value => changeContentTab(value as MyContentTabKey)}
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
                <span className={styles['my-message-tab']}>
                  <span>消息</span>
                  {!!overview.unreadNoticeCount && (
                    <Badge
                      count={overview.unreadNoticeCount}
                      overflowCount={99}
                      countClassName={styles['my-message-badge-count']}
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
