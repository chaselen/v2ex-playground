import { getHeader } from '../clientUtils'
import { parsePasswordResetForm, parsePasswordResetResult } from '../parsers/auth'
import { V2exSession } from '../session'
import type { PasswordResetAttempt, PasswordResetInput } from '../types'

/** 独立 CookieJar 避免找回密码验证码覆盖登录验证码；关闭后中止请求 */
export class PasswordResetService implements PasswordResetAttempt {
  private readonly abort = new AbortController()
  private once?: string
  private busy = false

  constructor(private readonly session = new V2exSession()) {}

  async loadChallenge(): Promise<string> {
    return this.run(async () => {
      this.once = undefined
      const { data } = await this.session.get<string>('/forgot', { signal: this.abort.signal })
      const once = parsePasswordResetForm(data)
      const image = await this.session.get<ArrayBuffer>(`/_captcha?now=${Date.now()}`, {
        signal: this.abort.signal,
        responseType: 'arraybuffer',
        headers: { Referer: `${this.session.baseUrl}/forgot` }
      })
      const type = getHeader(image.headers, 'content-type')?.split(';')[0]
      if (!type || !/^image\/(png|jpeg|gif|webp)$/.test(type))
        throw new Error('验证码图片加载失败，请重试')
      this.once = once
      return `data:${type};base64,${Buffer.from(image.data).toString('base64')}`
    })
  }

  async submit(input: PasswordResetInput): Promise<string> {
    return this.run(async () => {
      const once = this.once
      this.once = undefined
      if (!once) throw new Error('验证码已失效，请刷新后重试')
      if (!input.username.trim() || !input.email.trim() || !input.captcha.trim())
        throw new Error('请填写用户名、注册邮箱和验证码')
      const response = await this.session.post<string>(
        '/forgot',
        new URLSearchParams({
          u: input.username.trim(),
          e: input.email.trim(),
          c: input.captcha.trim(),
          once
        }),
        {
          signal: this.abort.signal,
          maxRedirects: 0,
          v2exSkipTwoFactor: true,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: `${this.session.baseUrl}/forgot`
          }
        }
      )
      return parsePasswordResetResult(response.data)
    })
  }

  dispose(): void {
    this.once = undefined
    this.abort.abort()
    this.session.setCookie('')
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.abort.signal.aborted) throw new Error('找回密码流程已关闭，请重新打开')
    if (this.busy) throw new Error('请求正在处理中，请稍候')
    this.busy = true
    try {
      return await operation()
    } catch (error) {
      throw new Error(
        error instanceof Error && !('config' in error)
          ? error.message
          : '找回密码请求失败，请检查网络并刷新验证码后重试'
      )
    } finally {
      this.busy = false
    }
  }
}
