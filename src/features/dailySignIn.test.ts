import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dailySignIn: vi.fn(),
  getAuthenticatedUsername: vi.fn(),
  getDailySignInStatus: vi.fn(),
  globalStateGet: vi.fn(),
  globalStateUpdate: vi.fn(),
  loggerDebug: vi.fn(),
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
    debug: mocks.loggerDebug,
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

/**
 * 将系统时间固定到指定的北京时间。
 * 例如 setBeijingTime('2026-07-21', 3) 表示北京时间 2026-07-21 03:00。
 */
function setBeijingTime(date: string, hour: number, minute = 0): void {
  const wallHour = String(hour).padStart(2, '0')
  const wallMinute = String(minute).padStart(2, '0')
  vi.setSystemTime(new Date(`${date}T${wallHour}:${wallMinute}:00.000+08:00`))
}

describe('dailySignIn feature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mocks.getAuthenticatedUsername.mockReturnValue('chaselen')
    mocks.globalStateGet.mockReturnValue(undefined)
    mocks.globalStateUpdate.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('treats mission-page claimed status as signed in and caches previous mission day after refresh hour', async () => {
    setBeijingTime('2026-07-21', 9)
    mocks.getDailySignInStatus.mockResolvedValue({
      signedIn: true,
      reward: { date: '2026-07-20', reward: 18 }
    })

    await expect(getDailySignInStatus()).resolves.toEqual({
      signedIn: true,
      result: 'repetitive',
      reward: 18
    })
    // 任务日为昨日：可写缓存供安静窗口使用，但不会匹配「今日已完成」
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: '2026-07-20',
      reward: 18
    })
  })

  test('caches status completion as today after typical refresh when reward date is today', async () => {
    setBeijingTime('2026-07-21', 9)
    mocks.getDailySignInStatus.mockResolvedValue({
      signedIn: true,
      reward: { date: '2026-07-21', reward: 12 }
    })

    await expect(getDailySignInStatus()).resolves.toEqual({
      signedIn: true,
      result: 'repetitive',
      reward: 12
    })
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: '2026-07-21',
      reward: 12
    })
  })

  test('caches status completion using mission date when previous mission is still current', async () => {
    setBeijingTime('2026-07-21', 2)
    // 领域层 date 已是任务日（描述中的 YYYYMMDD），不是流水墙钟日
    mocks.getDailySignInStatus.mockResolvedValue({
      signedIn: true,
      reward: { date: '2026-07-20', reward: 18 }
    })

    await expect(getDailySignInStatus()).resolves.toEqual({
      signedIn: true,
      result: 'repetitive',
      reward: 18
    })
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: '2026-07-20',
      reward: 18
    })
  })

  test('does not cache status when mission date is older than yesterday', async () => {
    setBeijingTime('2026-07-21', 9)
    mocks.getDailySignInStatus.mockResolvedValue({
      signedIn: true,
      reward: { date: '2026-07-19', reward: 9 }
    })

    await expect(getDailySignInStatus()).resolves.toEqual({
      signedIn: true,
      result: 'repetitive',
      reward: 9
    })
    expect(mocks.globalStateUpdate).not.toHaveBeenCalled()
  })

  test('manual sign-in caches stale-cycle repetitive as yesterday mission day', async () => {
    setBeijingTime('2026-07-21', 9)
    mocks.dailySignIn.mockResolvedValue({
      result: 'repetitive',
      reward: 18,
      rewardDate: '2026-07-20'
    })

    await expect(dailySignIn()).resolves.toMatchObject({
      signedIn: true,
      result: 'repetitive',
      reward: 18,
      loading: false
    })
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: '2026-07-20',
      reward: 18
    })
  })

  test('manual sign-in caches success as today after typical refresh', async () => {
    setBeijingTime('2026-07-21', 10)
    mocks.dailySignIn.mockResolvedValue({
      result: 'success',
      reward: 20,
      rewardDate: '2026-07-21'
    })

    await expect(dailySignIn()).resolves.toMatchObject({
      signedIn: true,
      result: 'success',
      reward: 20,
      loading: false
    })
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: '2026-07-21',
      reward: 20
    })
  })

  test('manual sign-in caches success with previous mission day when claimed before refresh', async () => {
    setBeijingTime('2026-07-21', 3)
    // 领域层返回描述中的任务日（上一自然日），不是流水墙钟日
    mocks.dailySignIn.mockResolvedValue({
      result: 'success',
      reward: 14,
      rewardDate: '2026-07-20'
    })

    await expect(dailySignIn()).resolves.toMatchObject({
      signedIn: true,
      result: 'success',
      reward: 14,
      loading: false
    })
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: '2026-07-20',
      reward: 14
    })
  })

  test('manual sign-in omits zero reward when balance has no daily login entry', async () => {
    setBeijingTime('2026-07-21', 9)
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
    setBeijingTime('2026-07-21', 9)
    // 无本地缓存时会查状态；任务日为昨日表示尚未刷新到今日任务
    mocks.getDailySignInStatus.mockResolvedValue({
      signedIn: true,
      reward: { date: '2026-07-20', reward: 18 }
    })

    await expect(autoDailySignIn()).resolves.toEqual({
      signedIn: true,
      result: 'repetitive',
      reward: 18
    })
    expect(mocks.dailySignIn).not.toHaveBeenCalled()
  })

  test('auto sign-in starts redeem only when the mission page is claimable', async () => {
    setBeijingTime('2026-07-21', 9)
    mocks.getDailySignInStatus.mockResolvedValue({ signedIn: false })
    mocks.dailySignIn.mockResolvedValue({
      result: 'success',
      reward: 9,
      rewardDate: '2026-07-21'
    })

    await expect(autoDailySignIn()).resolves.toMatchObject({
      signedIn: true,
      result: 'success',
      reward: 9,
      loading: false
    })
    expect(mocks.dailySignIn).toHaveBeenCalledOnce()
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: '2026-07-21',
      reward: 9
    })
  })

  test('auto sign-in skips network before typical refresh when yesterday already completed', async () => {
    setBeijingTime('2026-07-21', 3)
    mocks.globalStateGet.mockReturnValue({
      username: 'chaselen',
      date: '2026-07-20',
      reward: 18
    })

    await expect(autoDailySignIn()).resolves.toEqual({
      signedIn: true,
      result: 'repetitive',
      reward: 18
    })
    expect(mocks.getDailySignInStatus).not.toHaveBeenCalled()
    expect(mocks.dailySignIn).not.toHaveBeenCalled()
    expect(mocks.loggerDebug).toHaveBeenCalledWith(
      '自动签到跳过：任务刷新前且昨日已完成',
      expect.objectContaining({ rewardDate: '2026-07-20', beijingHour: 3 })
    )
  })

  test('auto sign-in still queries after typical refresh hour even with yesterday cache', async () => {
    setBeijingTime('2026-07-21', 8)
    mocks.globalStateGet.mockReturnValue({
      username: 'chaselen',
      date: '2026-07-20',
      reward: 18
    })
    mocks.getDailySignInStatus.mockResolvedValue({
      signedIn: true,
      reward: { date: '2026-07-20', reward: 18 }
    })

    await expect(autoDailySignIn()).resolves.toEqual({
      signedIn: true,
      result: 'repetitive',
      reward: 18
    })
    expect(mocks.getDailySignInStatus).toHaveBeenCalledOnce()
    expect(mocks.dailySignIn).not.toHaveBeenCalled()
  })

  test('auto sign-in claims previous mission before refresh and caches mission day', async () => {
    setBeijingTime('2026-07-21', 2)
    mocks.globalStateGet.mockReturnValue(undefined)
    mocks.getDailySignInStatus.mockResolvedValue({ signedIn: false })
    mocks.dailySignIn.mockResolvedValue({
      result: 'success',
      reward: 11,
      // 任务日来自描述，凌晨补领时为上一自然日
      rewardDate: '2026-07-20'
    })

    await expect(autoDailySignIn()).resolves.toMatchObject({
      signedIn: true,
      result: 'success',
      reward: 11,
      loading: false
    })
    expect(mocks.getDailySignInStatus).toHaveBeenCalledOnce()
    expect(mocks.dailySignIn).toHaveBeenCalledOnce()
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: '2026-07-20',
      reward: 11
    })
  })

  test('auto sign-in still claims after refresh when only previous mission day is cached', async () => {
    setBeijingTime('2026-07-21', 9)
    mocks.globalStateGet.mockReturnValue({
      username: 'chaselen',
      date: '2026-07-20',
      reward: 11
    })
    mocks.getDailySignInStatus.mockResolvedValue({ signedIn: false })
    mocks.dailySignIn.mockResolvedValue({
      result: 'success',
      reward: 8,
      rewardDate: '2026-07-21'
    })

    await expect(autoDailySignIn()).resolves.toMatchObject({
      signedIn: true,
      result: 'success',
      reward: 8,
      loading: false
    })
    expect(mocks.dailySignIn).toHaveBeenCalledOnce()
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: '2026-07-21',
      reward: 8
    })
  })

  test('auto sign-in quiet window ignores other account cache', async () => {
    setBeijingTime('2026-07-21', 1)
    mocks.globalStateGet.mockReturnValue({
      username: 'other-user',
      date: '2026-07-20',
      reward: 18
    })
    mocks.getDailySignInStatus.mockResolvedValue({ signedIn: false })
    mocks.dailySignIn.mockResolvedValue({
      result: 'success',
      reward: 7,
      rewardDate: '2026-07-20'
    })

    await expect(autoDailySignIn()).resolves.toMatchObject({
      signedIn: true,
      result: 'success',
      reward: 7
    })
    expect(mocks.getDailySignInStatus).toHaveBeenCalledOnce()
    expect(mocks.globalStateUpdate).toHaveBeenCalledWith('lastAutoSignInDate', {
      username: 'chaselen',
      date: '2026-07-20',
      reward: 7
    })
  })
})
