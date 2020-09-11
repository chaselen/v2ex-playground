import { LoginRequiredError } from './error';
import * as cheerio from 'cheerio';
import * as vscode from 'vscode';
import * as template from 'art-template';
import http from './http';
import { AxiosResponse } from 'axios';
import * as path from 'path';
import G from './global';
import * as FormData from 'form-data';

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
      topic.node = nodeElement.attr('href')?.split('go/')[1] || '';
      topic.nodeName = nodeElement.text();
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
    topic.node = node.attr('href')?.split('go/')[1] || '';
    topic.nodeName = node.text();
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
    const topic = new TopicDetail();
    topic.title = 'AMD 5700XT 实际体验也太差了';
    topic.node = 'create';
    topic.nodeName = 'amd';
    topic.authorAvatar = 'https://cdn.v2ex.com/avatar/8727/6d75/276253_large.png?m=1513922337';
    topic.authorName = 'iMiata';
    topic.displayTime = '4 小时 36 分钟前';
    topic.visitCount = '2158 次点击';
    topic.content = `<div class="markdown_body"><p>原显卡是 1070ti，换了 2k 屏以后显卡性能跟不上，本来想换个 2070s 的，但是又想后面能搞黑果，换成了 5700xt 。结果这货不用不知道，用了真的是。。。</p>
  <ul>
  <li>LOL 的 FPS 上限顶在了 60，时不时还会掉到 50+，1070ti 的日常 FPS 在 160-240 之间；</li>
  <li>Forza Horizon 4 设置成锁 60FPS，但是也是极其明显的持续卡顿，1070ti 完全没有这种情况；</li>
  <li>Scum 更是卡，我把主屏换成 1080p 的，在 1k 的分辨率下游戏居然也是每 5-10s 必掉一次 FPS （到城市那一片以后 FPS 每 3s 掉一次，每次直接掉到个位数）</li>
  <li>现在只剩 Dota 可以玩了。。。</li>
  </ul>
  <p>有没有同样用 5700xt 的盆友有我这么绝望的体验的，想知道是 AMD 的卡还是驱动挫</p>
  </div>`;
    topic.appends = [
      {
        time: '',
        content: `<div class="markdown_body"><p>看来LOL帧率锁60应该是我开了垂直同步导致的，但是不理解为啥这玩意开了会导致这种效果，我之前的1070ti玩游戏都会开垂直同步的呀</p></div>`
      }
    ];
    topic.replyCount = 50;
    topic.replies = [
      {
        userAvatar: 'https://cdn.v2ex.com/avatar/171b/5976/95780_normal.png?m=1449498342',
        userName: 'kokutou',
        time: '46 分钟前',
        floor: '1',
        content: '全脂...热量太高了啊',
        thanks: 1
      }
    ];

    const panel = vscode.window.createWebviewPanel('test', '测试', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
    panel.webview.html = this.renderPage('topic.html', {
      topic,
      contextPath: G.getWebViewContextPath(panel.webview)
    });
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
  public node: string = '';
  // 节点名称
  public nodeName: string = '';
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
  public node: string = '';
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
  // 感谢数 ❤
  public thanks: number = 0;
}
