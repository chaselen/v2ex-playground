import { TwoFactorPanelController } from '@/controllers/TwoFactorPanelController'

/** 两步验证操作 */
export interface TwoFactorVerificationOptions {
  /** 提交验证码 */
  verify(code: string): Promise<void>
}

/** 当前两步验证请求 */
interface ActiveTwoFactorRequest {
  /** 请求所属会话 */
  owner: object
  /** 两步验证面板 */
  panel: TwoFactorPanelController
  /** 验证结果 */
  task: Promise<boolean>
}

/** 当前两步验证请求 */
let activeRequest: ActiveTwoFactorRequest | undefined

/**
 * 打开两步验证面板
 * @param owner 请求所属会话
 * @param options 两步验证操作
 */
export function requestTwoFactorVerification(
  owner: object,
  options: TwoFactorVerificationOptions
): Promise<boolean> {
  if (activeRequest?.owner === owner) {
    activeRequest.panel.reveal()
    return activeRequest.task
  }

  activeRequest?.panel.dispose()
  const panel = new TwoFactorPanelController(options)
  const request: ActiveTwoFactorRequest = { owner, panel, task: panel.wait() }
  request.task = request.task.finally(() => {
    if (activeRequest === request) {
      activeRequest = undefined
    }
  })
  activeRequest = request
  return request.task
}
