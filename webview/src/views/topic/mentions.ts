/** 联想列表中的用户及其页面头像 */
export interface MentionUser {
  name: string
  avatar: string
}

/** 获取光标前尚未完成的 @ 用户名，避免把邮箱识别为提及 */
export function findMention(value: string, start: number, end = start) {
  if (start !== end) return null
  const match = /(?:^|[\s\u3000])@([a-zA-Z0-9_]*)$/.exec(value.slice(0, start))
  if (!match) return null
  // 光标位于用户名中间时，选择候选应一并替换后半段
  const suffix = /^[a-zA-Z0-9_]*/.exec(value.slice(start))![0]
  return { start: start - match[1].length - 1, end: start + suffix.length, query: match[1] }
}

/** 按候选顺序去重并过滤用户名 */
export function getMentionUsers(users: MentionUser[], query: string) {
  const seen = new Set<string>()
  const normalizedQuery = query.toLowerCase()
  return users.filter(user => {
    const key = user.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return key.includes(normalizedQuery)
  })
}
