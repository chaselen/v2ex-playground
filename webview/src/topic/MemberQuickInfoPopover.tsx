import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar, Button, Popover, Spin } from '@douyinfe/semi-ui'
import { IconUser } from '@douyinfe/semi-icons'
import { VscodeProTag } from '@/shared/SemiVscode'
import type { MemberInfo } from '@extension/shared/webview'

export interface MemberQuickInfoPopoverProps {
  /** 用户名 */
  username: string
  /** 触发元素 */
  children: ReactNode
  /** 加载用户快速信息 */
  loadMemberInfo: (username: string) => Promise<MemberInfo>
  /** 打开完整用户资料 */
  openMember: (username: string) => void
}

/**
 * 用户快速信息浮层
 */
export default function MemberQuickInfoPopover({
  username,
  children,
  loadMemberInfo,
  openMember
}: MemberQuickInfoPopoverProps) {
  const [visible, setVisible] = useState(false)
  const [member, setMember] = useState<MemberInfo>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)

  useEffect(() => {
    requestIdRef.current += 1
    setMember(undefined)
    setLoading(false)
    setError('')

    return () => {
      requestIdRef.current += 1
    }
  }, [username])

  /**
   * 按需加载用户资料
   */
  async function requestMemberInfo() {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError('')

    try {
      const nextMember = await loadMemberInfo(username)
      if (requestId === requestIdRef.current) {
        setMember(nextMember)
      }
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError((err as Error).message || '用户资料加载失败')
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }

  /**
   * 处理浮层显示状态变化
   * @param nextVisible 是否显示
   */
  function handleVisibleChange(nextVisible: boolean) {
    setVisible(nextVisible)
    if (nextVisible && !member && !loading && !error) {
      requestMemberInfo().catch(err => console.error(err))
    }
  }

  /**
   * 打开完整用户资料
   */
  function handleOpenMember() {
    setVisible(false)
    openMember(member?.username || username)
  }

  return (
    <Popover
      content={
        <div className="member-quick-card" role="group" aria-label={`${username} 的用户资料`}>
          {loading && (
            <div className="member-quick-state" role="status">
              <Spin size="small" />
              <span>正在加载用户资料</span>
            </div>
          )}

          {!loading && error && (
            <div className="member-quick-state member-quick-state--error">
              <span>{error}</span>
              <Button size="small" theme="light" onClick={() => requestMemberInfo()}>
                重试
              </Button>
            </div>
          )}

          {!loading && !error && member && (
            <>
              <header className="member-quick-header">
                <Avatar size="default" shape="square" src={member.avatar} alt={member.username}>
                  <IconUser />
                </Avatar>
                <div className="member-quick-heading">
                  <div className="member-quick-username-row">
                    <strong>{member.username}</strong>
                    {member.isPro && <VscodeProTag />}
                  </div>
                  {!!member.memberNumber && (
                    <span className="member-quick-number">第 {member.memberNumber} 号会员</span>
                  )}
                </div>
              </header>

              {!!member.tagline && <p className="member-quick-tagline">{member.tagline}</p>}
              {!!member.bio && <p className="member-quick-bio">{member.bio}</p>}

              <div className="member-quick-meta">
                {!!member.joinedAt && <span>加入于 {member.joinedAt}</span>}
                {!!member.activityRank && <span>今日活跃度排名 {member.activityRank}</span>}
              </div>

              <Button block size="small" theme="light" onClick={handleOpenMember}>
                打开完整资料
              </Button>
            </>
          )}
        </div>
      }
      mouseEnterDelay={250}
      mouseLeaveDelay={120}
      position="bottomLeft"
      showArrow
      trigger="hover"
      visible={visible}
      onVisibleChange={handleVisibleChange}
    >
      <span className="member-quick-trigger">{children}</span>
    </Popover>
  )
}
