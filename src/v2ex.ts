import { TreeNode } from './providers/BaseProvider';
import { AccountRestrictedError, LoginRequiredError } from './error';
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
      topic.link =
        'https://www.v2ex.com' + topicElement.attr('href')?.split('#')[0];
      topic.node = {
        name: nodeElement.attr('href')?.split('go/')[1] || '',
        title: nodeElement.text().trim(),
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
    const { data: html } = await http.get(
      `https://www.v2ex.com/go/${node.name}`
    );
    const $ = cheerio.load(html);
    const cells = $('#TopicsNode .cell[class*="t_"]');

    const list: Topic[] = [];
    cells.each((_, cell) => {
      const topicElement = $(cell).find('a.topic-link');

      const topic = new Topic();
      topic.title = topicElement.text().trim();
      topic.link =
        'https://www.v2ex.com' + topicElement.attr('href')?.split('#')[0];
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
    // topicLink = 'https://www.v2ex.com/t/704716';
    const res = await http.get<string>(topicLink + '?p=1');
    const $ = cheerio.load(res.data);

    /**
     * 部分帖子需要登录查看
     * 第1种：会重定向到登录页（https://www.v2ex.com/signin?next=/t/xxxxxx），并提示：你要查看的页面需要先登录。如交易区：https://www.v2ex.com/t/704753
     * 第2种：会重定向到首页，无提示。如：https://www.v2ex.com/t/704716
     * 第3种：账号访问受限（如新用户），会重定向到 https://www.v2ex.com/restricted
     */
    if (res.request._redirectable._redirectCount > 0) {
      if (res.request.path.indexOf('/signin') >= 0) {
        // 登录失效，删除cookie
        G.setCookie('');
        throw new LoginRequiredError('你要查看的页面需要先登录');
      }
      if (res.request.path === '/') {
        if (G.getCookie()) {
          throw new Error('您无权访问此页面');
        } else {
          throw new LoginRequiredError('你要查看的页面需要先登录');
        }
      }
      if (res.request.path.indexOf('/restricted') === 0) {
        throw new AccountRestrictedError(
          '访问受限，详情请查看 <a href="https://www.v2ex.com/restricted">https://www.v2ex.com/restricted</a>'
        );
      }
      throw new Error('未知错误');
    }

    const topic = new TopicDetail();
    topic.id = parseInt(topicLink.split('/t/')[1] || '0');
    topic.link = topicLink;
    topic.once = $('a.light-toggle').attr('href')?.split('?once=')[1] || '';
    topic.title = $('.header > h1').text();
    const node = $('.header > a').eq(1);
    topic.node = {
      name: node.attr('href')?.split('go/')[1] || '',
      title: node.text().trim(),
    };
    topic.authorAvatar = $('.header > .fr img.avatar').attr('src') || '';
    const meta = $('.header > .gray').text().split('·');
    topic.authorName = meta[0].trim();
    topic.displayTime = meta[1].trim();
    topic.visitCount = parseInt(meta[2].trim());
    topic.content = $('#Main .topic_content').html() || '';
    $('.subtle').each((_, element) => {
      topic.appends.push({
        time: $(element).children('.fade').text().split('·')[1].trim(),
        content: $(element).children('.topic_content').html() || '',
      });
    });

    const topicButtons = $('.topic_buttons');
    if (topicButtons.length) {
      const countStr = topicButtons.children('.topic_stats').text();
      if (/(\d+)\s*人收藏/.test(countStr)) {
        topic.collectCount = parseInt(RegExp.$1);
      }
      if (/(\d+)\s*人感谢/.test(countStr)) {
        topic.thankCount = parseInt(RegExp.$1);
      }
      const collectButton = topicButtons.children('a.tb').eq(0);
      topic.isCollected = collectButton.text().indexOf('取消收藏') >= 0;
      topic.collectParamT = collectButton.attr('href')?.split('?t=')[1] || null;
      topic.canThank = topicButtons.children('#topic_thank').length > 0;
      topic.isThanked = topicButtons.find('.topic_thanked').length > 0;
    }

    topic.replyCount =
      parseInt(
        $('#Main > .box')
          .eq(1)
          .children('div.cell')
          .eq(0)
          .find('span.gray')
          .text()
          .split('•')[0]
      ) || 0;

    /**
     * 获取回复
     * @param $ 页面加载后的文档
     */
    const _getTopicReplies = ($: ReturnType<typeof cheerio.load>): TopicReply[] => {
      const replies: TopicReply[] = [];
      $('#Main > .box')
        .eq(1)
        .children('div[id].cell')
        .each((_, element) => {
          replies.push({
            replyId: $(element).attr('id')?.split('r_')[1] || '0',
            userAvatar: $(element).find('img.avatar').attr('src') || '',
            userName: $(element).find('a.dark').html() || '',
            time: $(element).find('span.ago').text(),
            floor: $(element).find('span.no').text(),
            content: $(element).find('.reply_content').html() || '',
            thanks: parseInt(
              $(element).find('span.small.fade').text().trim() || '0'
            ),
            thanked: $(element).find('.thank_area.thanked').length > 0,
          });
        });
      return replies;
    };

    // 获取评论
    topic.replies = _getTopicReplies($);
    const pager = $('#Main > .box').eq(1).find('.cell:not([id]) table');
    if (pager.length) {
      // 如果获取分页组件，表示有多页评论
      const totalPage = parseInt(
        pager.find('td').eq(0).children('a').last().text()
      );
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
      headers: form.getHeaders(),
    });
  }

  /**
   * 感谢回复者
   * @param replyId 回复id
   * @param once 校验参数
   */
  static async thankReply(
    replyId: string,
    once: string
  ): Promise<ThankReplyResp> {
    const resp = await http.post<ThankReplyResp>(
      `https://www.v2ex.com/thank/reply/${replyId}?once=${once}`
    );
    if (resp.status !== 200) {
      return {
        success: false,
        once: undefined,
      };
    }
    return resp.data;
  }

  /**
   * 检查cookie是否有效
   * @param cookie 检查的cookie
   */
  static async checkCookie(cookie: string): Promise<boolean> {
    if (!cookie) {
      return false;
    }
    // 前往一个需要登录的页面检测，如果被重定向，说明cookie无效
    const res = await http.get('https://www.v2ex.com/t', {
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Cookie: cookie,
      },
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
    const { data: html } = await http.get<string>(
      'https://www.v2ex.com/planes'
    );
    const $ = cheerio.load(html);
    const nodes: Node[] = [];
    $('a.item_node').each((_, element) => {
      nodes.push({
        name: $(element).attr('href')?.split('go/')[1] || '',
        title: $(element).text().trim(),
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
    $('#my-nodes > a.fav-node').each((_, element) => {
      nodes.push({
        name: $(element).attr('href')?.split('go/')[1] || '',
        title: $(element)
          .children('.fav-node-name')
          .text()
          .trim()
          .split(' ')[0],
      });
    });
    return nodes;
  }

  /**
   * 每日签到
   *
   * @returns {Promise<DailyRes>} 返回签到结果
   */
  static async daily(): Promise<DailyRes> {
    const { data: html } = await http.get<string>('/mission/daily');
    const $ = cheerio.load(html);
    // 已领取过时会提示：每日登录奖励已领取
    if ($('.fa-ok-sign').length) {
      return DailyRes.repetitive;
    }
    // 未领取时有一个领取按钮，onclick内容是location.href = '/mission/daily/redeem?once=1111'
    const btn = $('input.super.normal.button');
    if (btn.length) {
      if (/once=(\d+)/.test(btn.attr('onclick') || '')) {
        const once = RegExp.$1;
        const { data: html2 } = await http.get<string>(
          `/mission/daily/redeem?once=${once}`
        );
        const $2 = cheerio.load(html2);
        if ($2('.fa-ok-sign').length) {
          return DailyRes.success;
        }
      }
    }
    return DailyRes.failed;
  }

  /**
   * 收藏帖子
   * @param topicId 帖子id
   * @param t 收藏参数t
   */
  static async collectTopic(topicId: number, t: string) {
    // /favorite/topic/714346?t=uecaqsvpeyreyhsyohnaxgpnjsfpufte
    await http.get<string>(`/favorite/topic/${topicId}?t=${t}`);
  }

  /**
   * 取消收藏帖子
   * @param topicId 帖子id
   * @param t 收藏参数t
   */
  static async cancelCollectTopic(topicId: number, t: string) {
    // /unfavorite/topic/714346?t=uecaqsvpeyreyhsyohnaxgpnjsfpufte
    await http.get<string>(`/unfavorite/topic/${topicId}?t=${t}`);
  }

  /**
   * 向帖子发送感谢
   * @param topicId 帖子id
   * @param once once参数
   */
  static async thankTopic(topicId: number, once: string): Promise<boolean> {
    // POST /thank/topic/714502?once=30681
    // 返回结果：{success: true, once: 30681}
    const { data: res } = await http.post(
      `/thank/topic/${topicId}?once=${once}`
    );
    return !!res.success;
  }

  /**
   * V2EX搜搜
   * @param q 查询关键词
   * @param sort 结果排序方式
   * @param from 与第一个结果的偏移量（默认 0），比如 0, 10, 20
   * @param size 结果数量（默认 10）
   */
  static async search(
    q: string,
    sort: SoV2exSort = 'sumup',
    from = 0,
    size = 10
  ): Promise<SoV2exSource[]> {
    const { data: res } = await http.get('https://www.sov2ex.com/api/search', {
      params: {
        q,
        sort,
        from,
        size,
      },
    });
    const hits: any[] = res.hits || [];
    return hits.map((h) => h._source);
  }

  /**
   * 渲染一个页面，返回渲染后的html
   * @param page 要渲染的html页面
   * @param data 传入的数据
   */
  static renderPage(page: string, data: any = {}): string {
    const templatePath = path.join(G.context!.extensionPath, 'html', page);
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
  /** 标题 */
  public title: string = '';
  /** 链接 */
  public link: string = '';
  /** 节点 */
  public node: Node = { title: '', name: '' };
}

/**
 * 话题详情
 */
export class TopicDetail {
  /** id */
  public id: number = 0;
  /** 链接 */
  public link: string = '';
  /** 校验参数，可用来判断是否登录或登录是否有效 */
  public once: string = '';
  /** 标题 */
  public title: string = '';
  /** 节点 */
  public node: Node = { title: '', name: '' };
  /** 作者头像 */
  public authorAvatar: string = '';
  /** 作者名字 */
  public authorName: string = '';
  /** 时间 */
  public displayTime: string = '';
  /** 点击次数 */
  public visitCount: number = 0;
  /** 内容 */
  public content: string = '';
  /** 追加内容 */
  public appends: TopicAppend[] = [];
  /** 收藏人数 */
  public collectCount: number = 0;
  /** 感谢人数 */
  public thankCount: number = 0;
  /** 是否已收藏 */
  public isCollected: boolean = false;
  /** 是否已感谢 */
  public isThanked: boolean = false;
  /** 是否能发送感谢（自己的帖子不能发送感谢） */
  public canThank: boolean = true;
  /** 收藏/取消收藏参数t */
  public collectParamT: string | null = null;
  /** 回复总条数 */
  public replyCount: number = 0;
  /** 回复 */
  public replies: TopicReply[] = [];
}

/**
 * 话题追加内容
 */
export class TopicAppend {
  /** 追加时间 */
  public time: String = '';
  /** 追加内容 */
  public content: string = '';
}

/**
 * 话题回复
 */
export class TopicReply {
  /** 回复id */
  public replyId: string = '';
  /** 用户头像 */
  public userAvatar: string = '';
  /** 用户名 */
  public userName: string = '';
  /** 回复时间 */
  public time: string = '';
  /** 楼层 */
  public floor: string = '';
  /** 回复内容 */
  public content: string = '';
  /** 感谢数 ❤ */
  public thanks: number = 0;
  /** 感谢已发送 */
  public thanked: boolean = false;
}

/**
 * 节点
 */
export class Node {
  /** 节点名称 */
  public name: string = '';
  /** 节点标题（显示的名称） */
  public title: string = '';
}

/**
 * 签到结果
 */
export enum DailyRes {
  /**签到成功 */
  success = '签到成功',
  /**重复签到 */
  repetitive = '重复签到',
  /**签到失败 */
  failed = '签到失败',
}

/**
 * sov2ex搜索结果的source字段
 */
export class SoV2exSource {
  /**帖子id */
  public id: number = 0;
  /**发帖人 */
  public member: string = '';
  /**帖子标题 */
  public title: string = '';
  /**帖子内容 */
  public content: string = '';
  /**回复数量 */
  public replies: number = 0;
  /**发帖时间 */
  public created: string = '';
}

export type SoV2exSort = 'sumup' | 'created';

/**
 * 感谢回复的响应内容
 */
export interface ThankReplyResp {
  /** 是否成功 */
  success: boolean;
  /** 新的once */
  once: string | undefined;
}
