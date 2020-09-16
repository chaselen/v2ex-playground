import { LoginRequiredError } from './../error';
import { TreeNode } from '../DataProvider';
import { V2ex } from '../v2ex';
import * as vscode from 'vscode';
import G from '../global';
import * as path from 'path';

/**
 * 存放话题页面的panels
 * key：话题的链接
 * value：panel
 */
const panels: { [key: string]: vscode.WebviewPanel } = {};

/**
 * 截取标题
 * @param title 标题
 */
function _getTitle(title: string) {
  return title.length <= 15 ? title : title.slice(0, 15) + '...';
}

/**
 * 创建webview面板
 * @param id 面板id
 * @param label 面板标题
 */
function _createPanel(id: string, label: string): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(id, _getTitle(label), vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
    enableFindWidget: true
  });
  panel.iconPath = vscode.Uri.file(path.join(G.context!.extensionPath, 'resources/favicon.png'));
  panels[id] = panel;

  panel.onDidDispose(() => {
    delete panels[id];
  });
  return panel;
}

/**
 * 点击子节点打开详情页面
 * @param item 话题的子节点
 */
export default function topicItemClick(item: TreeNode) {
  // 如果panel已经存在，则直接激活
  let panel = panels[item.link];
  if (panel) {
    panel.reveal();
    return;
  }

  panel = _createPanel(item.link, item.label!);
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
        {
          const item = new TreeNode(message.link.split('.com')[1], false);
          item.link = message.link;
          topicItemClick(item);
        }
        break;
      case 'login':
        vscode.commands.executeCommand('v2ex-explore.login');
        break;
      case 'refresh':
        loadTopicInPanel(panel, item.link);
        break;
      case 'postReply':
        {
          const { topicLink, content, once } = message;
          vscode.window.withProgress(
            {
              title: '正在提交回复',
              location: vscode.ProgressLocation.Notification
            },
            async () => {
              await V2ex.postReply(topicLink, content, once);
              loadTopicInPanel(panel, item.link);
            }
          );
        }
        break;
      default:
        break;
    }
  });

  loadTopicInPanel(panel, item.link);
}

/**
 * 在Panel中加载话题
 * @param panel panel
 * @param topicLink 话题链接
 */
function loadTopicInPanel(panel: vscode.WebviewPanel, topicLink: string) {
  panel.webview.html = V2ex.renderPage('loading.html', {
    contextPath: G.getWebViewContextPath(panel.webview)
  });

  // 获取详情数据
  V2ex.getTopicDetail(topicLink)
    .then((detail) => {
      try {
        // 在panel被关闭后设置html，会出现'Webview is disposed'异常，暂时简单粗暴地解决一下
        panel.webview.html = V2ex.renderPage('topic.html', {
          topic: detail,
          contextPath: G.getWebViewContextPath(panel.webview)
        });
      } catch (ignored) {}
    })
    .catch((err: Error) => {
      console.error(err);
      if (err instanceof LoginRequiredError) {
        panel.webview.html = V2ex.renderPage('error.html', {
          contextPath: G.getWebViewContextPath(panel.webview),
          message: '你要查看的页面需要先登录',
          showLogin: true
        });
      } else {
        panel.webview.html = V2ex.renderPage('error.html', {
          contextPath: G.getWebViewContextPath(panel.webview),
          message: err.message
        });
      }
    });
}

/**
 * 打开大图
 * @param imageSrc 图片地址
 */
function _openLargeImage(imageSrc: string) {
  // 如果panel已经存在，则直接激活
  let panel = panels[imageSrc];
  if (panel) {
    panel.reveal();
    return;
  }

  console.log('打开大图：', imageSrc);
  panel = _createPanel(imageSrc, '查看图片');
  panel.webview.html = V2ex.renderPage('browseImage.html', {
    imageSrc: imageSrc
  });
}
