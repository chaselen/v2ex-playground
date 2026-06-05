import * as esbuild from 'esbuild'

const isProd = process.argv.includes('--production')
const isWatch = process.argv.includes('--watch')

const config: esbuild.BuildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.cjs',
  platform: 'node',
  format: 'cjs',
  target: 'es2022',
  sourcemap: !isProd,
  minify: isProd,
  external: ['vscode']
  // platform: 'node' 自动 external 所有 Node 内置模块（path, fs, os 等）
}

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(config)
    await ctx.watch()
    console.log('[esbuild] watching...')
  } else {
    await esbuild.build(config)
    console.log('[esbuild] build done')
  }
}

main()
