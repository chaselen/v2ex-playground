import { BaseProvider, TreeNode } from './BaseProvider';
import { TreeItem } from 'vscode';
import { V2ex } from '../v2ex';

export default class ExploreProvider extends BaseProvider {
  rootElements: TreeNode[];

  constructor() {
    super();
    const createRoot = (label: string, tag: string) => {
      const root = new TreeNode(label, true);
      root.nodeName = tag;
      return root;
    };
    this.rootElements = [
      createRoot('技术', 'tech'),
      createRoot('创意', 'creative'),
      createRoot('好玩', 'play'),
      createRoot('Apple', 'apple'),
      createRoot('酷工作', 'jobs'),
      createRoot('交易', 'deals'),
      createRoot('城市', 'city'),
      createRoot('问与答', 'qna'),
      createRoot('最热', 'hot'),
      createRoot('全部', 'all'),
      createRoot('R2', 'r2'),
      createRoot('节点', 'nodes')
    ];
  }

  private async getElementData(root: TreeNode): Promise<TreeNode[]> {
    try {
      const topics = await V2ex.getTopicListByTab(root.nodeName!);
      const children: TreeNode[] = [];
      topics.forEach((topic) => {
        const child = new TreeNode(topic.title, false);
        child.link = topic.link;
        // 添加点击事件的命令
        child.command = {
          title: topic.title,
          command: 'v2ex.topicItemClick',
          tooltip: topic.title,
          arguments: [child]
        };
        children.push(child);
      });
      console.log(`获取到【${root.label}】数据：${topics.length}条`);
      return children;
    } catch (err) {
      throw err;
    }
  }

  /**
   * 刷新指定节点
   */
  async refreshRoot(root: TreeNode) {
    delete root.children;
    this._onDidChangeTreeData.fire(root);
  }

  /**
   * 刷新全部数据
   */
  refreshAll() {
    this.rootElements.forEach((root) => {
      // 只刷新已经加载过的节点数据
      if (root.children) {
        this.refreshRoot(root);
      }
    });
  }

  getTreeItem(element: TreeNode): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(element?: TreeNode | undefined): Promise<TreeNode[]> {
    if (element === undefined) {
      return this.rootElements;
    }
    // return element.children;
    if (element.children) {
      return element.children;
    } else {
      const children = await this.getElementData(element);
      element.children = children;
      return children;
    }
  }
}
