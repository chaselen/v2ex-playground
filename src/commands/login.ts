import { DailyRes, V2ex } from './../v2ex';
import * as vscode from 'vscode';
import G from '../global';

/**
 * 登录逻辑
 * @returns 返回是否成功登录成功
 */
export default async function login(): Promise<LoginResult> {
  let cookie = await vscode.window.showInputBox({
    placeHolder: 'V2EX Cookie',
    prompt: '在此处粘贴从浏览器中复制的 Cookie 以登录。（如要退出，请清空 Cookie 并回车确认）',
    value: G.getCookie()
  });
  // 如果用户撤销输入，如ESC，则为undefined
  if (cookie === undefined) {
    return LoginResult.cancel;
  }
  cookie = (cookie || '').trim();
  // 容错处理：如果用户把前面的键也复制进去了，则手动去掉前面的cookie:
  cookie = cookie.replace(/^cookie: /i, '');

  // 清除cookie
  if (!cookie) {
    await G.setCookie('');
    return LoginResult.logout;
  }

  const isLoginSuccess = await vscode.window.withProgress(
    {
      title: '正在登录',
      location: vscode.ProgressLocation.Notification
    },
    async () => {
      const isCookieValid = await V2ex.checkCookie(cookie!);
      console.log('Cookie是否有效：', isCookieValid);
      if (isCookieValid) {
        await G.setCookie(cookie!);
        vscode.window.showInformationMessage('登录成功');

        // 登录后签到
        V2ex.daily().then((res) => {
          console.log(`每日签到结果：${res}`);
          if (res === DailyRes.success) {
            vscode.window.showInformationMessage('签到成功');
          }
        });
      } else {
        vscode.window.showErrorMessage('登录失败，Cookie无效');
      }
      return isCookieValid;
    }
  );
  return isLoginSuccess ? LoginResult.success : LoginResult.failed;
}

/**
 * 登录结果
 */
export enum LoginResult {
  /** 登录成功 */
  success,
  /** 登录失败 */
  failed,
  /** 退出登录 */
  logout,
  /** 取消登录 */
  cancel
}
