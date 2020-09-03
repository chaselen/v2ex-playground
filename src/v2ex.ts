import axios from 'axios';
import * as cheerio from 'cheerio';
import * as vscode from 'vscode';
import * as template from 'art-template';

export class V2ex {
  /**
   * 根据标签获取话题列表
   * @param tab 标签
   */
  static async getTopicListByTab(tab: string): Promise<Topic[]> {
    const { data: html } = await axios.get(`https://www.v2ex.com/?tab=${tab}`);
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

  /**
   * 打开测试页面
   * @param templatePath 模板文件路径
   * @param extensionPath 插件目录
   */
  static openTestPage(templatePath: string, extensionPath: string) {
    const topic = new TopicDetail();
    topic.title = 'AMD 5700XT 实际体验也太差了';
    topic.nodeName = 'AMD';
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
        content: '全脂...热量太高了啊'
      }
    ];

    const panel = vscode.window.createWebviewPanel('test', '测试', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
    panel.webview.html = template(templatePath, {
      topic,
      extensionPath
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
