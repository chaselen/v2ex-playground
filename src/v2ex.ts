import axios from 'axios';
import * as cheerio from 'cheerio';
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
