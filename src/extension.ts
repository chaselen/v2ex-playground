import { V2ex } from './v2ex';
import { DataProvider, TreeNode } from './DataProvider';
import * as vscode from 'vscode';
import topicItemClick from './commands/topicItemClick';
import login from './commands/login';
import G from './global';
import { EOL } from 'os';

export function activate(context: vscode.ExtensionContext) {
  G.context = context;

  // 列表数据
  const dataProvider = new DataProvider();
  vscode.window.createTreeView('v2ex-explore', {
    treeDataProvider: dataProvider,
    showCollapseAll: true
  });

  // 事件：登录
  let disposable0 = vscode.commands.registerCommand('v2ex-explore.login', () => login());

  // 事件：刷新全部
  let disposable1 = vscode.commands.registerCommand('v2ex-explore.refreshAll', () => dataProvider.refreshAll());

  // 事件：刷新当前节点
  let disposable2 = vscode.commands.registerCommand('v2ex-explore.refreshNode', (root: TreeNode) => dataProvider.refreshRoot(root));

  // 事件：复制链接
  let disposable3 = vscode.commands.registerCommand('v2ex-explore.copyLink', (item: TreeNode) => vscode.env.clipboard.writeText(item.link));

  // 事件：复制标题和链接
  let disposable4 = vscode.commands.registerCommand('v2ex-explore.copyTitleLink', (item: TreeNode) =>
    vscode.env.clipboard.writeText(item.label + EOL + item.link)
  );

  // 事件：在浏览器中打开
  let disposable5 = vscode.commands.registerCommand('v2ex-explore.viewInBrowser', (item: TreeNode) =>
    vscode.env.openExternal(vscode.Uri.parse(item.link))
  );

  // 点击浏览帖子
  let disposable6 = vscode.commands.registerCommand('topicItemClick', (item: TreeNode) => topicItemClick(item));

  // 测试页面
  // V2ex.openTestPage();

  context.subscriptions.push(disposable0, disposable1, disposable2, disposable3, disposable4, disposable5, disposable6);
}

export function deactivate() {
  G.context = undefined;
}
