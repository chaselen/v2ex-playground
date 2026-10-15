import type { CheerioAPI } from 'cheerio/slim'

/** 每日签到页面提供的领取状态与本次领取令牌 */
export interface DailySignInPage {
  /** 页面是否显示奖励已领取，不代表已领取当日任务奖励 */
  signedIn: boolean
  /** 尚未领取时按钮携带的 once，缺少有效入口时为空 */
  once?: string
}

/** 解析签到页的已领取标记和领取按钮，不推断奖励所属任务日 */
export function parseDailySignInPage($: CheerioAPI): DailySignInPage {
  // <span class="gray"><li class="fa fa-ok-sign" style="color: #0c0;"></li> &nbsp;每日登录奖励已领取</span>
  if ($('.fa.fa-ok-sign').length) return { signedIn: true }

  // 尚未签到，从领取按钮中解析本次请求所需的 once 参数
  const once = $('input[value^="领取"]')
    .first()
    .attr('onclick')
    ?.match(/\/mission\/daily\/redeem\?once=(\d+)/)?.[1]
  return { signedIn: false, once }
}
