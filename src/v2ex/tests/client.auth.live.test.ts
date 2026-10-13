import { describe, expect, test } from 'vitest'
import { V2exClient } from '../client'
import { normalizeLoginCookie } from '../cookie'

describe('V2exClient authentication', () => {
  const v2exCookie = process.env.V2EX_COOKIE
  const authTest = v2exCookie ? test : test.skip

  test('gets once token', async () => {
    await expect(new V2exClient().getOnce()).resolves.toMatch(/^\d+$/)
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
