/** V2EX 首页分类的二级节点链接，按站点展示顺序排列 */
export const exploreNodeLinks: Partial<Record<string, { name: string; title: string }[]>> = {
  tech: [
    { name: 'programmer', title: '程序员' },
    { name: 'python', title: 'Python' },
    { name: 'idev', title: 'iDev' },
    { name: 'claude', title: 'Claude' },
    { name: 'openai', title: 'OpenAI' },
    { name: 'localllm', title: 'Local LLM' },
    { name: 'cloud', title: '云计算' },
    { name: 'bb', title: '宽带症候群' }
  ],
  creative: [
    { name: 'create', title: '分享创造' },
    { name: 'design', title: '设计' },
    { name: 'ideas', title: '奇思妙想' }
  ],
  play: [
    { name: 'share', title: '分享发现' },
    { name: 'crypto', title: '加密货币' },
    { name: 'games', title: '电子游戏' },
    { name: 'movie', title: '电影' },
    { name: 'tv', title: '剧集' },
    { name: 'music', title: '音乐' },
    { name: 'travel', title: '旅游' },
    { name: 'android', title: 'Android' },
    { name: 'afterdark', title: '午夜俱乐部' }
  ],
  apple: [
    { name: 'macos', title: 'macOS' },
    { name: 'iphone', title: 'iPhone' },
    { name: 'ipad', title: 'iPad' },
    { name: 'macmini', title: 'Mac mini' },
    { name: 'mbp', title: 'MBP' },
    { name: 'imac', title: 'iMac' },
    { name: 'watch', title: ' WATCH' },
    { name: 'apple', title: 'Apple' }
  ],
  jobs: [
    { name: 'jobs', title: '酷工作' },
    { name: 'cv', title: '求职' },
    { name: 'career', title: '职场话题' },
    { name: 'meet', title: '创业组队' },
    { name: 'outsourcing', title: '外包' }
  ],
  deals: [
    { name: 'all4all', title: '二手交易' },
    { name: 'exchange', title: '物物交换' },
    { name: 'free', title: '免费赠送' },
    { name: 'dn', title: '域名' },
    { name: 'tuan', title: '团购' }
  ],
  city: [
    { name: 'beijing', title: '北京' },
    { name: 'shanghai', title: '上海' },
    { name: 'shenzhen', title: '深圳' },
    { name: 'guangzhou', title: '广州' },
    { name: 'hangzhou', title: '杭州' },
    { name: 'chengdu', title: '成都' },
    { name: 'singapore', title: '新加坡' },
    { name: 'nyc', title: '纽约' },
    { name: 'la', title: '洛杉矶' }
  ],
  qna: [{ name: 'qna', title: '问与答' }],
  all: [
    { name: 'share', title: '分享发现' },
    { name: 'create', title: '分享创造' },
    { name: 'qna', title: '问与答' },
    { name: 'jobs', title: '酷工作' },
    { name: 'programmer', title: '程序员' },
    { name: 'career', title: '职场话题' },
    { name: 'solana', title: 'Solana' },
    { name: 'invest', title: '投资' },
    { name: 'ideas', title: '奇思妙想' },
    { name: 'hardware', title: '硬件' }
  ]
}
