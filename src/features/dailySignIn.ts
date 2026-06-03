import vscode from 'vscode'
import dayjs from 'dayjs'
import Config from '@/config'
import G from '@/global'

/** 自动签到选项 */
export interface AutoDailySignInOptions {
  /** 签到成功时显示提示 */
  notifyOnSuccess?: boolean
}

/** 上次自动签到完成日期存储 key */
const LAST_AUTO_SIGN_IN_DATE_KEY = 'lastAutoSignInDate'

/** 当前签到任务 */
let dailySignInTask: Promise<void> | undefined

/**
 * 自动执行每日签到
 * @param options 自动签到选项
 */
export default function autoDailySignIn(options: AutoDailySignInOptions = {}): Promise<void> {
  if (!Config.autoSignIn() || !G.getCookie()) {
    return Promise.resolve()
  }

  const today = dayjs().format('YYYY-MM-DD')
  const lastAutoSignInDate = G.context.globalState.get<string>(LAST_AUTO_SIGN_IN_DATE_KEY)
  if (lastAutoSignInDate === today) {
    return Promise.resolve()
  }

  if (!dailySignInTask) {
    dailySignInTask = runDailySignIn(today, options).finally(() => {
      dailySignInTask = undefined
    })
  }
  return dailySignInTask
}

/**
 * 执行签到请求
 * @param today 当前本地日期
 * @param options 自动签到选项
 */
async function runDailySignIn(today: string, options: AutoDailySignInOptions): Promise<void> {
  try {
    const result = await G.V2ex.daily()
    if (result === 'success' || result === 'repetitive') {
      await G.context.globalState.update(LAST_AUTO_SIGN_IN_DATE_KEY, today)
    }
    if (result === 'success' && options.notifyOnSuccess) {
      vscode.window.showInformationMessage('V2EX 每日签到成功')
    }
    if (result === 'failed') {
      console.warn('V2EX 每日签到失败')
    }
  } catch (err) {
    console.error('V2EX 每日签到失败', err)
  }
}
