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

    transactions.push({
      key: `${requestedPage}-${index}-${time}`,
      time,
      type: cells.eq(1).text().trim(),
      amount,
      direction,
      balance: cells.eq(3).text().trim(),
      descriptionHtml: cells.eq(4).html() || ''
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
  const date = transaction.time.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  return date && reward > 0 ? { date, reward } : undefined
}

/**
 * 解析金币、银币和铜币余额
 *
 * V2EX 账户概览会省略数量为 0 的高位币种，所以不能只按文本数字顺序解析。
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
