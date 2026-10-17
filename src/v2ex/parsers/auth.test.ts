import { describe, expect, test } from 'vitest'
import {
  isSignoutConfirmation,
  parseAuthProblem,
  parseSigninForm,
  parseSignoutPath,
  parsePasswordResetForm,
  parsePasswordResetResult
} from './auth'

const form = `<form method="post" action="/signin">
  <input type="text" name="random-user"><input type="password" name="random-password">
  <img src="/_captcha"><input type="text" name="random-captcha">
  <input type="hidden" name="once" value="123"><input type="hidden" name="next" value="/">
</form>`

describe('authentication page contracts', () => {
  test('recognizes the Chinese logout confirmation rather than any successful HTTP page', () => {
    expect(
      isSignoutConfirmation(
        '<div id="Main"><div class="box">V2EX › 登出 你已经完全登出，没有任何个人信息留在这台电脑上。</div></div>'
      )
    ).toBe(true)
    expect(isSignoutConfirmation('<div id="Main">V2EX › 登出</div>')).toBe(false)
    expect(isSignoutConfirmation('<div id="Main">请稍后重试</div>')).toBe(false)
  })
  test('reads dynamic names from the signin form rather than unrelated page inputs', () => {
    expect(parseSigninForm('<input type="text" name="search">' + form)).toEqual({
      usernameField: 'random-user',
      passwordField: 'random-password',
      captchaField: 'random-captcha',
      once: '123',
      next: '/'
    })
  })
  test.each([
    form.replace('name="once"', 'name="missing"'),
    form.replace('name="random-password"', 'name="once"'),
    form.replace('value="/"', 'value="https://example.com/"'),
    '<html>challenge</html>'
  ])('rejects incomplete or unexpected login pages', html => {
    expect(() => parseSigninForm(html)).toThrow('无法识别')
  })
  test('extracts only the same-site logout path from the source onclick', () => {
    expect(
      parseSignoutPath(
        `<a onclick="if (confirm('确定要从 V2EX 登出？')) { location.href= '/signout?once=12140'; }">登出</a>`
      )
    ).toBe('/signout?once=12140')
    expect(
      parseSignoutPath(
        `<a onclick="location.href='https://example.com/signout?once=12140'">登出</a>`
      )
    ).toBeUndefined()
  })
  test('returns plain problem text', () => {
    expect(
      parseAuthProblem('<div class="problem"><strong>验证码错误</strong>\n 请重试</div>')
    ).toBe('验证码错误 请重试')
  })
})

const resetForm =
  '<form method="post" action="/forgot"><input type="text" name="u"><input type="text" name="e"><input type="text" name="c"><img src="/_captcha"><input name="once" value="123"></form>'

test('validates password reset fields and rejects error and incomplete responses', () => {
  expect(parsePasswordResetForm(resetForm)).toBe('123')
  expect(() => parsePasswordResetForm(resetForm.replace('name="e"', 'name="email"'))).toThrow(
    '无法识别'
  )
  expect(() =>
    parsePasswordResetResult('<div class="problem">输入的验证码不正确</div>' + resetForm)
  ).toThrow('输入的验证码不正确')
  expect(() => parsePasswordResetResult(resetForm)).toThrow('请求未完成')
  expect(() => parsePasswordResetResult('<html>Unexpected response</html>')).toThrow('无法识别')
  expect(
    parsePasswordResetResult(
      '<div id="Main"><div class="box"><div class="header">标题</div><div class="inner">源站返回的结果说明</div></div></div>'
    )
  ).toBe('源站返回的结果说明')
})

test('preserves separate password reset errors as plain text list items', () => {
  const html =
    '<div class="problem">通过电子邮件重设密码的过程中遇到一些问题：<ul><li>用户名不存在</li><li>输入的<strong>验证码</strong>不正确</li></ul></div>'
  expect(() => parsePasswordResetResult(html)).toThrow(
    '通过电子邮件重设密码的过程中遇到一些问题：\n• 用户名不存在\n• 输入的验证码不正确'
  )
})

test('preserves multiple login problems without joining adjacent list items', () => {
  expect(
    parseAuthProblem(
      '<div class="problem">登录失败：<ul><li>用户名或密码错误</li><li>输入的验证码不正确</li></ul></div>'
    )
  ).toBe('登录失败：\n• 用户名或密码错误\n• 输入的验证码不正确')
  expect(parseAuthProblem('<div>正常页面</div>')).toBe('')
})

test('skips the empty hidden login problem before the actual error list', () => {
  expect(
    parseAuthProblem(
      '<div id="problem" class="problem topic_content markdown_body" style="display: none;"></div>' +
        '<div class="problem">请解决以下问题然后再提交：<ul><li>请输入用户名</li><li>请输入密码</li><li>输入的验证码不正确</li></ul></div>'
    )
  ).toBe('请解决以下问题然后再提交：\n• 请输入用户名\n• 请输入密码\n• 输入的验证码不正确')
})

test('reports the Chinese signin cooldown page rather than an unrecognized form', () => {
  const html =
    '<div id="Main"><div class="box"><div class="header">V2EX › 登录受限</div><div class="cell"><div class="topic_content markdown_body"><p>由于当前 IP 在短时间内的登录尝试次数太多，目前暂时不能继续尝试。</p><p>你可能会需要等待至多 1 天的时间再继续尝试。</p></div></div><div class="dock_area">受限 IP 不应回传</div></div></div>'
  expect(() => parseSigninForm(html)).toThrow(
    '登录受限：\n由于当前 IP 在短时间内的登录尝试次数太多，目前暂时不能继续尝试。\n你可能会需要等待至多 1 天的时间再继续尝试。'
  )
})
