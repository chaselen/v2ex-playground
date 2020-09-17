import { TreeNode } from './providers/BaseProvider';
import ExploreProvider from './providers/ExploreProvider';
import * as vscode from 'vscode';
import topicItemClick from './commands/topicItemClick';
import login, { LoginResult } from './commands/login';
import G from './global';
import { EOL } from 'os';
import CustomProvider from './providers/CustomProvider';
import addNode from './commands/addNode';
import removeNode from './commands/removeNode';
import CollectionProvider from './providers/CollectionProvider';

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

  const collectionProvider = new CollectionProvider();
  vscode.window.createTreeView('v2ex-collection', {
    treeDataProvider: collectionProvider,
    showCollapseAll: true
  });

  // 公共事件：登录
  let cDisposable1 = vscode.commands.registerCommand('v2ex.login', async () => {
    const loginResult = await login();
    if (loginResult === LoginResult.success || loginResult === LoginResult.logout) {
      collectionProvider.refreshNodeList();
    }
  });

  // 公共事件：复制链接
  let cDisposable2 = vscode.commands.registerCommand('v2ex.copyLink', (item: TreeNode) => vscode.env.clipboard.writeText(item.link));

  // 公共事件：复制标题和链接
  let cDisposable3 = vscode.commands.registerCommand('v2ex.copyTitleLink', (item: TreeNode) =>
    vscode.env.clipboard.writeText(item.label + EOL + item.link)
  );

  // 公共事件：在浏览器中打开
  let cDisposable4 = vscode.commands.registerCommand('v2ex.viewInBrowser', (item: TreeNode) => vscode.env.openExternal(vscode.Uri.parse(item.link)));

  // 公共事件：点击浏览帖子
  let cDisposable5 = vscode.commands.registerCommand('topicItemClick', (item: TreeNode) => topicItemClick(item));

  // 首页视图事件：刷新全部
  let homeDisposable1 = vscode.commands.registerCommand('v2ex-explore.refreshAll', () => exploreProvider.refreshAll());

  // 首页视图事件：刷新当前节点
  let homeDisposable2 = vscode.commands.registerCommand('v2ex-explore.refreshNode', (root: TreeNode) => exploreProvider.refreshRoot(root));

  // 自定义视图事件：添加自定义节点
  let cusDisposable1 = vscode.commands.registerCommand('v2ex-explore.addNode', async () => {
    const isAdd = await addNode();
    isAdd && customProvider.refreshNodeList();
  });

  // 自定义视图事件：刷新全部
  let cusDisposable2 = vscode.commands.registerCommand('v2ex-custom.refreshAll', () => customProvider.refreshAll());

  // 自定义视图事件：刷新当前节点
  let cusDisposable3 = vscode.commands.registerCommand('v2ex-custom.refreshNode', (root: TreeNode) => customProvider.refreshRoot(root));

  // 自定义视图事件：删除自定义节点
  let cusDisposable4 = vscode.commands.registerCommand('v2ex-custom.removeNode', (root: TreeNode) => {
    removeNode(root);
    customProvider.refreshNodeList();
  });

  // 收藏视图事件：刷新全部
  let colDisposable1 = vscode.commands.registerCommand('v2ex-collection.refreshAll', () => collectionProvider.refreshAll());

  // 收藏视图事件：刷新当前节点
  let colDisposable2 = vscode.commands.registerCommand('v2ex-collection.refreshNode', (root: TreeNode) => collectionProvider.refreshRoot(root));

  // 测试页面
  // V2ex.openTestPage();

  context.subscriptions.push(
    cDisposable1,
    cDisposable2,
    cDisposable3,
    cDisposable4,
    cDisposable5,
    homeDisposable1,
    homeDisposable2,
    cusDisposable1,
    cusDisposable2,
    cusDisposable3,
    cusDisposable4,
    colDisposable1,
    colDisposable2
  );
}

export function deactivate() {
  G.context = undefined;
}
