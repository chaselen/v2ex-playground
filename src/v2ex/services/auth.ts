import * as cheerio from 'cheerio/slim'
import axios from 'axios'
import { isV2exPath } from '../clientUtils'
import { parseAccountOverview } from '../parsers/account'
import { V2EX_REQUEST_HEADERS, V2EX_REQUEST_TIMEOUT, type V2exSession } from '../session'
import { TwoFactorRequiredError, type CheckCookieResult } from '../types'

/** V2EX 认证领域服务 */
export class AuthService {
  constructor(private readonly session: V2exSession) {}

  /** 获取一次性操作参数 */
  async getOnce(): Promise<string> {
    const { data } = await this.session.get<string>('/poll_once', { responseType: 'text' })
    return data.trim()
  }

  /** 检查当前 Cookie 是否有效 */
  async checkCookie(): Promise<CheckCookieResult> {
    if (!this.session.getCookie()) return { isValid: false }
    const { data: html } = await this.session.get<string>('/')
    const $ = cheerio.load(html)
    const overview = parseAccountOverview($)
    if (overview?.username) {
      return {
        isValid: true,
        username: overview.username
      }
    }
    if ($('a[href^="/signin"], form[action^="/signin"]').length > 0) {
      return { isValid: false }
    }
    throw new Error('登录状态检查失败，请检查网络后重试')
  }

  /** 尝试使用 Cookie 登录 */
  async tryLogin(cookie: string): Promise<boolean> {
    if (!cookie) return false
    // 登录探测不能污染当前 Session，因此使用独立的一次性请求
    const response = await axios.get<string>(this.session.baseUrl, {
      headers: { ...V2EX_REQUEST_HEADERS, Cookie: cookie },
      timeout: V2EX_REQUEST_TIMEOUT
    })
    const responseUrl = response.request?.res?.responseUrl
    if (responseUrl && isV2exPath(new URL(responseUrl), '/2fa')) {
      throw new TwoFactorRequiredError('需要输入 V2EX 两步验证码')
    }
    return cheerio.load(response.data)('#member-activity').length > 0
  }

  /** 提交两步验证码 */
  async submitTwoFactorCode(code: string): Promise<void> {
    if (!/^\d{6}$/.test(code)) throw new Error('请输入 6 位验证码')
    const once = await this.getOnce()
    const response = await this.session.post<string>('/2fa', new URLSearchParams({ code, once }), {
      maxRedirects: 0,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      validateStatus: status => status >= 200 && status < 400
    })
    if (response.status === 302) return
    const problem = cheerio
      .load(response.data)('.problem')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim()
    throw new Error(problem || '两步验证码验证失败，请重新输入验证码')
  }
}
