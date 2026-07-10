/**
 * SharePosterPage — 分享海报展示页
 *
 * 通过 URL query params 接收数据，全屏黑底展示 ShareCard / BusinessShareCard
 * 用于分享链接的落地页，用户打开链接即可看到海报大图，可长按保存
 *
 * URL 格式：
 *   项目情报：/share/poster?type=project&name=xxx&addr=0x...&top10=91.2&risk=高度集中&color=red&comp=60&clevel=中等&review=xxx
 *   商业模式：/share/poster?type=business&name=xxx&pattern=xxx&structure=xxx&rules=xxx&watch=x·y·z
 */

import { useSearchParams } from 'react-router-dom'
import { ShareCard } from '../components/ShareCard'
import { BusinessShareCard } from '../components/BusinessShareCard'

export default function SharePosterPage() {
  const [params] = useSearchParams()
  const type = params.get('type')

  // ── 提取项目情报参数 ──
  const projectName = params.get('name') || ''
  const contractAddress = params.get('addr') || ''

  if (type === 'project') {
    const top10Holding = parseFloat(params.get('top10') || '0')
    const riskLevel = params.get('risk') || ''
    const riskColor = (params.get('color') || 'red') as 'red' | 'orange' | 'yellow' | 'green'
    const infoCompleteness = parseInt(params.get('comp') || '0')
    const completenessLevel = params.get('clevel') || ''
    const review = params.get('review') || ''
    const qrCodeUrl = params.get('qr') || 'https://wisescan.xyz'

    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" style={{ touchAction: 'manipulation' }}>
        <ShareCard
          projectName={projectName}
          contractAddress={contractAddress}
          top10Holding={top10Holding}
          riskLevel={riskLevel}
          riskColor={riskColor}
          infoCompleteness={infoCompleteness}
          completenessLevel={completenessLevel}
          review={review}
          qrCodeUrl={qrCodeUrl}
          width={Math.min(window.innerWidth * 0.92, 375)}
        />
      </div>
    )
  }

  if (type === 'business') {
    const pattern = params.get('pattern') || ''
    const structure = params.get('structure') || ''
    const rules = params.get('rules') || ''
    const watchRaw = params.get('watch') || ''
    const watchPoints = watchRaw ? watchRaw.split('·') : []

    // 构造 reportData 供 BusinessShareCard 使用
    const reportData = {
      project_name: projectName,
      share_card: {
        project_name: projectName,
        pattern_type: pattern,
        structure,
        rule_summary: rules,
        watch_points: watchPoints,
      },
      id: params.get('rid') || '',
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

  // 兜底
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white">
      <p className="text-zinc-400 text-sm">海报参数无效</p>
    </div>
  )
}
