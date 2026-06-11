import { Empty, Spin } from '@douyinfe/semi-ui'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import SimpleBar from 'simplebar-react'
import type { NodeTopicTab } from '../types'
import MainPagination from './MainPagination'
import TopicRow from './TopicRow'
import styles from './NodeTopicPanel.module.scss'

interface NodeTopicPanelProps {
  /** 节点主题标签状态 */
  node: NodeTopicTab
  /** 页码变化回调 */
  onPageChange: (page: number) => void
}

/**
 * 节点主题列表
 * @param props 组件参数
 */
export default function NodeTopicPanel(props: NodeTopicPanelProps) {
  const { node, onPageChange } = props

  return (
    <section className={styles['node-topic-panel']}>
      <SimpleBar className={styles['node-topic-scroll']} autoHide={false}>
        {node.loading && !node.topics.length ? (
          <div className={styles['panel-state']}>
            <Spin size="middle" />
          </div>
        ) : node.error && !node.topics.length ? (
          <div className={`${styles['panel-state']} ${styles['error-text']}`}>{node.error}</div>
        ) : !node.topics.length ? (
          <div className={styles['panel-state']}>
            <Empty
              title="暂无话题"
              image={<IllustrationNoContent className={styles['empty-illustration']} />}
              darkModeImage={<IllustrationNoContentDark className={styles['empty-illustration']} />}
            />
          </div>
        ) : (
          <div className={styles['topic-list']}>
            {node.error && <div className={styles['error-banner']}>{node.error}</div>}
            {node.topics.map(topic => (
              <TopicRow
                key={topic.id}
                topicId={topic.id}
                title={topic.title}
                replies={topic.replies}
                className={styles['topic-row']}
              />
            ))}
          </div>
        )}
      </SimpleBar>

      {node.totalPage > 1 && (
        <footer className={styles['pagination']}>
          <MainPagination
            currentPage={node.page}
            totalPage={node.totalPage}
            totalCount={node.totalCount}
            disabled={node.loading}
            onPageChange={page => {
              if (page !== node.page) {
                onPageChange(page)
              }
            }}
          />
        </footer>
      )}
    </section>
  )
}
