import { DataProvider, Node, TopicDetail } from './DataProvider';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as template from 'art-template';

export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "v2ex-playground" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('v2ex-playground.helloWorld', () => {
    // The code you place here will be executed every time your command is executed

    // Display a message box to the user
    vscode.window.showInformationMessage('Hello World from V2EX Playground!');
  });

  // 列表数据
  const dataProvider = new DataProvider();
  vscode.window.registerTreeDataProvider('v2ex-explore', dataProvider);
  // dataProvider.refreshAll();

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
  const templatePath = path.join(context.extensionPath, 'src', 'topic.art');
  let disposable5 = vscode.commands.registerCommand('itemClick', (item: Node) => {
    const panel = vscode.window.createWebviewPanel(item.link || '', item.label || '', vscode.ViewColumn.One, {});

    // 先加载一个只有标题的页面
    const _default = new TopicDetail();
    _default.title = item.label || '';
    panel.webview.html = template(templatePath, _default);

    // 获取详情页面
    dataProvider.getTopicDetail(item.link || '').then((detail) => {
			const html = template(templatePath, detail);
			console.log('topic html：', html);
      panel.webview.html = html;
    });
  });

  // 测试页面
  // const htmlTemplate = fs.readFileSync(path.join(context.extensionPath, 'src', 'topic.html'), 'utf-8');
  // const panel = vscode.window.createWebviewPanel('test', '测试', vscode.ViewColumn.One, {});
  // panel.webview.html = htmlTemplate;

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
  context.subscriptions.push(disposable3);
  context.subscriptions.push(disposable4);
  context.subscriptions.push(disposable5);
}

export function deactivate() {}
