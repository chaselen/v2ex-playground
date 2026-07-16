import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Avatar, Button, Empty, Input, Pagination, Popconfirm, Toast } from '@douyinfe/semi-ui'
import { IconDelete, IconHistory, IconRefresh, IconSearch, IconUser } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import dayjs from 'dayjs'
import SimpleBar from 'simplebar-react'
import type SimpleBarCore from 'simplebar-core'
import PageSkeleton from '@/shared/PageSkeleton'
import { VscodeTag } from '@/shared/SemiVscode'
import { createVsCodeClient } from '@/shared/vscode'
import type {
  RecentBrowseListData,
  RecentBrowsePanelRpcCommands,
  RecentBrowsePanelWebviewEvents,
  RecentBrowseTopic
} from '@extension/shared/webview'

/** 最近浏览面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<RecentBrowsePanelRpcCommands, RecentBrowsePanelWebviewEvents>()

/** 最近浏览每页数量 */
const recentBrowsePageSize = 10

/** 最近浏览页面状态 */
type RecentBrowseViewState =
  | { status: 'loading'; data?: RecentBrowseListData }
  | { status: 'result'; data: RecentBrowseListData }
  | { status: 'error'; message: string; data?: RecentBrowseListData }

/**
 * 最近浏览页面应用
 */
export default function RecentBrowseApp() {
  const [state, setState] = useState<RecentBrowseViewState>({ status: 'loading' })
  const [clearing, setClearing] = useState(false)
  const [deletingTopicId, setDeletingTopicId] = useState<number>()
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const requestIdRef = useRef(0)
  const scrollRef = useRef<SimpleBarCore | null>(null)
  const data = state.data
  const loading = state.status === 'loading'

  /**
   * 加载最近浏览
   * @param page 页码
   * @param searchQuery 搜索词
   */
  async function loadRecentBrowse(page = data?.page || 1, searchQuery = activeQuery) {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setState(current => ({
      status: 'loading',
      data: current.data
    }))

    try {
      const nextData = await vscode.getRecentBrowseTopics({
        page,
        pageSize: recentBrowsePageSize,
        query: searchQuery
      })
      if (requestId !== requestIdRef.current) {
        return
      }

      setState({ status: 'result', data: nextData })
      scrollRef.current?.getScrollElement()?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return
      }
      setState(current => ({
        status: 'error',
        message: (err as Error).message || '加载失败',
        data: current.data
      }))
    }
  }

  /** 根据输入的关键词搜索最近浏览 */
  function searchRecentBrowse() {
    const nextQuery = query.trim()
    setActiveQuery(nextQuery)
    loadRecentBrowse(1, nextQuery).catch(err => console.error(err))
  }

  /** 更新搜索词，清空输入时立即恢复完整列表 */
  function updateQuery(value: string) {
    setQuery(value)
    if (!value.trim() && activeQuery) {
      setActiveQuery('')
      loadRecentBrowse(1, '').catch(err => console.error(err))
    }
  }

  /**
   * 清空最近浏览
   */
  async function clearRecentBrowse() {
    if (clearing || deletingTopicId !== undefined) {
      return
    }

    setClearing(true)
    try {
      const nextData = await vscode.clearRecentBrowseTopics()
      setState({ status: 'result', data: nextData })
      Toast.success('已清空最近浏览')
    } catch (err) {
      Toast.error((err as Error).message || '清空失败')
    } finally {
      setClearing(false)
    }
  }

  /**
   * 删除单条最近浏览话题
   * @param topicId 话题 id
   */
  async function deleteRecentBrowse(topicId: number) {
    if (clearing || deletingTopicId !== undefined) {
      return
    }

    setDeletingTopicId(topicId)
    try {
      const nextData = await vscode.deleteRecentBrowseTopic({
        topicId,
        page: data?.page || 1,
        pageSize: recentBrowsePageSize,
        query: activeQuery
      })
      setState({ status: 'result', data: nextData })
      Toast.success('已删除浏览记录')
    } catch (err) {
      Toast.error((err as Error).message || '删除失败')
    } finally {
      setDeletingTopicId(undefined)
    }
  }

  /**
   * 打开话题
   * @param topic 最近浏览话题
   */
  function openTopic(topic: RecentBrowseTopic) {
    vscode.openTopic({
      topicId: topic.topicId,
      title: topic.title || `/t/${topic.topicId}`
    })
  }

  /**
   * 打开作者
   * @param event 鼠标事件
   * @param authorName 作者名称
   */
  function openAuthor(authorName: string) {
    if (!authorName) {
      return
    }

    vscode.openMember(authorName)
  }

  /**
   * 打开节点
   * @param event 鼠标事件
   * @param topic 最近浏览话题
   */
  function openNode(event: MouseEvent, topic: RecentBrowseTopic) {
    event.stopPropagation()
    if (!topic.nodeName) {
      return
    }

    vscode.openNode({
      name: topic.nodeName,
      title: topic.nodeTitle || topic.nodeName
    })
  }

  useEffect(() => {
    loadRecentBrowse(1).catch(err => console.error(err))
  }, [])

  /**
   * 渲染最近浏览话题
   * @param topic 最近浏览话题
   */
  function renderTopic(topic: RecentBrowseTopic) {
    const title = topic.title || `/t/${topic.topicId}`
    const authorName = topic.authorName
    const nodeTitle = topic.nodeTitle || topic.nodeName

    return (
      <article key={topic.topicId} className="recent-topic" title={title}>
        <span
          className="recent-topic-avatar-link"
          role="button"
          tabIndex={-1}
          title={authorName || '作者'}
          onClick={() => openAuthor(topic.authorName)}
        >
          <Avatar
            size="small"
            shape="square"
            src={topic.authorAvatar}
            alt={authorName || '作者'}
            className="recent-topic-avatar"
          >
            <IconUser />
          </Avatar>
        </span>
        <span className="recent-topic-end">
          {!!topic.publishedAt && (
            <time className="recent-topic-published">{topic.publishedAt}</time>
          )}
          <Popconfirm
            title="删除这条浏览记录？"
            content="删除后不可恢复"
            okText="删除"
            okType="danger"
            cancelText="取消"
            disabled={clearing || deletingTopicId !== undefined}
            onConfirm={() => deleteRecentBrowse(topic.topicId)}
          >
            <span className="recent-topic-delete-trigger">
              <Button
                size="small"
                theme="borderless"
                type="tertiary"
                icon={<IconDelete />}
                loading={deletingTopicId === topic.topicId}
                disabled={clearing || deletingTopicId !== undefined}
                aria-label={`删除浏览记录：${title}`}
                title="删除浏览记录"
                className="recent-topic-delete"
              />
            </span>
          </Popconfirm>
        </span>
        <span className="recent-topic-body">
          <a className="recent-topic-title" href="javascript:;" onClick={() => openTopic(topic)}>
            {title}
          </a>
          <span className="recent-topic-meta">
            {!!authorName && (
              <a
                className="recent-topic-author"
                href="javascript:;"
                onClick={() => openAuthor(topic.authorName)}
              >
                {authorName}
              </a>
            )}
            {!!nodeTitle && (
              <span
                className="recent-topic-node"
                role="button"
                tabIndex={-1}
                onClick={event => openNode(event, topic)}
              >
                <VscodeTag size="small">{nodeTitle}</VscodeTag>
              </span>
            )}
            <time className="recent-topic-read-time">
              <IconHistory />
              <span>{formatReadTime(topic.readAt)}</span>
            </time>
          </span>
        </span>
      </article>
    )
  }

  return (
    <SimpleBar ref={scrollRef} className="recent-scroll" role="main" autoHide={false}>
      <main className="recent-container">
        <header className="recent-toolbar">
          <div className="recent-search">
            <Input
              className="recent-search-input"
              value={query}
              prefix={<IconSearch />}
              placeholder="搜索标题、作者或节点"
              showClear
              composition
              disabled={clearing || deletingTopicId !== undefined}
              onChange={updateQuery}
              onEnterPress={searchRecentBrowse}
            />
            <Button
              theme="solid"
              icon={<IconSearch />}
              loading={loading}
              disabled={!query.trim() || clearing || deletingTopicId !== undefined}
              onClick={searchRecentBrowse}
            >
              搜索
            </Button>
          </div>
          <div className="recent-toolbar-actions">
            <Popconfirm
              title="清空最近浏览？"
              content="清空后不可恢复"
              okText="清空"
              okType="danger"
              cancelText="取消"
              disabled={!data?.totalCount || loading || clearing || deletingTopicId !== undefined}
              onConfirm={clearRecentBrowse}
            >
              <span>
                <Button
                  size="small"
                  theme="borderless"
                  type="tertiary"
                  icon={<IconDelete />}
                  loading={clearing}
                  disabled={!data?.totalCount || loading || deletingTopicId !== undefined}
                  aria-label="清空最近浏览"
                  title="清空最近浏览"
                />
              </span>
            </Popconfirm>
            <Button
              size="small"
              theme="borderless"
              type="tertiary"
              icon={<IconRefresh />}
              loading={loading}
              disabled={clearing || deletingTopicId !== undefined}
              aria-label="刷新"
              title="刷新"
              onClick={() => loadRecentBrowse(data?.page || 1, activeQuery)}
            />
          </div>
        </header>

        {state.status === 'error' && !data && (
          <div className="recent-state">
            <Empty
              title="加载失败"
              description={state.message}
              image={<IllustrationNoContent />}
              darkModeImage={<IllustrationNoContentDark />}
            />
            <Button size="small" loading={loading} onClick={() => loadRecentBrowse(1)}>
              重试
            </Button>
          </div>
        )}

        {loading && !data && <PageSkeleton variant="recent" rows={6} />}

        {data && !data.topics.length && (
          <div className="recent-state">
            <Empty
              title={activeQuery ? '未找到匹配的浏览记录' : '暂无最近浏览'}
              description={activeQuery ? `没有与“${activeQuery}”相关的标题、作者或节点` : undefined}
              image={<IllustrationNoContent />}
              darkModeImage={<IllustrationNoContentDark />}
            />
          </div>
        )}

        {data && !!data.topics.length && (
          <>
            <div className="recent-count">
              {activeQuery ? `找到 ${data.totalCount} 个主题` : `${data.totalCount} 个主题`}
            </div>
            <div className="recent-list">{data.topics.map(renderTopic)}</div>
            {data.totalPage > 1 && (
              <footer className="recent-pagination">
                <span className="recent-pagination-summary">
                  总条数：{data.totalCount.toLocaleString('en-US')}
                </span>
                <Pagination
                  currentPage={data.page}
                  disabled={loading}
                  hideOnSinglePage
                  pageSize={1}
                  showQuickJumper
                  total={data.totalPage}
                  onPageChange={page => loadRecentBrowse(page)}
                />
              </footer>
            )}
          </>
        )}
      </main>
    </SimpleBar>
  )
}

/**
 * 格式化最近浏览时间
 * @param timestamp 时间戳
 */
function formatReadTime(timestamp: number): string {
  if (!timestamp) {
    return ''
  }

  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
}
