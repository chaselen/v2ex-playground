/**
 * 最近浏览话题
 */
export interface RecentBrowseTopic {
  /** 话题 id */
  topicId: number
  /** 话题标题 */
  title: string
  /** 作者名称 */
  authorName: string
  /** 作者头像 */
  authorAvatar: string
  /** 节点 name */
  nodeName: string
  /** 节点展示标题 */
  nodeTitle: string
  /** 发布时间，通常为 YYYY-MM-DD HH:mm:ss；旧记录可能为 V2EX 展示文本 */
  publishedAt: string
  /** 最近浏览 Unix 时间戳，单位为毫秒 */
  readAt: number
}

/**
 * 最近浏览列表数据
 */
export interface RecentBrowseListData {
  /** 当前页码 */
  page: number
  /** 总页数 */
  totalPage: number
  /** 话题总数 */
  totalCount: number
  /** 话题列表 */
  topics: RecentBrowseTopic[]
}
