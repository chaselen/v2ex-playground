/**
 * 话题
 */
export class Topic {
  /** 主题id */
  public id: number

  /** 标题 */
  public title: string = ''

  /** 节点 */
  public node: Node = new Node()

  /** 链接 */
  public get link(): string {
    return `https://www.v2ex.com/t/${this.id}`
  }

  constructor(id: number) {
    this.id = id
  }
}

/**
 * 话题详情
 */
export class TopicDetail {
  /** id */
  public id: number = 0
  /** 校验参数，可用来判断是否登录或登录是否有效 */
  public once: string = ''
  /** 标题 */
  public title: string = ''
  /** 节点 */
  public node: Node = new Node()
  /** 作者头像 */
  public authorAvatar: string = ''
  /** 作者名字 */
  public authorName: string = ''
  /** 时间 */
  public displayTime: string = ''
  /** 点击次数 */
  public visitCount: number = 0
  /** 内容 */
  public content: string = ''
  /** 追加内容 */
  public appends: TopicAppend[] = []
  /** 收藏人数 */
  public collectCount: number = 0
  /** 感谢人数 */
  public thankCount: number = 0
  /** 是否已收藏 */
  public isCollected: boolean = false
  /** 是否已感谢 */
  public isThanked: boolean = false
  /** 是否能发送感谢（自己的帖子不能发送感谢） */
  public canThank: boolean = true
  /** 收藏/取消收藏参数t */
  public collectParamT: string | null = null
  /** 回复总条数 */
  public replyCount: number = 0
  /** 回复 */
  public replies: TopicReply[] = []

  /** 链接 */
  public get link(): string {
    return `https://www.v2ex.com/t/${this.id}`
  }
}

/**
 * 话题追加内容
 */
export class TopicAppend {
  /** 追加时间 */
  public time: String = ''
  /** 追加内容 */
  public content: string = ''
}

/**
 * 话题回复
 */
export class TopicReply {
  /** 回复id */
  public replyId: string = ''
  /** 用户头像 */
  public userAvatar: string = ''
  /** 用户名 */
  public userName: string = ''
  /** 回复时间 */
  public time: string = ''
  /** 楼层 */
  public floor: string = ''
  /** 回复内容 */
  public content: string = ''
  /** 感谢数 ❤ */
  public thanks: number = 0
  /** 感谢已发送 */
  public thanked: boolean = false
}

/**
 * 节点
 */
export class Node {
  /** 节点名称 */
  public name: string = ''
  /** 节点标题（显示的名称） */
  public title: string = ''

  constructor(name: string = '', title: string = '') {
    this.name = name
    this.title = title
  }
}

/**
 * 签到结果
 */
export enum DailyRes {
  /**签到成功 */
  success = '签到成功',
  /**重复签到 */
  repetitive = '重复签到',
  /**签到失败 */
  failed = '签到失败'
}

/**
 * sov2ex搜索结果的source字段
 */
export class SoV2exSource {
  /**帖子id */
  public id: number = 0
  /**发帖人 */
  public member: string = ''
  /**帖子标题 */
  public title: string = ''
  /**帖子内容 */
  public content: string = ''
  /**回复数量 */
  public replies: number = 0
  /**发帖时间 */
  public created: string = ''
}

/**
 * sov2ex的排序字段
 */
export type SoV2exSort = 'sumup' | 'created'

/**
 * 感谢回复的响应内容
 */
export interface ThankReplyResp {
  /** 是否成功 */
  success: boolean
  /** 新的once */
  once: string | undefined
}
