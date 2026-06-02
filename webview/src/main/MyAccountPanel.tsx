import { Avatar, Button, Empty, Progress, Spin } from '@douyinfe/semi-ui'
import { IconHelpCircle, IconUser } from '@douyinfe/semi-icons'
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations'
import SimpleBar from 'simplebar-react'
import { postVsCodeMessage } from '../shared/vscode'
import type { WebviewAccountOverview } from '../../../src/shared/webview'

interface MyAccountPanelProps {
  /** 是否加载中 */
  loading?: boolean
  /** 是否已登录 */
  loggedIn: boolean
  /** 账户概览 */
  overview?: WebviewAccountOverview
}

/** 收藏统计字段 */
type AccountStatKey = 'nodeCollectionCount' | 'topicCollectionCount' | 'specialFollowingCount'

/** 收藏统计项 */
const statItems: Array<{ key: AccountStatKey; label: string; path: string }> = [
  { key: 'nodeCollectionCount', label: '节点收藏', path: '/my/nodes' },
  { key: 'topicCollectionCount', label: '主题收藏', path: '/my/topics' },
  { key: 'specialFollowingCount', label: '特别关注', path: '/my/following' }
]

/**
 * 登录
 */
function login() {
  postVsCodeMessage('login')
}

/**
 * 打开 V2EX 链接
 * @param path 目标路径
 */
function openExternal(path: string) {
  postVsCodeMessage('openExternal', { path })
}

/**
 * 账户概览面板
 * @param props 组件参数
 */
export default function MyAccountPanel(props: MyAccountPanelProps) {
  const { loading, loggedIn, overview } = props

  if (loading) {
    return (
      <section className="my-panel">
        <div className="loading-panel">
          <Spin size="middle" />
        </div>
      </section>
    )
  }

  if (!loggedIn || !overview) {
    return (
      <section className="my-panel">
        <div className="empty-panel">
          <Empty
            title={loggedIn ? '暂无账户概览' : '还未登录，请先登录'}
            image={<IllustrationNoContent className="empty-illustration" />}
            darkModeImage={<IllustrationNoContentDark className="empty-illustration" />}
          >
            {!loggedIn && (
              <Button size="small" type="primary" theme="solid" onClick={login}>
                登录
              </Button>
            )}
          </Empty>
        </div>
      </section>
    )
  }

  /** 活跃度百分比 */
  const activityPercent = Math.min(Math.max(overview.activityPercent, 0), 100)

  return (
    <section className="my-panel">
      <SimpleBar className="my-scroll" autoHide={false}>
        <article className="my-card">
          <header className="my-profile">
            <button
              type="button"
              className="my-link my-avatar-link"
              title={overview.username}
              onClick={() => openExternal(`/member/${overview.username}`)}
            >
              <Avatar
                size="large"
                shape="square"
                src={overview.avatar}
                alt={overview.username}
                className="my-avatar"
              >
                <IconUser />
              </Avatar>
            </button>
            <button
              type="button"
              className="my-link my-identity"
              title={overview.username}
              onClick={() => openExternal(`/member/${overview.username}`)}
            >
              {overview.username}
            </button>
          </header>

          <div className="my-stats">
            {statItems.map(item => (
              <button
                type="button"
                className="my-link my-stat"
                key={item.key}
                onClick={() => openExternal(item.path)}
              >
                <strong>{overview[item.key]}</strong>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="my-activity">
            <Progress
              percent={activityPercent}
              showInfo
              format={() => `${overview.activityPercent}%`}
              stroke="#f59e0b"
              orbitStroke="color-mix(in srgb, #f59e0b 18%, var(--v2ex-widget-bg))"
              style={{ height: 6 }}
              className="my-activity-progress"
              aria-label="活跃度"
            />
          </div>

          <footer className="my-wallet">
            <button
              type="button"
              className="my-link my-notice"
              onClick={() => openExternal('/notifications')}
            >
              {overview.unreadNoticeCount} 未读提醒
            </button>
            <button
              type="button"
              className="my-link my-balance"
              aria-label="账户余额"
              onClick={() => openExternal('/balance')}
            >
              <span>{overview.gold}</span>
              <i className="my-coin my-coin--gold" />
              <span>{overview.silver}</span>
              <i className="my-coin my-coin--silver" />
              <span>{overview.bronze}</span>
              <i className="my-coin my-coin--bronze" />
            </button>
            <button
              type="button"
              className="my-link my-help"
              aria-label="余额说明"
              onClick={() => openExternal('/help/currency')}
            >
              <IconHelpCircle className="my-help-icon" />
            </button>
          </footer>
        </article>
      </SimpleBar>
    </section>
  )
}
