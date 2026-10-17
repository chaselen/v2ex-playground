import * as cheerio from 'cheerio/slim'
import { LoginCooldownError } from '../types'

/** 单次登录页面的字段与令牌，仅供认证服务使用 */
export interface SigninForm {
  usernameField: string
  passwordField: string
  captchaField: string
  once: string
  next: string
}

/** 从中文登录表单解析本次动态字段，拒绝无法识别的页面 */
export function parseSigninForm(html: string): SigninForm {
  const $ = cheerio.load(html)
  const box = $('#Main .box')
    .filter((_, element) => $(element).children('.header').text().includes('登录受限'))
    .first()
  if (box.length) {
    const explanation = box
      .children('.cell')
      .find('.topic_content p')
      .toArray()
      .map(element => $(element).text().replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
    throw new LoginCooldownError(explanation ? `登录受限：\n${explanation}` : undefined)
  }
  const form = $('form[action="/signin"][method="post"]').first()
  const textFields = form.find('input[type="text"]')
  const usernameField = textFields.eq(0).attr('name')
  const passwordField = form.find('input[type="password"]').attr('name')
  const captchaField = textFields.eq(1).attr('name')
  const once = form.find('input[name="once"]').attr('value')
  const next = form.find('input[name="next"]').attr('value')
  if (
    !usernameField ||
    !passwordField ||
    !captchaField ||
    !once ||
    next !== '/' ||
    form.find('img[src="/_captcha"]').length !== 1 ||
    new Set([usernameField, passwordField, captchaField, 'once', 'next']).size !== 5
  ) {
    throw new Error('无法识别 V2EX 登录表单，请尝试 Cookie 登录')
  }
  return { usernameField, passwordField, captchaField, once, next }
}

/** 提取源站认证失败提示，保留列表分条结构并作为纯文本展示 */
export function parseAuthProblem(html: string): string {
  const $ = cheerio.load(html)
  // 登录页在实际错误前包含空的隐藏提示容器
  const problem = $('.problem')
    .filter((_, element) => !!$(element).text().trim())
    .first()
  const items = problem
    .find('li')
    .toArray()
    .map(item => $(item).text().replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  problem.find('ul, ol').remove()
  const summary = problem.text().replace(/\s+/g, ' ').trim()
  return [summary, ...items.map(item => `• ${item}`)].filter(Boolean).join('\n')
}

/** 中文找回密码表单固定使用 u/e/c 字段，每次刷新重新获取 once */
export function parsePasswordResetForm(html: string): string {
  const $ = cheerio.load(html)
  const form = $('form[action="/forgot"][method="post"]').first()
  const once = form.find('input[name="once"]').attr('value')
  if (
    !once ||
    ['u', 'e', 'c'].some(name => form.find(`input[type="text"][name="${name}"]`).length !== 1) ||
    form.find('img[src="/_captcha"]').length !== 1
  )
    throw new Error('无法识别 V2EX 找回密码表单，请稍后重试')
  return once
}

/** 展示源站结果原文，拒绝仍含表单、错误或无法识别的响应 */
export function parsePasswordResetResult(html: string): string {
  const $ = cheerio.load(html)
  const problem = parseAuthProblem(html)
  if (problem) throw new Error(problem)
  if ($('form[action="/forgot"]').length) throw new Error('请求未完成，请检查填写内容并重试')
  const content = $('#Main .box').first().clone()
  content.find('.header, script, style').remove()
  const message = content.text().replace(/\s+/g, ' ').trim()
  if (!message) throw new Error('无法识别找回密码请求结果，请前往源站确认')
  return message
}

/** V2EX 登出成功返回中文确认页，不能仅凭 HTTP 200 判断成功 */
export function isSignoutConfirmation(html: string): boolean {
  return cheerio
    .load(html)('#Main')
    .text()
    .includes('你已经完全登出，没有任何个人信息留在这台电脑上。')
}

/** 源站登出链接位于导航的 onclick 中，只提取固定同站路径与数字令牌 */
export function parseSignoutPath(html: string): string | undefined {
  const $ = cheerio.load(html)
  for (const element of $('a[onclick]').toArray()) {
    const path = $(element)
      .attr('onclick')
      ?.match(/location\.href\s*=\s*['"](\/signout\?once=\d+)['"]/)?.[1]
    if (path) return path
  }
}
