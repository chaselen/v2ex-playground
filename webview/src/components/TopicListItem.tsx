import { Card } from '@douyinfe/semi-ui'
import type { Node, Topic } from '@extension/v2ex/types'
import { VscodeBadge, VscodeTag } from '@/components/SemiVscode'
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

  const content = (
    <article className={`${styles.item} ${appearance === 'row' ? styles.row : ''}`}>
      <div className={styles['title-row']}>
        <button
          type="button"
          className={styles.title}
          title={topic.title}
          onClick={() => onOpenTopic(topic)}
        >
          {topic.title}
        </button>
        {topic.replies > 0 && <VscodeBadge count={topic.replies} overflowCount={99} />}
      </div>
      <div className={styles.meta}>
        {!!topic.node.title && (
          <button
            type="button"
            className={styles.node}
            aria-label={`打开节点：${topic.node.title}`}
            onClick={() => onOpenNode(topic.node)}
          >
            <VscodeTag size="small">{topic.node.title}</VscodeTag>
          </button>
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

  if (appearance === 'card') {
    return <Card className={styles.card}>{content}</Card>
  }

  return content
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
