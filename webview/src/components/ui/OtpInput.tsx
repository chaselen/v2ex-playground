import { unstable_OneTimePasswordField as OneTimePasswordField } from 'radix-ui'
import { mergeClassNames } from './utils'

export interface OtpInputProps {
  /** 验证码长度 */
  length: number
  /** 当前验证码 */
  value: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否处于校验错误状态 */
  invalid?: boolean
  /** 附加类名 */
  className?: string
  /** 验证码变化回调 */
  onValueChange: (value: string) => void
  /** 填满验证码时回调 */
  onComplete?: (value: string) => void
}

/** 基于 Radix One Time Password Field 的数字验证码输入 */
export function OtpInput({
  className,
  disabled = false,
  invalid = false,
  length,
  onComplete,
  onValueChange,
  value
}: OtpInputProps) {
  function updateValue(nextValue: string) {
    onValueChange(nextValue)
    if (nextValue.length === length) {
      onComplete?.(nextValue)
    }
  }

  return (
    <OneTimePasswordField.Root
      className={mergeClassNames(
        'v2ex-otp',
        invalid && 'v2ex-otp--invalid',
        disabled && 'v2ex-otp--disabled',
        className
      )}
      value={value}
      disabled={disabled}
      validationType="numeric"
      autoComplete="one-time-code"
      onValueChange={updateValue}
    >
      {Array.from({ length }, (_, index) => (
        <OneTimePasswordField.Input
          className="v2ex-otp__input"
          index={index}
          inputMode="numeric"
          aria-label={`验证码第 ${index + 1} 位`}
          aria-invalid={invalid || undefined}
          key={index}
        />
      ))}
      <OneTimePasswordField.HiddenInput name="code" />
    </OneTimePasswordField.Root>
  )
}
