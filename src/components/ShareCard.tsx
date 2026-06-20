import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { toPng } from 'html-to-image'

export interface ShareCardData {
  projectName?: string
  contractAddress?: string
  riskLabel?: string
  summary?: string
  inviteCode?: string
  walletAddress?: string
  patternType?: string
  businessSummary?: string
}

interface ShareCardProps {
  type: 'invite' | 'project' | 'business'
  data: ShareCardData
  onImageReady: (dataUrl: string, fileSize: number) => void
  onError?: (err: Error) => void
}

export default function ShareCard({ type, data, onImageReady, onError }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const content = type === 'invite'
      ? `https://wisescan.io/invite?code=${data.inviteCode || 'ABC123'}`
      : `https://wisescan.io/project/${data.contractAddress || '0x123'}`
    
    QRCode.toDataURL(content, { width: 80, margin: 1, color: { dark: '#222222', light: '#FFFFFF' } })
      .then(url => { if (!cancelled) { setQrDataUrl(url); setReady(true) } })
      .catch(() => { setReady(true) })
    return () => { cancelled = true }
  }, [type, data])

  useEffect(() => {
    if (!ready || !cardRef.current) return
    const timer = setTimeout(async () => {
      try {
        const el = cardRef.current
        if (!el) return
        const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true })
        const base64 = dataUrl.split(',')[1]
        const size = base64 ? Math.round(base64.length * 0.75) : 0
        onImageReady(dataUrl, size)
      } catch (err: any) { onError?.(err) }
    }, 1000)
    return () => clearTimeout(timer)
  }, [ready])

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      zIndex: -1, opacity: 0, pointerEvents: 'none',
      width: 375, height: 667,
    }}>
      <div ref={cardRef} style={{
        width: 375, height: 667,
        background: 'linear-gradient(180deg, #0D2240 0%, #1A3660 50%, #244A80 100%)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '28px 24px', boxSizing: 'border-box',
        borderRadius: 16, overflow: 'hidden',
      }}>
        {/* 品牌 */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', letterSpacing: 1, marginBottom: 12 }}>
          明鉴 WiseScan
        </div>

        {/* 主标题 */}
        <div style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3, textAlign: 'center', marginBottom: 20 }}>
          投前查一查<br/>少亏冤枉钱
        </div>

        {/* 三个功能模块 */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 24, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📊</div>
            <span style={{ fontSize: 10, color: '#8AA8C8' }}>项目安全评估</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💬</div>
            <span style={{ fontSize: 10, color: '#8AA8C8' }}>商业模式拆解</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👨‍💼</div>
            <span style={{ fontSize: 10, color: '#8AA8C8' }}>与专家聊天咨询</span>
          </div>
        </div>

        {/* 中间手机mockup */}
        <div style={{
          width: '100%', flex: 1, background: 'rgba(255,255,255,0.08)',
          borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, gap: 6, padding: 12,
        }}>
          <div style={{ width: 80, height: 120, background: 'rgba(255,255,255,0.1)', borderRadius: 10, border: '2px solid rgba(255,255,255,0.15)', position: 'relative', marginBottom: 6 }}>
            <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 9, color: '#6B85A5' }}>Web3 安全评估 · 一键分析</div>
        </div>

        {/* 二维码区域 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginBottom: 10 }}>
          {qrDataUrl && (
            <div style={{ width: 62, height: 62, background: '#FFFFFF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, flexShrink: 0 }}>
              <img src={qrDataUrl} alt="QR" width={56} height={56} />
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#93B4E0' }}>扫码查看完整报告</div>
            <div style={{ fontSize: 9, color: '#5A7A9A', marginTop: 2 }}>明鉴 · 一站式Web3安全评估平台</div>
          </div>
        </div>

        {/* 底部 */}
        <div style={{ fontSize: 10, color: '#4A6580', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, width: '100%', textAlign: 'center' }}>
          先明鉴，后投资 · wiseinvest.cn
        </div>
      </div>
    </div>
  )
}
