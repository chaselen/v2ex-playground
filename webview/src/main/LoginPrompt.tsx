import { Button, Empty } from '@douyinfe/semi-ui'
import { IllustrationNoAccess, IllustrationNoAccessDark } from '@douyinfe/semi-illustrations'
import { postVsCodeMessage } from '../shared/vscode'

/**
 * 登录
 */
function login() {
  postVsCodeMessage('login')
}

/**
 * 登录提示
 */
export default function LoginPrompt() {
  return (
    <div className="empty-panel">
      <Empty
        title="还未登录，请先登录"
        image={<IllustrationNoAccess className="empty-illustration" />}
        darkModeImage={<IllustrationNoAccessDark className="empty-illustration" />}
      >
        <Button size="small" type="primary" theme="solid" onClick={login}>
          登录
        </Button>
      </Empty>
    </div>
  )
}
