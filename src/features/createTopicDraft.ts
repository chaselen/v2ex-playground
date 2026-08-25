import G from '@/global'
import type { CreateTopicDraft } from '@/shared/webview'

/** 创作新主题草稿存储 key */
const createTopicDraftsKey = 'v2ex.createTopicDrafts'

/** 按规范化用户名保存的草稿 */
type CreateTopicDrafts = Record<string, CreateTopicDraft>

/** 获取当前账号的创作草稿 */
export function getCreateTopicDraft(username: string): CreateTopicDraft | undefined {
  return G.context.globalState.get<CreateTopicDrafts>(createTopicDraftsKey)?.[
    normalizeUsername(username)
  ]
}

/** 保存当前账号的创作草稿 */
export function saveCreateTopicDraft(username: string, draft: CreateTopicDraft): Thenable<void> {
  const drafts = G.context.globalState.get<CreateTopicDrafts>(createTopicDraftsKey) || {}
  return G.context.globalState.update(createTopicDraftsKey, {
    ...drafts,
    [normalizeUsername(username)]: draft
  })
}

/** 清除当前账号的创作草稿 */
export function clearCreateTopicDraft(username: string): Thenable<void> {
  const drafts = { ...(G.context.globalState.get<CreateTopicDrafts>(createTopicDraftsKey) || {}) }
  delete drafts[normalizeUsername(username)]
  return G.context.globalState.update(createTopicDraftsKey, drafts)
}

/** 规范化草稿所属用户名 */
function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}
