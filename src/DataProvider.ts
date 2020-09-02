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
      const { data: html } = await axios.get(`https://www.v2ex.com/?tab=${root.tab}`);
      const $ = cheerio.load(html);
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

  /**
   * 获取话题详情内容
   * @param topicLink 话题链接
   */
  async getTopicDetail(topicLink: string): Promise<TopicDetail> {
    const { data: html } = await axios.get(topicLink);
    const $ = cheerio.load(html);
    const topicDetail = new TopicDetail();
    topicDetail.title = $('.header > h1').text();
    topicDetail.nodeName = $('.header > a').eq(1).text();
    topicDetail.authorAvatar = $('.header > .fr img.avatar').attr('src') || '';
    const meta = $('.header > .gray').text().split('·');
    topicDetail.authorName = meta[0].trim();
    topicDetail.displayTime = meta[1].trim();
    topicDetail.visitCount = meta[2].trim();
    topicDetail.content = $('.topic_content').html() || '';
    $('.subtle').each((_, element) => {
      topicDetail.appends.push({
        time: $(element).children('.fade').text().split('·')[1].trim(),
        content: $(element).children('.topic_content').html() || ''
      });
    });
    topicDetail.replyCount = parseInt($('#Main > .box').eq(1).children('div.cell').eq(0).find('span.gray').text().split('•')[0]) || 0;
    $('#Main > .box')
      .eq(1)
      .children('div[id].cell')
      .each((_, element) => {
        topicDetail.replies.push({
          userAvatar: $(element).find('img.avatar').attr('src') || '',
          userName: $(element).find('a.dark').html() || '',
          time: $(element).find('span.ago').text(),
          floor: $(element).find('span.no').text(),
          content: $(element).find('.reply_content').html() || ''
        });
      });
    return topicDetail;
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
  public link: string | undefined;

  constructor(label: string, isDir: boolean) {
    super(label, isDir ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None);
    this.isDir = isDir;
    // contextValue对应的是view/item/context中的viewItem
    this.contextValue = isDir ? 'dir' : 'item';
  }
}

/**
 * 话题详情
 */
export class TopicDetail {
  // 标题
  public title: string = '';
  // 节点名称
  public nodeName: string = '';
  // 作者头像
  public authorAvatar: string = '';
  // 作者名字
  public authorName: string = '';
  // 时间
  public displayTime: string = '';
  // 点击次数
  public visitCount: string = '';
  // 内容
  public content: string = '';
  // 追加内容
  public appends: TopicAppend[] = [];
  // 回复总条数
  public replyCount: number = 0;
  // 回复
  public replies: TopicReply[] = [];
}

/**
 * 话题追加内容
 */
export class TopicAppend {
  // 追加时间
  public time: String = '';
  // 追加内容
  public content: string = '';
}

/**
 * 话题回复
 */
export class TopicReply {
  // 用户头像
  public userAvatar: string = '';
  // 用户名
  public userName: string = '';
  // 回复时间
  public time: string = '';
  // 楼层
  public floor: string = '';
  // 回复内容
  public content: string = '';
}
