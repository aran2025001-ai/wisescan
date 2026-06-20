import { useState } from "react"
import RadarChart from "./RadarChart"
import ProjectInfoCard from "./ProjectInfoCard"
import { generateComprehensiveReview } from "../utils/reviewGenerator"
import { normalizeReportData } from "../utils/normalizeReport"
import { renderEvidenceTaggedText } from "../utils/evidenceTags"
import { Copy, Check, Info } from "lucide-react"
import ShareButton from "./ShareButton"

interface DimensionRow {
  dimension: string
  score: number
  max: number
  deduction: string
}

interface ReportData {
  total_score: number
  risk_level: string
  conclusion: string
  six_dimensions: DimensionRow[]
  radar_data?: number[]
  public_opinion?: {
    summary: string
    negative_keywords?: string[]
    positive_indicators?: string[]
    evidence_source?: string
  } | string
  ai_summary?: string
  onChainData?: {
    tokenName: string
    tokenSymbol: string
    totalSupply: string
    decimals: number
    isContract: boolean
    codeSize: number
    chain: string
    goplus?: {
      lpLockStatus: '已锁定' | '未锁定' | '未知'
      lpLockInfo: string | null
      top10Percent: number | null
      isOpenSource: boolean | null
    }
  }
  liquidity_lock?: string
  top10_concentration?: string
  funding_record?: string
  history_mode_changes?: string
}

interface ContractValidation {
  status: 'unchecked' | 'format_ok' | 'eip55_ok' | 'eip55_fail' | 'onchain_verified'
  message: string
}

// 各维度满分映射（API 返回的数据可能不包含 max 字段）
const dimensionMaxMap: Record<string, number> = {
  "代码与技术安全": 25,
  "团队与运营透明度": 20,
  "经济模型与资金安全": 20,
  "社群与市场热度": 15,
  "历史与执行可靠性": 10,
  "合规性与法律风险": 10,
}

export default function RiskReportCard({
  projectName,
  contractAddress,
  onCopyAddress,
  copied,
  onAnalyzeBusinessModel,
  onUpdateRiskReport,
  assessmentCount,
  lastEvaluation,
  linkedToken,
  reportData,
  contractValidation,
}: {
  projectName: string
  contractAddress: string
  onCopyAddress: () => void
  copied: boolean
  onAnalyzeBusinessModel?: () => void
  onUpdateRiskReport?: () => void
  assessmentCount?: number
  lastEvaluation?: string
  linkedToken?: string
  reportData?: ReportData
  contractValidation?: ContractValidation
}) {
  const [isTokenExpanded, setIsTokenExpanded] = useState(false)
  const [showInfoPopover, setShowInfoPopover] = useState(false)

  // 📊 数据驱动：有 reportData 用真实数据，否则用 mock
  // 🔧 数据清洗：确保所有字段都存在，防止渲染崩溃
  const rawDimensions = reportData?.six_dimensions
  // 检测哪些维度的得分为 null/undefined（用于雷达图下方标注）
  const dimsWithNullScore: string[] = Array.isArray(rawDimensions) && rawDimensions.length > 0
    ? rawDimensions.filter((d: any) => !(typeof d.score === 'number' && !isNaN(d.score))).map((d: any) => d.dimension || "未知维度").filter(Boolean)
    : []
  const dimensions: DimensionRow[] = Array.isArray(rawDimensions) && rawDimensions.length > 0
    ? rawDimensions.map((d: any) => ({
        dimension: d.dimension || "未知维度",
        score: typeof d.score === 'number' ? d.score : 0,
        max: typeof d.max === 'number' ? d.max : (dimensionMaxMap[d.dimension] || 10),
        deduction: d.deduction || "无",
      }))
    : [
        { dimension: "代码与技术安全", score: 25, max: 25, deduction: "无" },
        { dimension: "团队与运营透明度", score: 8, max: 20, deduction: "团队匿名" },
        { dimension: "经济模型与资金安全", score: 12, max: 20, deduction: "代币锁仓不透明" },
        { dimension: "社群与市场热度", score: 10, max: 15, deduction: "僵尸粉较多" },
        { dimension: "历史与执行可靠性", score: 4, max: 10, deduction: "模式变更2次" },
        { dimension: "合规性与法律风险", score: 5, max: 10, deduction: "无法律实体" },
      ]

  // 安全获取分数（防止 NaN/Infinity）
  const totalScore = typeof reportData?.total_score === 'number' && !isNaN(reportData.total_score)
    ? Math.round(reportData.total_score) : 45
  const hasRealTotalScore = typeof reportData?.total_score === 'number' && !isNaN(reportData.total_score)
  const riskLevel = (reportData?.risk_level && typeof reportData.risk_level === 'string')
    ? reportData.risk_level : "高风险"
  const conclusion = (reportData?.conclusion && typeof reportData.conclusion === 'string')
    ? reportData.conclusion : "不建议参与"

  // 信息完整性评分（用于分享卡片）
  const dims = reportData?.six_dimensions || []
  const totalMax = dims.reduce((s: number, d: any) => s + (d.max || 0), 0)
  const infoCompleteness = totalMax > 0
    ? Math.round(dims.reduce((s: number, d: any) => s + (d.score || 0), 0) / totalMax * 100)
    : 30

  // 🔗 链上真实数据（来自 NodeReal BSCTrace RPC）
  // ⚠️ linkedToken 由父组件从 API 响应的顶层 onChainData 传入，不要在这里重新计算
  const onChain = reportData?.onChainData
  const hasOnChain = !!onChain?.tokenName && onChain.tokenName !== '未知'
  const displayLinkedToken = linkedToken || (hasOnChain ? onChain!.tokenSymbol : undefined) || projectName || undefined

  // 🔍 定性字段：来自 GoPlus API + DeepSeek
  const lockStatus = onChain?.goplus?.lpLockStatus || reportData?.liquidity_lock || null
  const top10Concentration = onChain?.goplus?.top10Percent !== null && onChain?.goplus?.top10Percent !== undefined
    ? (onChain.goplus.top10Percent >= 70 ? '极高' : onChain.goplus.top10Percent >= 50 ? '偏高' : '正常')
    : reportData?.top10_concentration || null
  const hasFunding = reportData?.funding_record || null

  // 安全计算雷达图分数 — 始终从 six_dimensions 实时推导，与评分表一致
  const radarScores = dimensions.map(d => {
    const ratio = d.max > 0 ? d.score / d.max : 0
    return isFinite(ratio) ? ratio : 0.5
  })
  const radarActualScores = dimensions.map(d => `${d.score}/${d.max}`)
  // 📝 public_opinion 兼容新旧格式（string | object）
  const publicOpinionRaw = reportData?.public_opinion
  const publicOpinionSummary = typeof publicOpinionRaw === 'string'
    ? publicOpinionRaw
    : (typeof publicOpinionRaw === 'object' && publicOpinionRaw !== null
      ? (publicOpinionRaw.summary || "舆情数据加载中...")
      : "舆情数据加载中...")
  const negativeKeywords = typeof publicOpinionRaw === 'object' && publicOpinionRaw !== null && Array.isArray(publicOpinionRaw.negative_keywords)
    ? publicOpinionRaw.negative_keywords
    : []
  // 🔧 v5.13: 优先使用 DeepSeek AI 生成的综合解读，模板拼凑仅作 fallback
  const aiSummary = (reportData?.ai_summary && typeof reportData.ai_summary === 'string' && reportData.ai_summary.trim().length > 20)
    ? reportData.ai_summary
    : generateComprehensiveReview(normalizeReportData(reportData))

  return (
    <div className="w-full bg-zinc-900 rounded-lg border border-[#343438] max-w-sm mx-auto">
      {/* 报告标题 */}
      <div className="bg-gradient-to-r from-blue-950/50 to-purple-950/50 px-4 py-3 border-b border-[#343438] text-center">
        <h3 className="text-white font-semibold text-base">全景风险报告 - {projectName}</h3>
        <p className="text-zinc-400 text-xs mt-1">明鉴·风险洞察官出品</p>
      </div>

      {/* 项目基本情报 */}
      <ProjectInfoCard
        projectName={projectName}
        contractAddress={contractAddress}
        reportData={reportData}
        onChainData={reportData?.onChainData}
        assessmentCount={assessmentCount}
        lastEvaluation={lastEvaluation}
        linkedToken={displayLinkedToken || ''}
        isEmbedded={true}
        onCopyAddress={onCopyAddress}
      />

      <div className="border-b border-[#343438]"></div>

      {/* 六维雷达图 */}
      <div className="px-4 py-3 border-b border-[#343438] bg-zinc-800/50">
        <h4 className="text-white font-semibold text-sm mb-2 text-center">六维雷达图</h4>
        <RadarChart scores={radarScores} actualScores={radarActualScores} labels={dimensions.map(d => d.dimension)} />
        {dimsWithNullScore.length > 0 && (
          <p className="text-[#6B7280] text-xs text-center mt-2">
            {dimsWithNullScore.join("、")} 等维度数据采集中
          </p>
        )}
      </div>

      {/* 详细评分表 */}
      <div className="px-4 py-3 space-y-3">
        {dimensions.map((item, i) => {
          const hasScore = typeof item.score === 'number' && !isNaN(item.score)
          return (
          <div key={i} className={`text-sm ${i > 0 ? "border-t border-[#343438] pt-3" : ""}`}>
            <p className="text-blue-400 font-semibold text-xs mb-1">{item.dimension}（{item.max} 分）</p>
            <p className={`text-xs mb-1 ${hasScore ? 'text-zinc-300' : 'text-[#6B7280]'}`}>
              得分：{hasScore ? `${item.score} / ${item.max}` : `— / ${item.max}`}
            </p>
            <p className="text-zinc-400 text-xs">扣分项：{renderEvidenceTaggedText(item.deduction, "text-zinc-400 text-xs")}</p>
          </div>
        )})}
      </div>

      {/* 互联网舆情监测摘要 */}
      <div className="px-4 py-3 border-t border-[#343438] bg-zinc-800/30">
        <h4 className="text-white font-semibold text-sm mb-3 text-center">互联网舆情监测摘要</h4>
        <div className="space-y-3 text-xs">
          {negativeKeywords.length > 0 && (
            <div>
              <p className="text-zinc-300 mb-1">负面关键词：</p>
              <p className="text-red-400 ml-2">{negativeKeywords.join("、")}</p>
            </div>
          )}
          <div>
            <p className="text-zinc-300 mb-1">舆情结论：</p>
            <p className="ml-2 font-semibold text-white">{publicOpinionSummary}</p>
          </div>
        </div>
      </div>

      {/* 综合评分与风险等级 */}
      <div className="px-4 py-3 border-t border-[#343438] bg-zinc-800/30 space-y-3">
        <h4 className="text-white font-semibold text-sm text-center">综合评分与风险等级</h4>
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-300 shrink-0">综合评分</span>
          {hasRealTotalScore ? (
            <span className={`font-bold ml-2 text-right ${totalScore >= 70 ? "text-green-500" : totalScore >= 50 ? "text-yellow-500" : "text-red-500"}`}>{totalScore} / 100</span>
          ) : (
            <span className="text-[#6B7280] text-xs">评估中，请稍后刷新</span>
          )}
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-300 shrink-0">风险等级</span>
          <span className={`font-bold ml-2 text-right ${totalScore >= 70 ? "text-green-500" : totalScore >= 50 ? "text-yellow-500" : "text-red-500"}`}>{riskLevel}</span>
        </div>
        <div className="flex items-center text-xs">
          <span className="text-zinc-300 shrink-0 mr-2">建议</span>
          <span className={`font-bold text-right flex-1 ${conclusion === "可以参与" ? "text-green-500" : conclusion === "谨慎参与" ? "text-yellow-500" : "text-red-500"}`}>
            {conclusion === "可以参与" ? "✅" : conclusion === "谨慎参与" ? "⚠️" : "❌"} {conclusion}
          </span>
        </div>
        <div className={`border rounded p-2 mt-2 ${totalScore >= 70 ? "bg-green-500/10 border-green-500/30" : totalScore >= 50 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-red-500/10 border-red-500/30"}`}>
          <div className={`text-xs leading-relaxed ${totalScore >= 70 ? "text-green-400" : totalScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
            {reportData ? renderEvidenceTaggedText(`明鉴评分 ${totalScore}/100，综合评定为${riskLevel}。`, `text-xs leading-relaxed ${totalScore >= 70 ? "text-green-400" : totalScore >= 50 ? "text-yellow-400" : "text-red-400"}`) : "该项目存在锁仓机制不透明、模式多次变更等风险，建议谨慎。"}
          </div>
        </div>
      </div>

      {/* AI 综合解读 */}
      <div className="px-4 py-3 border-t border-[#343438] bg-zinc-800/30">
        <h4 className="text-white font-semibold text-sm mb-2 text-center">明鉴·风险洞察官综合解读</h4>
        <div className="text-zinc-200 text-xs leading-relaxed">
          {renderEvidenceTaggedText(aiSummary, "text-zinc-200 text-xs leading-relaxed")}
        </div>
      </div>

      {/* 免责声明 */}
      <div className="px-4 py-3 border-t border-[#343438] bg-zinc-700/20">
        <h4 className="text-white font-semibold text-sm mb-2 text-center">免责声明</h4>
        <p className="text-zinc-300 text-xs leading-relaxed">
          本报告基于公开信息生成，仅供参考，不构成投资建议。用户应自行核实并承担风险。
        </p>
      </div>

      {/* Bottom buttons - compact style */}
      <div className="space-y-2 px-4 pb-2">
        <div className="border-t border-[#343438] -mx-4"></div>

        <ShareButton
          type="project"
          data={{
            projectName,
            contractAddress,
            riskLabel: riskLevel,
            infoCompleteness,
            summary: conclusion,
          }}
          label="分享项目情报"
          className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 hover:text-blue-300 text-white text-xs font-medium py-2.5 rounded-full transition-colors"
        />

        <div className="flex gap-2">
          <button
            onClick={() => onUpdateRiskReport?.()}
            className="flex-1 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 hover:text-blue-300 text-white text-xs font-medium py-2.5 rounded-full transition-colors"
          >
            更新风险报告
          </button>
          <button
            onClick={() => onAnalyzeBusinessModel?.()}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 hover:text-blue-300 text-white text-xs font-medium py-2.5 rounded-full transition-colors"
          >
            分析该项目的商业模式
          </button>
        </div>
      </div>
    </div>
  )
}
