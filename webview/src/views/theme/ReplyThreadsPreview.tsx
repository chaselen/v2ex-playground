import { useState } from 'react'
import { RadioGroup, RadioGroupItem, Button, Avatar } from '@/components/ui'
import EnhancedHtmlContent from '@/components/EnhancedHtmlContent'
import ReplyList from '../topic/ReplyList'
import { replyThreadStyleLabels } from '../topic/replyTree'
import type { ReplyThreadStyle, TopicReply } from '@extension/v2ex/types'
import '../topic/topic.scss'

const replies: TopicReply[] = Array.from({ length: 8 }, (_, index) => ({
  replyId: String(index + 1),
  floor: String(index + 1),
  userName: ['alice', 'bob', 'carol'][index % 3],
  userAvatar: '',
  isMod: false,
  isOp: index === 0,
  isPro: false,
  time: '10 分钟前',
  repliedAt: '',
  content:
    index === 0
      ? '先明确需求，再用不同的显示方式阅读同一段讨论。<a href="#r_8">跳到第 8 楼</a>'
      : `第 ${index + 1} 楼：这是用于检查窄布局和主题对比度的回复。`,
  thanks: 0,
  thanked: false
}))
for (const [child, parent] of [
  [3, 1],
  [4, 3],
  [5, 2],
  [6, 4],
  [7, 6],
  [8, 7]
]) {
  const target = replies[parent - 1]
  replies[child - 1].parent = {
    replyId: target.replyId,
    floor: target.floor,
    userName: target.userName,
    content: target.content,
    url: `#r_${target.replyId}`
  }
}

/** 使用真实渲染器检查七种回复模式、折叠跳转及窄面板 */
export default function ReplyThreadsPreview() {
  const [style, setStyle] = useState<ReplyThreadStyle>('off')
  const [showAvatars, setShowAvatars] = useState(false)
  const [narrow, setNarrow] = useState(false)
  return (
    <>
      <RadioGroup
        aria-label="官网回复模式预览"
        value={style}
        onValueChange={value => setStyle(value as ReplyThreadStyle)}
      >
        {Object.entries(replyThreadStyleLabels).map(([value, label]) => (
          <RadioGroupItem key={value} value={value} label={label} />
        ))}
      </RadioGroup>
      <Button onClick={() => setShowAvatars(current => !current)}>切换回复头像</Button>
      <Button onClick={() => setNarrow(current => !current)}>切换窄面板</Button>
      <div
        className="thread-theme-preview"
        style={{ width: narrow ? 300 : '100%', maxWidth: '100%' }}
      >
        <ReplyList
          topicId={1}
          replies={replies}
          style={style}
          showAvatar={showAvatars}
          renderReply={(reply, decorations) => (
            <div className="reply-layout">
              {showAvatars && (
                <Avatar
                  size="small"
                  shape="square"
                  fallback={reply.userName.slice(0, 1).toUpperCase()}
                />
              )}
              <div className="reply-body">
                <div className="reply-meta">
                  <strong>{reply.userName}</strong>
                  {decorations.beforeTime}
                  <span className="time">{reply.time}</span>
                  {decorations.meta}
                  <span className="floor">#{reply.floor}</span>
                </div>
                {decorations.before}
                <EnhancedHtmlContent
                  className="topic-content reply-content"
                  html={decorations.content}
                />
                {decorations.after}
              </div>
            </div>
          )}
        />
      </div>
    </>
  )
}
