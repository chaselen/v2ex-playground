import vscode from 'vscode'

let output: vscode.LogOutputChannel | undefined

/** 初始化扩展统一日志通道 */
export function initializeLogger(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('V2EX', { log: true })
  context.subscriptions.push(output)
}

/** 将未知异常转换为日志通道可接受的内容 */
function normalizeError(error: unknown): string | Error {
  if (typeof error === 'string' || error instanceof Error) {
    return error
  }
  return String(error)
}

/** 扩展统一日志记录器 */
export const logger = {
  trace(message: string, ...args: unknown[]): void {
    output?.trace(message, ...args)
  },
  debug(message: string, ...args: unknown[]): void {
    output?.debug(message, ...args)
  },
  info(message: string, ...args: unknown[]): void {
    output?.info(message, ...args)
  },
  warn(message: string, ...args: unknown[]): void {
    output?.warn(message, ...args)
  },
  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (error === undefined) {
      output?.error(message, ...args)
      return
    }
    output?.error(message, normalizeError(error), ...args)
  },
  show(): void {
    output?.show(true)
  }
}
