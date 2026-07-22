import { useEffect, useImperativeHandle, useRef, useState, type MouseEvent, type Ref } from 'react'
import { CircleCheck, CircleHelp, Gift, Inbox, UserRound } from 'lucide-react'
import { normalizeHtml } from '@/core/contentEnhancement'
import CurrencyBalance from '@/components/CurrencyBalance'
import SimpleBar from 'simplebar-react'
import { handleWebviewLinkClick } from '@/core/linkNavigation'
import PageSkeleton from '@/components/PageSkeleton'
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Progress,
  RadioGroup,
  RadioGroupItem,
  Spinner
} from '@/components/ui'
import { createVsCodeClient, resolveWebviewUrl } from '@/core/vscode'
import LoginPrompt from '../components/LoginPrompt'
import MainPagination from '../components/MainPagination'
import TopicRow from '../components/TopicRow'
import { markTopicListRead } from '../nodeData'
import type {
  MyContentTabKey,
  MainViewRpcCommands,
  MainViewWebviewEvents,
  MyNotificationListData,
  MyTopicListData,
  WebviewAccountOverview,
  WebviewNotification,
  WebviewTopic
} from '@extension/shared/webview'
import styles from './MyTab.module.scss'

/** 主面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<MainViewRpcCommands, MainViewWebviewEvents>()

interface MyTabProps {
  /** 面板实例引用 */
  ref?: Ref<MyTabHandle>
  /** 是否加载中 */
  loading?: boolean
  /** 是否已登录 */
  loggedIn: boolean
  /** 账户概览 */
  overview?: WebviewAccountOverview
  /** 账户概览加载错误 */
  overviewError?: string | null
  /** 重试加载账户概览 */
  onRetryOverview: () => void
  /** 打开节点收藏 */
  onOpenNodeCollection: () => void
}

/**
 * 我的账户面板实例
 */
export interface MyTabHandle {
  /** 刷新已加载的内容标签 */
  refreshLoadedTabs: () => Promise<void>
  /** 标记已加载的主题已读 */
  markTopicRead: (topicId: number) => void
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
  vscode.openExternal(resolveWebviewUrl(path))
}

/**
 * 打开用户页
 * @param username 用户名
 */
function openMember(username: string) {
  vscode.openMember(username)
}

/**
 * 账户概览面板
 * @param props 组件参数
 */
export default function MyTab(props: MyTabProps) {
  const { ref, loading, loggedIn, overview, overviewError, onRetryOverview, onOpenNodeCollection } =
    props
  const [activeContentTab, setActiveContentTab] = useState<MyContentTabKey>('topicCollection')
  const [topicLists, setTopicLists] = useState<MyTopicListsState>({
    topicCollection: createMyTopicListState(),
    specialFollowing: createMyTopicListState()
  })
  const [notificationList, setNotificationList] = useState<MyNotificationListState>(
    createMyNotificationListState
  )
  const [dailySignedIn, setDailySignedIn] = useState(false)
  const [dailySignInReward, setDailySignInReward] = useState<number>()
  const [dailySignInLoading, setDailySignInLoading] = useState(false)
  const topicRequestSeq = useRef<Record<MyContentTopicTabKey, number>>({
    topicCollection: 0,
    specialFollowing: 0
  })
  const notificationRequestSeq = useRef(0)
  const accountKeyRef = useRef<string | undefined>(undefined)
  const contentSectionRef = useRef<HTMLElement>(null)

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
  }, [activeContentTab, loggedIn, notificationList, topicLists])

  /** 当前账户 key */
  const accountKey = loggedIn ? overview?.username : undefined

  useEffect(() => {
    if (accountKeyRef.current === accountKey) {
      return
    }

    accountKeyRef.current = accountKey
    resetMyContentState()
  }, [accountKey])

  useEffect(() => {
    let disposed = false

    if (!accountKey) {
      setDailySignedIn(false)
      setDailySignInReward(undefined)
      setDailySignInLoading(false)
      return
    }

    setDailySignInLoading(true)
    vscode
      .getDailySignInStatus()
      .then(data => {
        if (!disposed) {
          setDailySignedIn(data.signedIn)
          setDailySignInReward(data.reward)
          setDailySignInLoading(!!data.loading)
        }
      })
      .catch(err => {
        console.error(err)
        if (!disposed) {
          setDailySignInLoading(false)
        }
      })

    return () => {
      disposed = true
    }
  }, [accountKey])

  useImperativeHandle(ref, () => ({
    async refreshLoadedTabs() {
      if (!loggedIn) {
        return
      }

      const requests: Promise<boolean>[] = []
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
    },
    markTopicRead(topicId: number) {
      setTopicLists(current => ({
        topicCollection: markMyTopicListRead(current.topicCollection, topicId),
        specialFollowing: markMyTopicListRead(current.specialFollowing, topicId)
      }))
    }
  }))

  useEffect(() => {
    return vscode.on('dailySignInStatusChanged', data => {
      if (data.loading) {
        // 自动签到探测时 loading 事件可能仍带 signedIn=false，避免把已签到状态打回
        setDailySignInLoading(true)
        if (data.signedIn) {
          setDailySignedIn(true)
        }
        if (data.reward !== undefined) {
          setDailySignInReward(data.reward)
        }
        return
      }

      setDailySignedIn(data.signedIn)
      if (data.reward !== undefined) {
        setDailySignInReward(data.reward)
      }
      setDailySignInLoading(false)
    })
  }, [])

  /**
   * 重置我的内容缓存
   */
  function resetMyContentState() {
    topicRequestSeq.current.topicCollection += 1
    topicRequestSeq.current.specialFollowing += 1
    notificationRequestSeq.current += 1
    setActiveContentTab('topicCollection')
    setTopicLists({
      topicCollection: createMyTopicListState(),
      specialFollowing: createMyTopicListState()
    })
    setNotificationList(createMyNotificationListState())
    setDailySignedIn(false)
    setDailySignInReward(undefined)
    setDailySignInLoading(false)
  }

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
        return true
      }
    } catch (err) {
      if (topicRequestSeq.current[tab] !== requestSeq) {
        return false
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

    return false
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
      const data = await vscode.getMyNotifications(page)
      if (notificationRequestSeq.current === requestSeq) {
        onMyNotificationsLoaded(data)
        return true
      }
    } catch (err) {
      if (notificationRequestSeq.current !== requestSeq) {
        return false
      }
      setNotificationList(current => ({
        ...current,
        loading: false,
        loaded: true,
        error: (err as Error).message
      }))
    }

    return false
  }

  /**
   * 切换内容页码并回到列表首条数据
   * @param loadPage 加载目标页
   */
  async function changeContentPage(loadPage: () => Promise<boolean>) {
    if (!(await loadPage())) {
      return
    }

    // 等待新一页列表完成渲染后，将非吸顶容器作为稳定的回位锚点
    requestAnimationFrame(() => {
      contentSectionRef.current?.scrollIntoView({ block: 'start' })
    })
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
      setDailySignInReward(data.reward)
      setDailySignInLoading(!!data.loading)
    } catch (err) {
      console.error(err)
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
        isRead={topic.isRead}
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
            size="small"
            shape="square"
            src={notification.avatar}
            alt={notification.username}
            className={styles['my-notification-avatar']}
            fallback={<UserRound aria-hidden="true" />}
          />
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

    if (state.loading && !state.topics.length) {
      return (
        <div className={styles['my-content-state']}>
          <Spinner aria-label="加载主题列表" />
        </div>
      )
    }

    if (state.error) {
      return (
        <div className={styles['my-content-state']}>
          <Empty title="加载失败" description={state.error} icon={<Inbox aria-hidden="true" />} />
          <Button
            size="small"
            loading={state.loading}
            onClick={() => loadMyTopics(tab, state.page)}
          >
            重试
          </Button>
        </div>
      )
    }

    if (!state.topics.length) {
      return (
        <div className={styles['my-content-state']}>
          <Empty title={emptyTitle} icon={<Inbox aria-hidden="true" />} />
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
                  void changeContentPage(() => loadMyTopics(tab, page))
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

    if (state.loading && !state.notifications.length) {
      return (
        <div className={styles['my-content-state']}>
          <Spinner aria-label="加载消息" />
        </div>
      )
    }

    if (state.error) {
      return (
        <div className={styles['my-content-state']}>
          <Empty title="加载失败" description={state.error} icon={<Inbox aria-hidden="true" />} />
          <Button
            size="small"
            loading={state.loading}
            onClick={() => loadMyNotifications(state.page)}
          >
            重试
          </Button>
        </div>
      )
    }

    if (!state.notifications.length) {
      return (
        <div className={styles['my-content-state']}>
          <Empty title="暂无消息" icon={<Inbox aria-hidden="true" />} />
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
                  void changeContentPage(() => loadMyNotifications(page))
                }
              }}
            />
          </div>
        )}
      </>
    )
  }

  /** 渲染当前“我的”内容 */
  function renderActiveContent() {
    switch (activeContentTab) {
      case 'topicCollection':
        return renderMyTopicList('topicCollection', '暂无收藏主题')
      case 'specialFollowing':
        return renderMyTopicList('specialFollowing', '暂无特别关注')
      case 'messages':
        return renderMessages()
    }
  }

  if (loading) {
    return (
      <SimpleBar className={styles['my-panel']} autoHide={false}>
        <div className={styles['my-panel-content']}>
          <PageSkeleton variant="my" rows={4} />
        </div>
      </SimpleBar>
    )
  }

  if (!loggedIn) {
    return (
      <SimpleBar className={styles['my-panel']} autoHide={false}>
        <LoginPrompt />
      </SimpleBar>
    )
  }

  if (!overview && overviewError) {
    return (
      <SimpleBar className={styles['my-panel']} autoHide={false}>
        <div className={styles['empty-panel']}>
          <Empty title="加载失败" description={overviewError} icon={<Inbox aria-hidden="true" />} />
          <Button size="small" loading={loading} onClick={onRetryOverview}>
            重试
          </Button>
        </div>
      </SimpleBar>
    )
  }

  if (!overview) {
    return (
      <SimpleBar className={styles['my-panel']} autoHide={false}>
        <div className={styles['empty-panel']}>
          <Empty title="暂无账户概览" icon={<Inbox aria-hidden="true" />} />
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
                fallback={<UserRound aria-hidden="true" />}
              />
            </button>
            <div className={styles['my-identity']}>
              <button
                type="button"
                className={`${styles['my-link']} ${styles['my-username']}`}
                title={overview.username}
                onClick={() => openMember(overview.username)}
              >
                {overview.username}
              </button>
              {!!overview.tagline && (
                <p className={styles['my-tagline']} title={overview.tagline}>
                  {overview.tagline}
                </p>
              )}
            </div>
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
              value={activityPercent}
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
              <CircleHelp className={styles['my-help-icon']} aria-hidden="true" />
            </button>
          </footer>

          <div className={styles['my-daily-sign-in']}>
            <Button
              variant={dailySignedIn ? 'ghost' : 'primary'}
              size="small"
              className={dailySignedIn ? styles['my-daily-sign-in-done'] : undefined}
              icon={
                dailySignedIn ? <CircleCheck aria-hidden="true" /> : <Gift aria-hidden="true" />
              }
              loading={dailySignInLoading}
              disabled={dailySignedIn}
              onClick={handleDailySignIn}
            >
              {dailySignedIn
                ? `今日已签到${dailySignInReward !== undefined ? `，获得 ${dailySignInReward} 铜币` : ''}`
                : '签到'}
            </Button>
          </div>
        </article>

        <section ref={contentSectionRef} className={styles['my-content']}>
          <div className={styles['my-content-tabs-header']}>
            <RadioGroup
              aria-label="我的内容"
              value={activeContentTab}
              className={styles['my-content-tabs']}
              variant="segmented"
              onValueChange={value => changeContentTab(value as MyContentTabKey)}
            >
              <RadioGroupItem value="topicCollection" label="主题收藏" />
              <RadioGroupItem value="specialFollowing" label="特别关注" />
              <RadioGroupItem
                value="messages"
                label={
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
              />
            </RadioGroup>
          </div>
          <div className={styles['my-content-panel']}>{renderActiveContent()}</div>
        </section>
      </div>
    </SimpleBar>
  )
}

/**
 * 标记我的主题列表中的话题已读
 * @param state 主题列表状态
 * @param topicId 话题 id
 */
function markMyTopicListRead(state: MyTopicListState, topicId: number): MyTopicListState {
  return {
    ...state,
    topics: markTopicListRead(state.topics, topicId)
  }
}
