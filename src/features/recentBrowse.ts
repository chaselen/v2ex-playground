import G from '@/global'
import type { RecentBrowseTopic } from '@/shared/webview'
import type { TopicDetail } from '@/v2ex'

/** 最近浏览记录存储 key */
const RECENT_BROWSE_RECORDS_KEY = 'topicReadRecords'

/** 最近浏览记录保留时间 */
const RECENT_BROWSE_RECORD_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** 最近浏览记录数量上限 */
const RECENT_BROWSE_RECORD_LIMIT = 2000

/**
 * 最近浏览记录
 *
 * key 为话题 id，value 为最近浏览话题
 */
type RecentBrowseRecords = Record<string, RecentBrowseTopic | number>

/** 话题已读变化回调 */
type TopicReadHandler = (topicId: number) => void | Promise<void>

/** 话题已读变化监听器 */
const topicReadHandlers = new Set<TopicReadHandler>()

/**
 * 判断话题是否已读
 * @param topicId 话题 id
 */
export function isTopicRead(topicId: number): boolean {
  return !!getRecentBrowseRecordsMap()[topicId]
}

/**
 * 更新最近浏览话题详情
 * @param detail 话题详情
 */
export async function updateRecentBrowseTopic(detail: TopicDetail): Promise<void> {
  const recordsMap = getRecentBrowseRecordsMap()
  const records = normalizeRecentBrowseRecordsMap({
    ...recordsMap,
    [detail.id]: {
      topicId: detail.id,
      title: detail.title,
      authorName: detail.authorName,
      authorAvatar: detail.authorAvatar,
      nodeName: detail.node.name,
      nodeTitle: detail.node.title,
      publishedAt: detail.publishedAt,
      readAt: Date.now()
    }
  })
  await G.context.globalState.update(RECENT_BROWSE_RECORDS_KEY, records)
  await Promise.all(Array.from(topicReadHandlers).map(handler => handler(detail.id)))
}

/**
 * 获取最近浏览话题
 * @param page 页码
 * @param pageSize 每页数量
 * @param query 标题、作者或节点搜索词
 */
export function getRecentBrowseTopics(
  page = 1,
  pageSize = 20,
  query = ''
): {
  page: number
  totalPage: number
  totalCount: number
  topics: RecentBrowseTopic[]
} {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const records = Object.values(getRecentBrowseRecordsMap())
    .filter(topic => {
      if (!normalizedQuery) {
        return true
      }

      return [topic.title, topic.authorName, topic.nodeName, topic.nodeTitle].some(value =>
        value.toLocaleLowerCase().includes(normalizedQuery)
      )
    })
    .sort((a, b) => b.readAt - a.readAt)
  const safePageSize = Math.max(pageSize, 1)
  const totalCount = records.length
  const totalPage = Math.max(Math.ceil(totalCount / safePageSize), 1)
  const safePage = Math.min(Math.max(page, 1), totalPage)
  const start = (safePage - 1) * safePageSize

  return {
    page: safePage,
    totalPage,
    totalCount,
    topics: records.slice(start, start + safePageSize)
  }
}

/**
 * 删除单条最近浏览话题
 * @param topicId 话题 id
 */
export async function deleteRecentBrowseTopic(topicId: number): Promise<void> {
  const records = { ...getRecentBrowseRecordsMap() }
  delete records[topicId]
  await G.context.globalState.update(RECENT_BROWSE_RECORDS_KEY, records)
}

/**
 * 清空最近浏览话题
 */
export async function clearRecentBrowseTopics(): Promise<void> {
  await G.context.globalState.update(RECENT_BROWSE_RECORDS_KEY, {})
}

/**
 * 监听话题已读变化
 * @param handler 话题已读变化回调
 */
export function onTopicRead(handler: TopicReadHandler): { dispose: () => void } {
  topicReadHandlers.add(handler)
  return {
    dispose: () => topicReadHandlers.delete(handler)
  }
}

/**
 * 获取话题已读记录
 */
function getRecentBrowseRecordsMap(): Record<string, RecentBrowseTopic> {
  const rawRecords = G.context.globalState.get<RecentBrowseRecords>(RECENT_BROWSE_RECORDS_KEY) || {}
  const records = normalizeRecentBrowseRecordsMap(rawRecords)
  if (Object.keys(records).length !== Object.keys(rawRecords).length) {
    G.context.globalState.update(RECENT_BROWSE_RECORDS_KEY, records)
  }
  return records
}

/**
 * 清理话题已读记录
 * @param records 原始记录
 */
function normalizeRecentBrowseRecordsMap(
  records: RecentBrowseRecords
): Record<string, RecentBrowseTopic> {
  const minTimestamp = Date.now() - RECENT_BROWSE_RECORD_TTL_MS
  const entries = Object.entries(records)
    .map(([topicId, record]) => normalizeRecentBrowseRecord(topicId, record))
    .filter(record => record && record.title && record.authorName && record.readAt >= minTimestamp)
    .sort((a, b) => b!.readAt - a!.readAt)
    .slice(0, RECENT_BROWSE_RECORD_LIMIT)

  return Object.fromEntries(entries.map(record => [String(record!.topicId), record!]))
}

/**
 * 规范化单条已读记录
 * @param topicId 话题 id
 * @param record 原始记录
 */
function normalizeRecentBrowseRecord(
  topicId: string,
  record: RecentBrowseTopic | number
): RecentBrowseTopic | undefined {
  const numericTopicId = Number(topicId)
  if (!Number.isFinite(numericTopicId) || numericTopicId <= 0) {
    return undefined
  }

  if (typeof record === 'number') {
    return {
      topicId: numericTopicId,
      title: '',
      authorName: '',
      authorAvatar: '',
      nodeName: '',
      nodeTitle: '',
      publishedAt: '',
      readAt: record
    }
  }

  return {
    topicId: numericTopicId,
    title: record.title || '',
    authorName: record.authorName || '',
    authorAvatar: record.authorAvatar || '',
    nodeName: record.nodeName || '',
    nodeTitle: record.nodeTitle || '',
    publishedAt: formatRecentBrowseTime(record.publishedAt || getLegacyDisplayTime(record)),
    readAt: Number(record.readAt) || Date.now()
  }
}

/**
 * 格式化最近浏览时间
 * @param timeText 时间文本
 */
function formatRecentBrowseTime(timeText: string): string {
  return timeText.trim().replace(/\s+[+-]\d{2}:\d{2}$/, '')
}

/**
 * 读取旧版最近浏览展示时间
 * @param record 最近浏览记录
 */
function getLegacyDisplayTime(record: RecentBrowseTopic): string {
  return 'displayTime' in record && typeof record.displayTime === 'string' ? record.displayTime : ''
}
