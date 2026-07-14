import { describe, expect, test } from 'vitest'
import { V2exClient } from '../client'

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
})
