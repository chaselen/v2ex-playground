import { Avatar } from '@/components/ui'
import { useBrowseSettings } from '@/hooks/useBrowseSettings'
import styles from './TopicAuthor.module.scss'

/** 帖子列表中的作者头像和用户名，头像遵循宿主显示设置 */
export default function TopicAuthor({ name, avatar }: { name: string; avatar?: string }) {
  const { showAvatar } = useBrowseSettings()
  return (
    <span className={styles.author}>
      {showAvatar && (
        <Avatar src={avatar} alt="" size="small" shape="square" className={styles.avatar} />
      )}
      <span>{name}</span>
    </span>
  )
}
