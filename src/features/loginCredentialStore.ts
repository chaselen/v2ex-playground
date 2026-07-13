import type vscode from 'vscode'
import { normalizeLoginCookie } from '@/v2ex'

/** SecretStorage 登录凭据键 */
const LOGIN_COOKIE_SECRET_KEY = 'v2ex.loginCookie'

/** 旧版 globalState 登录凭据键 */
const LEGACY_LOGIN_COOKIE_KEY = 'cookie'

/** 登录凭据持久化存储 */
export class LoginCredentialStore {
  /**
   * @param context 插件上下文
   */
  constructor(private readonly context: vscode.ExtensionContext) {}

  /** 读取登录 Cookie，并迁移旧版 globalState 数据 */
  async load(): Promise<string> {
    const storedCookie = await this.context.secrets.get(LOGIN_COOKIE_SECRET_KEY)
    const legacyCookieValue = this.context.globalState.get<string>(LEGACY_LOGIN_COOKIE_KEY)
    const storedLoginCookie = normalizeLoginCookie(storedCookie)
    const legacyLoginCookie = normalizeLoginCookie(legacyCookieValue)
    const loginCookie = storedLoginCookie || legacyLoginCookie

    if (
      (loginCookie && loginCookie !== storedCookie) ||
      (!loginCookie && storedCookie !== undefined)
    ) {
      await this.save(loginCookie)
    }
    if (legacyCookieValue !== undefined) {
      await this.context.globalState.update(LEGACY_LOGIN_COOKIE_KEY, undefined)
    }
    return loginCookie
  }

  /**
   * 保存登录 Cookie
   * @param cookie 登录 Cookie
   */
  async save(cookie: string): Promise<void> {
    const loginCookie = normalizeLoginCookie(cookie)
    if (loginCookie) {
      await this.context.secrets.store(LOGIN_COOKIE_SECRET_KEY, loginCookie)
    } else {
      await this.context.secrets.delete(LOGIN_COOKIE_SECRET_KEY)
    }
  }
}
