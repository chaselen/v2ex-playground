import vscode from 'vscode'
import Config from '@/config'
import G from '@/global'
import type { DailyRes } from '@/v2ex'
import { logger } from '@/core/logger'

/** 自动签到选项 */
export interface AutoDailySignInOptions {
  /** 签到成功时显示提示 */
  notifyOnSuccess?: boolean
  /** 签到失败时显示提示 */
  notifyOnFailure?: boolean
  /** 签到失败时自动重试 */
  retryOnFailure?: boolean
}

/** 签到数据 */
export interface DailySignInData {
  /** 今日是否已签到 */
  signedIn: boolean
  /** 是否正在签到 */
  loading?: boolean
  /** 签到结果 */
  result?: DailyRes
  /** 当日签到奖励铜币数 */
  reward?: number
}

/** 上次自动签到完成日期存储 key */
const LAST_AUTO_SIGN_IN_DATE_KEY = 'lastAutoSignInDate'

/** 自动签到失败后的重试间隔 */
const AUTO_SIGN_IN_RETRY_DELAYS = [2_000, 5_000]

/** 自动签到定期检查间隔 */
const AUTO_SIGN_IN_CHECK_INTERVAL_MS = 60 * 60 * 1000

/** 签到完成记录 */
interface DailySignInRecord {
  /** 登录账号用户名 */
  username: string
  /** 完成日期 */
  date: string
}

/** 签到任务 */
interface DailySignInTask {
  /** 签到账号用户名 */
  username: string
  /** 签到任务 Promise */
  promise: Promise<DailySignInData>
}

/** 当前签到任务 */
let dailySignInTask: DailySignInTask | undefined

/** 每日签到状态变化事件 */
const dailySignInStatusEmitter = new vscode.EventEmitter<DailySignInData>()

/** 监听每日签到状态变化 */
export const onDailySignInStatusChanged = dailySignInStatusEmitter.event

/**
 * 自动执行每日签到
 * @param options 自动签到选项
 */
export default async function autoDailySignIn(
  options: AutoDailySignInOptions = {}
): Promise<DailySignInData> {
  if (!Config.autoSignIn()) {
    return {
      signedIn: isDailySignedInToday()
    }
  }

  let username = G.V2ex.getAuthenticatedUsername()
  if (!username) {
    try {
      if (!(await G.V2ex.ensureAuthenticated())) return { signedIn: false }
      username = G.V2ex.getAuthenticatedUsername()
    } catch (err) {
      logger.error('自动签到登录会话检查失败', err)
      return { signedIn: false }
    }
  }
  if (!username) return { signedIn: false }

  if (isDailySignedInTodayFor(username)) {
    return {
      signedIn: true,
      result: 'repetitive'
    }
  }

  return getOrStartDailySignInTask(username, {
    notifyOnSuccess: true,
    notifyOnFailure: true,
    retryOnFailure: true,
    ...options
  })
}

/**
 * 获取今日签到状态
 */
export function isDailySignedInToday(): boolean {
  const username = G.V2ex.getAuthenticatedUsername()
  return username ? isDailySignedInTodayFor(username) : false
}

/**
 * 获取指定账号的今日签到状态
 * @param username 签到账号用户名
 */
function isDailySignedInTodayFor(username: string): boolean {
  const today = getCurrentV2exDate()
  const record = G.context.globalState.get<DailySignInRecord>(LAST_AUTO_SIGN_IN_DATE_KEY)
  return record?.username === username && record.date === today
}

/**
 * 启动每日自动签到定期调度
 * @returns 调度器资源
 */
export function startDailySignInScheduler(): vscode.Disposable {
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const scheduleNextCheck = () => {
    if (disposed) return
    timer = setTimeout(() => {
      void autoDailySignIn().finally(scheduleNextCheck)
    }, AUTO_SIGN_IN_CHECK_INTERVAL_MS)
  }

  scheduleNextCheck()
  return new vscode.Disposable(() => {
    disposed = true
    if (timer) clearTimeout(timer)
  })
}

/**
 * 是否正在执行每日签到
 */
function isDailySignInLoading(): boolean {
  return !!dailySignInTask && dailySignInTask.username === G.V2ex.getAuthenticatedUsername()
}

/**
 * 查询每日签到状态
 */
export async function getDailySignInStatus(): Promise<DailySignInData> {
  if (isDailySignInLoading()) {
    return {
      signedIn: isDailySignedInToday(),
      loading: true
    }
  }

  const username = G.V2ex.getAuthenticatedUsername()
  if (!username) {
    return {
      signedIn: false
    }
  }

  if (isDailySignedInTodayFor(username)) {
    return {
      signedIn: true,
      result: 'repetitive'
    }
  }

  try {
    const status = await G.V2ex.getDailySignInStatus()
    const signedIn = status.signedIn && status.reward?.date === getCurrentV2exDate()
    if (signedIn && status.reward && G.V2ex.getAuthenticatedUsername() === username) {
      await updateDailySignedInDate(status.reward.date, username)
    }
    return {
      signedIn,
      result: signedIn ? 'repetitive' : undefined
    }
  } catch (err) {
    logger.error('每日签到状态查询失败', err)
    return {
      signedIn: false
    }
  }
}

/**
 * 手动执行每日签到
 */
export function dailySignIn(): Promise<DailySignInData> {
  const username = G.V2ex.getAuthenticatedUsername()
  if (!username) {
    return Promise.resolve({
      signedIn: false
    })
  }

  return getOrStartDailySignInTask(username, {
    notifyOnSuccess: true,
    notifyOnFailure: true
  })
}

/**
 * 获取或创建当前账号的签到任务
 * @param username 签到账号用户名
 * @param options 签到选项
 */
function getOrStartDailySignInTask(
  username: string,
  options: AutoDailySignInOptions
): Promise<DailySignInData> {
  if (dailySignInTask?.username === username) {
    return dailySignInTask.promise
  }

  dailySignInTask = startDailySignInTask(username, options)
  return dailySignInTask.promise
}

/**
 * 启动每日签到任务
 * @param username 签到账号用户名
 * @param options 自动签到选项
 */
function startDailySignInTask(username: string, options: AutoDailySignInOptions): DailySignInTask {
  dailySignInStatusEmitter.fire({
    signedIn: isDailySignedInTodayFor(username),
    loading: true
  })

  const task: DailySignInTask = {
    username,
    promise: Promise.resolve({ signedIn: false })
  }
  task.promise = runDailySignInWithRetry(username, options)
    .then(data => {
      const nextData = {
        ...data,
        loading: false
      }
      if (G.V2ex.getAuthenticatedUsername() === username) {
        dailySignInStatusEmitter.fire(nextData)
      }
      return nextData
    })
    .finally(() => {
      if (dailySignInTask === task) {
        dailySignInTask = undefined
      }
    })
  return task
}

/**
 * 执行签到并按需重试
 * @param username 签到账号用户名
 * @param options 签到选项
 */
async function runDailySignInWithRetry(
  username: string,
  options: AutoDailySignInOptions
): Promise<DailySignInData> {
  const retryDelays = options.retryOnFailure ? AUTO_SIGN_IN_RETRY_DELAYS : []
  let data = await runDailySignIn(username)

  for (const [index, delay] of retryDelays.entries()) {
    if (data.result !== 'failed') break
    logger.warn('每日签到将在延迟后重试', { attempt: index + 2, delay })
    await new Promise(resolve => setTimeout(resolve, delay))
    if (G.V2ex.getAuthenticatedUsername() !== username) break
    data = await runDailySignIn(username)
  }

  const isCurrentAccount = G.V2ex.getAuthenticatedUsername() === username
  if (isCurrentAccount && data.result === 'success' && options.notifyOnSuccess) {
    vscode.window.showInformationMessage(`V2EX 每日签到成功，获得 ${data.reward} 铜币`)
  } else if (isCurrentAccount && data.result === 'failed' && options.notifyOnFailure) {
    vscode.window.showErrorMessage('V2EX 每日签到失败，请稍后重试', '查看日志').then(action => {
      if (action === '查看日志') logger.show()
    })
  }

  return data
}

/**
 * 执行签到请求
 * @param username 签到账号用户名
 */
async function runDailySignIn(username: string): Promise<DailySignInData> {
  try {
    const { result, reward, rewardDate } = await G.V2ex.dailySignIn()
    if (
      (result === 'success' || result === 'repetitive') &&
      rewardDate &&
      G.V2ex.getAuthenticatedUsername() === username
    ) {
      await updateDailySignedInDate(rewardDate, username)
    }
    if (result === 'success') {
      logger.info('每日签到成功', { reward })
    } else if (result === 'repetitive' && rewardDate === getCurrentV2exDate()) {
      logger.info('今日已完成签到')
    } else if (result === 'repetitive') {
      logger.info('V2EX 每日签到尚未刷新', { rewardDate })
    } else {
      logger.warn('每日签到失败')
    }
    return {
      signedIn:
        result === 'success' || (result === 'repetitive' && rewardDate === getCurrentV2exDate()),
      result,
      reward
    }
  } catch (err) {
    logger.error('每日签到失败', err)
    return {
      signedIn: false,
      result: 'failed'
    }
  }
}

/**
 * 更新本地签到日期
 * @param date 签到日期
 * @param username 签到账号用户名
 */
function updateDailySignedInDate(date: string, username: string): Thenable<void> {
  return G.context.globalState.update(LAST_AUTO_SIGN_IN_DATE_KEY, {
    username,
    date
  } satisfies DailySignInRecord)
}

/** 获取 V2EX 余额流水使用的 +08:00 日期 */
function getCurrentV2exDate(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
