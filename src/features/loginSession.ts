import autoDailySignIn, { type AutoDailySignInOptions } from '@/features/dailySignIn'
import G from '@/global'

/** 登录会话刷新选项 */
export interface RefreshLoginSessionOptions {
  /** 会话有效时自动执行每日签到 */
  autoDailySignIn?: boolean
  /** 自动签到选项 */
  dailySignInOptions?: AutoDailySignInOptions
}

/** 登录会话刷新结果 */
export interface RefreshLoginSessionResult {
  /** Cookie 是否有效 */
  loggedIn: boolean
}

/** 当前登录会话刷新任务 */
let loginSessionRefreshTask: Promise<RefreshLoginSessionResult> | undefined

/**
 * 刷新 V2EX 运行时登录会话
 * @param options 刷新选项
 */
export async function refreshLoginSession(
  options: RefreshLoginSessionOptions = {}
): Promise<RefreshLoginSessionResult> {
  const result = await getLoginSessionRefreshTask()

  if (options.autoDailySignIn && result.loggedIn) {
    autoDailySignIn(options.dailySignInOptions).catch(err =>
      console.error('V2EX 自动签到失败', err)
    )
  }

  return result
}

/**
 * 获取登录会话刷新任务
 */
function getLoginSessionRefreshTask(): Promise<RefreshLoginSessionResult> {
  if (!loginSessionRefreshTask) {
    loginSessionRefreshTask = doRefreshLoginSession().finally(() => {
      loginSessionRefreshTask = undefined
    })
  }

  return loginSessionRefreshTask
}

/**
 * 执行登录会话刷新
 */
async function doRefreshLoginSession(): Promise<RefreshLoginSessionResult> {
  // checkCookie 会刷新 V2exClient 内部 CookieJar，这里不更新持久化登录 Cookie
  const isCookieValid = await G.V2ex.checkCookie()

  if (!isCookieValid) {
    return {
      loggedIn: false
    }
  }

  return {
    loggedIn: true
  }
}
