import * as cheerio from 'cheerio/slim'
import { describe, expect, it } from 'vitest'
import { parseMemberInfo } from './member'

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
              V2EX member #1, joined on 2010-04-25 21:45:46 +08:00
              <div class="sep5"></div>
              Today's activity rank 13775
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
      memberNumber: 1,
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
          "mainEntity": {
            "name": "fallback-user",
            "description": "Fallback tagline",
            "image": "https://cdn.v2ex.com/fallback.png",
            "identifier": "42",
            "dateCreated": "2020-01-02T03:04:05Z"
          }
        }
      </script>
    `)

    expect(parseMemberInfo($, 'fallback')).toMatchObject({
      username: 'fallback-user',
      tagline: 'Fallback tagline',
      bio: '',
      memberNumber: 42,
      joinedAt: '2020-01-02T03:04:05Z'
    })
  })
})
