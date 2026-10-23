import type { SyntaxTheme } from 'vscode-tint'

/** 所有正文页面共用的 TextMate 主题读取命令 */
export interface SyntaxThemeRpcCommands {
  getSyntaxTheme(): Promise<SyntaxTheme>
}

/** 当前主题及用户自定义合并后的完整 TextMate 规则 */
export interface SyntaxThemeWebviewEvents {
  syntaxThemeChanged: { theme: SyntaxTheme }
}
