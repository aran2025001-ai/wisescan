interface ChatBubbleProps {
  role: 'ai' | 'user'
  content: string
  time?: string
}

export function ChatBubble({ role, content, time }: ChatBubbleProps) {
  const isAi = role === 'ai'

  return (
    <div className={`flex gap-3 px-4 py-2 ${isAi ? 'justify-start' : 'justify-end'}`}>
      {/* AI Avatar */}
      {isAi && (
        <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-[#fafafa] text-xs font-bold">
          洞察
        </div>
      )}

      {/* Bubble */}
      <div className={`max-w-[75%] ${isAi ? '' : 'order-first'}`}>
        {isAi && (
          <div className="mb-1 text-xs text-[hsl(var(--muted-foreground))] ml-1">
            明鉴·风险洞察官
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isAi
              ? 'rounded-tl-sm bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
              : 'rounded-tr-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
          }`}
        >
          {content}
        </div>
        {time && (
          <div className={`mt-1 text-xs text-[hsl(var(--muted-foreground))] ${isAi ? 'ml-1' : 'text-right mr-1'}`}>
            {time}
          </div>
        )}
      </div>

      {/* User Avatar */}
      {!isAi && (
        <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-400 text-[#fafafa] text-xs font-bold">
          我
        </div>
      )}
    </div>
  )
}
