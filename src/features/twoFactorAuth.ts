import { TwoFactorPanelController } from '@/controllers/TwoFactorPanelController'
import type { TwoFactorVerification } from '@/v2ex'

/** 当前两步验证请求 */
interface ActiveTwoFactorRequest {
  /** 两步验证操作 */
  verification: TwoFactorVerification
  /** 两步验证面板 */
  panel: TwoFactorPanelController
  /** 验证结果 */
  task: Promise<boolean>
}

/** 当前两步验证请求 */
let activeRequest: ActiveTwoFactorRequest | undefined

/**
 * 打开两步验证面板
 * @param verification 两步验证操作
 */
export function requestTwoFactorVerification(
  verification: TwoFactorVerification
): Promise<boolean> {
  if (activeRequest?.verification === verification) {
    activeRequest.panel.reveal()
    return activeRequest.task
  }

  activeRequest?.panel.dispose()
  const panel = new TwoFactorPanelController({
    verify: code => verification.submitCode(code)
  })
  const request: ActiveTwoFactorRequest = { verification, panel, task: panel.wait() }
  request.task = request.task.finally(() => {
    if (activeRequest === request) {
      activeRequest = undefined
    }
  })
  activeRequest = request
  return request.task
}
