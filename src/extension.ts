import { V2ex } from './v2ex';
import { DataProvider, Node } from './DataProvider';
import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
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
  let disposable5 = vscode.commands.registerCommand('itemClick', async (item: Node) => {
    const label = item.label?.slice(0, 15) || '';
    const panel = vscode.window.createWebviewPanel(item.link || '', label, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });
    panel.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case 'browseImage':
          _openLargeImage(context, message.src);
          break;
        default:
          break;
      }
    });
    panel.webview.html = '<h1 style="text-align: center;">加载中...</h1>';

    // 获取详情数据
    V2ex.getTopicDetail(item.link || '')
      .then((detail) => {
        try {
          // 在panel被关闭后设置html，会出现'Webview is disposed'异常，暂时简单粗暴地解决一下
          panel.webview.html = V2ex.renderPage(context, 'topic.art', {
            topic: detail,
            cssPath: panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'resources/html/topic.css'))).toString()
          });
        } catch (ignored) {}
      })
      .catch((err: Error) => {
        console.error(err);
        // panel.dispose();
        // vscode.window.showErrorMessage(`获取话题详情失败：${err.message}`);
        panel.webview.html = `<h1 style="text-align: center;">${err.message}</h1>`;
      });
  });

  // 测试页面
  // V2ex.openTestPage(context);

  context.subscriptions.push(disposable2);
  context.subscriptions.push(disposable3);
  context.subscriptions.push(disposable4);
  context.subscriptions.push(disposable5);
}

/**
 * 打开大图
 * @param imageSrc 图片地址
 */
function _openLargeImage(context: vscode.ExtensionContext, imageSrc: string) {
  console.log('打开大图：', imageSrc);
  const panel = vscode.window.createWebviewPanel(imageSrc, '查看图片', vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true
  });

  panel.webview.html = V2ex.renderPage(context, 'browseImage.art', {
    imageSrc: imageSrc
  });
}

export function deactivate() {}
