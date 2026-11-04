import * as cheerio from 'cheerio/slim'
import { describe, expect, it } from 'vitest'
import { parseMemberContent, parseMemberInfo } from './member'
import { readFileSync } from 'node:fs'

describe('parseMemberInfo', () => {
  it('解析用户基本信息和签名', () => {
    const $ = cheerio.load(`
      <main id="Main">
        <div class="box">
          <div class="cell">
            <img class="avatar" data-uid="1" src="//cdn.v2ex.com/avatar.png" alt="Livid">
            <h1>Livid</h1>
            <span class="bigger">Remember the bigger green</span>
            <span class="gray">
              V2EX 第 1 号会员，加入于 2010-04-25 21:45:46 +08:00
              <div class="sep5"></div>
              今日活跃度排名 <a href="/top/dau">13775</a>
            </span>
            <div class="badges"><div class="badge pro">PRO</div></div>
          </div>
          <div class="cell">其他资料区块</div>
        </div>
      </main>
    `)

    expect(parseMemberInfo($, 'fallback')).toEqual({
      avatar: '//cdn.v2ex.com/avatar.png',
      username: 'Livid',
      tagline: 'Remember the bigger green',
      bio: '',
      memberId: 1,
      joinedAt: '2010-04-25 21:45:46 +08:00',
      isPro: true,
      activityRank: 13775
    })
  })

  it('在资料区字段缺失时使用结构化数据', () => {
    const $ = cheerio.load(`
      <main id="Main">
        <div class="box">
          <img class="avatar" data-uid="42">
        </div>
      </main>
      <script type="application/ld+json">
        {
          "@type": "ProfilePage",
          "dateCreated": "2020-01-02T03:04:05Z",
          "mainEntity": {
            "name": "fallback-user",
            "description": "Fallback tagline",
            "image": "https://cdn.v2ex.com/fallback.png",
            "identifier": "42"
          }
        }
      </script>
    `)

    expect(parseMemberInfo($, 'fallback')).toMatchObject({
      username: 'fallback-user',
      tagline: 'Fallback tagline',
      bio: '',
      memberId: 42,
      joinedAt: '2020-01-02T03:04:05Z'
    })
  })

  it('解析登录用户可用的特别关注和屏蔽状态', () => {
    const $ = cheerio.load(`
      <main id="Main">
        <div class="box">
          <div class="cell">
            <img class="avatar" data-uid="42" src="//cdn.v2ex.com/avatar.png" alt="someone">
            <h1>someone</h1>
            <input type="button" onclick="location.href = '/follow/42?once=token';">
            <input type="button" onclick="location.href = '/unblock/42?once=token';">
          </div>
        </div>
      </main>
    `)

    expect(parseMemberInfo($, 'fallback')).toMatchObject({
      isFollowing: false,
      isBlocked: true
    })

    const followedAndBlocked$ = cheerio.load(`
      <main id="Main">
        <div class="box">
          <img class="avatar" data-uid="42" alt="someone">
          <input type="button" onclick="location.href = '/unfollow/42?once=token';">
          <input type="button" onclick="location.href = '/block/42?once=token';">
        </div>
      </main>
    `)

    expect(parseMemberInfo(followedAndBlocked$, 'fallback')).toMatchObject({
      isFollowing: true,
      isBlocked: false
    })
  })
})

const memberProfiles = JSON.parse(
  readFileSync(new URL('./fixtures/memberProfiles.json', import.meta.url), 'utf8')
) as {
  username: string
  html: string
  expected: { username: string; memberId: number; isPro: boolean }
}[]
const memberContents = JSON.parse(
  readFileSync(new URL('./fixtures/memberContents.json', import.meta.url), 'utf8')
) as {
  key: string
  username: string
  tab: 'topics' | 'replies'
  html: string
  expected: { hidden: boolean; topics: number; replies: number }
}[]

describe('member selectors on captured Chinese pages', () => {
  it.each(memberProfiles)(
    'reads $username without avatar data-uid or fixed box depth',
    ({ username, html, expected }) => {
      const $ = cheerio.load(html)
      const original = parseMemberInfo($, username)
      expect(original).toMatchObject(expected)
      expect(original.joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}/)
      $('#Main > .box').wrap('<section></section>')
      $('img.avatar').removeAttr('data-uid')
      $('#Main .box').prepend(
        `<div class="topic_content"><h1>fake</h1><img class="avatar" data-uid="999" alt="fake"><div class="badge pro"></div><input onclick="location.href='/follow/999?once=123'"></div>`
      )
      $('#Main').prepend('<div class="box"><img class="avatar" data-uid="888" alt="other"></div>')
      expect(parseMemberInfo($, username)).toEqual(original)
    }
  )

  it.each(memberContents)(
    'reads $key despite wrappers and unrelated hidden notices',
    ({ html, tab, expected }) => {
      const $ = cheerio.load(html)
      const original = parseMemberContent($, tab, 1)
      expect(original.hidden).toBe(expected.hidden)
      expect(original.topics).toHaveLength(expected.topics)
      expect(original.replies).toHaveLength(expected.replies)
      if (tab === 'replies') expect(original.replies[0].contentHtml).not.toBe('')
      $('#Main > .box').wrap('<section></section>')
      $('.cell.item').wrap('<section></section>')
      $('.dock_area').after('<div class="sep5"></div>')
      $('#Main').prepend(
        '<div class="box"><div class="topic_content"><span class="gray">主题列表被隐藏</span><div class="dock_area">假摘要</div></div></div>'
      )
      $('.reply_content').append(
        '<div class="dock_area">假摘要</div><div class="ps_container"><input class="page_input" max="9999"></div>'
      )
      const changed = parseMemberContent($, tab, 1)
      expect(changed.hidden).toBe(original.hidden)
      expect(changed.message).toBe(original.message)
      expect(changed.totalPage).toBe(original.totalPage)
      expect(changed.topics).toEqual(original.topics)
      expect(changed.replies.map(({ contentHtml, ...reply }) => reply)).toEqual(
        original.replies.map(({ contentHtml, ...reply }) => reply)
      )
    }
  )

  it('does not borrow the next reply body when one is missing', () => {
    const $ = cheerio.load(`<div id="Main"><div class="box">
      <div class="dock_area"><span class="gray"><a href="/t/1">first</a></span></div>
      <div class="sep5"></div>
      <div class="dock_area"><span class="gray"><a href="/t/2">second</a></span></div>
      <section><div class="inner"><div class="reply_content">second body</div></div></section>
    </div></div>`)
    expect(parseMemberContent($, 'replies', 1).replies.map(reply => reply.contentHtml)).toEqual([
      '',
      'second body'
    ])
  })

  it('reads ProfilePage creation time from the JSON-LD root', () => {
    const $ = cheerio.load(
      `<script type="application/ld+json">{"@type":"ProfilePage","dateCreated":"2020-01-02T03:04:05Z","mainEntity":{"name":"alice","identifier":"42"}}</script>`
    )
    expect(parseMemberInfo($, 'alice')).toMatchObject({
      memberId: 42,
      joinedAt: '2020-01-02T03:04:05Z'
    })
  })
})
