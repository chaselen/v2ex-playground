import { forwardRef, type SVGProps } from 'react'

/** 箭头伸出浮层的高度；Base UI 定位偏移需显式包含这部分空间 */
export const FLOATING_ARROW_HEIGHT = 6

/** 浮层箭头形状：填充三角形仅为两条外露斜边描边 */
export const FloatingArrow = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  function FloatingArrow(props, ref) {
    return (
      <svg {...props} ref={ref} aria-hidden="true">
        <path className="v2ex-floating-arrow__fill" d="M0 0h18L9 6Z" />
        <path className="v2ex-floating-arrow__border" d="M0 0 9 6 18 0" />
      </svg>
    )
  }
)
