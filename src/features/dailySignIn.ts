import vscode from 'vscode'
import dayjs from 'dayjs'
import Config from '@/config'
import G from '@/global'
import type { DailyRes } from '@/v2ex'

/** 自动签到选项 */
export interface AutoDailySignInOptions {
  /** 签到成功时显示提示 */
  notifyOnSuccess?: boolean
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

/** 当前签到任务 */
let dailySignInTask: Promise<DailySignInData> | undefined

/** 每日签到状态变化事件 */
const dailySignInStatusEmitter = new vscode.EventEmitter<DailySignInData>()

/** 监听每日签到状态变化 */
export const onDailySignInStatusChanged = dailySignInStatusEmitter.event

/**
 * 自动执行每日签到
 * @param options 自动签到选项
 */
export default function autoDailySignIn(
  options: AutoDailySignInOptions = {}
): Promise<DailySignInData> {
  if (!Config.autoSignIn() || !G.getCookie()) {
    return Promise.resolve({
      signedIn: isDailySignedInToday()
    })
  }

  if (isDailySignedInToday()) {
    return Promise.resolve({
      signedIn: true,
      result: 'repetitive'
    })
  }

  if (!dailySignInTask) {
    dailySignInTask = startDailySignInTask(options)
  }
  return dailySignInTask
}

/**
 * 获取今日签到状态
 */
export function isDailySignedInToday(): boolean {
  const today = dayjs().format('YYYY-MM-DD')
  const lastAutoSignInDate = G.context.globalState.get<string>(LAST_AUTO_SIGN_IN_DATE_KEY)
  return lastAutoSignInDate === today
}

/**
 * 是否正在执行每日签到
 */
function isDailySignInLoading(): boolean {
  return !!dailySignInTask
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

  if (!G.getCookie()) {
    return {
      signedIn: false
    }
  }

  if (isDailySignedInToday()) {
    return {
      signedIn: true,
      result: 'repetitive'
    }
  }

  try {
    const signedIn = await G.V2ex.getDailySignInStatus()
    if (signedIn) {
      await updateDailySignedInDate()
    }
    return {
      signedIn,
      result: signedIn ? 'repetitive' : undefined
    }
  } catch (err) {
    console.error('V2EX 每日签到状态查询失败', err)
    return {
      signedIn: false
    }
  }
}

/**
 * 手动执行每日签到
 */
export function dailySignIn(): Promise<DailySignInData> {
  if (!G.getCookie()) {
    return Promise.resolve({
      signedIn: false
    })
  }

  if (!dailySignInTask) {
    dailySignInTask = startDailySignInTask({ notifyOnSuccess: true })
  }
  return dailySignInTask
}

/**
 * 启动每日签到任务
 * @param options 自动签到选项
 */
function startDailySignInTask(options: AutoDailySignInOptions): Promise<DailySignInData> {
  dailySignInStatusEmitter.fire({
    signedIn: isDailySignedInToday(),
    loading: true
  })

  return runDailySignIn(options)
    .then(data => {
      const nextData = {
        ...data,
        loading: false
      }
      dailySignInStatusEmitter.fire(nextData)
      return nextData
    })
    .finally(() => {
      dailySignInTask = undefined
    })
}

/**
 * 执行签到请求
 * @param options 自动签到选项
 */
async function runDailySignIn(options: AutoDailySignInOptions): Promise<DailySignInData> {
  try {
    const { result, reward } = await G.V2ex.dailySignIn()
    if (result === 'success' || result === 'repetitive') {
      await updateDailySignedInDate()
    }
    if (result === 'success' && options.notifyOnSuccess) {
      vscode.window.showInformationMessage(`V2EX 每日签到成功，获得 ${reward} 铜币`)
    }
    if (result === 'failed') {
      console.warn('V2EX 每日签到失败')
    }
    return {
      signedIn: result === 'success' || result === 'repetitive',
      result,
      reward
    }
  } catch (err) {
    console.error('V2EX 每日签到失败', err)
    return {
      signedIn: false,
      result: 'failed'
    }
  }
}

/**
 * 更新本地签到日期
 */
function updateDailySignedInDate(): Thenable<void> {
  const today = dayjs().format('YYYY-MM-DD')
  return G.context.globalState.update(LAST_AUTO_SIGN_IN_DATE_KEY, today)
}
