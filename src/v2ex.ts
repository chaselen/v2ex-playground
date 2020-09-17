import { TreeNode } from './providers/BaseProvider';
import { LoginRequiredError } from './error';
import * as cheerio from 'cheerio';
import * as template from 'art-template';
import http from './http';
import { AxiosResponse } from 'axios';
import * as path from 'path';
import G from './global';
import * as FormData from 'form-data';
import topicItemClick from './commands/topicItemClick';

export class V2ex {
  /**
   * 根据标签获取话题列表
   * @param tab 标签
   */
  static async getTopicListByTab(tab: string): Promise<Topic[]> {
    const { data: html } = await http.get(`https://www.v2ex.com/?tab=${tab}`);
    const $ = cheerio.load(html);
    const cells = $('#Main > .box').eq(0).children('.cell.item');

    const list: Topic[] = [];
    cells.each((_, cell) => {
      const topicElement = $(cell).find('a.topic-link');
      const nodeElement = $(cell).find('a.node');

      const topic = new Topic();
      topic.title = topicElement.text().trim();
      topic.link = 'https://www.v2ex.com' + topicElement.attr('href')?.split('#')[0];
      topic.node = {
        name: nodeElement.attr('href')?.split('go/')[1] || '',
        title: nodeElement.text().trim()
      };
      list.push(topic);
    });
    return list;
  }

  /**
   * 根据节点获取话题列表
   * @param node 节点
   */
  static async getTopicListByNode(node: Node): Promise<Topic[]> {
    const { data: html } = await http.get(`https://www.v2ex.com/go/${node.name}`);
    const $ = cheerio.load(html);
    const cells = $('#TopicsNode .cell[class*="t_"]');

    const list: Topic[] = [];
    cells.each((_, cell) => {
      const topicElement = $(cell).find('a.topic-link');

      const topic = new Topic();
      topic.title = topicElement.text().trim();
      topic.link = 'https://www.v2ex.com' + topicElement.attr('href')?.split('#')[0];
      topic.node = node;
      list.push(topic);
    });
    return list;
  }

  /**
   * 获取话题详情内容
   * @param topicLink 话题链接
   */
  static async getTopicDetail(topicLink: string): Promise<TopicDetail> {
    // topicLink = 'https://www.v2ex.com/t/703733';
    const res = await http.get<string>(topicLink + '?p=1');
    const $ = cheerio.load(res.data);

    /**
     * 部分帖子需要登录查看
     * 第1种：会重定向到登录页（https://www.v2ex.com/signin?next=/t/xxxxxx），并提示：你要查看的页面需要先登录。如交易区：https://www.v2ex.com/t/704753
     * 第2种：会重定向到首页，无提示。如：https://www.v2ex.com/t/704716
     */
    if (res.request._redirectable._redirectCount > 0) {
      // 登录失效，删除cookie
      G.setCookie('');
      throw new LoginRequiredError('你要查看的页面需要先登录');
    }

    const topic = new TopicDetail();
    topic.link = topicLink;
    topic.once = $('a.light-toggle').attr('href')?.split('?once=')[1] || '';
    topic.title = $('.header > h1').text();
    const node = $('.header > a').eq(1);
    topic.node = {
      name: node.attr('href')?.split('go/')[1] || '',
      title: node.text().trim()
    };
    topic.authorAvatar = $('.header > .fr img.avatar').attr('src') || '';
    const meta = $('.header > .gray').text().split('·');
    topic.authorName = meta[0].trim();
    topic.displayTime = meta[1].trim();
    topic.visitCount = meta[2].trim();
    topic.content = $('.topic_content').html() || '';
    $('.subtle').each((_, element) => {
      topic.appends.push({
        time: $(element).children('.fade').text().split('·')[1].trim(),
        content: $(element).children('.topic_content').html() || ''
      });
    });
    topic.replyCount = parseInt($('#Main > .box').eq(1).children('div.cell').eq(0).find('span.gray').text().split('•')[0]) || 0;

    /**
     * 获取回复
     * @param $ 页面加载后的文档
     */
    const _getTopicReplies = ($: CheerioStatic): TopicReply[] => {
      const replies: TopicReply[] = [];
      $('#Main > .box')
        .eq(1)
        .children('div[id].cell')
        .each((_, element) => {
          replies.push({
            userAvatar: $(element).find('img.avatar').attr('src') || '',
            userName: $(element).find('a.dark').html() || '',
            time: $(element).find('span.ago').text(),
            floor: $(element).find('span.no').text(),
            content: $(element).find('.reply_content').html() || '',
            thanks: parseInt($(element).find('span.small.fade').text().trim() || '0')
          });
        });
      return replies;
    };

    // 获取评论
    topic.replies = _getTopicReplies($);
    const pager = $('#Main > .box').eq(1).find('.cell:not([id]) table');
    if (pager.length) {
      // 如果获取分页组件，表示有多页评论
      const totalPage = parseInt(pager.find('td').eq(0).children('a').last().text());
      console.log(`${topicLink}：一共${totalPage}页回复`);

      const promises: Promise<AxiosResponse<string>>[] = [];
      for (let p = 2; p <= totalPage; p++) {
        promises.push(http.get<string>(topicLink + `?p=${p}`));
      }
      try {
        const resList = await Promise.all(promises);
        resList
          .map((res) => res.data)
          .forEach((html) => {
            const replies = _getTopicReplies(cheerio.load(html));
            topic.replies = topic.replies.concat(replies);
            // 有时候会出现统计的回复数与实际获取到的回复数量不一致的问题，修正一下回复数量
            if (topic.replies.length > topic.replyCount) {
              topic.replyCount = topic.replies.length;
            }
          });
      } catch (error) {}
    }
    return topic;
  }

  /**
   * 提交回复
   * @param topicLink 话题链接，如：https://www.v2ex.com/t/703733
   * @param content 回复内容
   * @param once 校验参数，可以从话题页面中获得
   */
  static async postReply(topicLink: string, content: string, once: string) {
    const form = new FormData();
    form.append('content', content);
    form.append('once', once);
    await http.post(topicLink, form, {
      headers: form.getHeaders()
    });
  }

  /**
   * 检查cookie是否有效
   * @param cookie 检查的cookie
   */
  static async checkCookie(cookie: string): Promise<boolean> {
    // 前往一个需要登录的页面检测，如果被重定向，说明cookie无效
    const res = await http.get('https://www.v2ex.com/t', {
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Cookie: cookie
      }
    });
    return res.request._redirectable._redirectCount <= 0;
  }

  // 缓存的节点信息
  private static _cachedNodes: Node[] = [];
  /**
   * 获取所有节点
   */
  static async getAllNodes(): Promise<Node[]> {
    if (this._cachedNodes.length) {
      return this._cachedNodes;
    }
    const { data: html } = await http.get<string>('https://www.v2ex.com/planes');
    const $ = cheerio.load(html);
    const nodes: Node[] = [];
    $('a.item_node').each((_, element) => {
      nodes.push({
        name: $(element).attr('href')?.split('go/')[1] || '',
        title: $(element).text().trim()
      });
    });
    console.log(`获取到${nodes.length}个节点`);
    this._cachedNodes = nodes;
    return nodes;
  }

  /**
   * 获取我收藏的节点
   */
  static async getCollectionNodes(): Promise<Node[]> {
    const res = await http.get<string>('https://www.v2ex.com/my/nodes');
    if (res.request._redirectable._redirectCount > 0) {
      // 登录失效，删除cookie
      G.setCookie('');
      throw new LoginRequiredError('你要查看的页面需要先登录');
    }

    const $ = cheerio.load(res.data);
    const nodes: Node[] = [];
    $('#my-nodes > a.grid_item').each((_, element) => {
      nodes.push({
        name: $(element).attr('href')?.split('go/')[1] || '',
        title: $(element).children('div').text().trim().split(' ')[0]
      });
    });
    return nodes;
  }

  /**
   * 渲染一个页面，返回渲染后的html
   * @param page 要渲染的html页面
   * @param data 传入的数据
   */
  static renderPage(page: string, data: any = {}): string {
    const templatePath = path.join(G.context!.extensionPath, 'resources', 'html', page);
    const html = template(templatePath, data);
    return html;
  }

  /**
   * 打开测试页面
   * @param context 插件上下文
   */
  static openTestPage() {
    const item = new TreeNode('写了一个 VSCode 上可以逛 V2EX 的插件', false);
    item.link = 'https://www.v2ex.com/t/703733';
    topicItemClick(item);
  }
}

/**
 * 话题
 */
export class Topic {
  // 标题
  public title: string = '';
  // 链接
  public link: string = '';
  // 节点
  public node: Node = { title: '', name: '' };
}

/**
 * 话题详情
 */
export class TopicDetail {
  // 链接
  public link: string = '';
  // 校验参数，可用来判断是否登录或登录是否有效
  public once: string = '';
  // 标题
  public title: string = '';
  // 节点
  public node: Node = { title: '', name: '' };
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
  // 感谢数 ❤
  public thanks: number = 0;
}

/**
 * 节点
 */
export class Node {
  // 节点名称
  public name: string = '';
  // 节点标题（显示的名称）
  public title: string = '';
}
