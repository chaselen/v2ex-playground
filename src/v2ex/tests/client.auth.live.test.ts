import { describe, expect, test } from 'vitest'
import axios from 'axios'
import { V2exClient } from '../client'
import { LoginCooldownError } from '../types'
import { normalizeLoginCookie } from '../cookie'
import { V2exSession, V2EX_REQUEST_HEADERS, V2EX_REQUEST_TIMEOUT } from '../session'
import {
  parseSignoutPath,
  parsePasswordResetForm,
  parsePasswordResetResult,
  parseSigninForm,
  parseAuthProblem
} from '../parsers/auth'

describe('V2exClient authentication', () => {
  test('loads the current Chinese signin form and captcha in an isolated session', async () => {
    const client = new V2exClient()
    const attempt = client.createPasswordLogin()
    try {
      await expect(attempt.loadChallenge()).resolves.toMatch(
        /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/
      )
      expect(client.getLoginCookie()).toBe('')
      await expect(attempt.loadChallenge()).resolves.toMatch(/^data:image\//)
    } finally {
      attempt.dispose()
      client.dispose()
    }
  })

  test('loads the Chinese password reset challenge without changing login credentials', async () => {
    const client = new V2exClient()
    const attempt = client.createPasswordReset()
    try {
      await expect(attempt.loadChallenge()).resolves.toMatch(
        /^data:image\/(png|jpeg|gif|webp);base64,/
      )
      expect(client.getLoginCookie()).toBe('')
    } finally {
      attempt.dispose()
      client.dispose()
    }
  })

  test('preserves separate errors from the live password reset form without requesting email', async () => {
    const session = new V2exSession()
    const page = await session.get<string>('/forgot')
    const once = parsePasswordResetForm(page.data)
    const response = await session.post<string>(
      '/forgot',
      new URLSearchParams({
        u: '',
        e: '',
        c: 'invalid',
        once
      }),
      { headers: { Referer: `${session.baseUrl}/forgot` } }
    )
    expect(() => parsePasswordResetResult(response.data)).toThrow(/\n• .+\n• /)
  })

  test('reads the live signin error list after its empty hidden problem container', async () => {
    const session = new V2exSession()
    const page = await session.get<string>('/signin')
    const form = parseSigninForm(page.data)
    const response = await session.post<string>(
      '/signin',
      new URLSearchParams({
        [form.usernameField]: '',
        [form.passwordField]: '',
        [form.captchaField]: 'invalid',
        once: form.once,
        next: form.next
      }),
      {
        maxRedirects: 0,
        v2exSkipTwoFactor: true,
        headers: { Referer: `${session.baseUrl}/signin` }
      }
    )
    const problem = parseAuthProblem(response.data)
    expect(problem).toContain('• 请输入用户名')
    expect(problem).toContain('• 请输入密码')
    expect(problem).toContain('• 输入的验证码不正确')
  })

  test('reads the live cooldown page or its unrestricted redirect without attempting login', async () => {
    // 未受限 IP 会跳回登录页；直接观察响应，避免将正常跳转当作会话失效
    const response = await axios.get<string>('https://www.v2ex.com/signin/cooldown', {
      headers: V2EX_REQUEST_HEADERS,
      timeout: V2EX_REQUEST_TIMEOUT,
      maxRedirects: 0,
      validateStatus: status => status === 200 || status === 302
    })
    if (response.status === 302) {
      expect(new URL(response.headers.location, 'https://www.v2ex.com').href).toBe(
        'https://www.v2ex.com/signin'
      )
      const page = await new V2exSession().get<string>('/signin')
      expect(parseSigninForm(page.data).once).toMatch(/^\d+$/)
    } else {
      expect(() => parseSigninForm(response.data)).toThrow(LoginCooldownError)
      expect(() => parseSigninForm(response.data)).toThrow('至多 1 天')
    }
  })

  const v2exCookie = process.env.V2EX_COOKIE
  const authTest = v2exCookie ? test : test.skip

  // 显式启用写操作验证，避免普通认证检查自动退出会话
  test.skipIf(!v2exCookie || process.env.V2EX_TEST_SIGNOUT !== '1')(
    'signs out through the V2EX confirmation page and clears local credentials',
    async () => {
      let stored = normalizeLoginCookie(v2exCookie)
      const client = await V2exClient.create({
        loginCookieStore: {
          load: async () => stored,
          save: async cookie => {
            stored = cookie
          }
        }
      })
      try {
        await client.refreshAuthentication()
        await client.logout()
        expect(client.isAuthenticated()).toBe(false)
        expect(client.getLoginCookie()).toBe('')
        expect(stored).toBe('')
      } finally {
        client.dispose()
      }
    }
  )

  authTest('recognizes the source signout entry without revoking the test session', async () => {
    const session = new V2exSession(v2exCookie)
    const { data } = await session.get<string>('/?tab=all')
    expect(parseSignoutPath(data)).toMatch(/^\/signout\?once=\d+$/)
  })

  authTest('refreshes the authenticated session with V2EX_COOKIE', async () => {
    const client = new V2exClient(v2exCookie)

    await expect(client.refreshAuthentication()).resolves.toBe(true)
    expect(client.getAuthenticatedUsername()).not.toBe('')
  })

  authTest('persists renewed homepage credentials and restores them after restart', async () => {
    let stored = normalizeLoginCookie(v2exCookie)
    const store = {
      load: async () => stored,
      save: async (cookie: string) => {
        stored = cookie
      }
    }
    const client = await V2exClient.create({ loginCookieStore: store })
    try {
      await expect(client.refreshAuthentication()).resolves.toBe(true)
      expect(stored).toBe(client.getLoginCookie())
      expect(stored).not.toContain('V2EX_LANG')
      const restarted = await V2exClient.create({ loginCookieStore: store })
      try {
        await expect(restarted.refreshAuthentication()).resolves.toBe(true)
      } finally {
        restarted.dispose()
      }
    } finally {
      client.dispose()
    }
  })
})

describe('V2exSession authentication', () => {
  test('gets once token', async () => {
    await expect(new V2exSession().getOnce()).resolves.toMatch(/^\d+$/)
  })
})
