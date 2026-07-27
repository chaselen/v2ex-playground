import dayjs, { type Dayjs } from 'dayjs'

/** 一分钟的毫秒数 */
const minuteMs = 60 * 1000

/** 一小时的毫秒数 */
const hourMs = 60 * minuteMs

/** 一天的毫秒数 */
const dayMs = 24 * hourMs

/**
 * 按 V2EX 列表风格格式化发布时间
 * @param timeText 发布时间
 * @param now 当前时间
 */
export function formatPublishedTime(timeText: string, now: Dayjs = dayjs()): string {
  const publishedAt = dayjs(timeText)
  if (!publishedAt.isValid()) {
    return timeText
  }

  const elapsedMs = Math.max(now.valueOf() - publishedAt.valueOf(), 0)
  if (elapsedMs < minuteMs) {
    return '几秒前'
  }
  if (elapsedMs < hourMs) {
    return `${Math.floor(elapsedMs / minuteMs)} 分钟前`
  }
  if (elapsedMs < dayMs) {
    return `${Math.floor(elapsedMs / hourMs)} 小时前`
  }

  return publishedAt.year() === now.year()
    ? publishedAt.format('M 月 D 日')
    : publishedAt.format('YYYY 年 M 月 D 日')
}

/**
 * 格式化最近浏览时间，精确到分钟
 * @param timestamp Unix 时间戳，单位为毫秒
 */
export function formatReadTime(timestamp: number): string {
  return timestamp ? dayjs(timestamp).format('YYYY-MM-DD HH:mm') : ''
}

/**
 * 生成最近浏览时间的机器可读值
 * @param timestamp Unix 时间戳，单位为毫秒
 */
export function readTimeDateTime(timestamp: number): string {
  return timestamp ? dayjs(timestamp).toISOString() : ''
}
