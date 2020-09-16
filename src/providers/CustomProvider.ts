import { TreeItem, ProviderResult } from 'vscode';
import { BaseProvider, TreeNode } from './BaseProvider';
import * as path from 'path';
import G from '../global';

export default class CustomProvider extends BaseProvider {
  private rootElements: TreeNode[] = [];
  private _tipNode = new TreeNode('还没有添加自定义节点', false);

  constructor() {
    super();

    this.refreshNodeList();
  }

  /**
   * 刷新节点列表
   */
  refreshNodeList() {
    const customNodes = G.getCustomNodes();
    if (customNodes.length) {
      this.rootElements = customNodes.map<TreeNode>((n) => {
        const treeNode = new TreeNode(n.title, true);
        treeNode.tab = n.name;
        return treeNode;
      });
    } else {
      this.rootElements = [this._tipNode];
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeNode): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element?: TreeNode): ProviderResult<TreeNode[]> {
    if (element === undefined) {
      return this.rootElements;
    }
    return element.children;
  }
}
