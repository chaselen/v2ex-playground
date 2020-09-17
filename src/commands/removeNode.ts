import G from '../global';
import { TreeNode } from '../providers/BaseProvider';

export default async function removeNode(root: TreeNode) {
  G.removeCustomNode(root.nodeName!);
}
