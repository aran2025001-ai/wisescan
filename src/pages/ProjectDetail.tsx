import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useParams, useNavigate } from "react-router-dom"
import RiskReportCard from "../components/RiskReportCard"
import ProjectInfoCard from "../components/ProjectInfoCard"
import { useAccount } from "wagmi"
import { ChevronLeft, Check } from "lucide-react"

// Risk badge helper (unified with ProjectLibrary)
const getRiskBadge = (level: number | string) => {
  const lvl = typeof level === 'string'
    ? { '良好': 1, '低风险': 1, '中等': 2, '中等风险': 2, '需谨慎': 3, '高风险': 4, '极高风险': 5 }[level] || 1
    : level
  switch (lvl) {
    case 5:
    case 4: return { label: "极高风险", color: "bg-red-700 text-white" }
    case 3: return { label: "需谨慎", color: "bg-red-600 text-white" }
    case 2: return { label: "中等", color: "bg-orange-500 text-white" }
    case 1: return { label: "良好", color: "bg-green-500 text-white" }
    default: return { label: "未知", color: "bg-zinc-500 text-white" }
  }
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { address } = useAccount()
  const [copied, setCopied] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<any>(null)
  const [reportData, setReportData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false)
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false)
  const [, ] = useState(false)
  const [, setInviteCount] = useState(0)  // 已成功邀请人数
  const [isUpdateRiskModalOpen, setIsUpdateRiskModalOpen] = useState(false)
  const [showPaymentResult, setShowPaymentResult] = useState(false)
  const [paymentResultMsg, setPaymentResultMsg] = useState("")
  const [evidenceImages, setEvidenceImages] = useState<File[]>([])
  const [evidenceText, setEvidenceText] = useState("")

  // 从 Supabase 加载项目 + 付费报告
  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(supabaseUrl, supabaseKey)

        // 查项目
        const { data: proj } = await supabase.from('projects').select('*').eq('id', id).single()
        if (cancelled || !proj) { setError('项目不存在'); setLoading(false); return }
        setProject(proj)

        // 查缓存的最新报告数据（从 project_facts 的 cached_report 字段读取）
        const addr = proj.contract_address || ''
        if (addr) {
          const { data: pf } = await supabase
            .from('project_facts')
            .select('cached_report')
            .eq('contract_address', addr.toLowerCase())
            .maybeSingle()
          if (pf?.cached_report) setReportData(pf.cached_report)
        }

        // 查当前用户是否付费解锁（有 risk_reports 记录）
        // 无条件查询：按 project_id 查，钱包地址作为辅助条件
        let repQuery = supabase
          .from('risk_reports')
          .select('report_data, user_address')
          .eq('project_id', id)
        if (address) {
          repQuery = repQuery.ilike('user_address', address.toLowerCase())
        }
        const { data: rep } = await repQuery
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (rep) {
          setReportData(rep.report_data)
          setIsPaid(true)
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, address])

  // 获取邀请次数（>0 则隐藏邀请弹窗，终身一次）
  useEffect(() => {
    if (!address) { setInviteCount(0); return }
    fetch(`/api/invite/stats?user_address=${address}`)
      .then(r => r.json())
      .then(j => { if (j.invite_count !== undefined) setInviteCount(j.invite_count || 0) })
      .catch(() => {})
  }, [address])

  const riskBadge = getRiskBadge(reportData?.risk_level || project?.risk_level || 1)

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(project?.contract_address || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleUnlockReport = () => handleGenerateRiskReport()
  const handleAnalyzeBusinessModel = () => setIsAnalyzeModalOpen(true)
  const handleUpdateRiskReport = () => setIsUpdateRiskModalOpen(true)

  // 付费后生成报告并写入 risk_reports 表（持久化）
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
        // 同步存入 risk_reports（确保付费状态持久化）
        await saveRiskReport(merged)
      }
      setIsPaid(true)
      setPaymentResultMsg('全景风险报告已生成！')
    } catch (err: any) {
      console.error('生成报告失败:', err.message)
      setPaymentResultMsg('报告生成失败，请稍后重试。')
    }
  }

  // 前端直接写 risk_reports（弥补服务端存库偶发失败）
  // 先插新记录，再删旧记录，确保不丢数据
  const saveRiskReport = async (reportData: any) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      // 查 project_id
      const { data: proj } = await supabase.from('projects').select('id').eq('contract_address', contractAddress.toLowerCase()).maybeSingle()
      // 第1步：插入新记录
      const { data: inserted, error: insErr } = await supabase.from('risk_reports').insert({
        user_address: (address || 'anonymous').toLowerCase(),
        project_id: proj?.id || null,
        report_data: reportData,
        total_score: reportData.total_score,
        risk_level: reportData.risk_level,
      }).select('id')
      if (insErr) {
        console.warn('⚠️ risk_reports 写入失败:', insErr.message)
        return
      }
      const newId = inserted?.[0]?.id
      console.log('💾 risk_reports 写入成功, id:', newId)
      // 第2步：删除该用户该项目的旧记录（排除新插入的）
      if (newId && proj?.id) {
        await supabase.from('risk_reports').delete()
          .eq('project_id', proj.id)
          .ilike('user_address', (address || 'anonymous').toLowerCase())
          .neq('id', newId)
        console.log('🧹 旧报告已清理')
      }
    } catch (e: any) {
      console.warn('⚠️ risk_reports 写入失败:', e.message)
    }
  }

  const handleEvidenceChange = (images: File[], text: string) => {
    setEvidenceImages(images)
    setEvidenceText(text)
  }

  // 加载中
  if (loading) {
    return (
      <div className="text-white flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mb-4" />
        <p className="text-zinc-400 text-xs">加载项目信息...</p>
      </div>
    )
  }

  // 错误或不存在
  if (error || !project) {
    return (
      <div className="text-white flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-zinc-400 text-xs mb-4">{error || '项目不存在'}</p>
        <button onClick={() => navigate('/library')} className="text-blue-400 text-xs underline">返回全网项目库</button>
      </div>
    )
  }

  const projectName = project.name || '未命名项目'
  const contractAddress = project.contract_address || ''
  // 评估次数：优先用 localStorage 项目库的计数（更完整），回退到 Supabase
  let localCount = 0
  try {
    const raw = localStorage.getItem('wisescan_project_library')
    if (raw) {
      const lib = JSON.parse(raw)
      const found = lib.find((p: any) => p.contractAddress?.toLowerCase() === contractAddress.toLowerCase())
      if (found?.assessmentCount) localCount = found.assessmentCount
    }
  } catch {}
  const assessmentCount = localCount || project.assessment_count || 0
  const lastEvaluation = project.last_eval_time
    ? new Date(project.last_eval_time).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '--'

  return (
    <div className="text-white flex flex-col">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => navigate("/library")}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
            title="返回"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-center text-sm font-semibold flex-1 truncate px-2">{projectName}</h1>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${riskBadge.color} whitespace-nowrap flex-shrink-0`}>
            {riskBadge.label}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {!isPaid ? (
          // Show project basic info card
          <ProjectInfoCard
            projectName={projectName}
            contractAddress={contractAddress}
            onCopyAddress={handleCopyAddress}
            onUnlock={handleUnlockReport}
            onAnalyzeBusinessModel={handleAnalyzeBusinessModel}
            assessmentCount={assessmentCount}
            lastEvaluation={lastEvaluation}
            reportData={reportData}
            evidenceImages={evidenceImages}
            evidenceText={evidenceText}
            onEvidenceChange={handleEvidenceChange}
          />
        ) : (
          // Show full risk report card (RiskAssessment standard)
          <RiskReportCard
            projectName={projectName}
            contractAddress={contractAddress}
            onCopyAddress={handleCopyAddress}
            copied={copied}
            onAnalyzeBusinessModel={handleAnalyzeBusinessModel}
            onUpdateRiskReport={handleUpdateRiskReport}
            assessmentCount={assessmentCount}
            lastEvaluation={lastEvaluation}
            linkedToken={reportData?.onChainData?.tokenSymbol || ''}
            reportData={reportData}
          />
        )}
      </div>

      {/* Share Modal */}
      {/* Analyze Business Model Modal */}
      {isAnalyzeModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setIsAnalyzeModalOpen(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-sm text-center">分析该项目的商业模式</h3>
            <p className="text-zinc-300 text-xs leading-relaxed">将跳转到商业模式拆解页面，对项目的商业模式进行深度分析。</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setIsAnalyzeModalOpen(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setIsAnalyzeModalOpen(false)
                  navigate("/business")
                }}
                className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Risk Report Modal */}
      {isUpdateRiskModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setIsUpdateRiskModalOpen(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-sm text-center">更新风险报告</h3>
            <p className="text-zinc-300 text-xs leading-relaxed">根据全网最新信息将重新生成该项目的风险报告，需支付1 USDT（BSC链），是否继续？</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setIsUpdateRiskModalOpen(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setIsUpdateRiskModalOpen(false)
                  let evidenceMsg = ""
                  if (evidenceImages.length > 0 || evidenceText.length > 0) {
                    evidenceMsg = `，已补充${evidenceImages.length}张图片、${evidenceText.length}字文本等证据`
                  }
                  setPaymentResultMsg(`正在更新全景风险报告${evidenceMsg}。`)
                  setShowPaymentResult(true)
                  handleGenerateRiskReport()
                }}
                className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal 已移至 ProjectInfoCard 组件内，此处代码已废弃可安全删除 */}

      {/* Unlock Report Modal */}
      {isUnlockModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setIsUnlockModalOpen(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-sm text-center">解锁全景风险报告</h3>
            <p className="text-zinc-300 text-xs leading-relaxed">将为您生成完整风险报告，需支付 2.99 USDT（当前仅支持BSC链（BEP20）支付）。是否继续？</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setIsUnlockModalOpen(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsUnlockModalOpen(false)
                  handleGenerateRiskReport()
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs"
              >
                确认支付
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Result Modal */}
      {showPaymentResult && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => setShowPaymentResult(false)}>
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center text-green-400">
              <Check className="w-8 h-8" />
            </div>
            <p className="text-zinc-200 text-xs text-left leading-relaxed">{paymentResultMsg}</p>
            <button
              onClick={() => setShowPaymentResult(false)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs font-medium"
            >
              知道了
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
