import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Share2 } from 'lucide-react'
import QRCode from 'qrcode'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function InviteLanding() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()

  const [qrDataUrl, setQrDataUrl] = useState('')
  const [toast, setToast] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [acceptDone, setAcceptDone] = useState(false)

  // 从 URL 解析邀请码
  const inviteCode = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('code') || ''
    : ''

  // 生成二维码（用当前页面URL）
  useEffect(() => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    QRCode.toDataURL(url, { width: 100, margin: 2, color: { dark: '#222', light: '#fff' } })
      .then(setQrDataUrl)
      .catch(() => {})
  }, [])

  // Toast自动消失
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t) }
  }, [toast])

  // 复制链接
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setToast('链接已复制')
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setToast('链接已复制')
    })
  }, [])

  // 接受邀请
  const handleAccept = async () => {
    if (!isConnected || !address) {
      setToast('请先连接钱包')
      return
    }
    if (!inviteCode) {
      setToast('邀请码无效')
      return
    }
    setAccepting(true)
    setToast('')
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: inviteCode, invitee_address: address }),
      })
      const data = await res.json()
      if (data.success) {
        setAcceptDone(true)
        setToast('🎉 接受成功！')
        setTimeout(() => navigate('/', { replace: true }), 1500)
      } else {
        setToast(data.error || '接受邀请失败，请稍后重试')
      }
    } catch {
      setToast('网络错误，请稍后重试')
    } finally {
      setAccepting(false)
    }
  }

  const handleGoHome = () => navigate('/', { replace: true })

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-3 sm:p-6">
      {/* ====== 主视觉：带二维码的海报 ====== */}
      <div className="relative w-full max-w-[375px] aspect-[375/667] rounded-2xl overflow-hidden shadow-2xl mb-0">
        {/* 海报底图 */}
        <img src="/share-poster.png" alt="明鉴 WiseScan 邀请卡片" className="w-full h-full object-cover" />

        {/* 二维码：和 ShareButton 预览位置一致 */}
        {qrDataUrl && (
          <div className="absolute" style={{ left: '6%', bottom: '5.5%', width: '14.5%', aspectRatio: '1/1' }}>
            <img src={qrDataUrl} alt="二维码" className="w-full h-full" style={{ display: 'block' }} />
          </div>
        )}

        {/* 底部渐变遮罩：只覆盖底部，不挡二维码 */}
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none" />

        {/* 确认按钮/连接钱包：定位在二维码上方 */}
        <div className="absolute inset-x-0" style={{ bottom: '120px' }}>
          <div className="px-5">
            {acceptDone ? (
              <div className="w-full h-12 rounded-full bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg">
                🎉 接受成功！
              </div>
            ) : !isConnected ? (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button
                    onClick={openConnectModal}
                    className="w-full h-12 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.98]"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    连接钱包后接受邀请
                  </button>
                )}
              </ConnectButton.Custom>
            ) : (
              <button
                onClick={handleAccept}
                disabled={accepting || !inviteCode}
                className="w-full h-12 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.98]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {accepting ? '处理中...' : '确认接受邀请'}
              </button>
            )}
          </div>
        </div>

        {/* 左上角：返回按钮 */}
        <button
          onClick={handleGoHome}
          className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* 右上角：分享/复制链接按钮 */}
        <button
          onClick={() => handleCopy(window.location.href)}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors"
        >
          <Share2 size={16} className="text-white" />
        </button>
      </div>

      {/* ====== 底部说明文字 ====== */}
      <div className="text-center space-y-1">
        <p className="text-xs text-zinc-500">
          🔍 明鉴 WiseScan · Web3 项目风险速查
        </p>
        <p className="text-[11px] text-zinc-600">
          守护你的每一次投资决策
        </p>
      </div>

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl z-50 animate-fade-in border border-zinc-700">
          ✅ {toast}
        </div>
      )}
    </div>
  )
}
