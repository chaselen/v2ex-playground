import vscode from 'vscode'
import Config from '@/config'
import G from '@/global'
import type { DailyRes } from '@/v2ex'
import { beijingNow, getBeijingDate } from '@/core/dayjs'
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

/**
 * 每日任务常见刷新时刻（北京时间小时，含）。
 * 刷新前窗口为 0:00–7:59；任务日刷新时刻可能变化，8 点后仍按小时轮询。
 */
const TYPICAL_MISSION_REFRESH_HOUR = 8

/** 签到完成记录 */
interface DailySignInRecord {
  /** 登录账号用户名 */
  username: string
  /** 完成日期 */
  date: string
  /** 当日签到奖励铜币数 */
  reward?: number
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

  const cached = getDailySignInRecordForToday(username)
  if (cached) {
    return {
      signedIn: true,
      result: 'repetitive',
      reward: cached.reward
    }
  }

  // 任务日通常在北京时间约 8 点刷新；昨日已签到时，次日 0:00–7:59 不请求 V2EX，
  // 避免无效查询/领取与休眠唤醒时的网络失败噪声
  if (isBeforeTypicalMissionRefresh()) {
    const previous = getDailySignInRecordFor(username)
    if (previous?.date === getBeijingDate(-1)) {
      logger.debug('自动签到跳过：任务刷新前且昨日已完成', {
        rewardDate: previous.date,
        beijingHour: beijingNow().hour()
      })
      return {
        signedIn: true,
        result: 'repetitive',
        reward: previous.reward
      }
    }
  }

  // 与手动签到复用进行中的任务，避免并发重复领取
  if (dailySignInTask?.username === username) {
    return dailySignInTask.promise
  }

  // 签到页已显示已领取（含任务尚未刷新时的上一任务日）时直接返回，不启动 loading 任务，避免 UI 闪烁与无效 redeem
  const status = await getDailySignInStatus()
  // 状态查询等待期间可能已有同账号任务启动，优先 join
  if (dailySignInTask?.username === username) {
    return dailySignInTask.promise
  }
  if (status.signedIn) {
    return status
  }

  return getOrStartDailySignInTask(username, {
    notifyOnSuccess: true,
    // 自动签到失败只写日志，不弹错误；避免休眠断网等场景打扰用户
    notifyOnFailure: false,
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
  return !!getDailySignInRecordForToday(username)
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
  const username = G.V2ex.getAuthenticatedUsername()
  if (!username) {
    return {
      signedIn: false
    }
  }

  const record = getDailySignInRecordForToday(username)
  if (isDailySignInLoading()) {
    return {
      // 任务进行中若尚无今日缓存，不把 UI 强行打成未签到；由 Webview 在 loading 时保留原状态
      signedIn: !!record,
      loading: true,
      reward: record?.reward
    }
  }

  if (record?.reward !== undefined) {
    return {
      signedIn: true,
      result: 'repetitive',
      reward: record.reward
    }
  }

  try {
    const status = await G.V2ex.getDailySignInStatus()
    // 签到页显示已领取即视为当前任务日已签到；任务尚未刷新时页面仍会停留在上一任务日
    const signedIn = status.signedIn
    // 领域层 reward.date 已是任务日；仅今日/昨日写入本地完成缓存
    const cacheDate = status.reward ? toSignInCacheDate(status.reward.date) : undefined
    if (signedIn && cacheDate && status.reward && G.V2ex.getAuthenticatedUsername() === username) {
      await updateDailySignedInDate(cacheDate, username, status.reward.reward)
    }
    return {
      signedIn,
      result: signedIn ? 'repetitive' : undefined,
      reward: signedIn ? status.reward?.reward : undefined
    }
  } catch (err) {
    logger.error('每日签到状态查询失败', err)
    return {
      signedIn: !!record,
      result: record ? 'repetitive' : undefined,
      reward: record?.reward
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
    // 领域层在缺少奖励流水时可能返回 0；UI 与缓存只接受有效正数
    const normalizedReward = reward > 0 ? reward : undefined
    // rewardDate 为任务日；success / repetitive 且属于近两日时写入本地完成记录
    const cacheDate =
      rewardDate && (result === 'success' || result === 'repetitive')
        ? toSignInCacheDate(rewardDate)
        : undefined
    if (
      cacheDate &&
      normalizedReward !== undefined &&
      G.V2ex.getAuthenticatedUsername() === username
    ) {
      await updateDailySignedInDate(cacheDate, username, normalizedReward)
    }
    if (result === 'success') {
      logger.info('每日签到成功', { reward: normalizedReward, cacheDate })
    } else if (result === 'repetitive' && cacheDate === getBeijingDate()) {
      logger.info('今日已完成签到')
    } else if (result === 'repetitive') {
      logger.info('V2EX 每日签到尚未刷新，当前任务日视作已签到', { rewardDate, cacheDate })
    } else {
      logger.warn('每日签到失败')
    }
    return {
      // 页面已领取（含任务尚未刷新、仍显示上一任务日已领取）时 UI 视作已签到
      signedIn: result === 'success' || result === 'repetitive',
      result,
      reward: normalizedReward
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
 * @param reward 当日签到奖励铜币数
 */
function updateDailySignedInDate(date: string, username: string, reward: number): Thenable<void> {
  return G.context.globalState.update(LAST_AUTO_SIGN_IN_DATE_KEY, {
    username,
    date,
    reward
  } satisfies DailySignInRecord)
}

/**
 * 获取指定账号今日的签到记录
 * @param username 登录账号用户名
 */
function getDailySignInRecordForToday(username: string): DailySignInRecord | undefined {
  const today = getBeijingDate()
  const record = getDailySignInRecordFor(username)
  return record?.date === today ? record : undefined
}

/**
 * 获取指定账号最近一次本地签到完成记录
 * @param username 登录账号用户名
 */
function getDailySignInRecordFor(username: string): DailySignInRecord | undefined {
  const record = G.context.globalState.get<DailySignInRecord>(LAST_AUTO_SIGN_IN_DATE_KEY)
  return record?.username === username ? record : undefined
}

/**
 * 是否处于常见任务刷新前的安静时段（北京时间 0:00–7:59）。
 * 昨日已签到时自动签到在此窗口内不访问网络。
 */
function isBeforeTypicalMissionRefresh(): boolean {
  return beijingNow().hour() < TYPICAL_MISSION_REFRESH_HOUR
}

/**
 * 将领域层返回的任务日规范化为本地签到完成缓存日期。
 *
 * `rewardDate` 已是任务日（描述 `YYYYMMDD 的每日登录奖励`），不是流水墙钟日。
 * 仅接受北京时间今日或昨日的任务日，避免过旧流水误写入。
 *
 * @returns 应写入的缓存日期；与近两日任务无关时返回 undefined（不写缓存）
 */
function toSignInCacheDate(missionDate: string): string | undefined {
  const today = getBeijingDate()
  const yesterday = getBeijingDate(-1)
  if (missionDate === today || missionDate === yesterday) {
    return missionDate
  }
  return undefined
}
