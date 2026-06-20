/**
 * 证据标签解析与渲染工具
 * 阶段三：将 AI 生成的 【社区验证】/【用户反映】/【用户提供，待核实】 标记渲染为彩色标签
 * 阶段四：新增 【用户提到】/【未验证】/(待验证) 标记支持
 */

import type { JSX } from "react"

// 标签配置
const EVIDENCE_TAGS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  "【社区验证】": { label: "✅ 社区验证", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  "【用户反映】": { label: "🟡 用户反映", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  "【用户提供，待核实】": { label: "⚪ 待核实", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/30" },
  // 阶段四新增：对话中引用的证据标记
  "【用户提到】": { label: "⚪ 用户提到", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/30" },
  "(待验证)": { label: "待验证", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/30" },
}
const EVIDENCE_TAG_PATTERN = /【(社区验证|用户反映|用户提供，待核实|用户提到)】|\(待验证\)/g

/** 解析文本中的证据标签，返回包含标签和普通文本的片段数组 */
export function parseEvidenceTags(text: string): Array<{ type: 'tag' | 'text'; value: string }> {
  const parts: Array<{ type: 'tag' | 'text'; value: string }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const regex = new RegExp(EVIDENCE_TAG_PATTERN)
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'tag', value: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return parts
}

/** 渲染包含证据标签的文本，将标签替换为彩色徽章 */
export function renderEvidenceTaggedText(text: string, textClass = "text-xs"): JSX.Element {
  if (!text) return <span className={textClass}>{text}</span>
  const parts = parseEvidenceTags(text)
  if (parts.length === 0) return <span className={textClass}>{text}</span>
  return (
    <span className={textClass}>
      {parts.map((part, i) => {
        if (part.type === 'tag') {
          const tag = EVIDENCE_TAGS[part.value]
          if (tag) {
            return (
              <span key={i} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${tag.color} ${tag.bg} border ${tag.border} mx-0.5 align-middle`}>
                {tag.label}
              </span>
            )
          }
          return <span key={i}>{part.value}</span>
        }
        return <span key={i}>{part.value}</span>
      })}
    </span>
  )
}
