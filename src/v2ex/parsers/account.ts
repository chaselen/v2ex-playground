import * as cheerio from 'cheerio/slim'
import { parseCoinBalance } from './balance'
import type { AccountOverview } from '../types'

/**
 * 从 HTML 中解析在线人数
 * @param $ cheerio 实例
 */
export function parseOnlineCount($: cheerio.CheerioAPI): number | undefined {
  const text = $('body').text().replace(/\s+/g, ' ')
  const match = text.match(/([\d,]+)\s*(?:Online|人在线)/i)
  if (!match) {
    return undefined
  }

  return Number(match[1].replace(/,/g, '')) || undefined
}

/**
 * 从 HTML 中解析账户概览
 * @param $ cheerio 实例
 */
export function parseAccountOverview($: cheerio.CheerioAPI): AccountOverview | undefined {
  const overview: AccountOverview = {
    avatar: '',
    username: '',
    nodeCollectionCount: 0,
    topicCollectionCount: 0,
    specialFollowingCount: 0,
    activityPercent: 0,
    unreadNoticeCount: 0,
    gold: 0,
    silver: 0,
    bronze: 0
  }

  const accountBox = $('#Rightbar > .box').has('#member-activity').first()
  if (!accountBox.length) {
    return undefined
  }

  const avatar = accountBox.find('td[width="48"] img.avatar').first()
  const activityHtml = accountBox.find('#member-activity').html() || ''

  overview.avatar = avatar.attr('src') || ''
  overview.username =
    accountBox.find('a[href^="/member/"]').first().text().trim() || avatar.attr('alt') || ''
  overview.nodeCollectionCount = Number(
    accountBox.find('a[href="/my/nodes"] .bigger').first().text().trim() || 0
  )
  overview.topicCollectionCount = Number(
    accountBox.find('a[href="/my/topics"] .bigger').first().text().trim() || 0
  )
  overview.specialFollowingCount = Number(
    accountBox.find('a[href="/my/following"] .bigger').first().text().trim() || 0
  )
  /*
  V2EX 的活跃度条在不同状态下会使用不同的内部元素类名：

  已满时：
  <div id="member-activity">
    <div class="member-activity-done" style="width: 100%;"></div>
  </div>

  未满时：
  <div id="member-activity">
    <div class="member-activity-bar">
      <div class="member-activity-start" style="width: 18%;"></div>
    </div>
  </div>

  因此这里直接从 #member-activity 的内部 HTML 中匹配 width，避免后续站点调整
  活跃度内部类名或嵌套层级时导致解析遗漏
  */
  overview.activityPercent = Number(activityHtml.match(/width\s*:\s*([\d.]+)%/)?.[1] || 0)

  const unreadText = $('#Rightbar a[href="/notifications"]').first().text().trim()
  overview.unreadNoticeCount = Number(unreadText.match(/(\d+)\s*未读提醒/)?.[1] || 0)

  const balance = parseCoinBalance($('#Rightbar .balance_area').first())
  overview.gold = balance.gold
  overview.silver = balance.silver
  overview.bronze = balance.bronze

  if (!overview.username && !overview.avatar) {
    return undefined
  }

  return overview
}

/**
 * 判断账户概览是否一致
 * @param overview 最新账户概览
 * @param oldOverview 旧账户概览
 */
export function isSameAccountOverview(
  overview: AccountOverview,
  oldOverview: AccountOverview
): boolean {
  return (
    overview.avatar === oldOverview.avatar &&
    overview.username === oldOverview.username &&
    overview.nodeCollectionCount === oldOverview.nodeCollectionCount &&
    overview.topicCollectionCount === oldOverview.topicCollectionCount &&
    overview.specialFollowingCount === oldOverview.specialFollowingCount &&
    overview.activityPercent === oldOverview.activityPercent &&
    overview.unreadNoticeCount === oldOverview.unreadNoticeCount &&
    overview.gold === oldOverview.gold &&
    overview.silver === oldOverview.silver &&
    overview.bronze === oldOverview.bronze
  )
}
