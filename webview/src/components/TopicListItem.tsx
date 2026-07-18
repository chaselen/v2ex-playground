import type { Node, Topic } from '@extension/v2ex/types'
import NodeButton from '@/components/NodeButton'
import { Badge } from '@/components/ui'
import styles from './TopicListItem.module.scss'

interface TopicListItemProps {
  /** 主题数据 */
  topic: Topic
  /** 列表项外观 */
  appearance?: 'row' | 'card'
  /** 是否展示作者 */
  showAuthor?: boolean
  /** 打开主题 */
  onOpenTopic: (topic: Topic) => void
  /** 打开用户 */
  onOpenMember: (username: string) => void
  /** 打开节点 */
  onOpenNode: (node: Node) => void
}

/**
 * 标准主题列表项
 * @param props 组件属性
 */
export default function TopicListItem(props: TopicListItemProps) {
  const {
    topic,
    appearance = 'row',
    showAuthor = false,
    onOpenTopic,
    onOpenMember,
    onOpenNode
  } = props

  const itemClassName = [
    styles.item,
    appearance === 'row' ? styles.row : '',
    appearance === 'card' ? styles.card : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={itemClassName}>
      <div className={styles['title-row']}>
        <button
          type="button"
          className={styles.title}
          title={topic.title}
          onClick={() => onOpenTopic(topic)}
        >
          {topic.title}
        </button>
        {topic.replies > 0 && (
          <Badge count={topic.replies} overflowCount={99} countClassName={styles.badge} />
        )}
      </div>
      <div className={styles.meta}>
        {!!topic.node.title && (
          <NodeButton
            className={styles.node}
            aria-label={`打开节点：${topic.node.title}`}
            onClick={() => onOpenNode(topic.node)}
          >
            {topic.node.title}
          </NodeButton>
        )}
        {showAuthor && !!topic.authorName && (
          <MemberButton username={topic.authorName} onOpenMember={onOpenMember} />
        )}
        {!!topic.displayTime && (
          <span title={topic.publishedAt || topic.displayTime}>{topic.displayTime}</span>
        )}
        {!!topic.lastReplyUser && (
          <span>
            最后回复来自 <MemberButton username={topic.lastReplyUser} onOpenMember={onOpenMember} />
          </span>
        )}
      </div>
    </article>
  )
}

/**
 * 用户链接按钮
 * @param props 组件属性
 */
function MemberButton(props: { username: string; onOpenMember: (username: string) => void }) {
  const { username, onOpenMember } = props

  return (
    <button type="button" className={styles['meta-button']} onClick={() => onOpenMember(username)}>
      {username}
    </button>
  )
}
