import { describe, expectTypeOf, test } from 'vitest'
import { V2exClient } from '../client'

describe('V2exClient public API', () => {
  test('keeps session, authentication internals and account reset out of the public contract', () => {
    expectTypeOf<
      Extract<keyof V2exClient, 'session' | 'auth' | 'accountService' | 'getOnce'>
    >().toEqualTypeOf<never>()
    expectTypeOf<Extract<keyof V2exClient['account'], 'reset'>>().toEqualTypeOf<never>()
  })
})
