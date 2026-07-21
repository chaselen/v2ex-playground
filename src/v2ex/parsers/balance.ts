import * as cheerio from 'cheerio/slim'
import { parsePagerTotalPage } from './common'
import type {
  AccountOverview,
  BalanceDetail,
  BalanceTransaction,
  DailySignInReward
} from '../types'

/** Cheerio 选择结果 */
type CheerioSelection = ReturnType<cheerio.CheerioAPI>

/**
 * 解析账户余额详情
 * @param $ cheerio 实例
 * @param requestedPage 请求页码
 */
export function parseBalance($: cheerio.CheerioAPI, requestedPage: number): BalanceDetail {
  const balance = parseCoinBalance($('#Main .balance_area').first())
  const transactions: BalanceTransaction[] = []

  $('#Main table.data > tbody > tr, #Main table.data > tr').each((index, element) => {
    const cells = $(element).children('td.d')
    if (cells.length < 5) {
      return
    }

    const amountCell = cells.eq(2)
    const amount = amountCell.text().trim()
    const direction = amountCell.find('.positive').length
      ? 'positive'
      : amountCell.find('.negative').length
        ? 'negative'
        : 'neutral'
    const time = cells.eq(0).text().trim()

    const descriptionCell = cells.eq(4)
    transactions.push({
      key: `${requestedPage}-${index}-${time}`,
      time,
      type: cells.eq(1).text().trim(),
      amount,
      direction,
      balance: cells.eq(3).text().trim(),
      // 任务日等规则匹配用纯文本；.html() 序列化会把中文编成 &#x..; 实体，不能用来做中文匹配
      description: descriptionCell.text().trim(),
      descriptionHtml: descriptionCell.html() || ''
    })
  })

  const currentPage =
    Number($('#Main .ps_container a.page_current').first().text().trim()) || requestedPage

  return {
    ...balance,
    page: currentPage,
    totalPage: parsePagerTotalPage($),
    transactions
  }
}

/** 从一页倒序余额流水中解析最新的每日登录奖励 */
export function parseLatestDailySignInReward(
  transactions: BalanceTransaction[]
): DailySignInReward | undefined {
  const transaction = transactions.find(
    item => item.type === '每日登录奖励' && item.direction === 'positive'
  )
  if (!transaction) return undefined

  const reward = Number(transaction.amount.replace(/,/g, '')) || 0
  const date = parseDailySignInMissionDate(transaction)
  return date && reward > 0 ? { date, reward } : undefined
}

/**
 * 解析每日登录奖励的任务日。
 *
 * 描述形如 `20250330 的每日登录奖励 2 铜币`：前缀日期为任务日。
 * 北京时间 0:00–8:00 补领上一任务日时，流水墙钟日可能已是次日，不能只用 time 的日历日。
 * 描述缺失时回退为流水时间开头的 YYYY-MM-DD。
 *
 * 必须使用 `description`（`.text()`），不要用 `descriptionHtml`：后者是 cheerio 再序列化结果，
 * 中文常被编成 `&#x7684;` 等实体，与网页源码里的纯文本不是同一形态。
 */
export function parseDailySignInMissionDate(
  transaction: Pick<BalanceTransaction, 'time' | 'description'>
): string | undefined {
  const fromDescription = transaction.description.match(/(\d{8})\s*的每日登录奖励/)?.[1]
  if (fromDescription) {
    return `${fromDescription.slice(0, 4)}-${fromDescription.slice(4, 6)}-${fromDescription.slice(6, 8)}`
  }
  return transaction.time.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
}

/**
 * 解析金币、银币和铜币余额
 *
 * V2EX 账户概览会省略数量为 0 的高位币种，需按币种图片 alt 解析，不能只按文本数字顺序。
 * 这里按 DOM 顺序读取文本金额，并在遇到币种图片时通过 alt 确认金额归属。
 *
 * @param balanceArea 余额区域
 * @example
 * 11 <img alt="G"> 25 <img alt="S"> 21 <img alt="B"> -> 11 金 25 银 21 铜
 * @example
 * 25 <img alt="S"> 21 <img alt="B"> -> 0 金 25 银 21 铜
 */
export function parseCoinBalance(
  balanceArea: CheerioSelection
): Pick<AccountOverview, 'gold' | 'silver' | 'bronze'> {
  const balance = {
    gold: 0,
    silver: 0,
    bronze: 0
  }
  const coinMap = {
    G: 'gold',
    S: 'silver',
    B: 'bronze'
  } as const
  let pendingAmount = 0

  balanceArea.contents().each((_, element) => {
    if (element.type === 'text') {
      // 金额总是在对应币种图片前的文本节点中
      const matchedAmount = element.data.match(/[\d,]+/g)?.pop()
      pendingAmount = matchedAmount ? Number(matchedAmount.replace(/,/g, '')) || 0 : 0
      return
    }

    if (element.type !== 'tag' || element.name !== 'img') {
      return
    }

    // 图片 alt 表示币种，缺失的币种保持默认 0
    const coinType = coinMap[element.attribs?.alt as keyof typeof coinMap]
    if (coinType) {
      balance[coinType] = pendingAmount
    }
    pendingAmount = 0
  })

  return balance
}
