import { TreeItem, ProviderResult } from 'vscode';
import { BaseProvider, TreeNode } from './BaseProvider';
import * as path from 'path';
import G from '../global';

export default class CustomProvider extends BaseProvider {
  rootElements: TreeNode[];

  constructor() {
    super();

    const tipNode = new TreeNode('还没有添加自定义节点', false);
    this.rootElements = [tipNode];

    const customNodes = G.getCustomNodes();
    if (customNodes.length) {
      this.rootElements = customNodes.map<TreeNode>((n) => {
        const treeNode = new TreeNode(n.title, true);
        treeNode.tab = n.name;
        return treeNode;
      });
    }
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
