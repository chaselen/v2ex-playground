import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { expect, test } from 'vitest'

/** 入口加载阶段只会创建事件源，不触发宿主操作 */
class EventEmitterStub {
  event() {
    return { dispose() {} }
  }
  fire() {}
  dispose() {}
}

test('生产构建入口可完成模块初始化', async () => {
  const entryPath = fileURLToPath(new URL('./extension.ts', import.meta.url))
  const filename = resolve(dirname(entryPath), '../out/extension.cjs')
  const result = await build({
    entryPoints: [entryPath],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'es2022',
    minify: true,
    external: ['vscode'],
    write: false,
    logLevel: 'silent'
  })
  const nodeRequire = createRequire(import.meta.url)
  const requireModule = (id: string) =>
    id === 'vscode' ? { EventEmitter: EventEmitterStub } : nodeRequire(id)
  const entryModule = { exports: {} as { activate?: unknown; deactivate?: unknown } }
  const load = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    result.outputFiles[0].text
  )

  // 实际执行模块初始化，覆盖类型检查与打包无法发现的初始化顺序问题
  load(requireModule, entryModule, entryModule.exports, filename, dirname(filename))
  expect(entryModule.exports.activate).toBeTypeOf('function')
  expect(entryModule.exports.deactivate).toBeTypeOf('function')
})
