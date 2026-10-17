import * as cheerio from 'cheerio/slim'
import { parseAccountOverview } from '../parsers/account'
import { getHeader, getResponseUrl, isV2exSessionPath } from '../clientUtils'
import type { V2exSession } from '../session'
import { LoginRequiredError, LoginCooldownError, type CheckCookieResult } from '../types'
import type { PasswordLoginInput } from '../types'
import {
  parseAuthProblem,
  isSignoutConfirmation,
  parseSigninForm,
  parseSignoutPath,
  type SigninForm
} from '../parsers/auth'

/** V2EX 认证领域服务 */
export class AuthService {
  private signinForm?: SigninForm

  constructor(private readonly session: V2exSession) {}

  /** 表单和图片始终使用同一 CookieJar；刷新后旧挑战失效 */
  async loadSigninChallenge(): Promise<string> {
    this.signinForm = undefined
    try {
      const response = await this.session.get<string>('/signin')
      const { data } = response
      if (isV2exSessionPath(new URL(getResponseUrl(response)), '/signin/cooldown')) {
        // 优先从中文冷却页提取说明，页面结构变化时仍明确报告受限
        try {
          parseSigninForm(data)
        } catch (error) {
          if (error instanceof LoginCooldownError) throw error
        }
        throw new LoginCooldownError()
      }
      const form = parseSigninForm(data)
      const image = await this.session.get<ArrayBuffer>(`/_captcha?now=${Date.now()}`, {
        responseType: 'arraybuffer',
        headers: { Referer: `${this.session.baseUrl}/signin` }
      })
      const contentType = getHeader(image.headers, 'content-type')?.split(';')[0]
      if (!contentType || !/^image\/(png|jpeg|gif|webp)$/.test(contentType)) {
        throw new Error('验证码图片加载失败，请重试')
      }
      this.signinForm = form
      return `data:${contentType};base64,${Buffer.from(image.data).toString('base64')}`
    } catch (error) {
      if (error instanceof LoginCooldownError) throw error
      // 不将携带请求配置的网络异常传到日志和 Webview
      throw new Error(
        error instanceof Error && !('config' in error)
          ? error.message
          : '登录页面加载失败，请检查网络后重试'
      )
    }
  }

  /** 提交一次登录挑战，不自动重试包含密码的 POST */
  async submitPasswordLogin(input: PasswordLoginInput): Promise<void> {
    const form = this.signinForm
    this.signinForm = undefined
    if (!form) throw new Error('登录验证码已失效，请刷新后重试')
    if (!input.username.trim() || !input.password || !input.captcha.trim())
      throw new Error('请填写账号、密码和验证码')
    try {
      const response = await this.session.post<string>(
        '/signin',
        new URLSearchParams({
          [form.usernameField]: input.username.trim(),
          [form.passwordField]: input.password,
          [form.captchaField]: input.captcha.trim(),
          once: form.once,
          next: form.next
        }),
        {
          maxRedirects: 0,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: `${this.session.baseUrl}/signin`
          },
          validateStatus: status => status >= 200 && status < 400,
          v2exSkipTwoFactor: true
        }
      )
      const location = getHeader(response.headers, 'location')
      if (response.status === 302 && location) {
        const target = new URL(location, this.session.baseUrl)
        if (isV2exSessionPath(target, '/signin/cooldown')) throw new LoginCooldownError()
        if (isV2exSessionPath(target, '/') || isV2exSessionPath(target, '/2fa')) return
      }
      throw new Error(parseAuthProblem(response.data) || '登录失败，请检查账号、密码和验证码')
    } catch (error) {
      if (error instanceof LoginCooldownError) throw error
      throw new Error(
        error instanceof Error && !('config' in error)
          ? error.message
          : '登录请求失败，请检查网络并刷新验证码后重试'
      )
    }
  }

  /** 使用源站导航中的新鲜令牌登出；调用方负责清理本地凭据 */
  async signout(): Promise<void> {
    try {
      const { data } = await this.session.get<string>('/')
      const path = parseSignoutPath(data)
      if (!path) {
        if (!(await this.checkCookie()).isValid) return
        throw new Error('无法识别 V2EX 退出入口，请稍后重试')
      }
      const response = await this.session.get<string>(path, {
        maxRedirects: 0,
        headers: { Referer: `${this.session.baseUrl}/` },
        validateStatus: status => status >= 200 && status < 400
      })
      const location = getHeader(response.headers, 'location')
      const confirmed = response.status === 200 && isSignoutConfirmation(response.data)
      const redirected =
        response.status === 302 &&
        location &&
        isV2exSessionPath(new URL(location, this.session.baseUrl), '/')
      if (!confirmed && !redirected) {
        throw new Error(parseAuthProblem(response.data) || '退出登录失败，请稍后重试')
      }
      // 确认页已返回且认证 Cookie 已删除，无需因语言等内部 Cookie 再请求首页
      if (confirmed && !this.session.getLoginCookie()) return
      if ((await this.checkCookie()).isValid) throw new Error('退出后仍处于登录状态，请重试')
    } catch (error) {
      if (error instanceof LoginRequiredError) return
      throw error
    }
  }

  /** 检查当前 Cookie 是否有效 */
  async checkCookie(): Promise<CheckCookieResult> {
    if (!this.session.getCookie()) return { isValid: false }
    let html: string
    try {
      html = (await this.session.get<string>('/')).data
    } catch (error) {
      if (error instanceof LoginRequiredError) return { isValid: false }
      throw error
    }
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

  /** 提交两步验证码 */
  async submitTwoFactorCode(code: string): Promise<void> {
    if (!/^\d{6}$/.test(code)) throw new Error('请输入 6 位验证码')
    const once = await this.session.getOnce()
    const response = await this.session.post<string>('/2fa', new URLSearchParams({ code, once }), {
      maxRedirects: 0,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      validateStatus: status => status >= 200 && status < 400
    })
    const location = getHeader(response.headers, 'location')
    if (
      response.status === 302 &&
      location &&
      isV2exSessionPath(new URL(location, this.session.baseUrl), '/')
    )
      return
    const problem = parseAuthProblem(response.data)
    throw new Error(problem || '两步验证码验证失败，请重新输入验证码')
  }
}
