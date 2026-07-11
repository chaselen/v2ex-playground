import { Skeleton } from '@douyinfe/semi-ui'
import type { ReactNode } from 'react'
import styles from './PageSkeleton.module.scss'

type PageSkeletonVariant =
  | 'topic'
  | 'member'
  | 'balance'
  | 'search'
  | 'recent'
  | 'node-topics'
  | 'node-tree'
  | 'my'

interface PageSkeletonProps {
  /** 与目标页面结构对应的骨架布局 */
  variant: PageSkeletonVariant
  /** 列表骨架的条目数量 */
  rows?: number
}

interface SkeletonRowsProps {
  /** 占位行数 */
  rows: number
}

/** Webview 首次加载时使用的页面结构化骨架 */
export default function PageSkeleton({ variant, rows = 5 }: PageSkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${styles[variant]}`}
      role="status"
      aria-busy="true"
      aria-label="加载中"
    >
      <Skeleton active placeholder={renderPlaceholder(variant, rows)} loading />
    </div>
  )
}

/** 根据目标页面返回接近真实内容层级的占位结构 */
function renderPlaceholder(variant: PageSkeletonVariant, rows: number): ReactNode {
  switch (variant) {
    case 'topic':
      return <TopicPlaceholder />
    case 'member':
      return <MemberPlaceholder rows={rows} />
    case 'balance':
      return <BalancePlaceholder rows={rows} />
    case 'search':
      return <SearchPlaceholder rows={rows} />
    case 'recent':
      return <RecentPlaceholder rows={rows} />
    case 'node-topics':
      return <CompactTopicRows rows={rows} />
    case 'node-tree':
      return <NodeTreePlaceholder rows={rows} />
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
function TopicPlaceholder() {
  return (
    <div>
      <Skeleton.Title className={styles['topic-title']} />
      <div className={styles['topic-meta']}>
        <Skeleton.Button className={styles.tag} />
        <Skeleton.Title className={styles.author} />
        <Skeleton.Paragraph rows={1} className={styles.time} />
      </div>
      <Skeleton.Paragraph rows={5} />
      <div className={styles.divider} />
      <Skeleton.Title className={styles['section-title']} />
      <ReplyRows rows={3} />
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
      <div className={styles.tabs}>
        <Skeleton.Button />
        <Skeleton.Button />
        <Skeleton.Button />
      </div>
      <TopicRows rows={rows} avatars={false} />
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

/** 最近浏览计数和带头像的话题列表占位 */
function RecentPlaceholder({ rows }: SkeletonRowsProps) {
  return (
    <div>
      <Skeleton.Paragraph rows={1} className={styles.summary} />
      <TopicRows rows={rows} avatars />
    </div>
  )
}

/** 主面板层级节点占位 */
function NodeTreePlaceholder({ rows }: SkeletonRowsProps) {
  return (
    <div className={styles['tree-rows']}>
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles['tree-row']} style={{ paddingLeft: (index % 3) * 18 }} key={index}>
          <Skeleton.Avatar size="extra-extra-small" shape="square" />
          <Skeleton.Title style={{ width: `${58 - (index % 3) * 8}%` }} />
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

/** 主面板使用的紧凑话题行占位 */
function CompactTopicRows({ rows }: SkeletonRowsProps) {
  return (
    <div className={styles['compact-rows']}>
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles['compact-row']} key={index}>
          <Skeleton.Title style={{ width: `${82 - (index % 3) * 9}%` }} />
          <Skeleton.Button className={styles.badge} />
        </div>
      ))}
    </div>
  )
}

/** 通用话题行占位 */
function TopicRows({ rows, avatars }: { rows: number; avatars: boolean }) {
  return (
    <div>
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles.row} key={index}>
          {avatars && <Skeleton.Avatar size="small" />}
          <div className={styles['row-content']}>
            <Skeleton.Title style={{ width: `${82 - (index % 3) * 9}%` }} />
            <Skeleton.Paragraph rows={1} />
          </div>
          <Skeleton.Button className={styles.badge} />
        </div>
      ))}
    </div>
  )
}

/** 话题回复行占位 */
function ReplyRows({ rows }: SkeletonRowsProps) {
  return (
    <div>
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles.reply} key={index}>
          <Skeleton.Avatar size="small" />
          <div className={styles['row-content']}>
            <Skeleton.Title className={styles.author} />
            <Skeleton.Paragraph rows={2} />
          </div>
        </div>
      ))}
    </div>
  )
}
