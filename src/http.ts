import axios from 'axios';
import G from './global';
import g from './global';

const http = axios.create({
  baseURL: 'https://www.v2ex.com',
  headers: {
    // 需要用一个合法的UA，否则访问某些页面会出错
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36',
  },
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  if (config.headers['Cookie'] === undefined) {
    config.headers['Cookie'] = g.getCookie() || '';
  }
  const proxy = G.getProxySetting();
  if (proxy) {
    config.proxy = {
      host: proxy.host,
      port: proxy.port,
      protocol: proxy.protocol,
    };
  } else {
    config.proxy = false;
  }
  return config;
});

export default http;
