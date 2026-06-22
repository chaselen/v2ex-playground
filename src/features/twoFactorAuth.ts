import { TwoFactorPanelController } from '@/controllers/TwoFactorPanelController'

/** 当前两步验证面板 */
let twoFactorPanel: TwoFactorPanelController | undefined

/** 当前两步验证任务 */
let twoFactorTask: Promise<boolean> | undefined

/**
 * 打开两步验证面板
 */
export function requestTwoFactorVerification(): Promise<boolean> {
  if (twoFactorPanel && twoFactorTask) {
    twoFactorPanel.reveal()
    return twoFactorTask
  }

  twoFactorPanel = new TwoFactorPanelController()
  twoFactorTask = twoFactorPanel.wait().finally(() => {
    twoFactorPanel = undefined
    twoFactorTask = undefined
  })
  return twoFactorTask
}
