import { DataProvider, Node } from './DataProvider';
import * as vscode from 'vscode';
import topicItemClick from './commands/topicItemClick';
import g from './global';

export function activate(context: vscode.ExtensionContext) {
  g.context = context;

  // 列表数据
  const dataProvider = new DataProvider();
  vscode.window.createTreeView('v2ex-explore', {
    treeDataProvider: dataProvider,
    showCollapseAll: true
  });

  // 事件：刷新当前节点
  let disposable1 = vscode.commands.registerCommand('v2ex-explore.refreshNode', (root: Node) => dataProvider.refreshRoot(root));

  // 事件：刷新全部
  let disposable2 = vscode.commands.registerCommand('v2ex-explore.refreshAll', () => dataProvider.refreshAll());

  // 事件：在浏览器中打开
  let disposable3 = vscode.commands.registerCommand('v2ex-explore.viewInBrowser', (item: Node) =>
    vscode.env.openExternal(vscode.Uri.parse(item.link!))
  );

  // 点击浏览帖子
  let disposable4 = vscode.commands.registerCommand('topicItemClick', (item: Node) => topicItemClick(item));

  // 测试页面
  // V2ex.openTestPage();

  context.subscriptions.push(disposable1, disposable2, disposable3, disposable4);
}

export function deactivate() {
  g.context = undefined;
}
