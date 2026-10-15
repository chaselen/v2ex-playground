import { useEffect, useState } from 'react'
import { Alert, Button, Dialog, Skeleton } from '@/components/ui'
import { createVsCodeClient } from '@/core/vscode'
import type { TopicPanelRpcCommands } from '@extension/shared/topicView'
import type { TopicInfo } from '@extension/v2ex/types'
import styles from './TopicInfoDialog.module.scss'

const vscode = createVsCodeClient<TopicPanelRpcCommands>()

/** 每次打开读取最新信息，关闭或切换话题后丢弃旧请求 */
export default function TopicInfoDialog({
  topicId,
  onClose
}: {
  topicId: number
  onClose(): void
}) {
  const [info, setInfo] = useState<TopicInfo>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setInfo(undefined)
    setError('')
    void vscode.getTopicInfo(topicId).then(
      result => {
        if (active) setInfo(result)
      },
      error => {
        if (active) setError(error instanceof Error ? error.message : '加载帖子信息失败')
      }
    )
    return () => {
      active = false
    }
  }, [topicId, attempt])
  return (
    <Dialog
      open
      className={styles.dialog}
      title="帖子信息"
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      {error ? (
        <div className={styles.error}>
          <Alert variant="danger" title="加载失败">
            {error}
          </Alert>
          <Button onClick={() => setAttempt(value => value + 1)}>重试</Button>
        </div>
      ) : info ? (
        <dl className={styles.fields}>
          {info.fields.map(({ label, value }) => (
            <div className={styles.row} key={label}>
              <dt>{label}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <Skeleton active role="status" aria-busy="true" aria-label="正在加载帖子信息">
          <div className={styles.fields} aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => (
              <div className={styles.row} key={index}>
                <Skeleton.Title className={styles.labelPlaceholder} />
                <div className={styles.valuePlaceholder}>
                  <Skeleton.Title
                    className={
                      index === 3 || index === 4 ? styles.longPlaceholder : styles.shortPlaceholder
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </Skeleton>
      )}
    </Dialog>
  )
}
