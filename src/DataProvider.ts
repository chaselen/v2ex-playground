import { TreeDataProvider, Event, EventEmitter, TreeItem, TreeItemCollapsibleState, ProviderResult } from 'vscode';
import { V2ex } from './v2ex';

export class DataProvider implements TreeDataProvider<Node> {
  private _onDidChangeTreeData: EventEmitter<Node | undefined> = new EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData?: Event<Node | undefined | null | void> = this._onDidChangeTreeData.event;
  rootElements: Node[];

  constructor() {
    const createRoot = (label: string, tag: string) => {
      const root = new Node(label, true);
      root.tab = tag;
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
      createRoot('R2', 'r2'),
      createRoot('节点', 'nodes')
    ];
  }

  private async getElementData(root: Node): Promise<Node[]> {
    try {
      const topics = await V2ex.getTopicListByTab(root.tab!);
      const children: Node[] = [];
      topics.forEach((topic) => {
        const child = new Node(topic.title, false);
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
  async refreshRoot(root: Node) {
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

  getTreeItem(element: Node): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(element?: Node | undefined): Promise<Node[]> {
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

export class Node extends TreeItem {
  // 是否是目录节点
  public isDir: boolean;

  // 根节点属性-节点标签
  public tab: string | undefined;
  // 根节点属性-子节点
  public children: Node[] | undefined;

  //  子节点属性-链接地址
  public link: string = '';

  constructor(label: string, isDir: boolean) {
    super(label, isDir ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None);
    this.isDir = isDir;
    // contextValue对应的是view/item/context中的viewItem
    this.contextValue = isDir ? 'dir' : 'item';
  }
}
