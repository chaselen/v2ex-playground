import { TreeNode } from './providers/BaseProvider';
import ExploreProvider from './providers/ExploreProvider';
import * as vscode from 'vscode';
import topicItemClick from './commands/topicItemClick';
import login from './commands/login';
import G from './global';
import { EOL } from 'os';
import CustomProvider from './providers/CustomProvider';
import addNode from './commands/addNode';
import removeNode from './commands/removeNode';

export function activate(context: vscode.ExtensionContext) {
  G.context = context;

  // 列表数据
  const exploreProvider = new ExploreProvider();
  vscode.window.createTreeView('v2ex-explore', {
    treeDataProvider: exploreProvider,
    showCollapseAll: true
  });

  const customProvider = new CustomProvider();
  vscode.window.createTreeView('v2ex-custom', {
    treeDataProvider: customProvider,
    showCollapseAll: true
  });

  // 事件：登录
  let disposable0 = vscode.commands.registerCommand('v2ex-explore.login', () => login());

  // 事件：刷新全部
  let disposable1 = vscode.commands.registerCommand('v2ex-explore.refreshAll', () => exploreProvider.refreshAll());

  // 事件：刷新当前节点
  let disposable2 = vscode.commands.registerCommand('v2ex-explore.refreshNode', (root: TreeNode) => exploreProvider.refreshRoot(root));

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

  // 事件：添加自定义节点
  let disposable7 = vscode.commands.registerCommand('v2ex-explore.addNode', async () => {
    const isAdd = await addNode();
    isAdd && customProvider.refreshNodeList();
  });

  // 事件：删除自定义节点
  let disposable8 = vscode.commands.registerCommand('v2ex-custom.removeNode', (root: TreeNode) => {
    removeNode(root);
    customProvider.refreshNodeList();
  });

  // 测试页面
  // V2ex.openTestPage();

  context.subscriptions.push(disposable0, disposable1, disposable2, disposable3, disposable4, disposable5, disposable6, disposable7, disposable8);
}

export function deactivate() {
  G.context = undefined;
}
