import { Skeleton } from '@/components/ui'
import type { ReactNode } from 'react'
import styles from './PageSkeleton.module.scss'

type PageSkeletonVariant =
  | 'topic'
  | 'member'
  | 'member-topics'
  | 'member-replies'
  | 'balance'
  | 'search'
  | 'tag-topics'
  | 'recent'
  | 'node-topics'
  | 'node-tree'
  | 'my'

interface PageSkeletonProps {
  /** 与目标页面结构对应的骨架布局 */
  variant: PageSkeletonVariant
  /** 列表骨架的条目数量 */
  rows?: number
  /** 话题骨架是否显示头像 */
  showAvatar?: boolean
}

interface SkeletonRowsProps {
  /** 占位行数 */
  rows: number
}

/** 话题标题骨架宽度序列（长短交错，避免单调递增） */
const topicTitleWidths = [72, 54, 84, 61, 78, 58, 80, 66]

/** Webview 首次加载时使用的页面结构化骨架 */
export default function PageSkeleton({ variant, rows = 5, showAvatar = true }: PageSkeletonProps) {
  return (
    <Skeleton
      active
      className={`${styles.skeleton} ${styles[variant]}`}
      role="status"
      aria-busy="true"
      aria-label="加载中"
    >
      {renderPlaceholder(variant, rows, showAvatar)}
    </Skeleton>
  )
}

/** 根据目标页面返回接近真实内容层级的占位结构 */
function renderPlaceholder(
  variant: PageSkeletonVariant,
  rows: number,
  showAvatar: boolean
): ReactNode {
  switch (variant) {
    case 'topic':
      return <TopicPlaceholder showAvatar={showAvatar} />
    case 'member':
      return <MemberPlaceholder rows={rows} />
    case 'member-topics':
      return <TopicRows rows={rows} avatars={false} />
    case 'member-replies':
      return <MemberReplyRows rows={rows} />
    case 'balance':
      return <BalancePlaceholder rows={rows} />
    case 'search':
      return <SearchPlaceholder rows={rows} />
    case 'tag-topics':
      return <TagTopicsPlaceholder rows={rows} />
    case 'recent':
      return <RecentPlaceholder rows={rows} />
    case 'node-topics':
      return <NodeTopicsPlaceholder rows={rows} />
    case 'node-tree':
      return <NodeTreePlaceholder rows={rows} showAvatar={showAvatar} />
    case 'my':
      return <MyPlaceholder rows={rows} />
  }

  return assertNever(variant)
}

/** 在新增骨架变体时强制同步占位结构 */
function assertNever(variant: never): never {
  throw new Error(`未处理的骨架屏类型：${variant}`)
}

/** 话题标题、元信息、正文和回复区占位 */
function TopicPlaceholder({ showAvatar }: { showAvatar: boolean }) {
  return (
    <div>
      <div className={styles['topic-header']}>
        <Skeleton.Title className={styles['topic-title']} />
        {showAvatar && (
          <Skeleton.Avatar className={styles['topic-avatar']} size="large" shape="square" />
        )}
      </div>
      <div className={styles['topic-meta']}>
        <Skeleton.Button className={styles.tag} />
        <Skeleton.Title className={styles.author} />
        <Skeleton.Paragraph rows={1} className={styles.time} />
        <div className={styles['topic-tags']}>
          <Skeleton.Button />
          <Skeleton.Button />
        </div>
      </div>
      <Skeleton.Paragraph rows={5} />
      <div className={styles.divider} />
      <Skeleton.Title className={styles['section-title']} />
      <ReplyRows rows={3} avatars={showAvatar} />
    </div>
  )
}

/** 用户头像、资料、标签页和动态列表占位 */
function MemberPlaceholder({ rows }: SkeletonRowsProps) {
  return (
    <div>
      <div className={styles.profile}>
        <Skeleton.Avatar size="large" shape="square" />
        <div className={styles['profile-main']}>
          <Skeleton.Title className={styles.username} />
          <Skeleton.Paragraph rows={2} className={styles['profile-meta']} />
        </div>
        <Skeleton.Button className={styles['icon-button']} />
      </div>
      {/* 对齐真实页 .member-content：资料区下方再接标签与列表 */}
      <div className={styles['member-body']}>
        <div className={styles.tabs}>
          <Skeleton.Button />
          <Skeleton.Button />
          <Skeleton.Button />
        </div>
        <TopicRows rows={rows} avatars={false} />
      </div>
    </div>
  )
}

/** 用户页标签内容：最近回复列表占位（对齐 .member-reply-item） */
function MemberReplyRows({ rows }: SkeletonRowsProps) {
  return (
    <div className={styles['member-reply-list']}>
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles['member-reply']} key={index}>
          <div className={styles['member-reply-meta']}>
            <Skeleton.Paragraph rows={1} className={styles['member-reply-summary']} />
            <Skeleton.Paragraph rows={1} className={styles['member-reply-time']} />
          </div>
          <Skeleton.Paragraph rows={2} className={styles['member-reply-body']} />
        </div>
      ))}
    </div>
  )
}

/** 余额摘要、操作按钮和流水表格占位 */
function BalancePlaceholder({ rows }: SkeletonRowsProps) {
  return (
    <div>
      <div className={styles['balance-header']}>
        <div className={styles['balance-summary']}>
          <Skeleton.Paragraph rows={1} className={styles.eyebrow} />
          <Skeleton.Title className={styles.wallet} />
        </div>
        <div className={styles.actions}>
          <Skeleton.Button />
          <Skeleton.Button />
        </div>
      </div>
      <div className={styles['balance-ledger']}>
        <div className={styles['table-head']}>
          <Skeleton.Title />
          <Skeleton.Title />
          <Skeleton.Title />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <div className={styles['table-row']} key={index}>
            <Skeleton.Paragraph rows={1} />
            <Skeleton.Paragraph rows={1} />
            <Skeleton.Paragraph rows={1} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** 搜索结果摘要和卡片列表占位 */
function SearchPlaceholder({ rows }: SkeletonRowsProps) {
  return (
    <div>
      <Skeleton.Paragraph rows={1} className={styles.summary} />
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles['search-card']} key={index}>
          <Skeleton.Title style={{ width: `${78 - (index % 3) * 8}%` }} />
          <Skeleton.Paragraph rows={1} className={styles['search-meta']} />
          <Skeleton.Paragraph rows={2} />
        </div>
      ))}
    </div>
  )
}

/** 标签标题、主题计数和列表占位 */
function TagTopicsPlaceholder({ rows }: SkeletonRowsProps) {
  return (
    <div>
      <div className={styles['tag-header']}>
        <div>
          <Skeleton.Paragraph rows={1} className={styles.eyebrow} />
          <Skeleton.Title className={styles['tag-title']} />
          <Skeleton.Paragraph rows={1} className={styles.summary} />
        </div>
        <Skeleton.Button />
      </div>
      <TopicRows rows={rows} avatars={false} />
    </div>
  )
}

/** 节点头像、标题、简介和主题列表占位 */
function NodeTopicsPlaceholder({ rows }: SkeletonRowsProps) {
  return (
    <div>
      <div className={styles['node-header']}>
        <div className={styles['node-header-main']}>
          <Skeleton.Avatar size="large" shape="square" />
          <div className={styles['node-header-text']}>
            <Skeleton.Paragraph rows={1} className={styles.eyebrow} />
            <Skeleton.Title className={styles['node-title']} />
            <Skeleton.Paragraph rows={2} className={styles['node-description']} />
            <Skeleton.Paragraph rows={1} className={styles.summary} />
          </div>
        </div>
        <Skeleton.Button />
      </div>
      <TopicRows rows={rows} avatars={false} />
    </div>
  )
}

/** 最近浏览计数和带头像的话题列表占位 */
function RecentPlaceholder({ rows }: SkeletonRowsProps) {
  return (
    <div>
      <Skeleton.Paragraph rows={1} className={styles.summary} />
      <TopicRows rows={rows} avatars />
    </div>
  )
}

/**
 * 构建节点树骨架分组
 * 真实页面只有「节点 / 话题」两级：前若干节点展开话题，其余为折叠节点
 * rows 控制大致可见行数（节点行 + 话题行）
 */
function buildNodeTreeGroups(rows: number): number[] {
  const target = Math.max(rows, 4)
  const groups: number[] = []
  let used = 0

  // 第一个节点展开 3 条话题
  groups.push(3)
  used += 4

  // 仍有空间时再展开一个节点
  if (used + 3 <= target) {
    groups.push(2)
    used += 3
  }

  while (used < target) {
    groups.push(0)
    used += 1
  }

  return groups
}

/** 主面板节点树占位：节点 / 话题两级，对齐自定义与收藏页 */
function NodeTreePlaceholder({
  rows,
  showAvatar
}: SkeletonRowsProps & {
  /** 是否预留节点图标占位；自定义 / 收藏列表为 true */
  showAvatar: boolean
}) {
  const groups = buildNodeTreeGroups(rows)

  return (
    <div className={styles['tree-rows']}>
      {groups.map((topicCount, nodeIndex) => (
        <div className={styles['tree-group']} key={nodeIndex}>
          <div className={styles['tree-node']}>
            <Skeleton.Avatar
              size="extra-extra-small"
              shape="square"
              className={styles['tree-chevron']}
            />
            {showAvatar ? (
              <Skeleton.Avatar
                size="extra-extra-small"
                shape="square"
                className={styles['tree-node-avatar']}
              />
            ) : null}
            <Skeleton.Title
              className={styles['tree-node-label']}
              style={{ width: `${46 + (nodeIndex % 3) * 12}%` }}
            />
          </div>
          {Array.from({ length: topicCount }, (_, topicIndex) => (
            <div className={styles['tree-topic']} key={topicIndex}>
              <Skeleton.Title
                className={styles['tree-topic-title']}
                style={{
                  width: `${topicTitleWidths[(nodeIndex + topicIndex * 2) % topicTitleWidths.length]}%`
                }}
              />
              <Skeleton.Button className={styles.badge} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** “我的”账户卡片、统计项和内容标签页占位 */
function MyPlaceholder({ rows }: SkeletonRowsProps) {
  return (
    <div>
      <div className={styles['my-card']}>
        <div className={styles['my-profile']}>
          <Skeleton.Avatar className={styles['my-avatar']} shape="square" />
          <Skeleton.Title className={styles.username} />
          <Skeleton.Button className={styles['my-profile-action']} />
        </div>
        <div className={styles.stats}>
          {Array.from({ length: 3 }, (_, index) => (
            <div className={styles.stat} key={index}>
              <Skeleton.Title />
              <Skeleton.Paragraph rows={1} />
            </div>
          ))}
        </div>
        <div className={styles['activity-row']}>
          <Skeleton.Paragraph rows={1} />
        </div>
        <div className={styles['wallet-row']}>
          <Skeleton.Title />
          <Skeleton.Title />
        </div>
        <div className={styles['sign-in-row']}>
          <Skeleton.Button />
        </div>
      </div>
      <div className={styles.tabs}>
        <Skeleton.Button />
        <Skeleton.Button />
        <Skeleton.Button />
      </div>
      <CompactTopicRows rows={rows} />
    </div>
  )
}

/** 主面板使用的紧凑话题行占位（标题宽度有变化，回复数 margin-left:auto 居右） */
function CompactTopicRows({ rows }: SkeletonRowsProps) {
  return (
    <div className={styles['compact-rows']}>
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles['compact-row']} key={index}>
          <Skeleton.Title
            className={styles['compact-row-title']}
            style={{ width: `${topicTitleWidths[index % topicTitleWidths.length]}%` }}
          />
          <Skeleton.Button className={styles.badge} />
        </div>
      ))}
    </div>
  )
}

/** 通用话题行占位（对齐 TopicListItem：标题+回复数 / 元信息） */
function TopicRows({ rows, avatars }: { rows: number; avatars: boolean }) {
  return (
    <div>
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles.row} key={index}>
          {avatars && <Skeleton.Avatar size="small" />}
          <div className={styles['row-content']}>
            <div className={styles['row-title']}>
              <Skeleton.Title style={{ width: `${62 - (index % 3) * 8}%` }} />
              <Skeleton.Button className={styles.badge} />
            </div>
            {/* 第二行对齐 meta：节点标签 + 时间，实际内容较短 */}
            <Skeleton.Paragraph
              rows={1}
              className={styles['row-meta']}
              style={{ width: `${42 - (index % 3) * 6}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** 话题回复行占位 */
function ReplyRows({ rows, avatars }: SkeletonRowsProps & { avatars: boolean }) {
  return (
    <div className={styles['reply-list']}>
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles.reply} key={index}>
          {avatars && <Skeleton.Avatar size="small" />}
          <div className={styles['row-content']}>
            <Skeleton.Title className={styles.author} />
            <Skeleton.Paragraph rows={2} />
          </div>
        </div>
      ))}
    </div>
  )
}
