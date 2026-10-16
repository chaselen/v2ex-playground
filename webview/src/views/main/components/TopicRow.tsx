import type { MouseEvent } from 'react'
import type { MainViewRpcCommands } from '@extension/shared/webview'
import TopicShareContextMenu from '@/components/TopicShareContextMenu'
import { Badge } from '@/components/ui'
import { createVsCodeClient } from '@/core/vscode'
import styles from './TopicRow.module.scss'

/** 主面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<MainViewRpcCommands>()

interface TopicRowProps {
  /** 主题 id */
  topicId: number
  /** 主题标题 */
  title: string
  /** 回复数 */
  replies?: number
  /** 渲染元素 */
  as?: 'div' | 'button'
  /** 附加类名 */
  className?: string
  /** 是否点击时打开主题 */
  openOnClick?: boolean
  /** 是否已读 */
  isRead?: boolean
}

/**
 * 主题行
 * @param props 组件参数
 */
export default function TopicRow(props: TopicRowProps) {
  const { topicId, title, replies, as = 'div', className, openOnClick = true, isRead } = props

  /**
   * 打开主题
   * @param event 鼠标事件
   */
  function openTopic(event: MouseEvent<HTMLElement>) {
    event.stopPropagation()
    vscode.openTopic(topicId, title)
  }

  const content = (
    <>
      <span className={styles['topic-title']}>{title}</span>
      {!!replies && replies > 0 && (
        <Badge count={replies} overflowCount={99} countClassName={styles.badge} />
      )}
    </>
  )
  const rowClassName = [styles['topic-row'], isRead ? styles['topic-row--read'] : '', className]
    .filter(Boolean)
    .join(' ')
  const row =
    as === 'button' ? (
      <button
        type="button"
        className={rowClassName}
        title={title}
        onClick={openOnClick ? openTopic : undefined}
      >
        {content}
      </button>
    ) : (
      <div className={rowClassName} title={title} onClick={openOnClick ? openTopic : undefined}>
        {content}
      </div>
    )

  return (
    <TopicShareContextMenu
      compact
      onCopyLink={() => vscode.ctxCopyLink(topicId)}
      onCopyTitleLink={() => vscode.ctxCopyTitleLink(topicId, title)}
      onViewInBrowser={() => vscode.ctxViewInBrowser(topicId)}
    >
      {row}
    </TopicShareContextMenu>
  )
}
