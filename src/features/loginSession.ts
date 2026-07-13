import autoDailySignIn, { type AutoDailySignInOptions } from '@/features/dailySignIn'
import G from '@/global'
import { logger } from '@/core/logger'
import type { CheckCookieResult } from '@/v2ex'

/** 登录会话刷新选项 */
export interface RefreshLoginSessionOptions {
  /** 会话有效时自动执行每日签到 */
  autoDailySignIn?: boolean
  /** 自动签到选项 */
  dailySignInOptions?: AutoDailySignInOptions
}

/** 登录会话缓存 */
interface LoginSessionCache {
  /** 对应的认证会话版本 */
  sessionVersion: number
  /** 登录会话刷新结果 */
  result: CheckCookieResult
}

/** 登录会话刷新任务 */
interface LoginSessionRefreshTask {
  /** 对应的认证会话版本 */
  sessionVersion: number
  /** 登录会话刷新 Promise */
  promise: Promise<CheckCookieResult>
}

/** 最近一次登录会话检查结果 */
let loginSessionCache: LoginSessionCache | undefined

/** 当前登录会话刷新任务 */
let loginSessionRefreshTask: LoginSessionRefreshTask | undefined

/**
 * 刷新 V2EX 运行时登录会话
 * @param options 刷新选项
 */
export async function refreshLoginSession(
  options: RefreshLoginSessionOptions = {}
): Promise<CheckCookieResult> {
  const result = await getLoginSessionRefreshTask(true)

  if (options.autoDailySignIn && result.isValid) {
    autoDailySignIn(options.dailySignInOptions).catch(err => logger.error('自动签到失败', err))
  }

  return result
}

/** 等待当前认证会话完成登录检查 */
export function ensureLoginSession(): Promise<CheckCookieResult> {
  return getLoginSessionRefreshTask()
}

/**
 * 获取登录会话刷新任务
 * @param force 是否忽略已完成的检查结果
 */
function getLoginSessionRefreshTask(force = false): Promise<CheckCookieResult> {
  const client = G.V2ex
  const sessionVersion = client.getAuthSessionVersion()

  if (loginSessionRefreshTask?.sessionVersion === sessionVersion) {
    return loginSessionRefreshTask.promise
  }

  if (!force && loginSessionCache?.sessionVersion === sessionVersion) {
    return Promise.resolve(loginSessionCache.result)
  }

  const task: LoginSessionRefreshTask = {
    sessionVersion,
    promise: doRefreshLoginSession()
      .then(result => {
        if (G.V2ex === client && client.getAuthSessionVersion() === sessionVersion) {
          loginSessionCache = {
            sessionVersion,
            result
          }
        }
        return result
      })
      .finally(() => {
        if (loginSessionRefreshTask === task) {
          loginSessionRefreshTask = undefined
        }
      })
  }
  loginSessionRefreshTask = task
  return task.promise
}

/**
 * 执行登录会话刷新
 */
async function doRefreshLoginSession(): Promise<CheckCookieResult> {
  // checkCookie 会刷新 V2exClient 内部 CookieJar，这里不更新持久化登录 Cookie
  const result = await G.V2ex.checkCookie()
  logger.info(result.isValid ? '登录会话刷新完成：已登录' : '登录会话刷新完成：未登录')
  return result
}
