import * as cheerio from 'cheerio/slim'
import { describe, expect, it } from 'vitest'
import {
  parseAccountOverview,
  parseBlockedMemberIds,
  parseFollowingMembers,
  parseIgnoredTopicIds
} from './account'

describe('parseAccountOverview', () => {
  it('解析账户用户名和签名', () => {
    const $ = cheerio.load(`
      <div id="Rightbar">
        <div class="box">
          <table>
            <tr>
              <td width="48" valign="top">
                <a href="/member/Livid"><img src="//cdn.v2ex.com/avatar.png" class="avatar" border="0" align="default" width="48" style="width: 48px; max-height: 48px;" alt="Livid" data-uid="1"></a>
              </td>
              <td width="10" valign="top"></td>
              <td width="auto" align="left">
                <div class="fr">
                  <a href="/settings/night/toggle?once=123" class="light-toggle"><img src="/static/img/toggle-light.png" align="absmiddle" height="10" alt="Light"></a>
                </div>
                <span class="bigger flex-one-row gap10">
                  <a href="/member/Livid">Livid</a>
                  <div class="spacer"></div>
                </span>
                <div class="sep5"></div>
                <span class="fade">Remember the bigger green</span>
              </td>
            </tr>
          </table>
          <a href="/my/nodes" class="dark" style="display: block;"><span class="bigger">19</span><div class="sep3"></div><span class="fade">节点收藏</span></a>
          <a href="/my/topics" class="dark" style="display: block;"><span class="bigger">352</span><div class="sep3"></div><span class="fade">主题收藏</span></a>
          <a href="/my/following" class="dark" style="display: block;"><span class="bigger">10</span><div class="sep3"></div><span class="fade">特别关注</span></a>
          <div class="cell" id="member-activity">
            <div class="member-activity-bar">
              <div class="member-activity-start" style="width: 75%;"></div>
            </div>
          </div>
        </div>
      </div>
    `)

    expect(parseAccountOverview($)).toMatchObject({
      avatar: '//cdn.v2ex.com/avatar.png',
      username: 'Livid',
      tagline: 'Remember the bigger green',
      nodeCollectionCount: 19,
      topicCollectionCount: 352,
      specialFollowingCount: 10,
      activityPercent: 75
    })
  })
})

describe('parseFollowingMembers', () => {
  it('解析右栏中的特别关注用户', () => {
    const $ = cheerio.load(`
      <div id="Rightbar">
        <div class="box">
          <div class="cell"><span class="fade">我关注的人</span></div>
          <div class="cell">
            <a href="/member/alice"><img class="avatar" src="//cdn.v2ex.com/alice.png" alt="alice"></a>&nbsp;
            <a href="/member/alice">alice</a>
          </div>
          <div class="inner">
            <a href="/member/bob"><img class="avatar" src="//cdn.v2ex.com/bob.png" alt="bob"></a>&nbsp;
            <a href="/member/bob">bob</a>
          </div>
        </div>
      </div>
    `)

    expect(parseFollowingMembers($)).toEqual([
      {
        avatar: '//cdn.v2ex.com/alice.png',
        username: 'alice'
      },
      {
        avatar: '//cdn.v2ex.com/bob.png',
        username: 'bob'
      }
    ])
  })

  it('在页面没有特别关注区域时返回空列表', () => {
    const $ = cheerio.load(
      '<div id="Rightbar"><div class="box"><div class="cell">其他内容</div></div></div>'
    )

    expect(parseFollowingMembers($)).toEqual([])
  })
})

describe('parseBlockedMemberIds', () => {
  it('解析首页脚本中的屏蔽用户编号', () => {
    const html = `
      <script>
        const blocked = [350370,367256];
        const ignored_topics = [893822];
      </script>
    `

    expect(parseBlockedMemberIds(html)).toEqual([350370, 367256])
  })

  it('忽略无效编号并保持去重后的顺序', () => {
    const html = 'const blocked = [12, 0, 12, -3, 34, ];'

    expect(parseBlockedMemberIds(html)).toEqual([12, 34])
  })

  it('在缺少 blocked 声明时返回空列表', () => {
    expect(parseBlockedMemberIds('<script>const ignored_topics = [1];</script>')).toEqual([])
  })
})

describe('parseIgnoredTopicIds', () => {
  it('解析首页脚本中的忽略主题编号', () => {
    const html = `
      <script>
        const blocked = [350370,367256];
        const ignored_topics = [893822, 10001];
      </script>
    `

    expect(parseIgnoredTopicIds(html)).toEqual([893822, 10001])
  })

  it('忽略无效编号并保持去重后的顺序', () => {
    const html = 'const ignored_topics = [12, 0, 12, -3, 34, ];'

    expect(parseIgnoredTopicIds(html)).toEqual([12, 34])
  })

  it('在缺少 ignored_topics 声明时返回空列表', () => {
    expect(parseIgnoredTopicIds('<script>const blocked = [1];</script>')).toEqual([])
  })
})
