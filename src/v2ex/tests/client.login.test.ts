import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { V2exClient } from '../client'

const form = `<form method="post" action="/signin"><input type="text" name="user-123"><input type="password" name="pass-123"><img src="/_captcha"><input type="text" name="captcha-123"><input name="once" value="42"><input name="next" value="/"></form>`
const homepage = (name: string) =>
  `<div id="Rightbar"><div class="box"><a href="/member/${name}">${name}</a><div id="member-activity"></div></div></div>`
const anonymous = '<a href="/signin">登录</a>'
const signedOut =
  anonymous +
  '<div id="Main"><div class="box">V2EX › 登出 你已经完全登出，没有任何个人信息留在这台电脑上。</div></div>'
const input = { username: ' new-user ', password: 'secret + &', captcha: ' abc ' }

let handle: (
  config: InternalAxiosRequestConfig
) =>
  | { status?: number; headers?: AxiosResponse['headers']; data?: unknown }
  | Promise<{ status?: number; headers?: AxiosResponse['headers']; data?: unknown }>
let requests: InternalAxiosRequestConfig[]
let clients: V2exClient[]

beforeEach(() => {
  requests = []
  clients = []
  const create = axios.create.bind(axios)
  vi.spyOn(axios, 'create').mockImplementation(config =>
    create({
      ...config,
      adapter: async request => {
        requests.push(request)
        return {
          config: request,
          status: 200,
          statusText: 'OK',
          headers: {},
          data: '',
          ...(await handle(request))
        }
      }
    })
  )
  handle = config => {
    if (config.url === '/signin' && config.method === 'get')
      return { data: form, headers: { 'set-cookie': ['challenge=session; Path=/'] } }
    if (config.url?.startsWith('/_captcha'))
      return { data: Buffer.from('image'), headers: { 'content-type': 'image/png' } }
    if (config.url === '/signin')
      return {
        status: 302,
        headers: { location: '/', 'set-cookie': ['A2=new; Domain=.v2ex.com; Path=/'] }
      }
    return {
      data: homepage(
        String(config.headers.get('Cookie')).includes('A2=new') ? 'NewUser' : 'OldUser'
      )
    }
  }
})
afterEach(() => {
  clients.forEach(client => client.dispose())
  vi.restoreAllMocks()
})

function client() {
  let stored = 'A2=old'
  const save = vi.fn(async (cookie: string) => {
    stored = cookie
  })
  const instance = new V2exClient(stored, { loginCookieStore: { load: async () => stored, save } })
  clients.push(instance)
  return { instance, save, stored: () => stored }
}

describe('password login candidates', () => {
  test('canceling candidate two-factor verification preserves the original account', async () => {
    const original = handle
    handle = config => {
      if (config.url === '/?tab=all' && String(config.headers.get('Cookie')).includes('A2=new'))
        return { status: 302, headers: { location: '/2fa' } }
      return original(config)
    }
    const instance = new V2exClient('A2=old', { onTwoFactorRequired: async () => false })
    clients.push(instance)
    await instance.ensureAuthenticated()
    const attempt = instance.createPasswordLogin()
    await attempt.loadChallenge()
    await expect(attempt.submit(input)).resolves.toBe('canceled')
    expect(instance.getAuthenticatedUsername()).toBe('OldUser')
    expect(instance.getLoginCookie()).toBe('A2=old')
    attempt.dispose()
  })

  test('keeps challenge cookies isolated and submits dynamic fields before committing the new account', async () => {
    const { instance, stored } = client()
    await instance.ensureAuthenticated()
    const attempt = instance.createPasswordLogin()
    expect(await attempt.loadChallenge()).toMatch(/^data:image\/png;base64,/)
    expect(instance.getLoginCookie()).toBe('A2=old')
    await expect(attempt.submit(input)).resolves.toBe('authenticated')
    const post = requests.find(config => config.method === 'post')!
    expect(Object.fromEntries(new URLSearchParams(post.data))).toEqual({
      'user-123': 'new-user',
      'pass-123': input.password,
      'captcha-123': 'abc',
      once: '42',
      next: '/'
    })
    expect(post.headers.get('Cookie')).toContain('challenge=session')
    expect(post.headers.get('Cookie')).not.toContain('A2=old')
    expect(instance.getAuthenticatedUsername()).toBe('NewUser')
    expect(stored()).toBe('A2=new')
    attempt.dispose()
  })

  test('keeps the original account on password failure and requires a fresh challenge', async () => {
    const original = handle
    handle = config =>
      config.method === 'post'
        ? { data: '<div class="problem">验证码错误</div>' }
        : original(config)
    const { instance, stored } = client()
    await instance.ensureAuthenticated()
    const attempt = instance.createPasswordLogin()
    await attempt.loadChallenge()
    await expect(attempt.submit(input)).rejects.toThrow('验证码错误')
    await expect(attempt.submit(input)).rejects.toThrow('已失效')
    expect(instance.getAuthenticatedUsername()).toBe('OldUser')
    expect(stored()).toBe('A2=old')
    attempt.dispose()
  })

  test('does not replay the password POST when login redirects to two-factor verification', async () => {
    const original = handle
    handle = config => {
      if (config.url === '/signin' && config.method === 'post')
        return {
          status: 302,
          headers: { location: '/2fa', 'set-cookie': ['A2=new; Domain=.v2ex.com; Path=/'] }
        }
      if (
        config.url === '/?tab=all' &&
        String(config.headers.get('Cookie')).includes('A2=new') &&
        !String(config.headers.get('Cookie')).includes('A2O=verified')
      )
        return { status: 302, headers: { location: '/2fa' } }
      if (config.url === '/poll_once') return { data: '43' }
      if (config.url === '/2fa')
        return {
          status: 302,
          headers: { location: '/', 'set-cookie': ['A2O=verified; Domain=.v2ex.com; Path=/'] }
        }
      return original(config)
    }
    const instance = new V2exClient('A2=old', {
      onTwoFactorRequired: async verification => {
        await verification.submitCode('123456')
        return true
      }
    })
    clients.push(instance)
    const attempt = instance.createPasswordLogin()
    await attempt.loadChallenge()
    await expect(attempt.submit(input)).resolves.toBe('authenticated')
    expect(
      requests.filter(config => config.url === '/signin' && config.method === 'post')
    ).toHaveLength(1)
    expect(instance.getLoginCookie()).toBe('A2=new; A2O=verified')
    attempt.dispose()
  })

  test('closing the login page while validation is pending prevents committing credentials', async () => {
    const original = handle
    let release!: () => void
    const waiting = new Promise<void>(resolve => {
      release = resolve
    })
    handle = async config => {
      if (config.url === '/?tab=all' && String(config.headers.get('Cookie')).includes('A2=new'))
        await waiting
      return original(config)
    }
    const { instance, stored } = client()
    const attempt = instance.createPasswordLogin()
    await attempt.loadChallenge()
    const submitting = attempt.submit(input)
    await vi.waitFor(() =>
      expect(
        requests.some(
          config =>
            config.url === '/?tab=all' && String(config.headers.get('Cookie')).includes('A2=new')
        )
      ).toBe(true)
    )
    attempt.dispose()
    release()
    await expect(submitting).resolves.toBe('canceled')
    expect(stored()).toBe('A2=old')
  })

  test('network errors containing request bodies are replaced with safe errors', async () => {
    const original = handle
    handle = config => {
      if (config.method === 'post')
        throw new axios.AxiosError('network failure', 'ERR_NETWORK', config)
      return original(config)
    }
    const { instance } = client()
    const attempt = instance.createPasswordLogin()
    await attempt.loadChallenge()
    try {
      await attempt.submit(input)
      expect.fail('must fail')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(error).not.toHaveProperty('config')
      expect(String(error)).not.toContain(input.password)
    }
    attempt.dispose()
  })
})

describe('source logout', () => {
  test.each([
    { response: '<div id="Main">稍后重试</div>', message: '退出登录失败，请稍后重试' },
    { response: signedOut, message: '退出后仍处于登录状态，请重试' }
  ])(
    'does not treat an unconfirmed logout or still-authenticated session as success',
    async ({ response, message }) => {
      handle = config => ({
        data:
          config.url === '/signout?once=123'
            ? response
            : homepage('OldUser') + `<a onclick="location.href= '/signout?once=123';">登出</a>`
      })
      const { instance, stored } = client()
      await instance.ensureAuthenticated()
      await expect(instance.logout()).rejects.toThrow(message)
      expect(instance.isAuthenticated()).toBe(true)
      expect(stored()).toBe('A2=old')
    }
  )
  test('an old source logout cannot clear a newly committed account', async () => {
    let release!: () => void
    const waiting = new Promise<void>(resolve => {
      release = resolve
    })
    let started = false
    handle = async config => {
      if (config.url === '/signout?once=123') {
        started = true
        await waiting
        return {
          status: 200,
          data: signedOut,
          headers: { 'set-cookie': ['A2=; Max-Age=0; Domain=.v2ex.com; Path=/'] }
        }
      }
      return {
        data:
          homepage(
            String(config.headers.get('Cookie')).includes('A2=new') ? 'NewUser' : 'OldUser'
          ) + `<a onclick="location.href= '/signout?once=123';">登出</a>`
      }
    }
    const { instance, stored } = client()
    await instance.ensureAuthenticated()
    const logout = instance.logout()
    await vi.waitFor(() => expect(started).toBe(true))
    await expect(instance.switchLoginCookie('A2=new')).resolves.toBe('authenticated')
    release()
    await expect(logout).resolves.toBe(false)
    expect(instance.getAuthenticatedUsername()).toBe('NewUser')
    expect(stored()).toBe('A2=new')
  })

  function installSignout(fail = false) {
    let revoked = false
    handle = config => {
      if (config.url === '/?tab=all')
        return {
          data: revoked
            ? anonymous
            : homepage('OldUser') + `<a onclick="location.href= '/signout?once=123';">登出</a>`
        }
      if (config.url === '/signout?once=123') {
        if (fail) return { data: '<div class="problem">退出失败</div>' }
        revoked = true
        return {
          status: 200,
          data: signedOut,
          headers: { 'set-cookie': ['A2=; Max-Age=0; Domain=.v2ex.com; Path=/'] }
        }
      }
      throw new Error('unexpected request')
    }
  }

  test('calls source signout before deleting local credentials', async () => {
    installSignout()
    const { instance, save } = client()
    await instance.ensureAuthenticated()
    save.mockImplementation(async () => {
      expect(requests.some(request => request.url === '/signout?once=123')).toBe(true)
    })
    await instance.logout()
    expect(instance.getLoginCookie()).toBe('')
    expect(instance.isAuthenticated()).toBe(false)
    expect(save).toHaveBeenCalledWith('')
  })

  test('keeps the original account if the source rejects signout', async () => {
    installSignout(true)
    const { instance, stored } = client()
    await instance.ensureAuthenticated()
    await expect(instance.logout()).rejects.toThrow('退出失败')
    expect(instance.isAuthenticated()).toBe(true)
    expect(instance.getLoginCookie()).toBe('A2=old')
    expect(stored()).toBe('A2=old')
  })

  test('invalidates runtime authentication if credential deletion fails after source signout', async () => {
    installSignout()
    const { instance, save } = client()
    await instance.ensureAuthenticated()
    save.mockRejectedValue(new Error('storage unavailable'))
    await expect(instance.logout()).rejects.toThrow('storage unavailable')
    expect(instance.isAuthenticated()).toBe(false)
    expect(instance.getLoginCookie()).toBe('')
  })
})

describe('authentication lifecycle regressions', () => {
  test('clears expired credentials when homepage redirects to signin during logout', async () => {
    const { instance, stored } = client()
    await instance.ensureAuthenticated()
    handle = () => ({ status: 302, headers: { location: '/signin' } })
    await expect(instance.logout()).resolves.toBe(true)
    expect(instance.isAuthenticated()).toBe(false)
    expect(instance.getLoginCookie()).toBe('')
    expect(stored()).toBe('')
  })

  test.each([false, true])(
    'shares concurrent logout and allows retry after failure (%s)',
    async fail => {
      let rejectLogout = fail
      let count = 0
      let release!: () => void
      const waiting = new Promise<void>(resolve => {
        release = resolve
      })
      handle = async config => {
        if (config.url === '/signout?once=123') {
          count++
          await waiting
          if (rejectLogout) throw new Error('network failure')
          return {
            status: 200,
            data: signedOut,
            headers: { 'set-cookie': ['A2=; Max-Age=0; Domain=.v2ex.com; Path=/'] }
          }
        }
        return {
          data: homepage('OldUser') + `<a onclick="location.href= '/signout?once=123';">登出</a>`
        }
      }
      const { instance, stored } = client()
      await instance.ensureAuthenticated()
      const first = instance.logout()
      const second = instance.logout()
      expect(first).toBe(second)
      await vi.waitFor(() => expect(count).toBe(1))
      release()
      if (fail) {
        await expect(first).rejects.toThrow('network failure')
        await expect(second).rejects.toThrow('network failure')
        expect(instance.isAuthenticated()).toBe(true)
        expect(stored()).toBe('A2=old')
        rejectLogout = false
        await expect(instance.logout()).resolves.toBe(true)
        expect(count).toBe(2)
      } else {
        await expect(first).resolves.toBe(true)
        await expect(second).resolves.toBe(true)
        expect(count).toBe(1)
      }
      expect(instance.isAuthenticated()).toBe(false)
      expect(stored()).toBe('')
    }
  )

  test.each(['password', 'cookie'] as const)(
    'canceling %s login invalidates the pending 2FA callback',
    async mode => {
      const original = handle
      handle = config => {
        if (config.url === '/?tab=all' && String(config.headers.get('Cookie')).includes('A2=new'))
          return { status: 302, headers: { location: '/2fa' } }
        return original(config)
      }
      let verification!: import('../types').TwoFactorVerification
      const instance = new V2exClient('A2=old', {
        onTwoFactorRequired: v => {
          verification = v
          return new Promise(resolve => {
            v.signal!.addEventListener('abort', () => resolve(false), { once: true })
          })
        }
      })
      clients.push(instance)
      await instance.ensureAuthenticated()
      const attempt = instance.createPasswordLogin()
      const abort = new AbortController()
      if (mode === 'password') await attempt.loadChallenge()
      const submitting =
        mode === 'password'
          ? attempt.submit(input)
          : instance.switchLoginCookie('A2=new', { signal: abort.signal })
      await vi.waitFor(() => expect(verification).toBeDefined())
      if (mode === 'password') attempt.dispose()
      else abort.abort()
      expect(verification.signal?.aborted).toBe(true)
      await expect(verification.submitCode('123456')).rejects.toThrow('登录状态已更新')
      await expect(submitting).resolves.toBe('canceled')
      expect(requests.some(config => config.url === '/2fa' && config.method === 'post')).toBe(false)
      expect(instance.getAuthenticatedUsername()).toBe('OldUser')
      attempt.dispose()
    }
  )
})

describe('logout across authentication changes', () => {
  test('clears local credentials if the session expires after reading the logout entry', async () => {
    handle = config =>
      config.url === '/signout?once=123'
        ? { status: 302, headers: { location: '/signin' } }
        : {
            data: homepage('OldUser') + `<a onclick="location.href= '/signout?once=123';">登出</a>`
          }
    const { instance, stored } = client()
    await instance.ensureAuthenticated()
    await expect(instance.logout()).resolves.toBe(true)
    expect(instance.isAuthenticated()).toBe(false)
    expect(stored()).toBe('')
  })

  test.each([false, true])(
    'a new account can log out independently (old request fails: %s)',
    async oldFails => {
      let finishOld!: () => void
      const oldResponse = new Promise<void>(resolve => {
        finishOld = resolve
      })
      const sourceLogouts: string[] = []
      handle = async config => {
        const cookie = String(config.headers.get('Cookie'))
        if (config.url === '/signout?once=123') {
          sourceLogouts.push(cookie)
          if (cookie.includes('A2=old')) {
            await oldResponse
            if (oldFails) throw new Error('old logout network failure')
          }
          return {
            status: 200,
            data: signedOut,
            headers: { 'set-cookie': ['A2=; Max-Age=0; Domain=.v2ex.com; Path=/'] }
          }
        }
        return {
          data:
            homepage(cookie.includes('A2=new') ? 'NewUser' : 'OldUser') +
            `<a onclick="location.href= '/signout?once=123';">登出</a>`
        }
      }
      const { instance, stored } = client()
      await instance.ensureAuthenticated()
      const oldLogout = instance.logout()
      try {
        await vi.waitFor(() => expect(sourceLogouts).toHaveLength(1))
        await expect(instance.switchLoginCookie('A2=new')).resolves.toBe('authenticated')
        const newLogout = instance.logout()
        expect(newLogout).not.toBe(oldLogout)
        await expect(newLogout).resolves.toBe(true)
        expect(sourceLogouts).toHaveLength(2)
        expect(sourceLogouts[1]).toContain('A2=new')
        expect(instance.isAuthenticated()).toBe(false)
        expect(stored()).toBe('')
      } finally {
        finishOld()
        await expect(oldLogout).resolves.toBe(false)
      }
    }
  )
})

test('disposing the client prevents a pending Cookie login from persisting credentials', async () => {
  const original = handle
  let release!: () => void
  const waiting = new Promise<void>(resolve => {
    release = resolve
  })
  let validating = false
  handle = async config => {
    if (config.url === '/?tab=all' && String(config.headers.get('Cookie')).includes('A2=new')) {
      validating = true
      await waiting
    }
    return original(config)
  }
  const { instance, stored } = client()
  const switching = instance.switchLoginCookie('A2=new')
  await vi.waitFor(() => expect(validating).toBe(true))
  instance.dispose()
  release()
  await expect(switching).resolves.toBe('canceled')
  expect(stored()).toBe('A2=old')
})

test('canceling logout invalidates its two-factor submission callback', async () => {
  let verification!: import('../types').TwoFactorVerification
  handle = () => ({ status: 302, headers: { location: '/2fa' } })
  const instance = new V2exClient('A2=old', {
    onTwoFactorRequired: v => {
      verification = v
      return new Promise(resolve => {
        v.signal!.addEventListener('abort', () => resolve(false), { once: true })
      })
    }
  })
  clients.push(instance)
  const result = instance.logout().catch(error => error)
  await vi.waitFor(() => expect(verification).toBeDefined())
  instance.dispose()
  await expect(verification.submitCode('123456')).rejects.toThrow('登录状态已更新')
  expect(requests.some(config => config.url === '/poll_once' || config.url === '/2fa')).toBe(false)
  expect(await result).toBeInstanceOf(Error)
})

describe('confirmed logout with internal cookies', () => {
  test('clears local credentials without a redundant homepage request after deleting A2', async () => {
    let completed = false
    handle = config => {
      if (config.url === '/signout?once=123') {
        completed = true
        return {
          status: 200,
          data: signedOut,
          headers: {
            'set-cookie': ['A2=; Max-Age=0; Domain=.v2ex.com; Path=/', 'V2EX_LANG=zhcn; Path=/']
          }
        }
      }
      if (completed) throw new Error('homepage temporarily unavailable')
      return {
        data: homepage('OldUser') + `<a onclick="location.href= '/signout?once=123';">登出</a>`
      }
    }
    const { instance, stored } = client()
    await instance.ensureAuthenticated()
    const start = requests.length
    await expect(instance.logout()).resolves.toBe(true)
    expect(requests.slice(start).map(request => request.url)).toEqual([
      '/?tab=all',
      '/signout?once=123'
    ])
    expect(instance.isAuthenticated()).toBe(false)
    expect(instance.getLoginCookie()).toBe('')
    expect(stored()).toBe('')
  })

  test('does not accept an unknown page merely because its response deletes A2', async () => {
    handle = config =>
      config.url === '/signout?once=123'
        ? {
            status: 200,
            data: '<div id="Main">未知页面</div>',
            headers: { 'set-cookie': ['A2=; Max-Age=0; Domain=.v2ex.com; Path=/'] }
          }
        : {
            data: homepage('OldUser') + `<a onclick="location.href= '/signout?once=123';">登出</a>`
          }
    const { instance, stored } = client()
    await instance.ensureAuthenticated()
    await expect(instance.logout()).rejects.toThrow('退出登录失败')
    expect(instance.isAuthenticated()).toBe(true)
    expect(stored()).toBe('A2=old')
  })

  test('continues verifying the account when the confirmation page retains A2', async () => {
    let completed = false
    handle = config => {
      if (config.url === '/signout?once=123') {
        completed = true
        return {
          status: 200,
          data: signedOut,
          headers: { 'set-cookie': ['V2EX_LANG=zhcn; Path=/'] }
        }
      }
      if (completed) throw new Error('homepage temporarily unavailable')
      return {
        data: homepage('OldUser') + `<a onclick="location.href= '/signout?once=123';">登出</a>`
      }
    }
    const { instance, stored } = client()
    await instance.ensureAuthenticated()
    await expect(instance.logout()).rejects.toThrow('homepage temporarily unavailable')
    expect(instance.isAuthenticated()).toBe(true)
    expect(stored()).toBe('A2=old')
  })
})

test('reports cooldown redirects from password submission without treating them as login success', async () => {
  const original = handle
  handle = config =>
    config.url === '/signin' && config.method === 'post'
      ? { status: 302, headers: { location: '/signin/cooldown' } }
      : original(config)
  const { instance: current } = client()
  const attempt = current.createPasswordLogin()
  await attempt.loadChallenge()
  await expect(attempt.submit(input)).rejects.toThrow('登录受限')
  attempt.dispose()
})
