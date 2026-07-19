import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dailySignIn: vi.fn(),
  getAuthenticatedUsername: vi.fn(),
  getDailySignInStatus: vi.fn(),
  globalStateGet: vi.fn(),
  globalStateUpdate: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  showErrorMessage: vi.fn(),
  showInformationMessage: vi.fn()
}))

vi.mock('vscode', () => ({
  default: {
    EventEmitter: class {
      event = vi.fn()
      fire = vi.fn()
    },
    window: {
      showErrorMessage: mocks.showErrorMessage,
      showInformationMessage: mocks.showInformationMessage
    }
  }
}))

vi.mock('@/config', () => ({
  default: {
    autoSignIn: vi.fn().mockReturnValue(true)
  }
}))

vi.mock('@/core/logger', () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn
  }
}))

vi.mock('@/global', () => ({
  default: {
    context: {
      globalState: {
        get: mocks.globalStateGet,
        update: mocks.globalStateUpdate
      }
    },
    V2ex: {
      dailySignIn: mocks.dailySignIn,
      getAuthenticatedUsername: mocks.getAuthenticatedUsername,
      getDailySignInStatus: mocks.getDailySignInStatus
    }
  }
}))

import autoDailySignIn, { dailySignIn, getDailySignInStatus } from './dailySignIn'

/** 与功能层一致的 +08:00 日历日期 */
function getCurrentV2exDate(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** 相对今天偏移 N 天的 +08:00 日期 */
function shiftV2exDate(days: number): string {
  const date = new Date(Date.now() + 8 * 60 * 60 * 1000)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

describe('dailySignIn feature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthenticatedUsername.mockReturnValue('chaselen')
    mocks.globalStateGet.mockReturnValue(undefined)
    mocks.globalStateUpdate.mockResolvedValue(undefined)
  })

  test('treats mission-page claimed status as signed in before V2EX day rolls over', async () => {
    const yesterday = shiftV2exDate(-1)
    mocks.getDailySignInStatus.mockResolvedValue({
      signedIn: true,
      reward: { date: yesterday, reward: 18 }
    })

    await expect(getDailySignInStatus()).resolves.toEqual({
      signedIn: true,
      result: 'repetitive',
      reward: 18
    })
    expect(mocks.globalStateUpdate).not.toHaveBeenCalled()
  })

  test('caches completion only when the reward date matches the current +08:00 day', async () => {
    const today = getCurrentV2exDate()
    mocks.getDailySignInStatus.mockResolvedValue({
      signedIn: true,
      reward: { date: today, reward: 12 }
    })

    await expect(getDailySignInStatus()).resolves.toEqual({
      signedIn: true,
      result: 'repetitive',
      reward: 12
    })
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: today,
      reward: 12
    })
  })

  test('manual sign-in returns signed in for stale-cycle repetitive without caching today', async () => {
    const yesterday = shiftV2exDate(-1)
    mocks.dailySignIn.mockResolvedValue({
      result: 'repetitive',
      reward: 18,
      rewardDate: yesterday
    })

    await expect(dailySignIn()).resolves.toMatchObject({
      signedIn: true,
      result: 'repetitive',
      reward: 18,
      loading: false
    })
    expect(mocks.globalStateUpdate).not.toHaveBeenCalled()
  })

  test('manual sign-in caches success for the new reward date', async () => {
    const today = getCurrentV2exDate()
    mocks.dailySignIn.mockResolvedValue({
      result: 'success',
      reward: 20,
      rewardDate: today
    })

    await expect(dailySignIn()).resolves.toMatchObject({
      signedIn: true,
      result: 'success',
      reward: 20,
      loading: false
    })
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: today,
      reward: 20
    })
  })

  test('manual sign-in omits zero reward when balance has no daily login entry', async () => {
    mocks.dailySignIn.mockResolvedValue({
      result: 'repetitive',
      reward: 0,
      rewardDate: undefined
    })

    await expect(dailySignIn()).resolves.toMatchObject({
      signedIn: true,
      result: 'repetitive',
      reward: undefined,
      loading: false
    })
    expect(mocks.globalStateUpdate).not.toHaveBeenCalled()
  })

  test('auto sign-in returns page status without starting redeem when already claimed', async () => {
    const yesterday = shiftV2exDate(-1)
    mocks.getDailySignInStatus.mockResolvedValue({
      signedIn: true,
      reward: { date: yesterday, reward: 18 }
    })

    await expect(autoDailySignIn()).resolves.toEqual({
      signedIn: true,
      result: 'repetitive',
      reward: 18
    })
    expect(mocks.dailySignIn).not.toHaveBeenCalled()
  })

  test('auto sign-in starts redeem only when the mission page is claimable', async () => {
    const today = getCurrentV2exDate()
    mocks.getDailySignInStatus.mockResolvedValue({ signedIn: false })
    mocks.dailySignIn.mockResolvedValue({
      result: 'success',
      reward: 9,
      rewardDate: today
    })

    await expect(autoDailySignIn()).resolves.toMatchObject({
      signedIn: true,
      result: 'success',
      reward: 9,
      loading: false
    })
    expect(mocks.dailySignIn).toHaveBeenCalledOnce()
  })
})
