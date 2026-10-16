import { OTPField as OneTimePasswordField } from '@base-ui/react/otp-field'
import { useId } from 'react'
import { mergeClassNames } from './utils'

export interface OtpInputProps {
  /** 验证码长度 */
  length: number
  /** 当前验证码 */
  value: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否在挂载时聚焦第一个输入框 */
  autoFocus?: boolean
  /** 是否处于校验错误状态 */
  invalid?: boolean
  /** 附加类名 */
  className?: string
  /** 验证码变化回调 */
  onValueChange: (value: string) => void
  /** 填满验证码时回调 */
  onComplete?: (value: string) => void
}

/** 基于 Base UI One Time Password Field 的数字验证码输入 */
export function OtpInput({
  autoFocus = false,
  className,
  disabled = false,
  invalid = false,
  length,
  onComplete,
  onValueChange,
  value
}: OtpInputProps) {
  const labelId = useId()
  return (
    <OneTimePasswordField.Root
      className={mergeClassNames(
        'v2ex-otp',
        invalid && 'v2ex-otp--invalid',
        disabled && 'v2ex-otp--disabled',
        className
      )}
      aria-labelledby={labelId}
      length={length}
      name="code"
      value={value}
      disabled={disabled}
      validationType="numeric"
      autoComplete="one-time-code"
      onValueChange={onValueChange}
      onValueComplete={onComplete}
    >
      <span id={labelId} className="v2ex-visually-hidden">
        验证码
      </span>
      {Array.from({ length }, (_, index) => (
        <OneTimePasswordField.Input
          autoFocus={autoFocus && index === 0}
          className="v2ex-otp__input"
          inputMode="numeric"
          aria-labelledby={index === 0 ? labelId : undefined}
          aria-label={index === 0 ? undefined : `验证码第 ${index + 1} 位`}
          aria-invalid={invalid || undefined}
          key={index}
        />
      ))}
    </OneTimePasswordField.Root>
  )
}
