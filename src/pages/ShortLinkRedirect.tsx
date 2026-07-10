/**
 * ShortLinkRedirect — 短链接解析页
 *
 * 路由：/s/:code
 * 功能：从 API 获取短链接对应的海报数据 → 渲染 SharePosterPage
 */

import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ShareCard } from '../components/ShareCard'
import { BusinessShareCard } from '../components/BusinessShareCard'

/** 本地开发/旧短链兼容：如果后端没有 302，前端拿到 image_url 后主动跳转 */
function redirectToImage(imageUrl: string) {
  if (typeof window !== 'undefined') {
    window.location.replace(imageUrl)
  }
}

export default function ShortLinkRedirect() {
  const { code } = useParams<{ code: string }>()
  const [posterData, setPosterData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) { setError('链接无效'); return }

    fetch(`/api/shorten?code=${encodeURIComponent(code)}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? '链接不存在' : '加载失败')
        return r.json()
      })
      .then(data => {
        // 如果已生成图片 URL，直接跳转到图片（本地开发兼容）
        if (data?.image_url) {
          redirectToImage(data.image_url)
          return
        }
        setPosterData(data)
      })
      .catch(e => setError(e.message))
  }, [code])

  // 加载中
  if (!posterData && !error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-zinc-400 text-sm">加载中...</div>
      </div>
    )
  }

  // 错误
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-3">
        <div className="text-zinc-400 text-sm">{error}</div>
        <a href="/" className="text-blue-400 text-xs underline">返回首页</a>
      </div>
    )
  }

  // 项目情报海报
  if (posterData.type === 'project') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" style={{ touchAction: 'manipulation' }}>
        <ShareCard
          projectName={posterData.name || ''}
          contractAddress={posterData.addr || ''}
          top10Holding={parseFloat(posterData.top10 || '0')}
          riskLevel={posterData.risk || ''}
          riskColor={(posterData.color || 'red') as any}
          infoCompleteness={parseInt(posterData.comp || '0')}
          completenessLevel={posterData.clevel || ''}
          review={posterData.review || ''}
          qrCodeUrl={posterData.qr || ''}
          width={Math.min(window.innerWidth * 0.92, 375)}
        />
      </div>
    )
  }

  // 商业模式海报
  if (posterData.type === 'business') {
    const watchPoints = posterData.watch ? posterData.watch.split('·') : []
    const reportData = {
      project_name: posterData.name || '',
      share_card: {
        project_name: posterData.name || '',
        pattern_type: posterData.pattern || '',
        structure: posterData.structure || '',
        rule_summary: posterData.rules || '',
        watch_points: watchPoints,
      },
      id: posterData.rid || '',
    }

    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" style={{ touchAction: 'manipulation' }}>
        <BusinessShareCard
          reportData={reportData}
          width={Math.min(window.innerWidth * 0.92, 375)}
        />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-3">
      <div className="text-zinc-400 text-sm">未知的海报类型</div>
      <a href="/" className="text-blue-400 text-xs underline">返回首页</a>
    </div>
  )
}
