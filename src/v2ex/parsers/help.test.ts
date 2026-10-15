import { describe, expect, test } from 'vitest'
import { parseHelpPage } from './help'

describe('help page parser', () => {
  test('extracts dynamic navigation and filters executable content', () => {
    const page = parseHelpPage(
      `<div id="Navcol"><ul class="nav"><li><a href="/help/new-topic">新主题</a></li></ul></div><div id="Maincol"><div class="markdown_body"><h1>帮助</h1><script>alert(1)</script><p style="color:red" onclick="evil()">说明</p><a href="javascript:evil()">危险链接</a><a href="/help/new-topic">主题</a><img src="/image.png" onerror="evil()"><iframe src="https://example.com"></iframe></div></div>`,
      'home'
    )
    expect(page.navigation).toEqual([{ slug: 'new-topic', title: '新主题' }])
    expect(page.html).toContain('https://www.v2ex.com/help/new-topic')
    expect(page.html).toContain('https://www.v2ex.com/image.png')
    expect(page.html).not.toMatch(/script|onclick|onerror|style=|javascript:|iframe/)
  })
  test('preserves declared image dimensions for inline retina badges', () => {
    const page = parseHelpPage(
      '<div id="Navcol"><ul class="nav"><li><a href="/help/currency">虚拟货币</a></li></ul></div><div id="Maincol"><div class="markdown_body"><h1>虚拟货币系统</h1><p>管理员 <img src="/static/img/mod@2x.png" width="30" height="14" style="margin-bottom:4px" onerror="evil()"> 发现此类行为</p><img src="/invalid.png" width="100%" height="-1"></div></div>',
      'currency'
    )
    expect(page.html).toContain('width="30" height="14"')
    expect(page.html).toContain('/static/img/mod@2x.png')
    expect(page.html).not.toMatch(/style=|onerror|width="100%"|height="-1"/)
  })
  test('preserves only safe pixel dimensions from node icon styles', () => {
    const page = parseHelpPage(
      '<div id="Navcol"><ul class="nav"><li><a href="/help/node">节点</a></li></ul></div><div id="Maincol"><div class="markdown_body"><h1>节点</h1><h2><img src="https://cdn.v2ex.com/node.png" style="vertical-align: middle; height: 24px; position: fixed; width: expression(evil())" onerror="evil()"> 分享创造</h2><img src="/bad.png" style="height: -1px; width: 100%; background: url(evil)"></div></div>',
      'node'
    )
    expect(page.html).toContain('style="height: 24px"')
    expect(page.html).not.toMatch(/vertical-align|position|expression|onerror|background|100%|-1px/)
  })
  test('preserves API anchors, multiline examples and footer semantics', () => {
    const page = parseHelpPage(
      '<div id="Navcol"><ul class="nav"><li><a href="/help/api">API</a></li></ul></div><div id="Maincol"><div class="markdown_body"><h1>API</h1><a href="#example">示例</a><h2 id="example">示例</h2><blockquote class="f12 arbitrary"><code>GET /api/v2/\nAuthorization: Bearer token</code></blockquote><table><tr><td width="70">HTTP 方法</td></tr></table><div class="flex-one-row"><small class="fade">更新时间</small><small class="fade">查看次数</small></div></div></div>',
      'api'
    )
    expect(page.html).toContain('href="#example"')
    expect(page.html).toContain('id="example"')
    expect(page.html).toContain('class="help-code-block"')
    expect(page.html).toContain('class="help-page-meta"')
    expect(page.html.match(/class="help-muted"/g)).toHaveLength(2)
    expect(page.html).toContain('width="70"')
    expect(page.html).not.toContain('arbitrary')
  })
  test('rejects unexpected pages instead of rendering them as help', () => {
    expect(() => parseHelpPage('<h1>登录</h1>', 'home')).toThrow('无法解析')
  })
})
