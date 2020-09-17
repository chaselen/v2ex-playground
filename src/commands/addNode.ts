import { V2ex } from './../v2ex';
import * as vscode from 'vscode';
import G from '../global';

/**
 * 添加节点逻辑
 * @returns 返回是否成功添加
 */
export default async function addNode(): Promise<boolean> {
  const nodes = await vscode.window.withProgress(
    {
      title: '获取节点信息',
      location: vscode.ProgressLocation.Notification
    },
    () => {
      return V2ex.getAllNodes();
    }
  );

  const items = nodes.map((n) => {
    const item = new NodeQuickPickItem();
    item.label = n.title;
    item.description = n.name;
    return item;
  });
  const select = await vscode.window.showQuickPick(items, {
    placeHolder: '搜索节点',
    matchOnDescription: true
  });
  if (select === undefined) {
    return false;
  }
  console.log('选择的节点', select);
  const isAdd = G.addCustomNode({
    name: select.description!,
    title: select.label
  });
  if (!isAdd) {
    vscode.window.showInformationMessage('节点已经存在，无需再添加');
  }
  return isAdd;
}

/**
 * 节点的选择项
 */
class NodeQuickPickItem implements vscode.QuickPickItem {
  /**
   * 显示的文本，也是节点标题
   */
  label: string = '';
  /**
   * 描述，也是节点名称
   */
  description?: string | undefined;
  detail?: string | undefined;
  picked?: boolean | undefined;
  alwaysShow?: boolean | undefined;
}
