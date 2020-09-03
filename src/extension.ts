import { V2ex } from './v2ex';
import { DataProvider, Node } from './DataProvider';
import * as vscode from 'vscode';
import * as path from 'path';
import * as template from 'art-template';

export function activate(context: vscode.ExtensionContext) {
  // let disposable = vscode.commands.registerCommand('v2ex-playground.helloWorld', () => {
  //   vscode.window.showInformationMessage('V2EX Playground');
  // });

  // 列表数据
  const dataProvider = new DataProvider();
  vscode.window.registerTreeDataProvider('v2ex-explore', dataProvider);

  // 事件：刷新当前节点
  let disposable2 = vscode.commands.registerCommand('v2ex-explore.refreshNode', (root: Node) => {
    dataProvider.refreshRoot(root);
  });

  // 事件：刷新全部
  let disposable3 = vscode.commands.registerCommand('v2ex-explore.refreshAll', () => {
    dataProvider.refreshAll();
  });

  // 事件：在浏览器中打开
  let disposable4 = vscode.commands.registerCommand('v2ex-explore.viewInBrowser', (item: Node) => {
    vscode.env.openExternal(vscode.Uri.parse(item.link || 'https://www.v2ex.com'));
  });

  // 点击浏览帖子
  const templatePath = path.join(context.extensionPath, 'resources', 'html', 'topic.art');
  let disposable5 = vscode.commands.registerCommand('itemClick', (item: Node) => {
    const panel = vscode.window.createWebviewPanel(item.link || '', item.label || '', vscode.ViewColumn.One, { enableScripts: true });

    // 获取详情数据
    V2ex.getTopicDetail(item.link || '')
      .then((detail) => {
        const html = template(templatePath, {
          topic: detail,
          extensionPath: context.extensionPath
        });
        console.log('topic html：', html);
        panel.webview.html = html;
      })
      .catch((err: Error) => {
        panel.dispose();
        console.error(err);
        vscode.window.showErrorMessage(`获取话题详情失败：${err.message}`);
      });
  });

  // 测试页面
  // V2ex.openTestPage(templatePath, context.extensionPath);

  // context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
  context.subscriptions.push(disposable3);
  context.subscriptions.push(disposable4);
  context.subscriptions.push(disposable5);
}

export function deactivate() {}
