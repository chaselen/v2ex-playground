import { imageEmoticonLinks, type ImageEmoticonToken } from '@/shared/imageEmoticons'

/** 图片表情匹配表达式 */
const imageEmoticonPattern = new RegExp(
  Object.keys(imageEmoticonLinks)
    .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g'
)

/** 表情分组 */
export const emoticonGroups = [
  {
    title: '流行',
    list: [
      '[脱单doge]',
      '[doge]',
      '[打call]',
      '[星星眼]',
      '[吃瓜]',
      '[OK]',
      '[哦呼]',
      '[思考]',
      '[疑惑]',
      '[辣眼睛]',
      '[傲娇]',
      '[捂脸]',
      '[无语]',
      '[大哭]',
      '[酸了]',
      '[歪嘴]',
      '[调皮]',
      '[笑哭]',
      '[嗑瓜子]',
      '[喜极而泣]',
      '[惊讶]',
      '[给心心]',
      '[呆]',
      '[跪了]',
      '[响指]',
      '[哇R]',
      '[萌萌哒R]',
      '[害羞R]',
      '[偷笑R]',
      '[哭惹R]',
      '[汗颜R]'
    ]
  },
  {
    title: '小黄脸',
    list: [
      '😀',
      '😁',
      '😂',
      '🤣',
      '😅',
      '😊',
      '😋',
      '😘',
      '🥰',
      '😗',
      '🤩',
      '🤔',
      '🤨',
      '😐',
      '😑',
      '🙄',
      '😏',
      '😪',
      '😫',
      '🥱',
      '😜',
      '😒',
      '😔',
      '😨',
      '😰',
      '😱',
      '🥵',
      '😡',
      '🥳',
      '🥺',
      '🤭',
      '🧐',
      '😎',
      '🤓',
      '😭',
      '🤑',
      '🤮'
    ]
  },
  {
    title: '手势',
    list: [
      '🙋',
      '🙎',
      '🙅',
      '🙇',
      '🤷',
      '🤏',
      '👉',
      '✌️',
      '🤘',
      '🤙',
      '👌',
      '🤌',
      '👍',
      '👎',
      '👋',
      '🤝',
      '🙏',
      '👏'
    ]
  },
  {
    title: '庆祝',
    list: ['✨', '🎉', '🎊']
  },
  {
    title: '其他',
    list: ['👻', '🤡', '🐔', '👀', '💩', '🐴', '🦄', '🐧', '🐶', '🐒', '🙈', '🙉', '🙊', '🐵']
  }
] as const satisfies readonly { title: string; list: readonly string[] }[]

/**
 * 替换图片表情 token 为图片链接
 * @param content 回复内容
 */
export function replaceImageEmoticonTokens(content: string) {
  return content
    .replace(imageEmoticonPattern, token => ` ${imageEmoticonLinks[token as ImageEmoticonToken]} `)
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/ *(\r?\n) */g, '$1')
    .trim()
}
