import { useEffect, useRef, useState, type ReactNode } from 'react'
import { UserRound } from 'lucide-react'
import { Avatar, Button, ConfirmPopover, HoverCard, Spinner, Tag, Toast } from '@/components/ui'
import { mergeClassNames } from '@/components/ui/utils'
import UserBadge from '@/components/UserBadge'
import type { MemberQuickInfo, TopicMemberRelationTarget } from '@extension/shared/webview'
import styles from './MemberQuickInfoPopover.module.scss'

export interface MemberQuickInfoPopoverProps {
  /** 用户名 */
  username: string
  /** 触发元素 */
  children: ReactNode
  /** 加载用户快速信息 */
  loadMemberInfo: (username: string) => Promise<MemberQuickInfo>
  /** 屏蔽用户 */
  blockMember: (target: TopicMemberRelationTarget) => Promise<void>
  /** 取消屏蔽用户 */
  unblockMember: (target: TopicMemberRelationTarget) => Promise<void>
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
  blockMember,
  unblockMember,
  openMember
}: MemberQuickInfoPopoverProps) {
  const [visible, setVisible] = useState(false)
  const [member, setMember] = useState<MemberQuickInfo>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  /** 当前用户屏蔽关系操作是否进行中 */
  const [updatingBlock, setUpdatingBlock] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    requestIdRef.current += 1
    setMember(undefined)
    setLoading(false)
    setError('')
    setUpdatingBlock(false)

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

  /** 切换用户屏蔽状态 */
  async function handleToggleBlock() {
    if (
      !member ||
      typeof member.isBlocked !== 'boolean' ||
      !Number.isInteger(member.memberId) ||
      member.memberId <= 0 ||
      updatingBlock
    ) {
      return
    }

    /** 当前弹窗资料请求序号 */
    const requestId = requestIdRef.current
    /** 切换后的用户屏蔽状态 */
    const nextBlocked = !member.isBlocked
    /** 用户关系操作目标 */
    const target = {
      memberId: member.memberId,
      username: member.username
    }
    setUpdatingBlock(true)
    try {
      if (nextBlocked) {
        await blockMember(target)
      } else {
        await unblockMember(target)
      }
      if (requestId === requestIdRef.current) {
        setMember(current => (current ? { ...current, isBlocked: nextBlocked } : current))
      }
    } catch (err) {
      Toast.error((err as Error).message || '更新屏蔽状态失败')
    } finally {
      setUpdatingBlock(false)
    }
  }

  return (
    <HoverCard
      content={
        <div className={styles.card} role="group" aria-label={`${username} 的用户资料`}>
          {loading && (
            <div className={styles.state} role="status">
              <Spinner />
              <span>正在加载用户资料</span>
            </div>
          )}

          {!loading && error && (
            <div className={mergeClassNames(styles.state, styles.stateError)}>
              <span>{error}</span>
              <Button size="small" onClick={() => requestMemberInfo()}>
                重试
              </Button>
            </div>
          )}

          {!loading && !error && member && (
            <>
              <header className={styles.header}>
                <Avatar
                  shape="square"
                  src={member.avatar}
                  alt={member.username}
                  fallback={<UserRound aria-hidden="true" />}
                />
                <div className={styles.heading}>
                  <div className={styles.usernameRow}>
                    <strong>{member.username}</strong>
                    {member.isPro && <UserBadge pro />}
                    {!member.isSelf && typeof member.isBlocked === 'boolean' && (
                      <ConfirmPopover
                        closeImmediately
                        title={member.isBlocked ? '取消屏蔽该用户？' : '确认屏蔽该用户？'}
                        description={
                          member.isBlocked
                            ? '取消后将恢复显示该用户的相关内容'
                            : '屏蔽后将不再显示该用户的相关内容'
                        }
                        confirmText={member.isBlocked ? '取消屏蔽' : '屏蔽用户'}
                        danger={!member.isBlocked}
                        disabled={updatingBlock}
                        onConfirm={handleToggleBlock}
                      >
                        <Button
                          className={styles.block}
                          size="small"
                          variant={member.isBlocked ? 'secondary' : 'danger'}
                          loading={updatingBlock}
                          aria-label={member.isBlocked ? '取消屏蔽' : '屏蔽用户'}
                        >
                          {member.isBlocked ? '取消屏蔽' : '屏蔽用户'}
                        </Button>
                      </ConfirmPopover>
                    )}
                  </div>
                  {!!member.memberId && <Tag>第 {member.memberId} 号会员</Tag>}
                </div>
              </header>

              {!!member.tagline && <p className={styles.tagline}>{member.tagline}</p>}
              {!!member.bio && (
                <p className={styles.bio} title={member.bio}>
                  {member.bio}
                </p>
              )}

              <div className={styles.meta}>
                {!!member.joinedAt && <span>加入于 {member.joinedAt}</span>}
                {!!member.activityRank && <span>今日活跃度排名 {member.activityRank}</span>}
              </div>

              <div className={styles.actions}>
                <Button
                  className={styles.open}
                  size="small"
                  variant="primary"
                  onClick={handleOpenMember}
                >
                  打开完整资料
                </Button>
              </div>
            </>
          )}
        </div>
      }
      openDelay={250}
      closeDelay={120}
      side="bottom"
      align="start"
      showArrow
      open={visible}
      onOpenChange={handleVisibleChange}
    >
      <span className={styles.trigger}>{children}</span>
    </HoverCard>
  )
}
