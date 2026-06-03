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
  /** 节点名称 */
  name: string
  /** 节点标题（显示的名称） */
  title: string
}

/** 签到结果 */
export type DailyRes = 'success' | 'repetitive' | 'failed'

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
