import type { ClientVia } from '@extension/v2ex/types'
import ClientSource from './ClientSource'
import { mergeClassNames } from './ui/utils'
import styles from './TimeWithSource.module.scss'

/** 详情页和分享图共用的时间及客户端信息 */
export interface TimeWithSourceProps {
  time: string
  via?: ClientVia
  title?: string
  className?: string
}

/** 时间与客户端使用统一行高和居中布局，时间提示不覆盖客户端提示 */
export default function TimeWithSource({ time, via, title, className }: TimeWithSourceProps) {
  return (
    <span className={mergeClassNames(styles.time, className)}>
      <span title={title}>{time}</span>
      <ClientSource via={via} />
    </span>
  )
}
