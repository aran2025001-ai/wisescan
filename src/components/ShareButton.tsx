import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'

interface ShareButtonProps {
  inviteCode?: string
  label?: string
  className?: string
  /** 自定义触发元素（替代默认按钮），点击后弹出海报预览 */
  trigger?: React.ReactNode
}

/** 加载图片为 HTMLImageElement（Promise 化） */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * 生成带二维码的合成缩略图（canvas 合成）
 * poster + qrCode → dataURL
 */
async function generateCompositeThumbnail(
  posterSrc: string,
  qrDataUrl: string,
  containerW = 375,
  containerH = 667,
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = containerW
  canvas.height = containerH
  const ctx = canvas.getContext('2d')!
  // 1. 画海报背景
  const posterImg = await loadImage(posterSrc)
  ctx.drawImage(posterImg, 0, 0, containerW, containerH)
  // 2. 画二维码（位置和预览页完全一致）
  // left:6%, bottom:5.5%, width:14.5%
  const qrW = containerW * 0.145
  const qrH = qrW
  const qrX = containerW * 0.06
  const qrY = containerH * (1 - 0.055) - qrH   // bottom:5.5% 折算为 top 坐标
  const qrImg = await loadImage(qrDataUrl)
  ctx.drawImage(qrImg, qrX, qrY, qrW, qrH)
  return canvas.toDataURL('image/png')
}

/** 分享渠道 —— 使用 simple-icons CDN 真实 APP 图标 */
const Channels = [
  {
    id: 'wechat',
    label: '微信',
    iconBg: '#07C160',
    iconUrl: 'https://cdn.simpleicons.org/wechat/ffffff',
  },
  {
    id: 'qq',
    label: 'QQ',
    iconBg: '#12B7F5',
    iconUrl: 'https://cdn.simpleicons.org/qq/ffffff',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    iconBg: '#25D366',
    iconUrl: 'https://cdn.simpleicons.org/whatsapp/ffffff',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    iconBg: '#0088CC',
    iconUrl: 'https://cdn.simpleicons.org/telegram/ffffff',
  },
  {
    id: 'more',
    label: '更多',
    iconBg: '#6B7280',
    // simple-icons 没有适合"更多"的图标，用内联 SVG（三个点）
    iconSvg: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff">
        <circle cx="12" cy="5" r="2"/>
        <circle cx="12" cy="12" r="2"/>
        <circle cx="12" cy="19" r="2"/>
      </svg>
    ),
  },
]

export default function ShareButton({ inviteCode, label, className = '', trigger }: ShareButtonProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [toast, setToast] = useState('')
  const [thumbnailSrc, setThumbnailSrc] = useState<string>('')
  // 确认弹窗状态：{ open: 是否显示, channel: 当前渠道 }
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; channel: string }>({ open: false, channel: '' })
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (toast) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setToast(''), 2000)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast])

  // 动态生成 baseUrl（开发环境 = localhost:5173，生产环境 = 实际域名）
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://wisescan.xyz'
  
  // 生成二维码
  useEffect(() => {
    if (!showPreview) return
    const content = `${baseUrl}/invite?code=${inviteCode || 'ABC123'}`
    QRCode.toDataURL(content, { width: 100, margin: 2, color: { dark: '#222', light: '#fff' } })
      .then(url => setQrDataUrl(url))
  }, [showPreview, inviteCode])

  // 打开抽屉时 → 生成带二维码的合成缩略图
  useEffect(() => {
    if (!showSheet) return
    if (!qrDataUrl) {
      // 还没生成二维码时，先用原始海报
      setThumbnailSrc('/share-poster.png')
      return
    }
    generateCompositeThumbnail('/share-poster.png', qrDataUrl)
      .then(dataUrl => setThumbnailSrc(dataUrl))
      .catch(() => setThumbnailSrc('/share-poster.png'))
  }, [showSheet, qrDataUrl])

  /** 构建分享文案 */
  const shareText = useMemo(() =>
    `明鉴WiseScan — 守护你的每一次投资决策\n项目风险评估、商业模式拆解，让你和专家一对一详聊项目细节。\n用Web3浏览器打开链接（如TP钱包等）：\n${baseUrl}/invite?code=${inviteCode || 'ABC123'}`,
  [inviteCode, baseUrl])
  const shareUrl = useMemo(() =>
    `${baseUrl}/invite?code=${inviteCode || 'ABC123'}`,
  [inviteCode, baseUrl])

  const handleClick = () => setShowPreview(true)

  /** 复制文本到剪贴板 */
  const doCopy = useCallback((text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {})
    } else {
      // fallback：用 textarea 方式复制
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }, [])

  /** 核心分享逻辑 — 每个渠道独立处理 */
  const doShare = useCallback(async (method: string) => {
    setShowSheet(false)

    try {
      switch (method) {
        // ── 1. 微信（复制文案 + 引导提示）──
        case 'wechat': {
          doCopy(shareText)
          setToast('📋 已复制！请打开微信\n选择聊天对象后粘贴发送')
          return
        }

        // ── 3. QQ（同上）──
        case 'qq': {
          doCopy(shareText)
          setToast('📋 已复制！请打开QQ\n选择好友后粘贴发送')
          return
        }

        // ── 4. WhatsApp ──
        case 'whatsapp': {
          // 直接打开 WhatsApp 网页版分享（PC/手机通用）
          const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`
          window.open(waUrl, '_blank', 'noopener,noreferrer')
          setToast('正在打开 WhatsApp...')
          return
        }

        // ── 5. Telegram ──
        case 'telegram': {
          // Telegram 官方分享链接（直接打开TG）
          const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
          window.open(tgUrl, '_blank', 'noopener,noreferrer')
          setToast('正在打开 Telegram...')
          return
        }

        // ── 5. 更多（Web Share API 纯文案分享）──
        case 'more': {
          if (navigator.share) {
            try {
              await navigator.share({ title: '明鉴 WiseScan', text: shareText, url: shareUrl })
              setToast('✅ 分享成功！')
              return
            } catch { /* 用户取消 → 降级 */ }
          }
          // 不支持 → 复制 + 下载
          doCopy(shareText)
          setToast('📋 文案已复制！图片将自动保存')
          const src = thumbnailSrc || '/share-poster.png'
          try {
            const bgResp = await fetch(src)
            const bgBlob = await bgResp.blob()
            const a = document.createElement('a')
            a.href = URL.createObjectURL(bgBlob)
            a.download = `明鉴-邀请卡片-${inviteCode || 'share'}.png`
            document.body.appendChild(a); a.click(); document.body.removeChild(a)
          } catch {}
          return
        }

        default:
          return
      }
    } catch (e) {
      console.warn('[Share] channel error:', e)
      setToast('分享失败，请重试')
    }
  }, [inviteCode, shareText, shareUrl, thumbnailSrc, doCopy])

  /** 渠道点击：微信/QQ 先出确认弹窗，其他渠道直接分享 */
  const handleChannelClick = useCallback((channelId: string) => {
    if (channelId === 'wechat' || channelId === 'qq') {
      doCopy(shareText)
      setConfirmModal({ open: true, channel: channelId })
      setShowSheet(false)
    } else {
      doShare(channelId)
    }
  }, [shareText, doCopy, doShare])

  /** 确认弹窗「确定」：关闭弹窗 + 打开对应 APP */
  const handleConfirmOk = useCallback(() => {
    const ch = confirmModal.channel
    setConfirmModal({ open: false, channel: '' })
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (ch === 'wechat') {
      if (isMobile) {
        // 手机端：尝试多种方式唤起微信
        try { window.location.href = 'weixin://'; setToast('📋 文案已复制！正在打开微信...\n如未唤起请手动打开微信粘贴'); return } catch {}
        // Android Intent fallback
        try { window.location.href = 'intent://#Intent;scheme=weixin;package=com.tencent.mm;end'; return } catch {}
        // 最终降级
        setToast('📋 文案已复制！\n请打开微信选择好友后粘贴发送')
      } else {
        try { window.location.href = 'weixin://' } catch {}
        setToast('正在打开微信...')
      }
    } else if (ch === 'qq') {
      if (isMobile) {
        try { window.location.href = 'mqqapi://'; setToast('📋 文案已复制！正在打开QQ...\n如未唤起请手动打开QQ粘贴'); return } catch {}
        try { window.location.href = 'intent://#Intent;scheme=mqqapi;package=com.mobile.qq;end'; return } catch {}
        setToast('📋 文案已复制！\n请打开QQ选择好友后粘贴发送')
      } else {
        try { window.location.href = 'mqqapi://' } catch {}
        setToast('正在打开QQ...')
      }
    }
  }, [confirmModal.channel])

  const closeAll = () => {
    setShowPreview(false)
    setShowSheet(false)
  }

  return (
    <>
      {trigger ? (
        <div onClick={handleClick} style={{ cursor: 'pointer' }}>
          {trigger}
        </div>
      ) : (
        <button onClick={handleClick} className={className}>
          {label || <span>邀请卡片</span>}
        </button>
      )}

      {/* ══════ 状态1：手机屏幕海报预览 ══════ */}
      {showPreview && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
          <div className="relative" style={{ width: '85vw', maxWidth: 375, aspectRatio: '375/667' }}>
            <img src="/share-poster.png" alt="邀请卡片" className="w-full h-full object-contain rounded-2xl"/>

            {/* 二维码：精确覆盖左下角白色圆角区域 */}
            {qrDataUrl && (
              <div className="absolute"
                style={{ left: '6%', bottom: '5.5%', width: '14.5%', aspectRatio: '1/1' }}>
                <img src={qrDataUrl} alt="二维码" className="w-full h-full block"/>
              </div>
            )}

            {/* 左上角：返回 */}
            <button onClick={closeAll}
              className="absolute flex items-center justify-center rounded-full"
              style={{ top: '3%', left: '3%', width: 36, height: 36, background: 'rgba(255,255,255,0.2)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            {/* 右上角：分享 → 打开抽屉 */}
            <button onClick={() => setShowSheet(true)}
              className="absolute flex items-center justify-center rounded-full"
              style={{ top: '3%', right: '3%', width: 36, height: 36, background: 'rgba(255,255,255,0.2)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ══════ 状态2：底部分享抽屉（仿 TP 钱包）══════ */}
      {showSheet && createPortal(
        <div className="fixed inset-0 z-[99999]" onClick={() => setShowSheet(false)}>
          <div className="absolute inset-0 bg-black/50"/>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pt-3 pb-6 animate-slide-up"
            style={{ background: 'linear-gradient(180deg,#F0F4FC 0%,#E4ECFA 100%)', maxWidth: 430, margin: '0 auto' }}
            onClick={e => e.stopPropagation()}>

            {/* 拖拽条 */}
            <div className="w-10 h-1 mx-auto mb-4 rounded-full opacity-40" style={{ background: '#8899AA' }}/>

            {/* 文件信息 + 缩略图（实时合成，含二维码） */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-5">
              <div className="text-sm font-semibold text-gray-800">
                明鉴邀请卡片-{inviteCode || 'share'}.png
              </div>
              <div className="text-xs text-gray-400 mt-0.5">约 2.00 MB</div>
              {/* 缩略图：使用合成图（海报+二维码） */}
              <div className="flex justify-center mt-3">
                <div className="rounded-xl overflow-hidden shadow-md" style={{ width: 150, height: 267 }}>
                  <img src={thumbnailSrc || '/share-poster.png'} alt="预览"
                    className="w-full h-full object-cover"/>
                </div>
              </div>
            </div>

            {/* 分享渠道（真实 APP 图标，6个用 justify-around 更紧凑） */}
            <div className="flex justify-around items-start px-1 mb-4">
              {Channels.map(ch => (
                <button key={ch.id} onClick={() => handleChannelClick(ch.id)}
                  className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
                  {/* 圆角方形 APP 图标（6个图标缩小到 44x44） */}
                  <div className="rounded-xl flex items-center justify-center overflow-hidden shadow-sm"
                    style={{ width: 44, height: 44, background: ch.iconBg }}>
                    {'iconSvg' in ch ? (
                      ch.iconSvg
                    ) : (
                      <img src={ch.iconUrl} alt={ch.label}
                        style={{ width: 26, height: 26 }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}/>
                    )}
                  </div>
                  <span className="text-[13px] text-gray-600 mt-0.5">{ch.label}</span>
                </button>
              ))}
            </div>

            <div className="h-2"/>
          </div>
        </div>,
        document.body
      )}

      {/* ════ 确认弹窗（微信/QQ）════ */}
      {confirmModal.open && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center" onClick={() => setConfirmModal({ open: false, channel: '' })}>
          {/* 遮罩 */}
          <div className="absolute inset-0 bg-black/50"/>
          {/* 弹窗卡片 */}
          <div className="relative bg-white rounded-2xl w-[85vw] max-w-xs p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* 图标 */}
            <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: confirmModal.channel === 'wechat' ? '#07C160' : '#12B7F5' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            {/* 标题 */}
            <div className="text-base font-semibold text-gray-800 mb-2">
              分享到{confirmModal.channel === 'wechat' ? '微信' : 'QQ'}
            </div>
            {/* 说明文字 */}
            <div className="text-sm text-gray-500 leading-relaxed mb-5">
              分享文案已复制，请在弹出的{confirmModal.channel === 'wechat' ? '微信' : 'QQ'}中选择好友并粘贴发送
            </div>
            {/* 按钮组 */}
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ open: false, channel: '' })}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={handleConfirmOk}
                className="flex-1 h-11 rounded-xl text-white text-sm font-semibold transition-colors active:scale-[0.97]"
                style={{ background: confirmModal.channel === 'wechat' ? '#07C160' : '#12B7F5' }}>
                确定
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast */}
      {toast && createPortal(
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[999999] pointer-events-none">
          <div className="bg-black/80 backdrop-blur rounded-xl px-6 py-4 text-center">
            <svg className="w-7 h-7 text-green-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            <div className="text-white text-sm whitespace-pre-line text-center leading-relaxed">{toast}</div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </>
  )
}
