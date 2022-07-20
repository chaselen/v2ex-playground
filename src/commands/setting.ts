import { ProxySetting } from './../global';
import * as vscode from 'vscode';
import G from '../global';

export default async function setting() {
  const sel = await vscode.window.showQuickPick(['代理设置'], {
    placeHolder: '设置',
  });

  switch (sel) {
    case '代理设置':
      proxySetting();
      break;
  }
}

async function proxySetting() {
  let proxy = G.getProxySetting();

  let input = await vscode.window.showInputBox({
    placeHolder: '填写代理url',
    prompt:
      '例如：http://127.0.0.1:7890（支持http、https、socks5，不填则不使用代理）',
    value: proxy ? `${proxy.protocol}://${proxy.host}:${proxy.port}` : '',
  });
  if (input === undefined) {
    return;
  }

  input = input.trim();
  if (!input.length) {
    G.setProxySetting(undefined);
    return;
  }

  const regex = /^(http|https|socks5):\/\/(.+):(\d+)$/gm;
  const match = regex.exec(input);
  if (!match) {
    vscode.window.showErrorMessage('代理url格式不正确');
    return;
  }

  const [, protocol, host, port] = match;
  const newProxy: ProxySetting = {
    protocol,
    host,
    port: Number(port),
  };
  G.setProxySetting(newProxy);
}
