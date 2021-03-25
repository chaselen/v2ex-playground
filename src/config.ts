import * as vscode from 'vscode';

/**
 * 获取配置
 */
export default class Config {
  /** 是否在新标签页打开 */
  static openInNewTab(): boolean {
    const b = vscode.workspace
      .getConfiguration()
      .get<boolean>('v2ex.browse.openInNewTab');
    return b !== undefined ? b : true;
  }
}
