import { TreeDataProvider, Event, EventEmitter, TreeItem, TreeItemCollapsibleState, ProviderResult } from 'vscode';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { assert } from 'console';

export class DataProvider implements TreeDataProvider<Node> {
  private _onDidChangeTreeData: EventEmitter<Node | undefined> = new EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData?: Event<Node | undefined | null | void> = this._onDidChangeTreeData.event;
  rootElements: Node[];

  constructor() {
    const createRoot = (label: string, tag: string) => {
      const root = new Node(label, true);
      root.tag = tag;
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

  async getElementData(root: Node): Promise<Node[]> {
    try {
      const res = await axios.get(`https://www.v2ex.com/?tab=${root.tag}`);
      const $ = cheerio.load(res.data);
      const cells = $('#Main > .box').eq(0).children('.cell.item');

      const children: Node[] = [];
      cells.each((i, cell) => {
        const tds = $(cell).find('td');
        assert(tds.length === 4);

        const topicNode = $(tds[2]).find('a.topic-link');
        // const avatarUrl = $(tds[0]).find('img').attr('src');
        const title = topicNode.text();
        const link = 'https://www.v2ex.com' + topicNode.attr('href')?.split('#')[0];

        const child = new Node(title, false);
        child.link = link;
        // 添加点击事件的命令
        child.command = {
          title: title,
          command: 'itemClick',
          tooltip: title,
          arguments: [child]
        };
        children.push(child);
      });
      console.log(`获取到【${root.label}】数据：${children.length}条`);
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
    console.log('刷新全部数据');

    this.rootElements.forEach((root) => {
      // 只刷新已经加载过的节点数据
      if (root.children) {
        this.refreshRoot(root);
      }
    });
  }

  reloadRootElementData(element: Node | undefined) {
    this._onDidChangeTreeData.fire(element);
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
  public tag: string | undefined;
  // 根节点属性-子节点
  public children: Node[] | undefined;

  //  子节点属性-链接地址
  public link: string | undefined;

  constructor(label: string, isDir: boolean) {
    super(label, isDir ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None);
    this.isDir = isDir;
    // contextValue对应的是view/item/context中的viewItem
    this.contextValue = isDir ? 'dir' : 'item';
  }
}
