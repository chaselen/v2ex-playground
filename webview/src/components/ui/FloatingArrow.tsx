import { forwardRef, type SVGProps } from 'react'

/** 浮层箭头形状：填充三角形仅为两条外露斜边描边 */
export const FloatingArrow = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  function FloatingArrow(props, ref) {
    return (
      <svg {...props} ref={ref} aria-hidden="true">
        <path className="v2ex-floating-arrow__fill" d="M0 0h30L15 10Z" />
        <path className="v2ex-floating-arrow__border" d="M0 0 15 10 30 0" />
      </svg>
    )
  }
)
