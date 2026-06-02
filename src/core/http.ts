import axios from 'axios'

const http = axios.create({
  headers: {
    // 需要用一个合法的UA，否则访问某些页面会出错
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9'
  },
  timeout: 15000
})

export default http
