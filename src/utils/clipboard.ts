// ===== 可靠剪贴板复制 =====
// 优先用 Clipboard API，失败时降级为 textarea+execCommand

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  // 方案1：Clipboard API
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API 可能因非 HTTPS、权限、焦点等原因失败 → 降级
  }

  // 方案2：textarea + execCommand（传统 fallback，兼容性最好）
  return copyViaTextarea(text)
}

function copyViaTextarea(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  let success = false
  try {
    success = document.execCommand('copy')
  } catch {
    // ignore
  }

  document.body.removeChild(textarea)
  return success
}
