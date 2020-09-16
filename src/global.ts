import { Node } from './v2ex';
import { ExtensionContext, Webview, Uri } from 'vscode';

export default class G {
  static context: ExtensionContext | undefined;

  /**
   * 获取WebView的上下文地址
   * @param webview webview
   */
  static getWebViewContextPath(webview: Webview): string {
    return webview.asWebviewUri(Uri.file(this.context!.extensionPath)).toString();
  }

  /**
   * 设置cookie
   * @param cookie cookie
   */
  static async setCookie(cookie: string) {
    await this.context?.globalState.update('cookie', cookie);
  }

  /**
   * 获取cookie
   */
  static getCookie(): string | undefined {
    return this.context?.globalState.get('cookie');
  }

  /**
   * 获取自定义节点
   */
  static getCustomNodes(): Node[] {
    return this.context?.globalState.get<Node[]>('nodes') || [];
  }

  /**
   * 设置自定义节点
   * @param newNodes 节点列表
   */
  static setCustomNodes(newNodes: Node[]) {
    this.context?.globalState.update('nodes', newNodes);
  }

  /**
   * 添加自定义节点
   * @param node 要添加的节点
   * @returns true表示添加成功，false表示节点已存在无需添加
   */
  static addCustomNode(node: Node): boolean {
    const nodes = this.getCustomNodes();
    // 如果节点已经有了，则忽略
    if (nodes.find((n) => n.name === node.name)) {
      return false;
    }
    nodes.push(node);
    this.setCustomNodes(nodes);
    return true;
  }

  /**
   * 删除自定义节点
   * @param nodeName 要删除的节点名称
   */
  static removeCustomNode(nodeName: string) {
    const nodes = this.getCustomNodes();
    const i = nodes.findIndex((n) => n.name === nodeName);
    if (i >= 0) {
      nodes.splice(i, 1);
    }
    this.setCustomNodes(nodes);
  }
}
