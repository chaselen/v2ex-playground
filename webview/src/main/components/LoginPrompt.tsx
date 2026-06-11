import { Button, Empty } from '@douyinfe/semi-ui'
import { IllustrationNoAccess, IllustrationNoAccessDark } from '@douyinfe/semi-illustrations'
import type { MainViewRpcCommands } from '../../../../src/shared/webview'
import { createVsCodeClient } from '../../shared/vscode'
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
      <Empty
        title="还未登录，请先登录"
        image={<IllustrationNoAccess className={styles['empty-illustration']} />}
        darkModeImage={<IllustrationNoAccessDark className={styles['empty-illustration']} />}
      >
        <Button size="small" type="primary" theme="solid" onClick={login}>
          登录
        </Button>
      </Empty>
    </div>
  )
}
