/** 感谢接口响应 */
export interface ThankResponse {
  /** 是否成功 */
  success: boolean
  /** 错误消息 */
  message?: string
}

/** 需要登录后访问 */
export class LoginRequiredError extends Error {}

/** 账号访问受限 */
export class AccountRestrictedError extends Error {}

/** 登录失效回调 */
export type LoginExpiredHandler = () => void | Promise<void>

/**
 * 账户概览变化回调
 * @param overview 最新账户概览
 * @param oldOverview 旧账户概览
 */
export type AccountOverviewChangedHandler = (
  overview: AccountOverview,
  oldOverview?: AccountOverview
) => void | Promise<void>

/**
 * 话题
 */
export interface Topic {
  /** 主题id */
  id: number

  /** 标题 */
  title: string

  /** 节点 */
  node: Node

  /** 回复数 */
  replies: number

  /** 展示时间 */
  displayTime?: string

  /** 最后回复用户 */
  lastReplyUser?: string
}

/**
 * 话题详情
 */
export interface TopicDetail {
  /** id */
  id: number
  /** 标题 */
  title: string
  /** 节点 */
  node: Node
  /** 作者头像 */
  authorAvatar: string
  /** 作者名字 */
  authorName: string
  /** 时间 */
  displayTime: string
  /** 点击次数 */
  visitCount: number
  /** 内容 */
  content: string
  /** 追加内容 */
  appends: TopicAppend[]
  /** 收藏人数 */
  collectCount: number
  /** 感谢人数 */
  thankCount: number
  /** 是否已收藏 */
  isCollected: boolean
  /** 是否已感谢 */
  isThanked: boolean
  /** 是否能发送感谢（自己的帖子不能发送感谢） */
  canThank: boolean
  /** 收藏/取消收藏参数t */
  collectParamT: string | null
  /** 回复总条数 */
  replyCount: number
  /** 当前回复页码 */
  replyCurrentPage: number
  /** 回复总页数 */
  replyTotalPage: number
  /** 回复 */
  replies: TopicReply[]
}

/**
 * 话题追加内容
 */
export interface TopicAppend {
  /** 追加时间 */
  time: string
  /** 追加内容 */
  content: string
}

/**
 * 话题回复
 */
export interface TopicReply {
  /** 回复id */
  replyId: string
  /** 用户头像 */
  userAvatar: string
  /** 用户名 */
  userName: string
  /** 回复时间 */
  time: string
  /** 楼层 */
  floor: string
  /** 回复内容 */
  content: string
  /** 感谢数 ❤ */
  thanks: number
  /** 感谢已发送 */
  thanked: boolean
}

/**
 * 节点
 */
export interface Node {
  /** 节点 name，如 /go/programmer 中的 programmer */
  name: string
  /** 节点展示标题，如“程序员” */
  title: string
}

/** 签到结果 */
export type DailyRes = 'success' | 'repetitive' | 'failed'

/** 每日签到结果 */
export interface DailySignInResult {
  /** 签到结果 */
  result: DailyRes
  /** 当日签到奖励铜币数 */
  reward: number
}

/**
 * 账户概览
 */
export interface AccountOverview {
  /** 头像地址 */
  avatar: string
  /** 用户名 */
  username: string
  /** 节点收藏数量 */
  nodeCollectionCount: number
  /** 主题收藏数量 */
  topicCollectionCount: number
  /** 特别关注数量 */
  specialFollowingCount: number
  /** 活跃度百分比 */
  activityPercent: number
  /** 未读提醒数量 */
  unreadNoticeCount: number
  /** 金币数量 */
  gold: number
  /** 银币数量 */
  silver: number
  /** 铜币数量 */
  bronze: number
}

/**
 * 提醒消息
 */
export interface V2exNotification {
  /** 提醒 id */
  id: number
  /** 用户头像 */
  avatar: string
  /** 用户名 */
  username: string
  /** 用户主页路径 */
  memberPath: string
  /** 提醒摘要 HTML */
  summaryHtml: string
  /** 话题 id */
  topicId?: number
  /** 话题标题 */
  topicTitle?: string
  /** 话题路径 */
  topicPath?: string
  /** 展示时间 */
  time: string
  /** 消息正文 HTML */
  payloadHtml: string
}

/** 用户页话题分类标签 */
export type MemberTopicTabKey = 'qna' | 'tech' | 'play' | 'jobs' | 'deals' | 'city'

/** 用户页内容标签 */
export type MemberContentTabKey = 'topics' | 'replies' | MemberTopicTabKey

/**
 * 用户基本信息
 */
export interface MemberInfo {
  /** 头像地址 */
  avatar: string
  /** 用户名 */
  username: string
  /** 会员编号 */
  memberNumber: number
  /** 加入时间 */
  joinedAt: string
  /** 今日活跃度排名 */
  activityRank?: number
}

/**
 * 用户回复
 */
export interface MemberReply {
  /** 话题 id */
  topicId?: number
  /** 话题标题 */
  topicTitle: string
  /** 话题路径 */
  topicPath: string
  /** 节点 */
  node: Node
  /** 话题作者 */
  topicAuthor: string
  /** 展示时间 */
  time: string
  /** 摘要 HTML */
  summaryHtml: string
  /** 回复内容 HTML */
  contentHtml: string
}

/**
 * 用户页内容
 */
export interface MemberContent {
  /** 标签 key */
  tab: MemberContentTabKey
  /** 当前页码 */
  page: number
  /** 总页数 */
  totalPage: number
  /** 总数 */
  totalCount: number
  /** 话题列表 */
  topics: Topic[]
  /** 回复列表 */
  replies: MemberReply[]
  /** 内容是否被隐藏 */
  hidden: boolean
  /** 空态或隐藏提示 */
  message: string
}

/**
 * 用户活动请求选项
 */
export interface MemberContentOptions {
  /** 内容标签 */
  tab?: MemberContentTabKey
  /** 页码 */
  page?: number
}

/**
 * 用户页资料
 */
export interface MemberProfile {
  /** 用户基本信息 */
  member: MemberInfo
  /** 当前内容 */
  content: MemberContent
}

/**
 * sov2ex搜索结果的source字段
 */
export interface SoV2exSource {
  /**帖子id */
  id: number
  /**发帖人 */
  member: string
  /**帖子标题 */
  title: string
  /**帖子内容 */
  content: string
  /**回复数量 */
  replies: number
  /**发帖时间 */
  created: string
}

/**
 * sov2ex的排序字段
 */
export type SoV2exSort = 'sumup' | 'created'
