import { AuthSessionChangedError } from './types'

/** 判断异常是否表示认证会话已经变化 */
export function isAuthSessionChangedError(error: unknown): error is AuthSessionChangedError {
  return error instanceof AuthSessionChangedError
}

/**
 * 执行任务并静默忽略认证会话变化
 * @param task 当前认证会话中的任务
 */
export async function ignoreAuthSessionChange(task: () => Promise<void>): Promise<void> {
  try {
    await task()
  } catch (error) {
    if (!isAuthSessionChangedError(error)) throw error
  }
}
