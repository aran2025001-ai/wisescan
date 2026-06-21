/**
 * ShareProjectDrawer — 项目情报分享抽屉组件
 * 
 * 功能：点击"分享项目情报" → 展示 ShareCard 全屏预览 → 底部抽屉弹窗 → 保存/分享到社交渠道
 * 
 * 设计：与邀请分享 ShareButton 保持一致的抽屉风格（线性渐变背景、圆角顶部、拖拽条、渠道图标）
 * 技术：html2canvas 将 ShareCard 截图生成 PNG，供保存和分享
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import html2canvas from 'html2canvas'
import { QRCodeSVG } from 'qrcode.react'
import { ShareCard } from './ShareCard'

// ============================================================
// Props 类型定义
// ============================================================

interface ShareProjectDrawerProps {
  /** 项目名称 */
  projectName: string
  /** 合约地址 */
  contractAddress: string
  /** TOP10 持仓占比 */
  top10Holding: number
  /** 风险等级描述 */
  riskLevel: string
  /** 风险等级颜色 */
  riskColor?: 'red' | 'orange' | 'yellow' | 'green'
  /** 信息完整性百分比 */
  infoCompleteness: number
  /** 信息完整性等级 */
  completenessLevel: string
  /** 点评内容 */
  review: string
  /** 自定义触发元素（替代默认按钮） */
  trigger?: React.ReactNode
  /** 按钮文案 */
  label?: string
  /** 按钮额外类名 */
  className?: string
  /** 邀请码（用于生成二维码链接） */
  inviteCode?: string
}

// ============================================================
// 分享渠道配置
// ============================================================

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
    id: 'bluetooth',
    label: '蓝牙',
    iconBg: '#0078D7',
    iconUrl: 'https://cdn.simpleicons.org/bluetooth/ffffff',
  },
  {
    id: 'more',
    label: '更多',
    iconBg: '#6B7280',
    iconSvg: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff">
        <circle cx="12" cy="5" r="2"/>
        <circle cx="12" cy="12" r="2"/>
        <circle cx="12" cy="19" r="2"/>
      </svg>
    ),
  },
]

const Actions = [
  {
    id: 'save',
    label: '保存',
    iconBg: '#F0F0F0',
    iconSvg: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
    ),
  },
  {
    id: 'close',
    label: '取消',
    iconBg: '#F0F0F0',
    iconSvg: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
  },
]

// ============================================================
// 主组件
// ============================================================

export default function ShareProjectDrawer({
  projectName,
  contractAddress,
  top10Holding,
  riskLevel,
  riskColor = 'red',
  infoCompleteness,
  completenessLevel,
  review,
  trigger,
  label = '分享项目情报',
  className = '',
  inviteCode,
}: ShareProjectDrawerProps) {
  // ── 状态 ──
  const [showPreview, setShowPreview] = useState(false)   // 全屏预览
  const [showSheet, setShowSheet] = useState(false)       // 底部抽屉
  const [capturedSrc, setCapturedSrc] = useState<string>('')  // 截图后的 PNG dataURL
  const [toast, setToast] = useState('')
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; channel: string }>({ open: false, channel: '' })
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const cardRef = useRef<HTMLDivElement>(null)  // 引用 ShareCard DOM 元素
  const captureAttempted = useRef(false)        // 防止重复截图

  // ── Toast 自动消失 ──
  useEffect(() => {
    if (toast) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setToast(''), 2000)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast])

  // ── 基础 URL ──
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://wisescan.xyz'
  const qrUrl = `${baseUrl}/library?address=${contractAddress}`

  // ── 分享文案 ──
  const shareText = useMemo(() =>
    `🔍 明鉴 WiseScan — 项目安全评估报告\n项目：${projectName}\n合约：${contractAddress}\nTOP10持仓占比：${top10Holding}%\n风险评级：${riskLevel}\n信息完整性：${infoCompleteness}%\n\n${qrUrl}`,
    [projectName, contractAddress, top10Holding, riskLevel, infoCompleteness, qrUrl]
  )

  // ── 截图函数：将 ShareCard 转为 PNG dataURL ──
  const captureCard = useCallback(async () => {
    if (!cardRef.current) return
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,                     // 2x 高清
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: 375,
        height: 700,
      })
      const dataUrl = canvas.toDataURL('image/png')
      setCapturedSrc(dataUrl)
      captureAttempted.current = true
    } catch (e) {
      console.warn('[ShareProjectDrawer] html2canvas failed:', e)
    }
  }, [])

  // ── 预览打开时触发截图 ──
  useEffect(() => {
    if (showPreview && !captureAttempted.current) {
      // 等 ShareCard 渲染完成再截图
      setTimeout(() => captureCard(), 300)
    }
  }, [showPreview, captureCard])

  // ── 打开抽屉时重新截图 ──
  useEffect(() => {
    if (showSheet) {
      captureAttempted.current = false
      setTimeout(() => captureCard(), 200)
    }
  }, [showSheet, captureCard])

  // ── 数据变化时重新截图（防止缓存数据覆盖新数据）──
  useEffect(() => {
    if (showPreview) {
      captureAttempted.current = false
      setTimeout(() => captureCard(), 150)
    }
  }, [showPreview, review, top10Holding, riskLevel, infoCompleteness])

  // ── 复制文本 ──
  const doCopy = useCallback((text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {})
    } else {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }, [])

  // ── 保存图片 ──
  const saveImage = useCallback(async (): Promise<boolean> => {
    const src = capturedSrc || ''
    if (!src) { setToast('图片尚未生成，请稍后重试'); return false }
    try {
      const resp = await fetch(src)
      const blob = await resp.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `明鉴-${projectName || '项目情报'}-${contractAddress.slice(0, 8)}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setToast('✅ 图片已保存')
      return true
    } catch (e) {
      console.warn('[ShareProjectDrawer] saveImage failed:', e)
      setToast('图片保存失败，请重试')
      return false
    }
  }, [capturedSrc, projectName, contractAddress])

  // ── 核心分享逻辑 ──
  const doShare = useCallback(async (method: string) => {
    setShowSheet(false)

    try {
      switch (method) {
        // 保存图片
        case 'save': {
          await saveImage()
          return
        }

        // 蓝牙 / 系统分享
        case 'bluetooth': {
          const src = capturedSrc || ''
          if (!src) { setToast('图片尚未生成，请稍后重试'); return }
          const resp = await fetch(src)
          const blob = await resp.blob()
          const file = new File([blob], `明鉴-${projectName || '项目情报'}.png`, { type: 'image/png' })
          if (navigator.share && navigator.canShare?.({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: `明鉴 WiseScan - ${projectName}` })
              setToast('✅ 分享成功！')
              return
            } catch { /* 用户取消 */ }
          }
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = `明鉴-${projectName || '项目情报'}.png`
          document.body.appendChild(a); a.click(); document.body.removeChild(a)
          setToast('图片已保存，可通过蓝牙发送至附近设备')
          return
        }

        // 更多（Web Share API）
        case 'more': {
          if (navigator.share) {
            try {
              await navigator.share({ title: `明鉴 WiseScan - ${projectName}`, text: shareText, url: qrUrl })
              setToast('✅ 分享成功！')
              return
            } catch { /* 用户取消 */ }
          }
          doCopy(shareText)
          setToast('📋 文案已复制！')
          return
        }

        default:
          return
      }
    } catch (e) {
      console.warn('[ShareProjectDrawer] share error:', e)
      setToast('分享失败，请重试')
    }
  }, [projectName, contractAddress, capturedSrc, shareText, qrUrl, doCopy, saveImage])

  // ── 渠道点击 ──
  const handleChannelClick = useCallback((channelId: string) => {
    if (channelId === 'wechat' || channelId === 'qq' || channelId === 'whatsapp' || channelId === 'telegram') {
      setConfirmModal({ open: true, channel: channelId })
      setShowSheet(false)
    } else {
      doShare(channelId)
    }
  }, [doShare])

  const handleConfirmOk = useCallback(async () => {
    const ch = confirmModal.channel
    setConfirmModal({ open: false, channel: '' })
    // 先保存图片，成功后再跳转
    const saved = await saveImage()
    if (!saved) return
    if (ch === 'wechat') {
      try { window.location.href = 'weixin://' } catch {}
      setToast('正在打开微信...')
    } else if (ch === 'qq') {
      try { window.location.href = 'mqqapi://' } catch {}
      setToast('正在打开QQ...')
    } else if (ch === 'whatsapp') {
      window.open('https://wa.me/', '_blank', 'noopener,noreferrer')
      setToast('正在打开 WhatsApp...')
    } else if (ch === 'telegram') {
      window.open('https://t.me/', '_blank', 'noopener,noreferrer')
      setToast('正在打开 Telegram...')
    }
  }, [confirmModal.channel, saveImage])

  const closeAll = () => {
    setShowPreview(false)
    setShowSheet(false)
  }

  // ── 触发按钮点击 ──
  const handleClick = () => {
    captureAttempted.current = false
    setShowPreview(true)
  }

  const cardProps = {
    projectName,
    contractAddress,
    top10Holding,
    riskLevel,
    riskColor,
    infoCompleteness,
    completenessLevel,
    review,
    qrCodeUrl: qrUrl,
    width: 375,
  }

  // 确认弹窗渠道颜色 & 标签
  const channelLabel: Record<string, string> = { wechat: '微信', qq: 'QQ', whatsapp: 'WhatsApp', telegram: 'Telegram' }
  const channelColor: Record<string, string> = { wechat: '#07C160', qq: '#12B7F5', whatsapp: '#25D366', telegram: '#0088CC' }

  return (
    <>
      {/* ── 触发按钮 ── */}
      {trigger ? (
        <div onClick={handleClick} style={{ cursor: 'pointer' }}>
          {trigger}
        </div>
      ) : (
        <button onClick={handleClick} className={className}>
          {label}
        </button>
      )}

      {/* ══════ 状态1：全屏 ShareCard 预览 ══════ */}
      {showPreview && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
          <div className="relative" style={{ width: '85vw', maxWidth: 375 }}>
            {/* ShareCard 渲染区（用于 html2canvas 截图） */}
            <div ref={cardRef} className="rounded-2xl overflow-hidden shadow-2xl">
              <ShareCard {...cardProps} />
            </div>

            {/* 顶部返回按钮 */}
            <button onClick={closeAll}
              className="absolute flex items-center justify-center rounded-full"
              style={{ top: '2%', left: '2%', width: 36, height: 36, background: 'rgba(0,0,0,0.3)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            {/* 右上角分享按钮 → 打开抽屉 */}
            <button onClick={() => setShowSheet(true)}
              className="absolute flex items-center justify-center rounded-full"
              style={{ top: '2%', right: '2%', width: 36, height: 36, background: 'rgba(0,0,0,0.3)' }}>
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

      {/* ══════ 状态2：底部分享抽屉 ══════ */}
      {showSheet && createPortal(
        <div className="fixed inset-0 z-[99999]" onClick={() => setShowSheet(false)}>
          <div className="absolute inset-0 bg-black/50"/>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pt-3 pb-6 animate-slide-up"
            style={{ background: 'linear-gradient(180deg,#F0F4FC 0%,#E4ECFA 100%)', maxWidth: 430, margin: '0 auto' }}
            onClick={e => e.stopPropagation()}>

            {/* 拖拽条 */}
            <div className="w-10 h-1 mx-auto mb-4 rounded-full opacity-40" style={{ background: '#8899AA' }}/>

            {/* 文件信息 + ShareCard 缩略图 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-5">
              <div className="text-sm font-semibold text-gray-800">
                明鉴-{projectName || '项目情报'}.png
              </div>
              <div className="text-xs text-gray-400 mt-0.5">项目安全评估分享卡片</div>
              <div className="flex justify-center mt-3">
                <div className="rounded-xl overflow-hidden shadow-md" style={{ width: 150, height: 280 }}>
                  {capturedSrc ? (
                    <img src={capturedSrc} alt={`${projectName} 情报卡片`}
                      className="w-full h-full object-cover"/>
                  ) : (
                    <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                      <span className="text-blue-400 text-xs">生成中...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 分享渠道 */}
            <div className="flex justify-around items-start px-1 mb-4">
              {Channels.map(ch => (
                <button key={ch.id} onClick={() => handleChannelClick(ch.id)}
                  className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
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
                  <span className="text-[11px] text-gray-600 mt-0.5">{ch.label}</span>
                </button>
              ))}
            </div>

            {/* 底部操作 */}
            <div className="flex justify-around pt-3 pb-1" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              {Actions.map(act => (
                <button key={act.id}
                  onClick={() => act.id === 'close' ? setShowSheet(false) : doShare(act.id)}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                    style={{ width: 48, height: 48, background: act.iconBg }}>
                    {act.iconSvg}
                  </div>
                  <span className="text-xs text-gray-500">{act.label}</span>
                </button>
              ))}
            </div>

            <div className="h-2"/>
          </div>
        </div>,
        document.body
      )}

      {/* ════ 确认弹窗（微信/QQ/WhatsApp/Telegram）════ */}
      {confirmModal.open && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center" onClick={() => setConfirmModal({ open: false, channel: '' })}>
          <div className="absolute inset-0 bg-black/50"/>
          <div className="relative bg-white rounded-2xl w-[85vw] max-w-xs p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: channelColor[confirmModal.channel] || '#6B7280' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div className="text-base font-semibold text-gray-800 mb-2">
              分享到{channelLabel[confirmModal.channel] || confirmModal.channel}
            </div>
            <div className="text-sm text-gray-500 leading-relaxed mb-5">
              保存该项目评估海报，请在弹出的{channelLabel[confirmModal.channel] || confirmModal.channel}中选择好友并从相册分享该图片
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ open: false, channel: '' })}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={handleConfirmOk}
                className="flex-1 h-11 rounded-xl text-white text-sm font-semibold transition-colors active:scale-[0.97]"
                style={{ background: channelColor[confirmModal.channel] || '#6B7280' }}>
                确定
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast 提示 */}
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
