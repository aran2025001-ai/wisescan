import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAccount } from 'wagmi'
import RiskReportCard from '../components/RiskReportCard'
import { ChevronLeft, Check } from 'lucide-react'

const getRiskBadge = (level: number) => {
  switch (level) {
    case 4:
      return { label: '极高风险', color: 'bg-red-700 text-white' }
    case 3:
      return { label: '需谨慎', color: 'bg-red-600 text-white' }
    case 2:
      return { label: '中等', color: 'bg-orange-500 text-white' }
    case 1:
      return { label: '良好', color: 'bg-green-500 text-white' }
    default:
      return { label: '未知', color: 'bg-zinc-500 text-white' }
  }
}

export default function ReportDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { address } = useAccount()
  const [copied, setCopied] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [_loadingData, setLoadingData] = useState(true)
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false)
  const [isUpdateRiskModalOpen, setIsUpdateRiskModalOpen] = useState(false)
  const [showPaymentResult, setShowPaymentResult] = useState(false)
  const [paymentResultMsg, setPaymentResultMsg] = useState("")

  // 从卡片传入的项目数据
  const report = (location.state as any)?.report
  const projectName = report?.projectName || '项目名称'
  const contractAddress = report?.contractAddress || ''
  const assessmentCount = report?.assessmentCount || 0
  const lastEvaluation = report?.lastEvaluationDate || '--'
  const riskBadge = getRiskBadge(report?.riskLevel || 1)

  // 加载全景风险报告数据
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(supabaseUrl, supabaseKey)

        if (contractAddress) {
          // 先从 project_facts 读缓存报告
          const { data: pf } = await supabase
            .from('project_facts')
            .select('cached_report')
            .eq('contract_address', contractAddress.toLowerCase())
            .maybeSingle()
          if (pf?.cached_report && !cancelled) setReportData(pf.cached_report)

          // 再从 risk_reports 读最新报告（按合约地址匹配，优先级更高）
          const { data: proj } = await supabase
            .from('projects')
            .select('id')
            .eq('contract_address', contractAddress.toLowerCase())
            .maybeSingle()
          if (proj) {
            const { data: rep } = await supabase
              .from('risk_reports')
              .select('report_data')
              .eq('project_id', proj.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (rep?.report_data && !cancelled) setReportData(rep.report_data)
          }
        }
      } catch (e: any) {
        console.error('加载报告数据失败:', e.message)
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    })()
    return () => { cancelled = true }
  }, [contractAddress, report?.id])

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(contractAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const handleGenerateRiskReport = async () => {
    try {
      const body = {
        project_name: projectName,
        contract_address: contractAddress,
        user_address: address,
      }
      const resp = await fetch('/api/generate-risk-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!resp.ok) throw new Error('API error: ' + resp.status)
      const json = await resp.json()
      if (json?.data) {
        const merged = json.onChainData ? { ...json.data, onChainData: json.onChainData } : json.data
        setReportData(merged)
      }
      setPaymentResultMsg('全景风险报告已更新！')
    } catch (err: any) {
      console.error('更新报告失败:', err.message)
      setPaymentResultMsg('报告更新失败，请稍后重试。')
    }
  }

  return (
    <div className="text-white flex flex-col">
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => navigate('/profile/reports')}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="返回"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold flex-1 text-center truncate">{projectName}</h1>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${riskBadge.color} whitespace-nowrap`}>
            {riskBadge.label}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        <RiskReportCard
          projectName={projectName}
          contractAddress={contractAddress}
          onCopyAddress={handleCopyAddress}
          copied={copied}
          onAnalyzeBusinessModel={() => setIsAnalyzeModalOpen(true)}
          onUpdateRiskReport={() => setIsUpdateRiskModalOpen(true)}
          assessmentCount={assessmentCount}
          lastEvaluation={lastEvaluation}
          reportData={reportData}
          linkedToken={projectName}
        />
      </div>

      {/* Analyze Modal */}
      {isAnalyzeModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setIsAnalyzeModalOpen(false)}>
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-sm text-center">分析该项目的商业模式</h3>
            <p className="text-zinc-300 text-xs leading-relaxed">将跳转到商业模式拆解页面。</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setIsAnalyzeModalOpen(false)} className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs">取消</button>
              <button onClick={() => { setIsAnalyzeModalOpen(false); navigate('/business') }} className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {isUpdateRiskModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setIsUpdateRiskModalOpen(false)}>
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-sm text-center">更新风险报告</h3>
            <p className="text-zinc-300 text-xs leading-relaxed">根据全网最新信息将重新生成该项目的风险报告，需支付1 USDT（BSC链），是否继续？</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setIsUpdateRiskModalOpen(false)} className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs">取消</button>
              <button onClick={() => { setIsUpdateRiskModalOpen(false); setPaymentResultMsg("正在更新全景风险报告。"); setShowPaymentResult(true); handleGenerateRiskReport() }} className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs">确定</button>
            </div>
          </div>
        </div>
      )}

      {showPaymentResult && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => setShowPaymentResult(false)}>
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center text-green-400"><Check className="w-8 h-8" /></div>
            <p className="text-zinc-200 text-xs text-left leading-relaxed">{paymentResultMsg}</p>
            <button onClick={() => setShowPaymentResult(false)} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs font-medium">知道了</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
