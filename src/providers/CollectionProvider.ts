import { LoginRequiredError } from './../error';
import { TreeItem } from 'vscode';
import { BaseProvider, TreeNode } from './BaseProvider';
import { V2ex } from '../v2ex';
import * as path from 'path';
import G from '../global';

export default class CollectionProvider extends BaseProvider {
  private rootElements: TreeNode[] = [];

  constructor() {
    super();

    this.refreshNodeList();
  }

  /**
   * 刷新节点列表
   */
  refreshNodeList() {
    V2ex.getCollectionNodes()
      .then((collectionNodes) => {
        if (collectionNodes.length) {
          this.rootElements = collectionNodes.map<TreeNode>((n) => {
            const treeNode = new TreeNode(n.title, true);
            treeNode.nodeName = n.name;
            return treeNode;
          });
        } else {
          this.rootElements = [new TreeNode('还没有收藏的节点', false)];
        }
      })
      .catch((err) => {
        if (err instanceof LoginRequiredError) {
          const n = new TreeNode('还未登录，请先登录', false);
          n.iconPath = {
            light: path.join(G.context!.extensionPath, 'resources/light/statusWarning.svg'),
            dark: path.join(G.context!.extensionPath, 'resources/dark/statusWarning.svg')
          };
          this.rootElements = [n];
        }
      })
      .finally(() => {
        this._onDidChangeTreeData.fire(undefined);
      });
  }

  private async getElementData(root: TreeNode): Promise<TreeNode[]> {
    try {
      const topics = await V2ex.getTopicListByNode({
        name: root.nodeName!,
        title: root.label!
      });
      const children: TreeNode[] = [];
      topics.forEach((topic) => {
        const child = new TreeNode(topic.title, false);
        child.link = topic.link;
        // 添加点击事件的命令
        child.command = {
          title: topic.title,
          command: 'topicItemClick',
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

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (element === undefined) {
      return this.rootElements;
    }
    if (element.children) {
      return element.children;
    } else {
      const children = await this.getElementData(element);
      element.children = children;
      return children;
    }
  }
}
