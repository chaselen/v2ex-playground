import styles from './CurrencyBalance.module.scss'

interface CurrencyBalanceProps {
  /** 金币数量 */
  gold: number
  /** 银币数量 */
  silver: number
  /** 铜币数量 */
  bronze: number
  /** 页面自定义币种尺寸类名 */
  coinClassName?: string
}

/**
 * V2EX 金银铜币余额
 * @param props 组件参数
 */
export default function CurrencyBalance(props: CurrencyBalanceProps) {
  const { gold, silver, bronze, coinClassName = '' } = props
  const coinClasses = `${styles.coin} ${coinClassName}`

  return (
    <>
      <span>{gold}</span>
      <i className={`${coinClasses} ${styles.gold}`} aria-hidden="true" />
      <span>{silver}</span>
      <i className={`${coinClasses} ${styles.silver}`} aria-hidden="true" />
      <span>{bronze}</span>
      <i className={`${coinClasses} ${styles.bronze}`} aria-hidden="true" />
    </>
  )
}
