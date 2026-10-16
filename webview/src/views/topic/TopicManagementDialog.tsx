import { useEffect, useRef, useState, type RefObject } from 'react'
import { Alert, Button, Dialog, Spinner, Toast } from '@/components/ui'
import { createVsCodeClient } from '@/core/vscode'
import type { TopicManagementAction } from '@extension/v2ex/types'
import type { TopicPanelRpcCommands } from '@extension/shared/topicView'
import styles from './TopicManagementDialog.module.scss'

const vscode = createVsCodeClient<TopicPanelRpcCommands>()

/** 读取最新操作说明，在独立模态框中确认展示管理操作 */
export default function TopicManagementDialog({
  action,
  returnFocusRef,
  onClose
}: {
  action: TopicManagementAction
  returnFocusRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [preparing, setPreparing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [retry, setRetry] = useState(0)
  const busyRef = useRef(false)

  useEffect(() => {
    let active = true
    setPreparing(true)
    setConfirmation('')
    setError('')
    vscode
      .prepareTopicManagement(action)
      .then(state => {
        if (active) setConfirmation(state.confirmation)
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => {
        if (active) setPreparing(false)
      })
    return () => {
      active = false
    }
  }, [action, retry])

  async function submit() {
    if (busyRef.current || submitted || preparing || !confirmation) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await vscode.manageTopic({ action, confirmation })
      Toast.success(action === 'boost' ? '主题已放到首页' : '主题已下沉')
      onClose()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setError(message)
      // 已写入但刷新失败时，禁止当前确认框重复提交
      if (message.includes('操作已提交')) setSubmitted(true)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      title={action === 'boost' ? '放到首页' : '下沉主题'}
      closeOnOverlayClick={false}
      finalFocus={returnFocusRef}
      onOpenChange={(next, details) => {
        if (!next && busyRef.current) {
          details.cancel()
          return
        }
        if (!next) onClose()
      }}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            关闭
          </Button>
          {!preparing && !confirmation && !submitted && (
            <Button onClick={() => setRetry(value => value + 1)}>重新读取</Button>
          )}
          <Button
            variant="primary"
            loading={busy}
            disabled={busy || submitted || preparing || !confirmation}
            onClick={() => void submit()}
          >
            {action === 'boost' ? '确认付费并放到首页' : '确认下沉'}
          </Button>
        </>
      }
    >
      <div className={styles.body} aria-busy={preparing || busy}>
        {error && <Alert variant="danger" title="操作失败" description={error} />}
        {preparing ? (
          <div className={styles.loading} role="status">
            <Spinner />
            正在核对操作说明…
          </div>
        ) : (
          confirmation && <p>{confirmation}</p>
        )}
      </div>
    </Dialog>
  )
}
