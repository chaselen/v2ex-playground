import type { ClientVia } from '@extension/v2ex/types'
import { Tooltip } from '@/components/ui'
import styles from './ClientSource.module.scss'

/** 客户端图标及其可见边界；未知名称保留文字展示 */
const clientIcons = new Map<string, { path: string; viewBox: string; fillRule?: 'evenodd' }>([
  // Font Awesome 5.0.13，CC BY 4.0
  // https://github.com/FortAwesome/Font-Awesome/blob/5.0.13/advanced-options/raw-svg/brands/android.svg
  [
    'android',
    {
      path: 'M89.6 204.5v115.8c0 15.4-12.1 27.7-27.5 27.7-15.3 0-30.1-12.4-30.1-27.7V204.5c0-15.1 14.8-27.5 30.1-27.5 15.1 0 27.5 12.4 27.5 27.5zm10.8 157c0 16.4 13.2 29.6 29.6 29.6h19.9l.3 61.1c0 36.9 55.2 36.6 55.2 0v-61.1h37.2v61.1c0 36.7 55.5 36.8 55.5 0v-61.1h20.2c16.2 0 29.4-13.2 29.4-29.6V182.1H100.4v179.4zm248-189.1H99.3c0-42.8 25.6-80 63.6-99.4l-19.1-35.3c-2.8-4.9 4.3-8 6.7-3.8l19.4 35.6c34.9-15.5 75-14.7 108.3 0L297.5 34c2.5-4.3 9.5-1.1 6.7 3.8L285.1 73c37.7 19.4 63.3 56.6 63.3 99.4zm-170.7-55.5c0-5.7-4.6-10.5-10.5-10.5-5.7 0-10.2 4.8-10.2 10.5s4.6 10.5 10.2 10.5c5.9 0 10.5-4.8 10.5-10.5zm113.4 0c0-5.7-4.6-10.5-10.2-10.5-5.9 0-10.5 4.8-10.5 10.5s4.6 10.5 10.5 10.5c5.6 0 10.2-4.8 10.2-10.5zm94.8 60.1c-15.1 0-27.5 12.1-27.5 27.5v115.8c0 15.4 12.4 27.7 27.5 27.7 15.4 0 30.1-12.4 30.1-27.7V204.5c0-15.4-14.8-27.5-30.1-27.5z',
      viewBox: '0 32 448 448'
    }
  ],
  // Apple 标志：Simple Icons（CC0），https://github.com/simple-icons/simple-icons
  [
    'ios',
    {
      path: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701',
      viewBox: '0 0 24 24'
    }
  ],
  // 自绘设备轮廓，屏幕与按键镂空；统一 24 单位的可见高度
  [
    'iphone',
    {
      path: 'M5 0h10a2 2 0 0 1 2 2v20a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-20a2 2 0 0 1 2 -2ZM5.0 4h10.0a0.5 0.5 0 0 1 0.5 0.5v13.5a0.5 0.5 0 0 1 -0.5 0.5h-10.0a0.5 0.5 0 0 1 -0.5 -0.5v-13.5a0.5 0.5 0 0 1 0.5 -0.5ZM8.5 1.5h3.0a0.5 0.5 0 0 1 0.5 0.5v0.0a0.5 0.5 0 0 1 -0.5 0.5h-3.0a0.5 0.5 0 0 1 -0.5 -0.5v0.0a0.5 0.5 0 0 1 0.5 -0.5ZM8.8 21a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0Z',
      viewBox: '0 0 20 24',
      fillRule: 'evenodd'
    }
  ],
  [
    'ipad',
    {
      path: 'M3 0h14a2 2 0 0 1 2 2v20a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-20a2 2 0 0 1 2 -2ZM3.0 2.5h14.0a0.5 0.5 0 0 1 0.5 0.5v17.0a0.5 0.5 0 0 1 -0.5 0.5h-14.0a0.5 0.5 0 0 1 -0.5 -0.5v-17.0a0.5 0.5 0 0 1 0.5 -0.5ZM9.2 22.2a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0Z',
      viewBox: '0 0 20 24',
      fillRule: 'evenodd'
    }
  ],
  [
    'ipod',
    {
      path: 'M4.5 0h11a2 2 0 0 1 2 2v20a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-20a2 2 0 0 1 2 -2ZM5.1 2.5h9.8a0.6 0.6 0 0 1 0.6 0.6v6.8a0.6 0.6 0 0 1 -0.6 0.6h-9.8a0.6 0.6 0 0 1 -0.6 -0.6v-6.8a0.6 0.6 0 0 1 0.6 -0.6ZM5.8 17.3a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0 -8.4 0ZM8.6 17.3a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0Z',
      viewBox: '0 0 20 24',
      fillRule: 'evenodd'
    }
  ]
])

/** 发帖或回复的客户端来源 */
export interface ClientSourceProps {
  via?: ClientVia
}

/** 常见移动客户端以图标展示，提示保留完整客户端名称 */
export default function ClientSource({ via }: ClientSourceProps) {
  if (!via) return null

  const icon = clientIcons.get(via.toLowerCase())
  const label = `via ${via}`

  if (!icon) return <span className={styles.source}>{label}</span>

  return (
    <Tooltip content={label}>
      <span className={styles.source} tabIndex={0} aria-label={label}>
        <svg width="14" height="14" viewBox={icon.viewBox} fill="currentColor" aria-hidden="true">
          <path d={icon.path} fillRule={icon.fillRule} />
        </svg>
      </span>
    </Tooltip>
  )
}
