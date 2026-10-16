import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, CircleHelp, Settings2 } from 'lucide-react'
import { Button, Popover, Toast } from '@/components/ui'
import { createVsCodeClient, resolveWebviewUrl } from '@/core/vscode'
import type { TopicManagementAction } from '@extension/v2ex/types'
import type { TopicPanelRpcCommands } from '@extension/shared/topicView'
import TopicManagementDialog from './TopicManagementDialog'
import styles from './TopicManagementPopover.module.scss'

const vscode = createVsCodeClient<TopicPanelRpcCommands>()
const labels: Record<TopicManagementAction, string> = { boost: '放到首页', fade: '下沉 10天' }

/** 管理浮层只提供操作入口，执行前交给独立 Dialog 确认 */
export default function TopicManagementPopover({ actions }: { actions: TopicManagementAction[] }) {
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<TopicManagementAction>()
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <Popover
        open={open}
        align="start"
        aria-label="主题管理"
        className={styles.panel}
        onOpenChange={setOpen}
        // 打开确认框时由 Dialog 接管焦点，避免 Popover 收起后抢回焦点
        finalFocus={action ? false : undefined}
        content={
          <div className={styles.operations}>
            {actions.map(item => (
              <div className={styles.row} key={item}>
                <Button
                  size="small"
                  variant="ghost"
                  className={styles.operation}
                  icon={
                    item === 'boost' ? (
                      <ArrowUp aria-hidden="true" />
                    ) : (
                      <ArrowDown aria-hidden="true" />
                    )
                  }
                  onClick={() => {
                    setOpen(false)
                    setAction(item)
                  }}
                >
                  {labels[item]}
                </Button>
                {item === 'boost' && (
                  <Button
                    size="small"
                    variant="ghost"
                    compact
                    icon={<CircleHelp aria-hidden="true" />}
                    aria-label="放到首页帮助"
                    onClick={() => {
                      setOpen(false)
                      void vscode
                        .openExternal(resolveWebviewUrl('/help/currency?#boost'))
                        .catch(reason =>
                          Toast.error(reason instanceof Error ? reason.message : String(reason))
                        )
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        }
      >
        <Button
          ref={triggerRef}
          className={styles.trigger}
          size="small"
          variant="secondary"
          icon={<Settings2 aria-hidden="true" />}
        >
          管理 <ChevronDown aria-hidden="true" />
        </Button>
      </Popover>
      {action && (
        <TopicManagementDialog
          key={action}
          action={action}
          returnFocusRef={triggerRef}
          onClose={() => setAction(undefined)}
        />
      )}
    </>
  )
}
