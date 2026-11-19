import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import { Alert, Button, Dialog, OtpInput } from '@/components/ui'
import type { LoginPanelViewState } from '@extension/shared/webview'

interface TwoFactorDialogProps {
  state: NonNullable<LoginPanelViewState['twoFactor']>
  onVerify: (id: number, code: string) => Promise<void>
  onCancel: (id: number) => Promise<void>
}

/** 在登录页完成候选会话的两步验证 */
export default function TwoFactorDialog({ state, onVerify, onCancel }: TwoFactorDialogProps) {
  const formId = useId()
  const form = useRef<HTMLFormElement>(null)
  const [code, setCode] = useState('')
  const [requestError, setRequestError] = useState('')
  const { id, submitting, error } = state
  const codeLength = 6

  function firstCodeInput() {
    return form.current?.querySelector<HTMLInputElement>('input[inputmode="numeric"]')
  }

  useEffect(() => {
    if (!error) return
    setCode('')
    firstCodeInput()?.focus()
  }, [error])

  async function verify(value: string) {
    if (submitting || value.length !== codeLength) return
    setRequestError('')
    try {
      await onVerify(id, value)
    } catch (cause) {
      setRequestError((cause as Error).message)
    }
  }

  async function cancel() {
    if (submitting) return
    try {
      await onCancel(id)
    } catch (cause) {
      setRequestError((cause as Error).message)
    }
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    void verify(code)
  }

  return (
    <Dialog
      open
      className="login-two-factor-dialog"
      title="两步验证"
      description="请输入身份验证器中的 6 位验证码。"
      closeOnOverlayClick={false}
      initialFocus={firstCodeInput}
      onOpenChange={(open, details) => {
        if (open) return
        if (submitting) details.cancel()
        else void cancel()
      }}
      footer={
        <>
          <Button disabled={submitting} onClick={cancel}>
            取消
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={submitting}
            disabled={code.length !== codeLength}
          >
            验证
          </Button>
        </>
      }
    >
      <form ref={form} id={formId} className="login-two-factor-form" onSubmit={submit}>
        {(requestError || error) && (
          <Alert variant="danger" title="验证失败" description={requestError || error} />
        )}
        <OtpInput
          length={codeLength}
          value={code}
          disabled={submitting}
          invalid={Boolean(error || requestError)}
          onValueChange={setCode}
          onComplete={verify}
        />
      </form>
    </Dialog>
  )
}
