import type { DailyRes } from '../v2ex/types'

/**
 * 每日签到数据
 */
export interface DailySignInState {
  /** 今日是否已签到 */
  signedIn: boolean
  /** 是否正在签到 */
  loading?: boolean
  /** 签到结果 */
  result?: DailyRes
  /** 当日签到奖励铜币数 */
  reward?: number
}
