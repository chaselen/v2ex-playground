import {
  TreeDataProvider,
  Event,
  EventEmitter,
  TreeItem,
  TreeItemCollapsibleState,
  ProviderResult
} from 'vscode'
import { V2ex } from '../v2ex'

export abstract class BaseProvider implements TreeDataProvider<TreeNode> {
  protected _onDidChangeTreeData: EventEmitter<TreeNode | undefined> = new EventEmitter<
    TreeNode | undefined
  >()
  readonly onDidChangeTreeData?: Event<TreeNode | undefined | null | void> =
    this._onDidChangeTreeData.event

  abstract getTreeItem(element: TreeNode): TreeItem | Thenable<TreeItem>
  abstract getChildren(element?: TreeNode): ProviderResult<TreeNode[]>
}

export class TreeNode extends TreeItem {
  // 是否是目录节点
  public isDir: boolean

  // 根节点属性-节点名称
  public nodeName?: string
  // 根节点属性-子节点
  public children?: TreeNode[]

  // 子节点属性-主题id
  public topicId?: number
  /** 子节点属性-主题链接 */
  public get link(): string | undefined {
    if (this.topicId) {
      return `${V2ex.baseUrl}/t/${this.topicId}`
    }
    return undefined
  }

  constructor(label: string, isDir: boolean) {
    super(label, isDir ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None)
    this.isDir = isDir
    // contextValue对应的是view/item/context中的viewItem
    this.contextValue = isDir ? 'dir' : 'item'
  }
}
