import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

/**
 * V2EX 站点时间、余额流水均为北京时间（UTC+8）。
 * 本地比较时统一转到该时区，不使用运行 VS Code 的系统时区。
 */
export const BEIJING_UTC_OFFSET = 8

/** 当前北京时间（与 V2EX 站点/流水一致） */
export function beijingNow() {
  return dayjs().utcOffset(BEIJING_UTC_OFFSET)
}

/**
 * 北京时间日历日期 YYYY-MM-DD
 * @param offsetDays 相对今天的偏移，-1 为昨天
 */
export function getBeijingDate(offsetDays = 0): string {
  return beijingNow().add(offsetDays, 'day').format('YYYY-MM-DD')
}

export default dayjs
