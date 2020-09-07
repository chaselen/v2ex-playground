import { Node } from '../DataProvider';
import { V2ex } from '../v2ex';
import * as vscode from 'vscode';
import * as path from 'path';

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

/**
 * 点击子节点打开详情页面
 * @param item 话题的子节点
 */
export default function topicItemClick(context: vscode.ExtensionContext, item: Node) {
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
}
