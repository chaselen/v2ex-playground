import { V2ex, Node } from './../v2ex';
import * as vscode from 'vscode';
import G from '../global';
import { TreeNode } from '../providers/BaseProvider';

export default async function removeNode(root: TreeNode) {
  G.removeCustomNode(root.nodeName!);
}
