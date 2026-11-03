import { Autocomplete } from '@base-ui/react/autocomplete'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Textarea, type TextareaProps } from '@/components/ui/Textarea'
import { Avatar } from '@/components/ui/Avatar'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { getTextareaCaretRect } from './textareaCaret'
import { findMention, getMentionUsers, type MentionUser } from './mentions'
import styles from './ReplyComposer.module.scss'

/** 保留正文和光标位置的回复用户联想输入框 */
export default function MentionTextarea({
  users = [],
  showAvatar = false,
  value = '',
  onContentChange,
  ...props
}: Omit<TextareaProps, 'value' | 'onChange'> & {
  users?: MentionUser[]
  showAvatar?: boolean
  value?: string
  onContentChange: (value: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [range, setRange] = useState<ReturnType<typeof findMention>>(null)
  const [dismissed, setDismissed] = useState(false)
  const [composing, setComposing] = useState(false)
  const [layoutVersion, setLayoutVersion] = useState(0)
  const caretAnchor = useMemo(
    () => ({
      contextElement: textareaRef.current ?? undefined,
      getBoundingClientRect: () =>
        textareaRef.current ? getTextareaCaretRect(textareaRef.current) : new DOMRect()
    }),
    [range, value, layoutVersion]
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const observer = new ResizeObserver(() => setLayoutVersion(version => version + 1))
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [])
  const candidates = range ? getMentionUsers(users, range.query) : []
  const open = !props.disabled && !composing && !dismissed && candidates.length > 0

  function updateRange() {
    const input = textareaRef.current
    setRange(input ? findMention(input.value, input.selectionStart, input.selectionEnd) : null)
  }

  function selectUser(name: string) {
    if (!range) return
    const after = value.slice(range.end)
    const inserted = `@${name}${/^\s/.test(after) ? '' : ' '}`
    const next = value.slice(0, range.start) + inserted + after
    if (props.maxLength != null && next.length > props.maxLength) return
    onContentChange(next)
    setDismissed(true)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      const cursor = range.start + inserted.length
      textareaRef.current?.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <Autocomplete.Root
      items={candidates}
      itemToStringValue={user => user.name}
      mode="none"
      value={value}
      open={open}
      autoHighlight="always"
      onOpenChange={next => {
        if (!next) setDismissed(true)
      }}
      onValueChange={(next, details) => {
        if (details.reason === 'item-press' || details.reason === 'escape-key') return
        onContentChange(next)
        setDismissed(false)
        updateRange()
      }}
    >
      <Autocomplete.Input
        render={<Textarea {...props} ref={textareaRef} />}
        onSelect={updateRange}
        onScroll={() => setLayoutVersion(version => version + 1)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => {
          setComposing(false)
          updateRange()
        }}
        onKeyDown={event => {
          // 联想仅接管候选导航；保留多行文本编辑和表单已有的快捷键
          if (
            !open ||
            event.nativeEvent.isComposing ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey ||
            !['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(event.key)
          ) {
            event.preventBaseUIHandler()
          }
        }}
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner
          className="v2ex-floating-positioner"
          anchor={caretAnchor}
          align="start"
          sideOffset={4}
          collisionPadding={8}
        >
          <Autocomplete.Popup className={`v2ex-popover ${styles.mentionPopup}`}>
            <ScrollArea className={styles.mentionScroll}>
              <Autocomplete.List aria-label="当前话题用户">
                {user => (
                  <Autocomplete.Item
                    className={styles.mentionItem}
                    key={user.name}
                    value={user}
                    onClick={() => selectUser(user.name)}
                  >
                    {showAvatar && (
                      <Avatar src={user.avatar} size="small" shape="square" aria-hidden="true" />
                    )}
                    <span>{user.name}</span>
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </ScrollArea>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  )
}
