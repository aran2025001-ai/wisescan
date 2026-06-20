import { useState, useRef } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  placeholder?: string
}

export function ChatInput({ onSend, placeholder = '输入项目名称或合约地址...' }: ChatInputProps) {
  const [text, setText] = useState('')
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleVoiceDown = () => {
    setIsRecording(true)
  }

  const handleVoiceUp = () => {
    if (isRecording) {
      setIsRecording(false)
      // Voice recognition will be implemented later
    }
  }

  return (
    <div className="flex items-center gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2">
      {!isVoiceMode ? (
        <>
          {/* 左侧：语音按钮（微信风格麦克风图标） */}
          <button
            onClick={() => setIsVoiceMode(true)}
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            aria-label="切换语音输入"
          >
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor">
              <path d="M512 736c-88.4 0-160-71.6-160-160V320c0-88.4 71.6-160 160-160s160 71.6 160 160v256c0 88.4-71.6 160-160 160z m0-416c-47.4 0-86.2 35.4-93.4 80h186.8c-7.2-44.6-46-80-93.4-80z" />
              <path d="M736 480h-53c0 94.4-76.6 171-171 171s-171-76.6-171-171h-53c0 116.8 89.6 212.8 202 222.2V736h-106c-16.6 0-30 13.4-30 30s13.4 30 30 30h266c16.6 0 30-13.4 30-30s-13.4-30-30-30H554v-33.8c112.4-9.4 202-105.4 202-222.2z" />
            </svg>
          </button>

          {/* 中间：文字输入框 */}
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 h-9 rounded-md bg-transparent px-1 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:outline-none"
            autoFocus
          />

          {/* 右侧：发送按钮（微信风格，显示文字"发送"） */}
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="flex-shrink-0 inline-flex items-center justify-center h-8 px-4 rounded text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </>
      ) : (
        <>
          {/* 左侧：键盘图标（切换回文字输入） */}
          <button
            onClick={() => setIsVoiceMode(false)}
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            aria-label="切换文字输入"
          >
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor">
              <path d="M896 736H128c-17.7 0-32 14.3-32 32v32c0 17.7 14.3 32 32 32h768c17.7 0 32-14.3 32-32v-32c0-17.7-14.3-32-32-32zM352 576h-64c-17.7 0-32 14.3-32 32v32c0 17.7 14.3 32 32 32h64c17.7 0 32-14.3 32-32v-32c0-17.7-14.3-32-32-32z m128 0h-64c-17.7 0-32 14.3-32 32v32c0 17.7 14.3 32 32 32h64c17.7 0 32-14.3 32-32v-32c0-17.7-14.3-32-32-32z m128 0h-64c-17.7 0-32 14.3-32 32v32c0 17.7 14.3 32 32 32h64c17.7 0 32-14.3 32-32v-32c0-17.7-14.3-32-32-32z m128 0h-64c-17.7 0-32 14.3-32 32v32c0 17.7 14.3 32 32 32h64c17.7 0 32-14.3 32-32v-32c0-17.7-14.3-32-32-32zM288 576h64c17.7 0 32-14.3 32-32v-32c0-17.7-14.3-32-32-32h-64c-17.7 0-32 14.3-32 32v32c0 17.7 14.3 32 32 32z" />
            </svg>
          </button>

          {/* 中间：按住说话按钮 */}
          <button
            onMouseDown={handleVoiceDown}
            onMouseUp={handleVoiceUp}
            onMouseLeave={handleVoiceUp}
            onTouchStart={handleVoiceDown}
            onTouchEnd={handleVoiceUp}
            className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors select-none ${
              isRecording
                ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
            }`}
          >
            {isRecording ? '松手发送' : '按住说话'}
          </button>

          {/* 右侧：占位（保持对齐） */}
          <div className="flex-shrink-0 w-[52px]" />
        </>
      )}
    </div>
  )
}
