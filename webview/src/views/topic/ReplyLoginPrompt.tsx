import { CircleUserRound, Lock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui'
import styles from './ReplyLoginPrompt.module.scss'

export interface ReplyLoginPromptProps {
  /** 是否正在刷新 */
  refreshing?: boolean
  /** 点击登录 */
  onLogin: () => void
  /** 点击刷新 */
  onRefresh: () => void
}

/** 未登录时的回复区提示 */
export default function ReplyLoginPrompt({
  refreshing = false,
  onLogin,
  onRefresh
}: ReplyLoginPromptProps) {
  return (
    <section className={styles.root} aria-label="登录后回复">
      <div className={styles.icon}>
        <Lock aria-hidden="true" />
      </div>
      <div className={styles.content}>
        <h2>登录后参与回复</h2>
        <p>登录 V2EX 账号后，才能回复话题、感谢回复者，并使用收藏等话题操作。</p>
      </div>
      <div className={styles.actions}>
        <Button
          icon={<CircleUserRound aria-hidden="true" />}
          size="small"
          variant="primary"
          onClick={onLogin}
        >
          登录 V2EX
        </Button>
        <Button
          icon={<RefreshCw aria-hidden="true" />}
          loading={refreshing}
          size="small"
          variant="secondary"
          onClick={onRefresh}
        >
          刷新
        </Button>
      </div>
    </section>
  )
}
