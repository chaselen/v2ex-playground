import { LogIn } from 'lucide-react'
import type { MainViewRpcCommands } from '@extension/shared/webview'
import { Button, Empty } from '@/components/ui'
import { createVsCodeClient } from '@/core/vscode'
import styles from './LoginPrompt.module.scss'

/** 主面板 VS Code 通信客户端 */
const vscode = createVsCodeClient<MainViewRpcCommands>()

/**
 * 登录
 */
function login() {
  vscode.login()
}

/**
 * 登录提示
 */
export default function LoginPrompt() {
  return (
    <div className={styles['empty-panel']}>
      <Empty title="还未登录，请先登录" icon={<LogIn />}>
        <Button size="small" variant="primary" onClick={login}>
          登录
        </Button>
      </Empty>
    </div>
  )
}
