declare const Vue: typeof import('vue')

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void
}
