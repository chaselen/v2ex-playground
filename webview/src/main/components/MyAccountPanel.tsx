import { useEffect, useImperativeHandle, useRef, useState, type MouseEvent, type Ref } from 'react'
import { Avatar, Button, Empty, Progress, Spin, Tabs } from '@douyinfe/semi-ui'
import { IconGiftStroked, IconHelpCircle, IconTickCircle, IconUser } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import { normalizeHtml } from '@/shared/contentEnhancement'
import CurrencyBalance from '@/shared/CurrencyBalance'
import { VscodeBadge } from '@/shared/SemiVscode'
import SimpleBar from 'simplebar-react'
import { handleWebviewLinkClick } from '@/shared/linkNavigation'
import { createVsCodeClient, resolveWebviewUrl } from '@/shared/vscode'
import LoginPrompt from './LoginPrompt'
import MainPagination from './MainPagination'
import TopicRow from './TopicRow'
import type {
  MyContentTabKey,
  MainViewRpcCommands,
  MainViewWebviewEvents,
  MyNotificationListData,
  MyTopicListData,
  WebviewAccountOverview,
  WebviewDailySignInData,
  WebviewNotification,
  WebviewTopic
} from '@extension/shared/webview'
import styles from './MyAccountPanel.module.scss'

/** 主面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<MainViewRpcCommands, MainViewWebviewEvents>()

interface MyAccountPanelProps {
  /** 面板实例引用 */
  ref?: Ref<MyAccountPanelHandle>
  /** 是否加载中 */
  loading?: boolean
  /** 是否已登录 */
  loggedIn: boolean
  /** 账户概览 */
  overview?: WebviewAccountOverview
  /** 打开节点收藏 */
  onOpenNodeCollection: () => void
}

/**
 * 我的账户面板实例
 */
export interface MyAccountPanelHandle {
  /** 刷新已加载的内容标签 */
  refreshLoadedTabs: () => Promise<void>
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
  vscode.openExternal({ path: resolveWebviewUrl(path) })
}

/**
 * 打开用户页
 * @param username 用户名
 */
function openMember(username: string) {
  vscode.openMember({ username })
}

/**
 * 账户概览面板
 * @param props 组件参数
 */
export default function MyAccountPanel(props: MyAccountPanelProps) {
  const { ref, loading, loggedIn, overview, onOpenNodeCollection } = props
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
  const topicRequestSeq = useRef<Record<MyContentTopicTabKey, number>>({
    topicCollection: 0,
    specialFollowing: 0
  })
  const notificationRequestSeq = useRef(0)

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
    vscode
      .getDailySignInStatus()
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

  useImperativeHandle(ref, () => ({
    async refreshLoadedTabs() {
      if (!loggedIn) {
        return
      }

      const requests: Promise<void>[] = []
      if (topicLists.topicCollection.loaded) {
        requests.push(loadMyTopics('topicCollection', 1))
      }
      if (topicLists.specialFollowing.loaded) {
        requests.push(loadMyTopics('specialFollowing', 1))
      }
      if (notificationList.loaded) {
        requests.push(loadMyNotifications(1))
      }
      await Promise.all(requests)
    }
  }))

  useEffect(() => {
    return vscode.on('dailySignInStatusChanged', data => setDailySignedIn(data.signedIn))
  }, [])

  /**
   * 加载我的主题列表
   * @param tab 我的主题内容标签 key
   * @param page 页码
   */
  async function loadMyTopics(tab: MyContentTopicTabKey, page: number) {
    const requestSeq = topicRequestSeq.current[tab] + 1
    topicRequestSeq.current[tab] = requestSeq

    setTopicLists(current => ({
      ...current,
      [tab]: {
        ...current[tab],
        loading: true,
        error: null
      }
    }))

    try {
      const data = await vscode.getMyTopics({ tab, page })
      if (topicRequestSeq.current[tab] === requestSeq) {
        onMyTopicListLoaded(data)
      }
    } catch (err) {
      if (topicRequestSeq.current[tab] !== requestSeq) {
        return
      }
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
    const requestSeq = notificationRequestSeq.current + 1
    notificationRequestSeq.current = requestSeq

    setNotificationList(current => ({
      ...current,
      loading: true,
      error: null
    }))

    try {
      const data = await vscode.getMyNotifications({ page })
      if (notificationRequestSeq.current === requestSeq) {
        onMyNotificationsLoaded(data)
      }
    } catch (err) {
      if (notificationRequestSeq.current !== requestSeq) {
        return
      }
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
      const data = await vscode.dailySignIn()
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
    handleWebviewLinkClick(event, {
      topicTitle: notification.topicTitle,
      fallbackTopic: notification.topicId
        ? {
            topicId: notification.topicId,
            title: notification.topicTitle
          }
        : undefined
    })
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
            <span
              dangerouslySetInnerHTML={{
                __html: normalizeHtml(notification.summaryHtml)
              }}
            />
            {!!notification.time && <time>{notification.time}</time>}
          </div>
          {!!notification.payloadHtml && (
            <div
              className={styles['my-notification-payload']}
              dangerouslySetInnerHTML={{
                __html: normalizeHtml(notification.payloadHtml)
              }}
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
      <SimpleBar className={styles['my-panel']} autoHide={false}>
        <div className={`${styles['my-panel-content']} ${styles['loading-panel']}`}>
          <Spin size="middle" />
        </div>
      </SimpleBar>
    )
  }

  if (!loggedIn) {
    return (
      <SimpleBar className={styles['my-panel']} autoHide={false}>
        <div className={styles['my-panel-content']}>
          <LoginPrompt />
        </div>
      </SimpleBar>
    )
  }

  if (!overview) {
    return (
      <SimpleBar className={styles['my-panel']} autoHide={false}>
        <div className={`${styles['my-panel-content']} ${styles['empty-panel']}`}>
          <Empty
            title="暂无账户概览"
            image={<IllustrationNoContent className={styles['empty-illustration']} />}
            darkModeImage={<IllustrationNoContentDark className={styles['empty-illustration']} />}
          />
        </div>
      </SimpleBar>
    )
  }

  /** 活跃度百分比 */
  const activityPercent = Math.min(Math.max(overview.activityPercent, 0), 100)

  return (
    <SimpleBar className={styles['my-panel']} autoHide={false}>
      <div className={styles['my-panel-content']}>
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
              onClick={() => vscode.openBalance()}
            >
              <CurrencyBalance
                gold={overview.gold}
                silver={overview.silver}
                bronze={overview.bronze}
                coinClassName={styles['my-coin']}
              />
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
                    <VscodeBadge
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
      </div>
    </SimpleBar>
  )
}
