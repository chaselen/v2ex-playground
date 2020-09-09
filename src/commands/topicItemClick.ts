import { Node } from '../DataProvider';
import { V2ex } from '../v2ex';
import * as vscode from 'vscode';
import g from '../global';

/**
 * 打开大图
 * @param imageSrc 图片地址
 */
function _openLargeImage(imageSrc: string) {
  console.log('打开大图：', imageSrc);
  const panel = vscode.window.createWebviewPanel(imageSrc, '查看图片', vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true
  });

  panel.webview.html = V2ex.renderPage('browseImage.art', {
    imageSrc: imageSrc
  });
}

/**
 * 点击子节点打开详情页面
 * @param item 话题的子节点
 */
export default function topicItemClick(item: Node) {
  // 截取标题
  const _getTitle = (title: string) => {
    return title.length <= 15 ? title : title.slice(0, 15) + '...';
  };

  const panel = vscode.window.createWebviewPanel(item.link!, _getTitle(item.label!), vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
    enableFindWidget: true
  });
  panel.webview.onDidReceiveMessage((message) => {
    switch (message.command) {
      case 'setTitle':
        panel.title = _getTitle(message.title);
        break;
      case 'browseImage':
        _openLargeImage(message.src);
        break;
      case 'openTopic':
        // label显示/t/xxx部分
        const item = new Node(message.link.split('.com')[1], false);
        item.link = message.link;
        topicItemClick(item);
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
        panel.webview.html = V2ex.renderPage('topic.art', {
          topic: detail,
          contextPath: panel.webview.asWebviewUri(vscode.Uri.parse(g.context!.extensionPath)).toString()
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
