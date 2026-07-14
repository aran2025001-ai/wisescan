import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import RadarChart from "../components/RadarChart"
import ScanMethodologyModal from "../components/ScanMethodologyModal"
import ErrorBoundary from "../components/ErrorBoundary"
import ProjectInfoCard from "../components/ProjectInfoCard"
import { useAccount } from "wagmi"
import { upsertProject } from "../services/projectService"
import { generateComprehensiveReview } from "../utils/reviewGenerator"
import { normalizeReportData } from "../utils/normalizeReport"
import { copyToClipboard } from "../utils/clipboard"
import { renderEvidenceTaggedText } from "../utils/evidenceTags"
import { TencentAsrClient } from "../services/tencentAsr"
import ShareProjectDrawer from "../components/ShareProjectDrawer"

// ===== 简短点评生成器 =====
function generateShortReview(reportData: any): string {
  if (!reportData) return '数据采集中，解锁查看完整报告'
  const dims = (reportData.six_dimensions || []) as any[]
  const positives: string[] = []
  const negatives: string[] = []
  const codeDim = dims.find((d: any) => d.dimension?.includes('代码'))
  if (codeDim) {
    if (codeDim.score >= 18 || codeDim.deduction?.includes('无扣分')) positives.push('已完成审计')
    else if (codeDim.score <= 8 || (codeDim.deduction?.includes('未审计') && !/无未审计/.test(codeDim.deduction))) negatives.push('尚未完成审计')
  }
  const funding = reportData.funding_record
  if (funding && funding !== '未知' && funding !== '无' && funding !== '--') positives.push('有融资记录')
  if (reportData.onChainData?.goplus?.isOpenSource === true) positives.push('合约开源')
  const lp = reportData.onChainData?.goplus?.lpLockStatus || reportData.liquidity_lock
  if (lp === '已锁定') positives.push('LP已锁定')
  const teamDim = dims.find((d: any) => d.dimension?.includes('团队'))
  if ((teamDim?.deduction?.includes('匿名') && !/未发现|无.*匿名|非匿名|不匿名/.test(teamDim.deduction)) || (teamDim?.score ?? 20) <= 8) negatives.push('团队匿名')
  const histDim = dims.find((d: any) => d.dimension?.includes('历史'))
  const changes = (reportData.history_mode_changes || '').toString().trim()
  const hasModeChange = changes && changes !== '无' && changes !== '0' && changes !== '0次' && !changes.startsWith('无')
  if (hasModeChange || (histDim?.deduction && /模式变更\d+次|模式变更≥\d+次|变更\d+次/.test(histDim.deduction))) {
    const changeCount = parseInt(changes)
    if (!Number.isNaN(changeCount) && changeCount >= 2) negatives.push(`曾有过${changeCount}次模式变更`)
    else negatives.push('曾有过模式变更')
  }
  const goplusTop10 = reportData.onChainData?.goplus?.top10Percent
  const t10 = goplusTop10 !== null && goplusTop10 !== undefined ? Number(goplusTop10) : parseInt(reportData.top10_concentration)
  if (!Number.isNaN(t10) && t10 >= 70) negatives.push('持仓高度集中')
  if (positives.length === 0 && negatives.length === 0) return '数据采集中，解锁查看完整报告'
  const posPart = positives.slice(0, 2).join('并')
  const negPart = negatives.slice(0, 2).join('且')
  if (posPart && negPart) return `${posPart}，但${negPart}。`
  if (posPart) return `${posPart}，解锁查看详情。`
  return `${negPart}，建议深入评估。`
}

import { ChevronLeft, MessageCirclePlus, Mic, Keyboard, Send,
  AlertCircle
} from "lucide-react"
import PaymentModal from "../components/PaymentModal"

interface Message {
  id: string
  type: "ai" | "user"
  content: string | React.ReactNode
  messageType?: "text" | "card"
  isButton?: boolean
  subtitle?: string
  isForm?: boolean
  isScanButton?: boolean
  timestamp: Date
  // 报告卡片数据（渲染时创建组件，不存 JSX，避免 JSX-in-state 导致渲染崩溃）
  cardData?: ReportData
  cardProjectName?: string
  cardContractAddress?: string
}

const initialWelcomeMessage = `👋 你是不是也遇到过——
项目看着很火，投进去就跑路？
白皮书全是术语，根本看不懂？
群里都说好，一提现就卡？

我是明鉴风险洞察官。我的工作就是帮你提前看穿这些风险。

你只需要：把项目名称、合约地址、或者任何你看到的资料发给我。你给得越全，我分析得越准。

第一步完全免费：我会给你一份"快速扫描"，告诉你合约有没有问题、持币是不是集中、信息披露了多少。

如果你想看更深度的全景风险报告（包括六维诊断图、全网舆情、AI综合安全解读），只需要 2.99 USDT —— 相当于少吃一顿快餐，但可能帮你避开一个几万块的坑。`

// ===== ReportData 接口（DeepSeek API 返回结构）=====
interface ReportData {
  total_score: number
  risk_level: string
  conclusion: string
  six_dimensions: { dimension: string; score: number; max: number; deduction: string }[]
  radar_data: number[]
  public_opinion: string | { summary: string; negative_keywords: string[]; positive_indicators: string[] }
  ai_summary: string
  /** BSCTrace 链上真实数据（由 API 返回） */
  onChainData?: {
    tokenName: string
    tokenSymbol: string
    totalSupply: string
    decimals: number
    isContract: boolean
    codeSize: number
    chain: string
    /** GoPlus Security API 安全扫描数据 */
    goplus?: {
      lpLockStatus: '已锁定' | '未锁定' | '未知'
      lpLockInfo: string | null
      top10Percent: number | null
      isOpenSource: boolean | null
    }
  }
  /** DeepSeek 返回的定性字段 */
  liquidity_lock?: string
  top10_concentration?: string
  funding_record?: string
}

// ===== RiskReportCard（全景风险报告卡片）=====
function RiskReportCard({
  projectName,
  contractAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  onCopyAddress,
  onAnalyzeBusinessModel,
  reportData,
  assessmentCount = 0,
  lastEvaluation = '--',
}: {
  projectName: string
  contractAddress?: string
  onCopyAddress?: () => void
  onAnalyzeBusinessModel?: () => void
  reportData?: ReportData
  assessmentCount?: number
  lastEvaluation?: string
}) {

  // 🔧 维度满分映射（DeepSeek 可能不返回 max 字段）
  const dimensionMaxMap: Record<string, number> = {
    "代码与技术安全": 25,
    "团队与运营透明度": 20,
    "经济模型与资金安全": 20,
    "社群与市场热度": 15,
    "历史与执行可靠性": 10,
    "合规性与法律风险": 10,
  }

  // 📊 数据驱动：有 reportData 用真实数据，否则用 mock
  const rawDims = reportData?.six_dimensions
  // 检测哪些维度的得分为 null/undefined（用于雷达图下方标注）
  const dimsWithNullScore: string[] = Array.isArray(rawDims)
    ? rawDims.filter((d: any) => !(typeof d.score === 'number' && !Number.isNaN(d.score))).map((d: any) => d.dimension || "未知维度").filter(Boolean)
    : []
  const dimensions: Array<{ dimension: string; score: number; max: number; deduction: string }> = (
    Array.isArray(rawDims) && rawDims.length > 0
      ? rawDims.map((d: any) => ({
          dimension: d.dimension || "未知维度",
          score: typeof d.score === 'number' ? d.score : 0,
          max: typeof d.max === 'number' && d.max > 0 ? d.max : (dimensionMaxMap[d.dimension] || 10),
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
  )
  const totalScore = (() => {
    // 1. 从六个维度自动计算总分（最可靠，和展示保持一致）
    const dimScores = dimensions.map(d => d.score)
    const dimSum = dimScores.reduce((a, b) => a + b, 0)
    if (dimSum > 0) return dimSum
    // 2. 维度无数据时使用 API 返回的 total_score
    if (typeof reportData?.total_score === 'number' && reportData.total_score > 0) {
      return Math.round(reportData.total_score)
    }
    // 3. 无可信数据 → fallback
    return 45
  })()
  const hasRealTotalScore = totalScore > 0
  const riskLevel = reportData?.risk_level || "高风险"
  const conclusion = reportData?.conclusion || "不建议参与"

  // ── 分享卡片所需数据 ──
  const shareTop10Raw = reportData?.onChainData?.goplus?.top10Percent
  const shareTop10Holding = (shareTop10Raw !== null && shareTop10Raw !== undefined && !Number.isNaN(Number(shareTop10Raw)))
    ? Number(shareTop10Raw) : 0
  const shareRiskLevel = shareTop10Holding >= 70 ? '高度集中' : shareTop10Holding >= 50 ? '中度集中' : '分布较分散'
  const shareRiskColor: 'red' | 'orange' | 'yellow' | 'green' = shareTop10Holding >= 70 ? 'red' : shareTop10Holding >= 50 ? 'yellow' : 'green'
  // 信息完整性评分（统一算法，内联）
  const shareInfoCompleteness = (() => {
    if (reportData?.integrityScore !== undefined) return reportData.integrityScore
    let s = 10
    if (projectName && projectName !== '未命名项目') s += 5
    if (contractAddress && contractAddress !== '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' && contractAddress !== '无合约地址') s += 5
    const _onChain = reportData?.onChainData
    const hasOnChain = !!_onChain?.tokenName && _onChain.tokenName !== '未知'
    if (hasOnChain) s += 20
    if (reportData?.total_score !== undefined && reportData.total_score > 0) s += 20
    if (reportData?.public_opinion) s += 10
    if (reportData?.ai_summary) s += 10
    return hasOnChain ? Math.min(s, 95) : Math.min(s, 75)
  })()
  const shareCompletenessLevel = shareInfoCompleteness >= 70 ? '较高' : shareInfoCompleteness >= 45 ? '中等' : '较低'
  
  // 📝 public_opinion 兼容新旧格式（string | object）
  const publicOpinionRaw = reportData?.public_opinion
  const publicOpinionSummary = typeof publicOpinionRaw === 'string' 
    ? publicOpinionRaw 
    : (publicOpinionRaw?.summary || '')
  
  // 🔧 v5.13: 优先使用 DeepSeek AI 生成的综合解读，模板拼凑仅作 fallback
  const aiSummary = (reportData?.ai_summary && typeof reportData.ai_summary === 'string' && reportData.ai_summary.trim().length > 20)
    ? reportData.ai_summary
    : generateComprehensiveReview(normalizeReportData(reportData))

  // 雷达图数据
  const radarLabels = dimensions.map(d => d.dimension)
  const radarScores = dimensions.map(d => d.max > 0 ? d.score / d.max : 0)
  const radarActualScores = dimensions.map(d => `${d.score}/${d.max}`)

  // 风险等级颜色
  const riskColorMap: Record<string, string> = {
    "极低风险": "text-green-400",
    "低风险": "text-green-400",
    "中等风险": "text-yellow-400",
    "高风险": "text-red-500",
    "极高风险": "text-red-600",
  }
  const riskColor = riskColorMap[riskLevel] || "text-red-500"
  const conclusionEmoji = conclusion.includes("严禁") ? "🚫" : conclusion.includes("不建议") ? "❌" : conclusion.includes("谨慎") ? "⚠️" : "✅"

  // 🔗 链上真实数据（来自 NodeReal BSCTrace RPC）
  const onChain = reportData?.onChainData
  const hasOnChain = !!onChain?.tokenName && onChain.tokenName !== '未知'
  const onChainToken = hasOnChain ? onChain!.tokenSymbol : undefined

  return (
    <div className="w-full bg-zinc-900 rounded-lg border border-[#343438]">  {/* 报告标题 */}
      <div className="bg-gradient-to-r from-blue-950/50 to-purple-950/50 px-4 py-3 border-b border-[#343438] text-center">
        <h3 className="text-white font-semibold text-lg">全景风险报告 - {projectName}</h3>
        <p className="text-zinc-400 text-sm mt-1">明鉴·风险洞察官出品</p>
      </div>

      {/* 项目基本情报 — 复用 ProjectInfoCard */}
      <div className="px-4 py-3 border-b border-[#343438] bg-zinc-800/30">
        <ProjectInfoCard
          isEmbedded={true}
          projectName={projectName}
          contractAddress={contractAddress}
          reportData={reportData}
          onCopyAddress={onCopyAddress}
          linkedToken={onChainToken}
          aiSummary={reportData?.ai_summary}
          assessmentCount={assessmentCount}
          lastEvaluation={lastEvaluation}
        />
      </div>

      <div className="border-b border-[#343438]"></div>

      {/* 六维雷达图 */}
      <div className="px-4 py-3 border-b border-[#343438] bg-zinc-800/50">
        <h4 className="text-white font-semibold text-base mb-2 text-center">六维雷达图</h4>
        <RadarChart labels={radarLabels} scores={radarScores} actualScores={radarActualScores} />
        {dimsWithNullScore.length > 0 && (
          <p className="text-[#6B7280] text-sm text-center mt-2">
            {dimsWithNullScore.join("、")} 等维度数据采集中
          </p>
        )}
      </div>

      {/* 详细评分表 */}
      <div className="px-4 py-3 space-y-3">
        {dimensions.map((item, i) => {
          const hasScore = typeof item.score === 'number' && !Number.isNaN(item.score)
          return (
          <div key={i} className={`text-sm ${i > 0 ? "border-t border-[#343438] pt-3" : ""}`}>
            <p className="text-blue-400 font-semibold text-sm mb-1">{item.dimension}（{item.max} 分）</p>
            <p className={`text-xs mb-1 ${hasScore ? 'text-zinc-300' : 'text-[#6B7280]'}`}>
              得分：{hasScore ? `${item.score} / ${item.max}` : `— / ${item.max}`}
            </p>
            <p className="text-zinc-400 text-sm">扣分项：{(() => {
              const d = item.deduction || "无"
              // 截断超长扣分描述：只显示前2条要点（按中文分号分割）
              if (d.length > 60) {
                const parts = d.split(/[；;]/).filter(Boolean)
                if (parts.length > 2) {
                  return parts.slice(0, 2).join('；') + `…等${parts.length}项`
                }
                return d.substring(0, 80) + '…'
              }
              return d
            })()}</p>
          </div>
        )})}
        {dimensions.every(d => typeof d.score !== 'number' || Number.isNaN(d.score)) && (
          <p className="text-[#6B7280] text-sm text-center mt-2">六维数据采集中，请稍后刷新</p>
        )}
      </div>

      {/* 互联网舆情监测摘要 */}
      <div className="px-4 py-3 border-t border-[#343438] bg-zinc-800/30">
        <h4 className="text-white font-semibold text-base mb-3 text-center">互联网舆情监测摘要</h4>
        <div className="space-y-3 text-sm">
          <div className="bg-zinc-700/50 rounded p-2">
            <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap">{publicOpinionSummary || "暂无舆情数据"}</p>
          </div>
        </div>
      </div>

      {/* 综合评分与风险等级 */}
      <div className="px-4 py-3 border-t border-[#343438] bg-zinc-800/30 space-y-3">
        <h4 className="text-white font-semibold text-base text-center">综合评分与风险等级</h4>
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-300 shrink-0">综合评分</span>
          {hasRealTotalScore ? (
            <span className="text-white font-bold ml-2 text-right">{totalScore} / 100</span>
          ) : (
            <span className="text-[#6B7280] text-sm">评估中，请稍后刷新</span>
          )}
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-300 shrink-0">风险等级</span>
          <span className={`${riskColor} font-bold ml-2 text-right`}>{riskLevel}</span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-zinc-300 shrink-0 mr-2">建议</span>
          <span className={`${riskColor} font-bold text-right flex-1`}>{conclusionEmoji} {conclusion}</span>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 mt-2">
          <p className="text-red-400 text-sm leading-relaxed">
            {reportData ? `明鉴评分 ${totalScore}/100，综合评定为${riskLevel}。` : "该项目存在锁仓机制不透明、模式多次变更等风险，建议谨慎。"}
          </p>
        </div>
      </div>

      {/* 🚨 恶意特征警告横幅 */}
      {(reportData as any)?.malicious_features?.detected && (
        <div className="bg-red-900/30 border-t border-b border-red-500/50 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-xl leading-none mt-0.5">🚨</span>
            <div>
              <div className="text-red-400 font-semibold text-sm">检测到恶意特征</div>
              <div className="text-zinc-300 text-[11px] mt-0.5">
                该项目存在以下恶意特征：{((reportData as any).malicious_features.features || []).join('、')}
              </div>
              {(reportData as any).malicious_features.evidence && (
                <div className="text-zinc-500 text-[10px] mt-1 leading-relaxed">
                  {(reportData as any).malicious_features.evidence}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 综合解读 */}
      <div className="px-4 py-3 border-t border-[#343438] bg-zinc-800/30">
        <h4 className="text-white font-semibold text-base mb-2 text-center">明鉴·风险洞察官综合解读</h4>
        <p className="text-zinc-200 text-sm leading-relaxed">
          {aiSummary}
        </p>
      </div>

      {/* 免责声明 */}
      <div className="px-4 py-3 border-t border-[#343438] bg-zinc-700/20">
        <h4 className="text-white font-semibold text-base mb-2 text-center">免责声明</h4>
        <p className="text-zinc-300 text-sm leading-relaxed">
          本报告基于公开信息生成，仅供参考，不构成投资建议。用户应自行核实并承担风险。
        </p>
      </div>

      <div className="border-t border-[#343438]"></div>

      {/* 底部操作按钮 */}
      <div className="space-y-2 px-4 pb-4">
        <div className="border-t border-[#343438] -mx-4"></div>

        <ShareProjectDrawer
          projectName={projectName}
          contractAddress={contractAddress}
          top10Holding={shareTop10Holding}
          riskLevel={shareRiskLevel}
          riskColor={shareRiskColor}
          infoCompleteness={shareInfoCompleteness}
          completenessLevel={shareCompletenessLevel}
          review={generateShortReview(reportData)}
          label="分享项目情报"
          className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 hover:text-blue-300 text-white text-sm font-medium py-2.5 rounded-full transition-colors"
        />

        <button
          onClick={onAnalyzeBusinessModel}
          className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 hover:text-blue-300 text-white text-sm font-medium py-2.5 rounded-full transition-colors"
        >
          分析该项目的商业模式
        </button>
      </div>
    </div>
  )
}


// ===== Main Component =====
const initialMessages = (): Message[] => [
  {
    id: "1",
    type: "ai",
    content: initialWelcomeMessage,
    timestamp: new Date(),
  },
  {
    id: "2",
    type: "ai",
    content: "我们是怎么审查的？",
    isButton: true,
    subtitle: "点这里了解评估标准",
    timestamp: new Date(Date.now() + 500),
  },
  {
    id: "ready-prompt",
    type: "ai",
    content: "准备好了吗？在下方输入项目名称或合约地址，开始查第一个项目。",
    timestamp: new Date(Date.now() + 1000),
  },
  {
    id: "4",
    type: "ai",
    isForm: true,
    content: "form",
    timestamp: new Date(Date.now() + 1500),
  },
  {
    id: "5",
    type: "ai",
    content: "如果您知道该项目曾经变更过模式（如矿机→质押）或项目方团队有过负面历史，您可以在下方输入框用文字或语音进一步说明。当您认为信息已完整提供，您可点击下方按钮，开始进行项目审查。",
    timestamp: new Date(Date.now() + 2000),
  },
  {
    id: "6",
    type: "ai",
    content: "开始快速扫描",
    isScanButton: true,
    subtitle: "快速扫描完全免费，约10~30秒内返回结果",
    timestamp: new Date(Date.now() + 2500),
  },
]

export default function RiskAssessment() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isConnected, address } = useAccount()

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem('wisescan_risk_messages')
      const parsed = saved ? JSON.parse(saved) : null
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          // 🛡️ 过滤已损坏的消息：只有 content 和 cardData 都为空时才丢弃
          .filter((m: any) => !(m.content === '' && !m.cardData))
          .map((m: any) => ({
            ...m,
            content: typeof m.content === 'string' ? m.content : '',
            timestamp: new Date(m.timestamp),
          }))
      }
    } catch { /* ignore */ }
    return []
  })
  const [inputValue, setInputValue] = useState("")
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [asrError, setAsrError] = useState<string | null>(null)
  const asrClientRef = useRef<TencentAsrClient | null>(null)  // 阶段六：腾讯云 ASR 客户端
  const [showMethodologyModal, setShowMethodologyModal] = useState(false)
  const [, setCopied] = useState(false)
  const [showNewConversationModal, setShowNewConversationModal] = useState(false)
  const [showBackConfirmModal, setShowBackConfirmModal] = useState(false)
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false)
  const [showContractHelper, setShowContractHelper] = useState(false)
  const [showSmartSearch, setShowSmartSearch] = useState(false)
  const [noContractMode, setNoContractMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ address: string; name: string; symbol: string; chainId: string }>>([])
  const [searching, setSearching] = useState(false)
  const paidKey = "wisescan_assessment_unlocked"
  // 获取当前合约地址对应的专属付费 key（实现按项目付费，不串）
  const getProjectPaidKey = (addr: string) => addr ? `wisescan_paid_${addr.toLowerCase()}` : paidKey
  const [isReportPaid, setIsReportPaid] = useState(() => {
    try { return sessionStorage.getItem(paidKey) === 'true' } catch { return false }
  })
  // 对话权限状态（阶段五：免费 vs 付费）
  const [chatIsPaid, setChatIsPaid] = useState(false)
  const [conversationCount, setConversationCount] = useState(0)
  const [, setRemainingCount] = useState(5)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [formData, setFormData] = useState(() => {
    const defaultForm = {
      projectName: "",
      contractAddress: "",
      website: "",
      community: "",
      whitepaper: "",
      remarks: "",
      images: [] as File[],
    }
    try {
      const saved = sessionStorage.getItem('wisescan_risk_form')
      if (saved) {
        const parsed = JSON.parse(saved)
        return { ...defaultForm, ...parsed, images: [] as File[] }
      }
    } catch {}
    return defaultForm
  })
  const [evidenceImages, setEvidenceImages] = useState<File[]>([])
  const [evidenceText, setEvidenceText] = useState("")
  const [scanImagePreviews, setScanImagePreviews] = useState<string[]>([])
  // Ref 突破 JSX 闭包：ProjectInfoCard 是在 setTimeout 内创建的，props 冻结。
  // 后续 state 变化不会反映到已存储的 JSX 元素中。通过 ref 保持最新值。
  const cardStateRef = useRef<{
    isReportPaid: boolean
    evidenceImages: File[]
    evidenceText: string
    reportDataReady: boolean
    reportData: ReportData | null
    projectAnalysis: {
      total_score: number
      risk_level: string
      conclusion: string
      six_dimensions: Array<{ dimension: string; score: number; deduction: string }>
      public_opinion: { summary: string; negative_keywords: string[]; positive_indicators: string[] }
      ai_summary: string
    } | null
    reportFailed: boolean
    assessmentCount: number
    lastEvaluation: string
    linkedToken: string
  }>({
    isReportPaid: false,
    evidenceImages: [],
    evidenceText: "",
    reportDataReady: false,
    reportData: null,
    projectAnalysis: null,
    reportFailed: false,
    assessmentCount: 0,
    lastEvaluation: '--',
    linkedToken: '',
  })
  useEffect(() => { cardStateRef.current.isReportPaid = isReportPaid }, [isReportPaid])
  useEffect(() => { cardStateRef.current.evidenceImages = evidenceImages }, [evidenceImages])
  useEffect(() => { cardStateRef.current.evidenceText = evidenceText }, [evidenceText])

  // 阶段五：同步对话付费状态
  useEffect(() => { setChatIsPaid(isReportPaid) }, [isReportPaid])
  // 阶段五：合约地址或付费状态变化 → 重置对话计数
  useEffect(() => {
    const key = `wisescan_chat_${formData.contractAddress?.trim() || 'unknown'}`
    const saved = sessionStorage.getItem(key)
    setConversationCount(saved ? parseInt(saved, 10) : 0)
    setRemainingCount(isReportPaid ? -1 : 5)
  }, [formData.contractAddress, isReportPaid])

  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertMsg, setAlertMsg] = useState("")
  const [alertShowResetBtn, setAlertShowResetBtn] = useState(false)
  const [preloadedReportData, setPreloadedReportData] = useState<ReportData | null>(() => {
    try {
      const saved = sessionStorage.getItem('wisescan_risk_report')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [resolvedProjectName, setResolvedProjectName] = useState<string | null>(null)
  const [projectAliasesFromApi, setProjectAliasesFromApi] = useState<string[]>([])
  useEffect(() => { cardStateRef.current.reportDataReady = !!preloadedReportData }, [preloadedReportData])
  useEffect(() => { cardStateRef.current.projectAnalysis = preloadedReportData as any }, [preloadedReportData])
  // 🔧 新扫出报告 → 重置对话计数为 0（防止旧项目 stale count 污染新对话）
  useEffect(() => {
    if (preloadedReportData) {
      const addr = (preloadedReportData as any).contractAddress?.trim() || (preloadedReportData as any).contract_address?.trim() || ''
      const key = addr ? `wisescan_chat_${addr}` : 'wisescan_chat_unknown'
      sessionStorage.removeItem(key)
      setConversationCount(0)
      setRemainingCount(isReportPaid ? -1 : 5)
    }
  }, [preloadedReportData, isReportPaid])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const pendingCardScrollRef = useRef(false)
  const skipInitialScrollRef = useRef(true)
  // 防止重复生成卡片
  const hasProjectInfoRef = useRef(false)
  const projectInfoCardIdRef = useRef<string | null>(null)
  const hasRiskReportRef = useRef(false)
  const riskReportCardIdRef = useRef<string | null>(null)
  const loadingMsgIdRef = useRef<string | null>(null)
  const reportFailedRef = useRef(false)  // 报告生成失败标记，允许免费重试
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)  // 跟进消息定时器
  const isOnboardingRef = useRef(false)  // 引导推送中标记（推送期间不自动滚动）
  const onboardingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])  // 引导推送定时器（用于清理）

  // 图片去重：持久化 ref 层跟踪所有已上传文件的 name+size key（跨渲染保持，即使 formData 异常重置也不丢失）
  const uploadedFileKeysRef = useRef<Set<string>>(new Set())

  // 钱包断开时重定向（仅从未在本会话连接过时才跳转，避免切APP/锁屏时误跳）
  useEffect(() => {
    if (isConnected) {
      sessionStorage.setItem('wisescan_wallet_connected', '1')
      return
    }
    const wasConnected = sessionStorage.getItem('wisescan_wallet_connected')
    if (!wasConnected) navigate("/")
  }, [isConnected, navigate])

  // 🎤 ASR 错误提示：3 秒后自动消失
  useEffect(() => {
    if (!asrError) return
    const timer = setTimeout(() => setAsrError(null), 3000)
    return () => clearTimeout(timer)
  }, [asrError])

  // ── 持久化：消息变化时保存到 sessionStorage（刷新不丢失）──
  useEffect(() => {
    if (messages.length > 0) {
      const safe = messages.map(m => ({
        id: m.id, type: m.type, content: typeof m.content === 'string' ? m.content : '',
        messageType: m.messageType, subtitle: m.subtitle, isButton: m.isButton,
        isForm: m.isForm, isScanButton: m.isScanButton, timestamp: m.timestamp,
        cardData: m.cardData, cardProjectName: m.cardProjectName, cardContractAddress: m.cardContractAddress,
      }))
      try { sessionStorage.setItem('wisescan_risk_messages', JSON.stringify(safe)) } catch {}
    }
  }, [messages])

  // ── 持久化：报告数据变化时保存/清除（刷新不丢失）──
  useEffect(() => {
    if (preloadedReportData) {
      try { sessionStorage.setItem('wisescan_risk_report', JSON.stringify(preloadedReportData)) } catch {}
    } else {
      try { sessionStorage.removeItem('wisescan_risk_report') } catch {}
    }
  }, [preloadedReportData])

  // ── 持久化：表单数据变化时保存到 sessionStorage（刷新不丢失，退出清空）──
  useEffect(() => {
    const safe = {
      projectName: formData.projectName,
      contractAddress: formData.contractAddress,
      website: formData.website,
      community: formData.community,
      whitepaper: formData.whitepaper,
      remarks: formData.remarks,
    }
    try { sessionStorage.setItem('wisescan_risk_form', JSON.stringify(safe)) } catch {}
  }, [formData])

  // 🎯 页面加载时的智能定位
  //  老用户无聊天记录 → 滚到表单位置（延迟等 DOM 稳定）
  //  老用户有聊天记录 → 立即滚到消息底部（覆盖浏览器刷新默认）
  //  全新用户 → 不处理，由引导推送控制
  useEffect(() => {
    const isOnboarded = localStorage.getItem('wisescan_completed_first_scan') === 'true'
    if (!isOnboarded) return
    const hasActiveChat = messages.length > initialMessages().length
    if (hasActiveChat) {
      // 有交互记录 → 立即滚到底部，避免浏览器默认 (0,0) 闪烁
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' })
      })
    } else {
      // 无交互记录 → 延迟等 DOM 稳定后滚到 ready-prompt
      const t = setTimeout(() => {
        const el = document.querySelector('[data-message-id="ready-prompt"]')
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
      }, 500)
      return () => clearTimeout(t)
    }
  }, [])

  // ⚠️ 后续消息变化时滚到底部（跳过首次消息渲染）
  const hasSkippedInitialMount = useRef(false)
  useEffect(() => {
    if (isOnboardingRef.current) return
    if (!hasSkippedInitialMount.current) {
      hasSkippedInitialMount.current = true
      return  // 首次加载跳过（由上面的初始定位 effect 处理）
    }
    // 卡片滚动由各自的 handler 手动处理，这里跳过避免双次滚动
    if (pendingCardScrollRef.current) {
      pendingCardScrollRef.current = false
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 新用户引导：逐步推送消息，完成后恢复自动滚动
  useEffect(() => {
    // 如果 sessionStorage 中有已持久化的消息（说明是刷新而非首次加载），不覆盖
    const hasPersisted = (() => {
      try {
        const saved = sessionStorage.getItem('wisescan_risk_messages')
        if (!saved) return false
        const parsed = JSON.parse(saved)
        return Array.isArray(parsed) && parsed.length > 0
      } catch { return false }
    })()
    if (hasPersisted) return

    const onboarded = localStorage.getItem('wisescan_completed_first_scan') === 'true'
    const all = initialMessages()

    if (onboarded) {
      // 老用户：直接全展示（但消息已通过 lazy init 加载，避免重复 setMessages 触发 scrollToBottom）
      if (messages.length !== all.length) {
        setMessages(all)
      }
    } else {
      // 新用户：逐步推送（每条间隔 2 秒）
      isOnboardingRef.current = true
      onboardingTimersRef.current = []
      all.forEach((msg, i) => {
        const timer = setTimeout(() => {
          setMessages(prev => [...prev, msg])
          // 最后一条推送完成后恢复自动滚动
          if (i === all.length - 1) {
            setTimeout(() => { isOnboardingRef.current = false }, 100)
          }
        }, i * 2000)
        onboardingTimersRef.current.push(timer)
      })
    }
  }, [])

  /** 滚动到聊天容器底部 */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  /** 滚动到聊天容器内指定卡片（标题可见） */
  const scrollToCard = (cardId: string) => {
    // 双 rAF 确保 React 已完成 DOM 更新和浏览器布局
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-message-id="${cardId}"]`)
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      })
    })
  }

  const handleOpenModal = useCallback(() => {
    setShowMethodologyModal(true)
  }, [])

  const handleCopyAddress = useCallback(async () => {
    const addr = noContractMode ? "无合约地址" : (formData.contractAddress.trim() || "")
    if (!addr || addr === "无合约地址") return
    const ok = await copyToClipboard(addr)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [formData.contractAddress])

  const handleSendMessage = async (voiceText?: string) => {
    const messageText = voiceText?.trim() || inputValue.trim()
    if (!messageText) return

    const userContent = messageText
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: userContent,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue("")

    // 插入 loading 消息
    const loadingId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, {
      id: loadingId,
      type: "ai",
      content: "正在分析中...",
      timestamp: new Date(),
    }])

    try {
      // 构建对话历史（最近 10 条，排除 loading 消息）
      const chatHistory = (messages as any[])
        .filter(m => m.type !== "card" && !m.isForm && !m.isButton && !m.isScanButton && m.content !== "正在分析中...")
        .slice(-10)
        .filter(m => typeof m.content === 'string')
        .map(m => ({ type: m.type, content: m.content as string }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: resolvedProjectName || formData.projectName?.trim() || '未命名项目',
          contract_address: formData.contractAddress?.trim() || undefined,
          message: userContent,
          chat_history: chatHistory,
          user_address: address || 'anonymous',
          conversation_count: conversationCount,
          is_paid: chatIsPaid,
          report_data: reportData || preloadedReportData || undefined,
          page: 'risk',
          user_notes: formData.remarks?.trim() || undefined,
          website: formData.website?.trim() || undefined,
          community: formData.community?.trim() || undefined,
          whitepaper: formData.whitepaper?.trim() || undefined,
        }),
      });

      const data = await res.json();

      // 阶段五：处理免费用户达到上限
      if (res.status === 403 && data.error === 'FREE_LIMIT_REACHED') {
        setRemainingCount(0)
        setMessages((prev) => {
          const withoutLoading = prev.filter(m => m.id !== loadingId);
          return [...withoutLoading, {
            id: (Date.now() + 2).toString(),
            type: "ai" as const,
            content: data.reply || "您已达到免费对话上限。解锁全景风险报告后，可继续深入讨论本项目。",
            timestamp: new Date(),
          }];
        });
        return;
      }

      // 阶段五：更新付费状态和剩余次数
      if (data.is_paid) setChatIsPaid(true)
      if (typeof data.remaining_count === 'number') setRemainingCount(data.remaining_count)

      // 阶段五：递增 sessionStorage 对话计数
      const chatKey = `wisescan_chat_${formData.contractAddress?.trim() || 'unknown'}`
      const newCount = conversationCount + 1
      sessionStorage.setItem(chatKey, String(newCount))
      setConversationCount(newCount)

      // 移除 loading，插入真实回复
      setMessages((prev) => {
        const withoutLoading = prev.filter(m => m.id !== loadingId);
        if (data.success && data.reply) {
          return [...withoutLoading, {
            id: (Date.now() + 2).toString(),
            type: "ai" as const,
            content: data.reply,
            timestamp: new Date(),
          }];
        }
        return [...withoutLoading, {
          id: (Date.now() + 2).toString(),
          type: "ai" as const,
          content: "抱歉，分析服务暂时不可用，请稍后再试。",
          timestamp: new Date(),
        }];
      });
    } catch (err) {
      console.error('[对话] API 调用失败:', err);
      setMessages((prev) => {
        const withoutLoading = prev.filter(m => m.id !== loadingId);
        return [...withoutLoading, {
          id: (Date.now() + 2).toString(),
          type: "ai" as const,
          content: "抱歉，网络连接异常，请检查网络后重试。",
          timestamp: new Date(),
        }];
      });
    }
  }

  // 前端直写 risk_reports（确保付费状态跨页面持久化）
  // 先插新记录，再删旧记录，确保不丢数据
  const saveRiskReport = async (reportData: any) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      const addr = formData.contractAddress.trim()

      // 第0步：先通过服务器 upsert API（用 service role key）确保 projects 表有记录
      //   比前端直写更可靠（RLS/ANON_KEY 可能无权限 INSERT）
      let projectId: string | null = null
      try {
        await fetch('/api/projects/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.projectName || 'Unknown',
            contract_address: addr,
            chain: /^T[A-Za-z1-9]{33}$/.test(addr) ? 'TRON' : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr) ? 'Solana' : 'EVM',
          }),
        })
        // 再查 projects 表拿 id
        const { data: proj } = await supabase.from('projects').select('id').eq('contract_address', addr.toLowerCase()).maybeSingle()
        projectId = proj?.id || null
      } catch {
        // fallback：直接在前端查/创建
        const { data: proj } = await supabase.from('projects').select('id').eq('contract_address', addr.toLowerCase()).maybeSingle()
        projectId = proj?.id || null
        if (!projectId) {
          const { data: newProj, error: createErr } = await supabase.from('projects').insert({
            name: formData.projectName || 'Unknown',
            contract_address: addr.toLowerCase(),
            chain: /^T[A-Za-z1-9]{33}$/.test(addr) ? 'TRON' : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr) ? 'Solana' : 'EVM',
          }).select('id').maybeSingle()
          if (createErr) {
            const { data: existing } = await supabase.from('projects').select('id').eq('contract_address', addr.toLowerCase()).maybeSingle()
            projectId = existing?.id || null
          } else {
            projectId = newProj?.id || null
          }
        }
      }
      if (projectId) console.log('📌 saveRiskReport projectId:', projectId)
      // 第1步：插入新记录
      const { data: inserted, error: insErr } = await supabase.from('risk_reports').insert({
        user_address: (address || 'anonymous').toLowerCase(),
        project_id: projectId || null,
        report_data: reportData,
        // 总分用六维之和（和前端展示一致），避免 API 返回的 total_score 和维度不一致
        total_score: Array.isArray(reportData?.six_dimensions)
          ? reportData.six_dimensions.reduce((s, d) => s + (d.score || 0), 0)
          : (reportData.total_score || 0),
        risk_level: reportData.risk_level,
      }).select('id')
      if (insErr) {
        console.warn('⚠️ risk_reports 写入失败:', insErr.message)
        return
      }
      const newId = inserted?.[0]?.id
      console.log('💾 risk_reports 写入成功, id:', newId)
      // 第2步：删除该用户该项目的旧记录（排除新插入的）
      if (newId && projectId) {
        await supabase.from('risk_reports').delete()
          .eq('project_id', projectId)
          .ilike('user_address', (address || 'anonymous').toLowerCase())
          .neq('id', newId)
        // 防御性清理：如果仍有同一用户同一项目的多条记录，只保留最新一条
        const { data: remaining } = await supabase.from('risk_reports')
          .select('id')
          .eq('project_id', projectId)
          .ilike('user_address', (address || 'anonymous').toLowerCase())
          .order('created_at', { ascending: false })
        if (remaining && remaining.length > 1) {
          const idsToDelete = remaining.slice(1).map((r: any) => r.id)
          await supabase.from('risk_reports').delete().in('id', idsToDelete)
          console.log('🧹 旧报告已清理 + 防御性清理', idsToDelete.length, '条')
        } else {
          console.log('🧹 旧报告已清理')
        }
      }
    } catch (e: any) {
      console.warn('⚠️ risk_reports 写入失败:', e.message)
    }
  }

  const [showCouponModal, setShowCouponModal] = useState(false)
  const [couponAmount, setCouponAmount] = useState(0)
  const [pendingUnlockProjectName, setPendingUnlockProjectName] = useState('') // 暂存待解锁的项目名
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingPaymentProjectName, setPendingPaymentProjectName] = useState('')

  const handleReportUnlock = async (projectName: string) => {
    // 🏷️ 跳过支付（调试用：VITE_SKIP_PAYMENT=true 时直接生成报告，不弹支付窗）
    if (import.meta.env.VITE_SKIP_PAYMENT === 'true') {
      doGenerateReport(projectName)
      return
    }

    // 正在生成中 → 防止重复
    if (isGeneratingReport) {
      return
    }

    // 💰 已付费用户且当前合约地址已付费 → 可免费重试
    const currentAddr = formData.contractAddress.trim()
    const paidForThisProject = currentAddr && sessionStorage.getItem(getProjectPaidKey(currentAddr)) === 'true'
    if (paidForThisProject) {
      doGenerateReport(projectName)
      return
    }

    // 先查用户有没有代金券
    try {
      const coupRes = await fetch(`/api/coupons/list?user_address=${address}`, {
        headers: { 'Content-Type': 'application/json' },
      })
      const coupData = await coupRes.json()
      const activeCoupons = (coupData.coupons || []).filter((c: any) => c.status === 'active')
      if (activeCoupons.length > 0) {
        // 有代金券 → 显示抵扣提示弹窗
        setCouponAmount(parseFloat(activeCoupons[0].amount) || 2.99)
        setPendingUnlockProjectName(projectName)
        setShowCouponModal(true)
        return // 等用户确认后再继续
      }
    } catch { /* 查询失败直接走支付弹窗 */ }

    // 无代金券 → 弹出支付窗（链上 USDT 支付）
    setPendingPaymentProjectName(projectName)
    setShowPaymentModal(true)
  }

  // 用户确认弹窗后执行真正的解锁
  const handlePaymentSuccess = () => {
    setShowPaymentModal(false)
    doGenerateReport(pendingPaymentProjectName || formData.projectName || "未命名项目")
  }

  const doGenerateReport = async (projectName: string) => {
    // 消耗代金券
    try {
      const coupRes = await fetch('/api/coupons/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_address: address }),
      })
      const coupData = await coupRes.json()
      if (coupData.success && coupData.used > 0) {
        console.log(`💳 消耗代金券 ${coupData.amount} USDT (${coupData.used} 张)`)
      }
    } catch { /* 代金券消耗失败不影响报告生成 */ }

    // 标记当前项目已付费（全局 + 按合约地址独立，不同项目不串）
    sessionStorage.setItem(paidKey, "true")
    const addr = formData.contractAddress.trim()
    if (addr) sessionStorage.setItem(getProjectPaidKey(addr), "true")
    setIsReportPaid(true)
    setIsGeneratingReport(true)
    hasRiskReportRef.current = true

    // 💬 插入 loading 消息气泡
    const evidenceMsg = evidenceImages.length > 0 || evidenceText.length > 0
      ? `，已补充${evidenceImages.length}张图片、${evidenceText.length}字文本等证据`
      : ""
    const loadingId = (Date.now()).toString()
    loadingMsgIdRef.current = loadingId
    setMessages((prev) => [...prev, {
      id: loadingId,
      type: "ai",
      content: `正在生成全景风险报告${evidenceMsg}，请稍等...`,
      timestamp: new Date(),
    }])
    scrollToBottom()

    const pName = formData.projectName.trim() || projectName || "未命名项目"

    // 🆕 将表单"补充说明"中的图片转 base64（并行转换）
    const formImages = (formData.images as File[]) || []
    let userNotesImages: string[] = []
    if (formImages.length > 0) {
      userNotesImages = await Promise.all(
        formImages.map(f => new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '')
          reader.onerror = () => resolve('')
          reader.readAsDataURL(f)
        }))
      ).then(arr => arr.filter(Boolean))
    }

    // 构建请求体（含补充说明 + 图片）
    const buildRequestBody = (base: Record<string, unknown>) => ({
      ...base,
      user_notes: formData.remarks?.trim() || undefined,
      user_notes_images: userNotesImages.length > 0 ? userNotesImages : undefined,
      website: formData.website?.trim() || undefined,
      community: formData.community?.trim() || undefined,
      whitepaper: formData.whitepaper?.trim() || undefined,
    })

    // 🔗 同步到 Supabase（并行执行，不阻塞）
    // 使用 /api/projects/upsert 统一去重，免于 /api/add-project 重复调用

    // 📦 优先使用预存数据（免费阶段已验证过）
    //    如果预存为空（后台预加载还没完成），则同步调用 API 等待
    let fetchedData: ReportData | null = null
    let apiResolvedName: string | null = null  // ← API 返回的修正项目名（本地变量，绕过 React 闭包）
    let apiProjectAliases: string[] = []
    if (!preloadedReportData) {
      const handleApiError = () => {
        setMessages((prev) => prev.filter(m => m.id !== loadingMsgIdRef.current).concat([
          {
            id: (Date.now()).toString(),
            type: "ai",
            content: "⚠️ 报告生成遇到点小状况，请重新点击解锁按钮",
            timestamp: new Date(),
          },
        ]))
        loadingMsgIdRef.current = null
        hasRiskReportRef.current = false
        reportFailedRef.current = true   // ← 标记失败，允许免费重试
        cardStateRef.current.reportFailed = true
        setIsGeneratingReport(false)
        scrollToBottom()
      }
      try {
        const res = await fetch('/api/generate-risk-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildRequestBody({
            project_name: pName,
            contract_address: addr || undefined,
            user_address: address || 'anonymous',
          })),
        })
        if (!res.ok) { handleApiError(); return }
        const json = await res.json()
        if (!json.success || !json.data) { handleApiError(); return }
        fetchedData = json.data
        // 注入链上真实数据
        if (json.onChainData) {
          fetchedData = { ...json.data, onChainData: json.onChainData }
        }
        // 同步存入 risk_reports（确保付费状态跨页面持久化）
        saveRiskReport(fetchedData).catch(e => console.warn('⚠️ risk_reports 写入:', e.message))
        setReportData(fetchedData)
        // 🔍 捕获 API 返回的修正项目名（对齐 free scan 流程）
        //    本地变量优先（绕过 React 闭包），同时写 state（供后续渲染使用）
        if (json.resolvedName && json.resolvedName !== pName) {
          apiResolvedName = json.resolvedName
          apiProjectAliases = json.projectAliases || []
          setResolvedProjectName(json.resolvedName)
          setProjectAliasesFromApi(json.projectAliases || [])
          console.log(`🔍 [ReportUnlock] 项目名已修正: "${pName}" → "${json.resolvedName}" (别名: ${(json.projectAliases || []).join(', ')})`)
        }
      } catch {
        handleApiError()
        return
      }
    } else {
      fetchedData = preloadedReportData
      setReportData(preloadedReportData)
    }

    setIsGeneratingReport(false)
    reportFailedRef.current = false       // ← 成功，清除失败标记
    cardStateRef.current.reportFailed = false

    // 💬 移除 loading 消息
    setMessages((prev) => prev.filter(m => m.id !== loadingMsgIdRef.current))
    loadingMsgIdRef.current = null

    // ✅ 存报告数据到消息中（不存 JSX 组件，渲染时再创建，避免 JSX-in-state 导致的渲染崩溃）
    const cardId = (Date.now() + 2).toString()
    riskReportCardIdRef.current = cardId
    // 🔍 显示名：本地变量优先（绕过 React 闭包），state 作为 fallback
    const effectiveResolvedName = apiResolvedName || resolvedProjectName
    const effectiveAliases = apiResolvedName ? apiProjectAliases : projectAliasesFromApi
    const displayPName = effectiveResolvedName && effectiveResolvedName !== pName
      ? `${effectiveResolvedName} (${[pName, ...effectiveAliases.filter(a => a !== pName)].join(', ')})`
      : pName
    const reportMessage: Message = {
      id: cardId,
      type: "ai",
      content: "",
      messageType: "risk-report",
      cardData: fetchedData || undefined,
      cardProjectName: displayPName,
      cardContractAddress: addr || "无合约地址",
      timestamp: new Date(),
    }
    pendingCardScrollRef.current = true
    setMessages((prev) => [...prev, reportMessage])
    scrollToCard(cardId)

    // 更新全网项目库（双写：localStorage + Supabase API）
    const updatedRecord = upsertProject({
      name: pName,
      contractAddress: addr || undefined,
      hasReport: true,
    })
    // 同步更新 cardStateRef（确保 RiskReportCard 展示最新的评估次数）
    if (updatedRecord) {
      cardStateRef.current.assessmentCount = updatedRecord.assessmentCount
      cardStateRef.current.lastEvaluation = updatedRecord.lastEvaluatedAt
        ? new Date(updatedRecord.lastEvaluatedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
        : '--'
    }
    // 同步 Supabase 项目计数
    fetch('/api/projects/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pName, contract_address: addr, chain: 'EVM' }),
    }).catch(() => {})
    // Supabase 同步（异步，不阻塞）
    if (addr) {
      fetch('/api/projects/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pName,
          contract_address: addr,
          chain: /^T[A-Za-z1-9]{33}$/.test(addr) ? 'TRON' : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr) ? 'Solana' : 'EVM',
        }),
      }).catch(() => { /* 静默 */ });
    }

    // 追加跟进消息（仅当报告卡片渲染成功后）
    followUpTimerRef.current = setTimeout(() => {
      pendingCardScrollRef.current = true
      setMessages((prev) => [...prev, {
        id: (Date.now() + 3).toString(),
        type: "ai",
        content: "如果您对全景风险报告内容仍有疑问，可以在下方输入框用文字或语音进一步咨询，我会为您解答。",
        timestamp: new Date(),
      }])
    }, 800)
  }

  // CRC32 表（用于图片内容去重，不依赖 crypto.subtle，兼容 http 局域网调试）
  const CRC32_TABLE = useMemo(() => {
    const table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      }
      table[i] = c >>> 0
    }
    return table
  }, [])

  const crc32 = useCallback((bytes: Uint8Array) => {
    let c = -1 >>> 0
    for (let i = 0; i < bytes.length; i++) {
      c = (CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)) >>> 0
    }
    return (c ^ (-1 >>> 0)) >>> 0
  }, [CRC32_TABLE])

  /** 计算文件内容 key：前 8KB 字节的 CRC32 + 文件大小（比 name+size 更稳，TP Wallet 文件名可能变化） */
  const computeFileKey = useCallback(async (file: File): Promise<string> => {
    try {
      const slice = file.slice(0, 8192)
      const buffer = await slice.arrayBuffer()
      const uint8 = new Uint8Array(buffer)
      const hash = crc32(uint8)
      return `${file.size}_${hash.toString(16).padStart(8, '0')}`
    } catch {
      // 极端降级：文件名+大小
      return `${file.name}_${file.size}`
    }
  }, [crc32])

  const handleScanImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newFiles = Array.from(files)
    const current = formData.images as File[]
    const total = current.length + newFiles.length
    if (total > 10) {
      setAlertMsg("⚠️ 上传数量超限\n\n最多支持上传10张图片，请减少后重试。")
      setShowAlertModal(true)
      return
    }
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"]

    // 重复校验（三层防御）：
    // 1) 当前 formData.images 里的文件名+大小
    // 2) uploadedFileKeysRef 持久化 tracking（Ref 层）
    // 3) 文件内容前 8KB 的 CRC32 + size（TP Wallet 等环境文件名可能变化）
    const existingKeys = new Set([
      ...current.map(f => `${f.name}_${f.size}`),
      ...Array.from(uploadedFileKeysRef.current),
    ])
    const newFileKeys = await Promise.all(newFiles.map(async (file) => ({
      file,
      key: await computeFileKey(file),
    })))

    const duplicateNames: string[] = []
    const uniqueNewFiles: File[] = []
    for (const { file, key } of newFileKeys) {
      if (!validTypes.includes(file.type)) {
        setAlertMsg(`⚠️ 文件格式不支持\n\n${file.name} 格式不支持，仅支持 JPG/PNG 格式。`)
        setShowAlertModal(true)
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setAlertMsg(`⚠️ 文件过大\n\n${file.name} 超过5MB限制，请压缩后重新上传。`)
        setShowAlertModal(true)
        return
      }
      if (existingKeys.has(key)) {
        duplicateNames.push(file.name)
      } else {
        uniqueNewFiles.push(file)
        existingKeys.add(key)
        uploadedFileKeysRef.current.add(key)  // 写入持久化 ref
      }
    }
    if (duplicateNames.length > 0) {
      setAlertMsg(`⚠️ 文件已存在\n\n${duplicateNames.join(", ")} 已存在，已自动跳过重复文件。`)
      setShowAlertModal(true)
    }
    if (uniqueNewFiles.length === 0) return
    setFormData(prev => ({ ...prev, images: [...current, ...uniqueNewFiles] }))
    // 生成缩略图预览
    const newPreviews = uniqueNewFiles.map(f => URL.createObjectURL(f))
    setScanImagePreviews(prev => [...prev, ...newPreviews])
    e.target.value = ""
  }

  /** 删除已上传图片 */
  const handleRemoveScanImage = (index: number) => {
    setFormData(prev => {
      const images = prev.images as File[]
      return { ...prev, images: images.filter((_, i) => i !== index) }
    })
    setScanImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  /** 风险扫描图片上传：动态创建 input（Android 多选兼容，触发系统相册网格视图） */
  const handleScanImageUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*'
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      if (target.files && target.files.length > 0) {
        await handleScanImageChange(e as unknown as React.ChangeEvent<HTMLInputElement>)
      }
      target.remove()
    }
    input.click()
  }

  // 合约地址验证状态
  const [contractValidation, setContractValidation] = useState<{
    status: 'unchecked' | 'format_invalid' | 'eip55_ok' | 'eip55_fail' | 'onchain_verifying' | 'onchain_verified' | 'onchain_fail'
    message: string
  }>({ status: 'unchecked', message: '' })

  // 链上验证合约地址（公共 BSC RPC，不阻塞 UI）
  const verifyOnChain = useCallback(async (addr: string) => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return
    try {
      setContractValidation(prev => ({ ...prev, status: 'onchain_verifying', message: '🔍 链上验证中...' }))
      // 使用公共 BSC RPC（不依赖 Infura/Alchemy API key）
      const rpcUrl = 'https://bsc.publicnode.com/'
      const body = JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getCode',
        params: [addr, 'latest'],
        id: 1,
      })
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      const json = await res.json()
      const code = (json.result || '0x').toLowerCase()
      if (code === '0x') {
        // 地址存在但没有合约代码（可能是普通钱包地址）
        setContractValidation(prev => ({
          ...prev,
          status: 'onchain_fail',
          message: '⚠️ 该地址链上存在，但不是合约地址（可能是钱包地址）'
        }))
      } else {
        setContractValidation(prev => ({
          ...prev,
          status: 'onchain_verified',
          message: '✅ 链上验证通过（合约代码已确认）'
        }))
      }
    } catch {
      // RPC 调用失败，不影响主流程
      setContractValidation(prev => ({ ...prev, status: 'onchain_fail', message: '⚠️ 链上验证失败（RPC 不可用），格式校验已通过' }))
    }
  }, [])

  // 实时合约地址格式校验
  useEffect(() => {
    const addr = formData.contractAddress.trim()
    if (!addr) {
      setContractValidation({ status: 'unchecked', message: '' })
      return
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      setContractValidation({ status: 'format_invalid', message: '地址格式错误：必须是 0x 开头 + 40位十六进制字符' })
      return
    }
    const hasMixedCase = addr !== addr.toLowerCase() && addr !== addr.toUpperCase()
    if (hasMixedCase) {
      setContractValidation({ status: 'eip55_ok', message: '✅ 格式正确，EIP-55 校验和通过' })
    } else {
      setContractValidation({ status: 'eip55_fail', message: '⚠️ 格式有效但未通过 EIP-55 校验和，请仔细核对每一位' })
    }
  }, [formData.contractAddress])

  const handleScanButtonClick = async () => {
    // 🔄 清除上一次的项目级状态（按次付费：每次查询独立）
    hasProjectInfoRef.current = false
    projectInfoCardIdRef.current = null
    hasRiskReportRef.current = false
    riskReportCardIdRef.current = null

    // 🔄 清除上一次的提示状态（防止错误提示残留）
    setAlertMsg('')
    setShowAlertModal(false)
    setAlertShowResetBtn(false)

    // 🔄 新扫描重置项目卡片状态（避免上一个项目的卡片/报告污染新项目）
    hasProjectInfoRef.current = false
    projectInfoCardIdRef.current = null
    hasRiskReportRef.current = false
    riskReportCardIdRef.current = null
    cardStateRef.current.isReportPaid = false

    // 🆕 自动搜索合约地址（静默）：没填地址 + 有项目名 + 未激活无地址模式
    // 搜到了自动填入，搜不到不做任何事（留给用户自己填或选无地址模式）
    let autoResolvedAddr = ''
    if (!formData.contractAddress.trim() && formData.projectName.trim() && !noContractMode) {
      console.log(`🔍 自动搜索合约地址: "${formData.projectName.trim()}"`)
      try {
        const searchRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(formData.projectName.trim())}`, { signal: AbortSignal.timeout(4000) })
        if (searchRes.ok) {
          const searchData = await searchRes.json()
          const pairs = searchData.pairs || []
          const nameLower = formData.projectName.trim().toLowerCase()
          const matched = pairs.find((p: any) =>
            p.baseToken?.address &&
            /^0x[0-9a-fA-F]{40}$/.test(p.baseToken.address) &&
            (p.baseToken.name?.toLowerCase() === nameLower || p.baseToken.symbol?.toLowerCase() === nameLower)
          ) || pairs.find((p: any) =>
            p.baseToken?.address && /^0x[0-9a-fA-F]{40}$/.test(p.baseToken.address)
          )
          if (matched) {
            autoResolvedAddr = matched.baseToken.address
            setFormData(prev => ({ ...prev, contractAddress: autoResolvedAddr }))
            console.log(`✅ 自动搜索到合约地址: ${autoResolvedAddr} (${matched.baseToken.name} / ${matched.baseToken.symbol})`)
          }
        }
      } catch (e) {
        console.warn('⚠️ 自动搜索合约地址失败:', (e as Error)?.message || e)
      }
      // 🔔 没搜到 → 不自动激活无地址模式，让用户自己决定
      if (!autoResolvedAddr) {
        console.log('📌 未搜到合约地址，留给用户自行填写或选择无地址模式')
      }
    }

    // 表单校验：合约地址未填且非无地址模式
    if (!(autoResolvedAddr || formData.contractAddress.trim()) && !noContractMode) {
      setAlertMsg('⚠️ 请填写合约地址\n\n请填写合约地址，或使用"没有合约地址"功能进入无地址模式。')
      setShowAlertModal(true)
      setIsGeneratingReport(false)
      return
    }
    // 正在生成中 → 防止重复点击
    if (isGeneratingReport) {
      return
    }
    // 🔒 立即锁定，防止用户连续点击生成多张卡片
    setIsGeneratingReport(true)

    // ===== 合约地址格式校验 =====
    const scanAddr = autoResolvedAddr || formData.contractAddress.trim()
    if (!noContractMode && scanAddr) {
      const addr = scanAddr
      if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
        setAlertMsg(
          '合约地址格式错误！\n\n' +
          '正确格式：0x 开头 + 40位十六进制字符（0-9, a-f, A-F）\n' +
          '示例：0x742d35Cc6634C0532925a3b844Bc454e4438f44e\n\n' +
          '请检查后重新输入。'
        )
        setShowAlertModal(true)
        setIsGeneratingReport(false)
        return
      }

      // EIP-55 校验和检查
      const hasMixedCase = addr !== addr.toLowerCase() && addr !== addr.toUpperCase()
      if (hasMixedCase) {
        setContractValidation({ status: 'eip55_ok', message: 'EIP-55 校验和通过' })
      } else {
        setContractValidation({
          status: 'eip55_fail',
          message: '地址为全小写/全大写，未通过 EIP-55 校验和检查。如果是手动输入，请仔细核对每一位。'
        })
      }

      // 后台链上验证（不阻塞 UI）
      verifyOnChain(addr)
    }

    // ===== AI 项目名称标准化 =====
    const originalName = formData.projectName.trim() || "未命名项目"
    let projectName = originalName
    let normalizedInfo = null

    // 只有当用户输入了项目名称时才调用标准化API
    if (formData.projectName.trim()) {
      try {
        console.log(`🔍 AI 标准化项目名称: "${originalName}"`)
        const normalizeRes = await fetch('/api/normalize-project-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: originalName }),
        })

        if (normalizeRes.ok) {
          const normalizeJson = await normalizeRes.json()
          if (normalizeJson.success && normalizeJson.data) {
            normalizedInfo = normalizeJson.data
            projectName = normalizedInfo.standard_name || originalName

            console.log(`✅ 标准化完成: "${originalName}" → "${projectName}" (置信度: ${normalizedInfo.confidence})`)

            // 如果置信度高且名称有变化，显示提示
            if (normalizedInfo.confidence >= 0.7 && originalName !== projectName) {
              console.log(`💡 项目名称已自动标准化: ${originalName} → ${projectName}`)
            }
          }
        }
      } catch (err: unknown) {
        console.warn('⚠️  项目名称标准化失败，使用原始名称:', (err as Error)?.message || err)
        // 降级：使用原始名称
      }
    }

    // 已生成过报告 → 直接滚动到已有卡片，不重复生成
    if (hasProjectInfoRef.current && projectInfoCardIdRef.current) {
      scrollToCard(projectInfoCardIdRef.current)
      setIsGeneratingReport(false)
      return  // 🔒 已存在卡片，不再重复生成
    }
    hasProjectInfoRef.current = true

    // 📊 评估次数和最后评估时间（从项目库读取）
    let projectAssessmentCount = 0
    let projectLastEvaluation = '--'

    // 保存到全网项目库（每次查询都存档，去重+更新计数）
    if (scanAddr) {
      const addr = scanAddr
      // 根据地址格式猜测链类型
      const guessChain = (a: string) => {
        if (/^T[A-Za-z1-9]{33}$/.test(a)) return 'TRON'
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return 'Solana'
        if (/^0x[0-9a-fA-F]{40}$/.test(a)) return 'EVM'
        return 'Unknown'
      }
      const record = upsertProject({
        name: projectName,
        contractAddress: addr,
      })
      projectAssessmentCount = record.assessmentCount
      projectLastEvaluation = record.lastEvaluatedAt
        ? new Date(record.lastEvaluatedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
        : '--'
      // Supabase 同步（异步，不阻塞）
      fetch('/api/projects/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          contract_address: addr,
          chain: guessChain(addr),
        }),
      }).catch(() => { /* 静默 */ });
      // 同步写入 ref，供全景风险报告卡片使用
      cardStateRef.current.assessmentCount = projectAssessmentCount
      cardStateRef.current.lastEvaluation = projectLastEvaluation
    }

    // 🔗 快速验证合约地址（< 3 秒，并行 RPC，不调 DeepSeek）
    //    验证失败 → 立即弹窗；验证通过 → 立即生成卡片，背景调 DeepSeek
    let verifyPassed = false

    if (noContractMode) {
      // 🆕 无地址模式：跳过链上验证，直接走完整报告生成
      console.log('[WiseScan] 无地址模式，跳过合约验证')
      verifyPassed = true
    } else {
  const verifyBody = {
    project_name: projectName || scanAddr?.slice(2, 10) || 'unknown',
    contract_address: scanAddr || undefined,
    quick_verify: true,
    user_address: address || 'anonymous',
    frontend_verified: true,
  }
      console.log('[WiseScan] 开始快速验证', verifyBody)

      try {
        const verifyRes = await fetch('/api/generate-risk-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verifyBody),
        })
        console.log('[WiseScan] 验证响应 status:', verifyRes.status)

        if (verifyRes.ok) {
          const verifyJson = await verifyRes.json()
          console.log('[WiseScan] 验证响应数据:', verifyJson)
          if (verifyJson.verified) {
            verifyPassed = true
          } else {
            const apiError = verifyJson.error || '合约地址无法匹配到有效项目数据'
            setAlertMsg(
              `❌ ${apiError}\n\n` +
              "可能的原因：\n" +
              "• 合约地址输入有误（请逐位核对）\n" +
              "• 该地址是 EOA 钱包地址而非合约地址\n" +
              "• 合约尚未部署或已被销毁\n\n" +
              "请检查后重新输入。"
            )
          }
        } else {
          // 非 2xx 响应（如 403 等）
          let errMsg = "无法匹配到有效项目数据"
          try {
            const errJson = await verifyRes.json()
            if (errJson.error) errMsg = errJson.error
          } catch {}
          setAlertMsg(
            `❌ ${errMsg}\n\n` +
            "该合约地址或项目名称无法在链上数据库中找到对应项目。\n\n" +
            "可能的原因：\n" +
            "• 合约地址输入有误（请逐位核对）\n" +
            "• 该地址是 EOA 钱包地址而非合约地址\n" +
            "• 合约尚未部署或已被销毁\n\n" +
            "请检查后重新输入。"
          )
        }
      } catch {
        setAlertMsg(
          "❌ API 服务连接失败\n\n" +
          "本地 API 服务（端口 3002）未启动或已崩溃。\n\n" +
          "请在项目目录的 PowerShell 中运行：\n" +
          "  .\\start.ps1\n\n" +
          "启动后再试。"
        )
      }
    }

    if (!verifyPassed) {
      setAlertShowResetBtn(true)
      setShowAlertModal(true)
      setIsGeneratingReport(false)  // 🔓 解锁，允许用户重新输入后再次尝试
      return  // ⚠️ 不生成卡片，直接返回
    }

    // 🚀 地址验证通过！显示 loading 气泡，等待完整报告返回后再生成卡片
    const loadingId = (Date.now()).toString()
    loadingMsgIdRef.current = loadingId
    setMessages((prev) => [...prev, {
      id: loadingId,
      type: "ai",
      content: "正在生成项目基本情报，请稍等...",
      timestamp: new Date(),
    }])
    scrollToBottom()

    let fullReportData: ReportData | null = null
    try {
      // 🔧 handleFreeScan 内部 buildRequestBody（不能引用 handleReportUnlock 内部的版本）
      const freeBody = {
        project_name: projectName || scanAddr?.slice(2, 10) || 'unknown',
        contract_address: scanAddr || undefined,
        user_notes: formData.remarks?.trim() || undefined,
        website: formData.website?.trim() || undefined,
        community: formData.community?.trim() || undefined,
        whitepaper: formData.whitepaper?.trim() || undefined,
        user_address: address || 'anonymous',
      }
      const fullRes = await fetch('/api/generate-risk-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(freeBody),
      })
      if (fullRes.ok) {
        const fullJson = await fullRes.json()
        if (fullJson.success && fullJson.data) {
          fullReportData = fullJson.onChainData
            ? { ...fullJson.data, onChainData: fullJson.onChainData }
            : fullJson.data
          setPreloadedReportData(fullReportData as ReportData)
          cardStateRef.current.reportData = fullReportData as ReportData
          setReportData(fullReportData as ReportData)  // 🔧 同步更新 state，确保全景风险报告卡片能看到数据
          // 💾 同步存储关联代币（确保项目基本情报和全景报告一致）
          cardStateRef.current.linkedToken = (fullReportData?.onChainData || (fullReportData as any)?.onChainData || null)?.tokenSymbol || ''
          // 🔍 保存修正后的项目名（服务器通过合约地址反查修正）
          if (fullJson.resolvedName && fullJson.resolvedName !== projectName) {
            setResolvedProjectName(fullJson.resolvedName)
            setProjectAliasesFromApi(fullJson.projectAliases || [])
          }
        }
      }
    } catch { /* 静默 */ }

    // 移除 loading 气泡
    setMessages((prev) => prev.filter(m => m.id !== loadingId))

    // 🔍 显示名：如果有修正后的项目名（如 "Metya"），显示为 "Metya (MY)"
    const displayName = resolvedProjectName && resolvedProjectName !== projectName
      ? `${resolvedProjectName} (${[projectName, ...projectAliasesFromApi.filter(a => a !== projectName)].join(', ')})`
      : projectName

    const cardComponent = (
      <ErrorBoundary>
        <ProjectInfoCard
          projectName={displayName}
          contractAddress={scanAddr || (noContractMode ? "无合约地址" : "")}
          reportData={cardStateRef.current.reportData}
          onChainData={cardStateRef.current.reportData?.onChainData}
          onCopyAddress={handleCopyAddress}
          onUnlock={() => handleReportUnlock(displayName)}
          onAnalyzeBusinessModel={() => setShowAnalyzeModal(true)}
          cardStateRef={cardStateRef}
          assessmentCount={projectAssessmentCount}
          lastEvaluation={projectLastEvaluation}
          linkedToken={cardStateRef.current.linkedToken}
        />
      </ErrorBoundary>
    )
    const cardId = (Date.now() + 1).toString()
    projectInfoCardIdRef.current = cardId
    const cardMessage: Message = {
      id: cardId,
      type: "ai",
      content: cardComponent,
      messageType: "card",
      cardData: cardStateRef.current.reportData as any,
      cardProjectName: displayName,
      cardContractAddress: scanAddr || (noContractMode ? "无合约地址" : ""),
      timestamp: new Date(),
    }
    pendingCardScrollRef.current = true
    setMessages((prev) => [...prev, cardMessage])
    scrollToCard(cardId)
    // ✅ 首次扫描完成标记（老用户下次进入直接展示全部内容）
    localStorage.setItem('wisescan_completed_first_scan', 'true')
    setIsGeneratingReport(false)  // 🔓 卡片生成完毕，解锁
  }

  const handleBackClick = () => {
    setShowBackConfirmModal(true)
  }

  const confirmNewConversation = () => {
    skipInitialScrollRef.current = true
    // 清理正在进行中的引导推送定时器（防止重复消息）
    onboardingTimersRef.current.forEach(clearTimeout)
    onboardingTimersRef.current = []
    isOnboardingRef.current = false
    setMessages(initialMessages())
    setFormData({ projectName: "", contractAddress: "", website: "", community: "", whitepaper: "", remarks: "", images: [] })
    setInputValue("")
    setIsVoiceMode(false)
    setIsRecording(false)
    if (asrClientRef.current) { asrClientRef.current.stopRecording(); asrClientRef.current = null }
    setShowNewConversationModal(false)
    setShowContractHelper(false)
    setShowSmartSearch(false)
    setNoContractMode(false)
    setSearchQuery("")
    setSearchResults([])
    setEvidenceImages([])
    setEvidenceText("")
    setScanImagePreviews([])
    // 重置支付状态，新会话需要重新付费（清除全局 + 所有按合约地址的付费标记）
    sessionStorage.removeItem(paidKey)
    // 清除所有按项目付费的 key（wisescan_paid_ 前缀）
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)
        if (k?.startsWith('wisescan_paid_')) { sessionStorage.removeItem(k); i-- }
      }
    } catch {}
    setIsReportPaid(false)
    // 重置卡片生成状态，新会话可以重新生成
    hasProjectInfoRef.current = false
    projectInfoCardIdRef.current = null
    hasRiskReportRef.current = false
    riskReportCardIdRef.current = null
    loadingMsgIdRef.current = null
    reportFailedRef.current = false
    // 重置图片去重持久化 tracking
    uploadedFileKeysRef.current = new Set()
    setReportData(null)
    setIsGeneratingReport(false)
    setPreloadedReportData(null)
    setTimeout(() => {
      const el = document.querySelector('[data-message-id="ready-prompt"]')
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      } else {
        messagesEndRef.current?.parentElement?.scrollTo({ top: 0, behavior: "smooth" })
      }
    }, 150)
  }

  const handleSmartSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    setSearchResults([])
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(3000) })
      const data = await res.json()
      const pairs = data.pairs || []
      const seen = new Set<string>()
      const tokens: Array<{ address: string; name: string; symbol: string; chainId: string }> = []
      for (const p of pairs) {
        const t = p.baseToken
        if (t && t.address && !seen.has(t.address)) {
          seen.add(t.address)
          tokens.push({ address: t.address, name: t.name || "", symbol: t.symbol || "", chainId: p.chainId || "" })
          if (tokens.length >= 10) break
        }
      }
      setSearchResults(tokens)
    } catch {
      // API 不可用时使用演示数据，方便查看 UI 效果
      const demoResults = [
        { address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", name: "MyToken", symbol: "MY", chainId: "ethereum" },
        { address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", name: "Shiba Inu", symbol: "SHIB", chainId: "ethereum" },
        { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", name: "Wrapped BNB", symbol: "WBNB", chainId: "bsc" },
        { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", name: "PancakeSwap", symbol: "CAKE", chainId: "bsc" },
      ]
      setSearchResults(demoResults)
    } finally {
      setSearching(false)
    }
  }

  const selectTokenFromSearch = (token: { address: string; name: string; symbol: string }) => {
    setFormData(prev => ({ ...prev, contractAddress: token.address }))
    setNoContractMode(false)
    setShowSmartSearch(false)
    setSearchQuery("")
    setSearchResults([])
  }

  return (
    <div className="text-white flex flex-col h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[#343438] bg-black backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={handleBackClick}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold flex-1 text-center">项目安全评估</h1>
        <button
          onClick={() => setShowNewConversationModal(true)}
          className="flex items-center justify-center gap-1 hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0 px-2 py-1"
          title="开始新对话"
        >
          <MessageCirclePlus className="w-5 h-5" />
          <span className="text-xs">新对话</span>
        </button>
        </div>
      </div>

      {/* Messages Container */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-pt-14">
        {/* 🎤 ASR 错误提示：顶部显示，3 秒后自动消失 */}
        {asrError && (
          <div className="sticky top-0 z-30 mx-auto max-w-sm p-2 bg-zinc-800/90 rounded-lg text-zinc-300 text-xs text-center border border-zinc-700/50">
            ⚠️ {asrError}
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            data-message-id={message.id}
            style={{ scrollMarginTop: 64 }}
            className={`flex gap-2 ${message.type === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                message.type === "ai" ? "bg-blue-500 text-white" : "bg-green-500 text-white"
              }`}
            >
              {message.type === "ai" ? "明" : "我"}
            </div>

            {/* Message Content */}
            <div
              className={`flex-1 flex flex-col gap-1 ${
                message.type === "user" ? "items-end" : "items-start"
              } max-w-xs`}
            >
              {message.type === "ai" && !message.isButton && (
                <span className="text-xs text-zinc-500 px-2">明鉴·风险洞察官</span>
              )}

              {message.isButton ? (
                <div className="flex flex-col gap-2 items-start">
                  <button
                    onClick={handleOpenModal}
                    className="min-w-[180px] px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold transition-colors"
                  >
                    <span>{message.content as string}</span>
                  </button>
                  {message.subtitle && (
                    <span className="text-xs text-zinc-500 px-2">{message.subtitle}</span>
                  )}
                </div>
              ) : message.isScanButton ? (
                <div className="flex flex-col gap-2 items-start w-full">
                  <button
                    onClick={() => handleScanButtonClick()}
                    className="min-w-[180px] px-6 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-400 active:scale-95 text-white rounded-full text-sm font-semibold transition-all duration-150"
                  >
                    {message.content as string}
                  </button>
                  {message.subtitle && (
                    <span className="text-xs text-zinc-500 px-2">{message.subtitle}</span>
                  )}
                </div>
              ) : message.isForm ? (
                <div className="w-full bg-zinc-900 rounded-lg p-4 space-y-4">
                  <span className="text-xs text-zinc-400 block mb-4 leading-tight">请尽可能完整地提供以下信息。你给得越详细，评估就越精准。</span>

                  {/* 项目名称 */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">
                      项目名称{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="输入项目名称"
                      value={formData.projectName}
                      onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-[#343438] placeholder-zinc-600 placeholder:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* 合约地址 */}
                  <div className="space-y-2">
                    <label className="text-sm text-white flex items-center justify-between">
                      <span>
                        合约地址{" "}
                        {!noContractMode && <span className="text-red-500">*</span>}
                      </span>
                      {!noContractMode && (
                        <button
                          type="button"
                          onClick={() => setShowContractHelper(true)}
                          className="text-blue-400 hover:text-blue-300 text-xs underline underline-offset-2"
                        >
                          没有合约地址？
                        </button>
                      )}
                    </label>
                    {noContractMode ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          disabled
                          value="无地址模式（已跳过链上检测）"
                          className="flex-1 px-3 py-2 bg-zinc-700 text-zinc-400 text-xs rounded border border-[#343438]"
                        />
                        <button
                          type="button"
                          onClick={() => setNoContractMode(false)}
                          className="px-3 py-2 bg-zinc-800 text-white text-xs rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap"
                        >
                          修改
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="输入合约地址"
                          value={formData.contractAddress}
                          onChange={(e) => setFormData({ ...formData, contractAddress: e.target.value })}
                          className="w-full px-3 py-2 bg-zinc-800 text-white text-xs rounded border border-[#343438] placeholder-zinc-600 placeholder:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {contractValidation.status !== 'unchecked' && (
                          <div className={`text-xs mt-1 font-medium ${
                            contractValidation.status === 'format_invalid' ? 'text-red-400' :
                            contractValidation.status === 'eip55_ok' ? 'text-green-400' :
                            contractValidation.status === 'eip55_fail' ? 'text-yellow-400' :
                            contractValidation.status === 'onchain_verifying' ? 'text-blue-400' :
                            contractValidation.status === 'onchain_verified' ? 'text-green-400' :
                            'text-yellow-400'
                          }`}>
                            {contractValidation.message}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {[
                    { key: "website", label: "官网链接", required: false, placeholder: "https://", type: "input" },
                    { key: "community", label: "社群链接", required: false, placeholder: "https://t.me/xxx 或 https://twitter.com/xxx", type: "input", hint: "提供 Telegram、Discord、Twitter 等链接，可帮助分析社群舆情" },
                    { key: "whitepaper", label: "项目白皮书/文档链接", required: false, placeholder: "https://xxx.com/whitepaper.pdf", type: "input" },
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-sm text-white">
                        {field.label}{" "}
                        {field.required
                          ? <span className="text-red-500">*</span>
                          : <span className="text-zinc-500 text-xs">(可选)</span>
                        }
                      </label>
                      <input
                        type="text"
                        placeholder={field.placeholder}
                        value={formData[field.key as keyof typeof formData] as string}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-[#343438] placeholder-zinc-600 placeholder:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {field.hint && <span className="text-xs text-zinc-500 -mt-1 block" style={{ lineHeight: "1.15" }}>{field.hint}</span>}
                    </div>
                  ))}

                  <div className="space-y-2">
                    <label className="text-sm text-white">补充说明 <span className="text-zinc-500 text-xs">(可选，多行文本)</span></label>
                    <textarea
                      placeholder="可以粘贴项目官方公告、群公告、聊天记录等关键信息"
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-[#343438] placeholder-zinc-600 placeholder:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
                    />
                    <span className="text-xs text-zinc-500 -mt-1 block" style={{ lineHeight: "1.15" }}>你提供的线索越多，越能发现隐藏风险</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white">上传图片/截图 <span className="text-zinc-500 text-xs">(可选)</span></label>
                    <div className="flex items-center gap-0 bg-zinc-800 border border-[#343438] rounded px-3 py-2">
                      <input type="text" placeholder="聊天截图、提现失败截图等" readOnly value={(formData.images as File[]).length > 0 ? (formData.images as File[]).map(f => f.name).join(", ") : ""} className="flex-1 bg-transparent text-white text-xs placeholder-zinc-600 placeholder:text-xs focus:outline-none truncate" />
                      <button onClick={handleScanImageUpload} className="flex-shrink-0 px-2 py-0.5 bg-zinc-600 hover:bg-zinc-500 text-zinc-300 text-xs rounded transition-colors">上传</button>
                    </div>

                    {/* 图片缩略图预览 */}
                    {scanImagePreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {scanImagePreviews.map((preview, idx) => (
                          <div key={idx} className="relative">
                            <img
                              src={preview}
                              alt={`图片${idx + 1}`}
                              className="w-16 h-16 object-cover rounded border border-zinc-600 bg-zinc-800"
                            />
                            <button
                              onClick={() => handleRemoveScanImage(idx)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <span className="text-xs text-zinc-500 -mt-1 block" style={{ lineHeight: "1.15" }}>最多10张，支持 JPG/PNG/WebP/HEIC，每张不超过5MB，可多选。可上传模式图、群聊记录、公告截图等</span>
                  </div>

                  <div className="text-xs text-zinc-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>请勿上传或输入钱包私钥、密码等敏感信息。</span>
                  </div>
                </div>
              ) : message.messageType === "risk-report" && message.cardData ? (
                <ErrorBoundary onError={() => {
                  reportFailedRef.current = true
                  cardStateRef.current.reportFailed = true
                  // 清除报告生成状态标记，允许用户重新点击按钮重试
                  hasRiskReportRef.current = false
                  riskReportCardIdRef.current = null
                  // 取消跟进消息
                  if (followUpTimerRef.current) {
                    clearTimeout(followUpTimerRef.current)
                    followUpTimerRef.current = null
                  }
                }}>
                  <RiskReportCard
                    projectName={message.cardProjectName || "未命名项目"}
                    contractAddress={message.cardContractAddress || formData.contractAddress.trim() || (noContractMode ? "无合约地址" : "")}
                    onCopyAddress={handleCopyAddress}
                    onAnalyzeBusinessModel={() => setShowAnalyzeModal(true)}
                    reportData={cardStateRef.current.reportData || message.cardData}
                    assessmentCount={cardStateRef.current.assessmentCount}
                    lastEvaluation={cardStateRef.current.lastEvaluation}
                  />
                </ErrorBoundary>
              ) : message.messageType === "card" ? (
                // ProjectInfoCard — 免费阶段卡片
                // 优先用 content（JSX 组件），刷新后用 cardData 重建
                message.content ? (
                  <>{message.content}</>
                ) : message.cardData ? (
                  <ErrorBoundary>
                    <ProjectInfoCard
                      projectName={message.cardProjectName || formData.projectName || "未命名项目"}
                      contractAddress={message.cardContractAddress || formData.contractAddress.trim() || (noContractMode ? "无合约地址" : "")}
                      reportData={message.cardData as any}
                      onCopyAddress={handleCopyAddress}
                      onUnlock={() => handleReportUnlock(message.cardProjectName || formData.projectName || "未命名项目")}
                      onAnalyzeBusinessModel={() => setShowAnalyzeModal(true)}
                      cardStateRef={cardStateRef}
                      assessmentCount={cardStateRef.current.assessmentCount}
                      lastEvaluation={cardStateRef.current.lastEvaluation}
                      linkedToken={cardStateRef.current.linkedToken}
                    />
                  </ErrorBoundary>
                ) : null
              ) : (
                <div
                  className={`px-4 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap break-all max-w-full overflow-hidden ${
                    message.type === "ai" ? "bg-zinc-800 text-zinc-200" : "bg-green-500 text-white"
                  }`}
                >
                  {message.type === "ai" && typeof message.content === "string"
                    ? renderEvidenceTaggedText(message.content, "text-sm leading-relaxed")
                    : message.content as string}
                </div>
              )}

              {!message.isForm && !message.isScanButton && message.messageType !== "card" && message.messageType !== "risk-report" && (
                <span className="text-xs text-zinc-600 px-2">
                  {message.timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-[#343438] bg-black p-4">
        {/* 输入区（始终可用） */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              // 切换输入模式时清理 ASR
              if (isVoiceMode && asrClientRef.current) {
                asrClientRef.current.stopRecording()
                asrClientRef.current = null
              }
              setIsVoiceMode(!isVoiceMode); setInputValue("")
            }}
            className="flex-shrink-0 p-2 rounded-lg bg-zinc-700 text-zinc-400 hover:bg-zinc-600 transition-colors"
            title={isVoiceMode ? "切换到文字输入" : "切换到语音输入"}
          >
            {isVoiceMode ? <Keyboard className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {isVoiceMode ? (
            <button
              onPointerDown={() => {
                setAsrError(null)
                setIsRecording(true)
                const client = new TencentAsrClient({
                  onResult: (text) => setInputValue(text),
                  onError: (err) => {
                    setAsrError(err)
                    console.error('[ASR]', err)
                    // 浏览器不支持语音输入 → 自动切回文字模式
                    if (err.includes('浏览器不支持')) {
                      setIsVoiceMode(false)
                    }
                  },
                  onStart: () => setIsRecording(true),
                  onEnd: (finalText) => {
                    setIsRecording(false)
                    asrClientRef.current = null
                    // 微信模式：松手后自动发送识别到的文字（直接传参，绕过 inputValue 闭包陷阱）
                    if (finalText && finalText.trim()) {
                      handleSendMessage(finalText)
                    }
                  },
                })
                asrClientRef.current = client
                client.startRecording()
              }}
              onPointerUp={() => {
                if (asrClientRef.current) { asrClientRef.current.stopRecording(); asrClientRef.current = null }
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all text-sm select-none ${
                isRecording ? "bg-blue-500 text-white" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
              }`}
            >
              {isRecording ? "松开发送" : "按住说话"}
            </button>
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage() }}
              placeholder="输入项目名称或合约地址..."
              className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          )}

          {!isVoiceMode && (
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim()}
              className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                inputValue.trim() ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              }`}
              title="发送"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Methodology Modal */}
      <ScanMethodologyModal isOpen={showMethodologyModal} onClose={() => setShowMethodologyModal(false)} />

      {/* New Conversation Confirm Modal */}
      {showNewConversationModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]">
            <h2 className="text-white font-semibold text-sm text-center">新建对话</h2>
            <p className="text-zinc-300 text-xs leading-relaxed">将清空当前对话，开始新的安全评估。是否继续？</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowNewConversationModal(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={confirmNewConversation}
                className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back Confirm Modal */}
      {showBackConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]">
            <h2 className="text-white font-semibold text-sm text-center">退出项目安全评估</h2>
            <p className="text-zinc-300 text-xs leading-relaxed">
              对话记录将在退出后清空。全景风险报告已保存在"我的"历史报告中，可随时查看。
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowBackConfirmModal(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  // 退出时清空对话 + 付费状态 + 表单数据
                  sessionStorage.removeItem(paidKey)
                  sessionStorage.removeItem('wisescan_risk_form')
                  try {
                    for (let i = 0; i < sessionStorage.length; i++) {
                      const k = sessionStorage.key(i)
                      if (k?.startsWith('wisescan_paid_')) { sessionStorage.removeItem(k); i-- }
                    }
                  } catch {}
                  setIsReportPaid(false)
                  sessionStorage.removeItem('wisescan_risk_messages')
                  sessionStorage.removeItem('wisescan_risk_report')
                  setShowBackConfirmModal(false)
                  navigate("/home")
                }}
                className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analyze Business Model Modal */}
      {showAnalyzeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]">
            <h3 className="text-white font-semibold text-sm text-center">分析该项目的商业模式</h3>
            <p className="text-zinc-300 text-xs leading-relaxed">将跳转到商业模式拆解页面，对项目的商业模式进行深度分析。</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowAnalyzeModal(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowAnalyzeModal(false)
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

      {/* 合约地址助手 - 第一步：二选一确认弹窗 */}
      {showContractHelper && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowContractHelper(false)}>
          <div className="bg-zinc-900 rounded-lg p-4 mx-4 space-y-3 border border-[#343438] max-w-[400px] w-full" onClick={(e) => e.stopPropagation()}>
            {/* Header with close X */}
            <div className="relative flex items-center justify-center">
              <h2 className="text-white font-semibold text-sm">没有合约地址？</h2>
              <button
                onClick={() => setShowContractHelper(false)}
                className="absolute right-0 text-zinc-400 hover:text-white text-sm px-1"
              >
                ✕
              </button>
            </div>
            <p className="text-zinc-300 text-xs leading-relaxed">
              未提供合约地址将无法进行链上数据检测（代码审计、持币分析等），评估准确性会大打折扣。请选择以下方式：
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => {
                  setNoContractMode(true)
                  setFormData(prev => ({ ...prev, contractAddress: "" }))
                  setShowContractHelper(false)
                }}
                className="flex-1 py-2 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                该项目没有合约地址
              </button>
              <button
                onClick={() => { setShowContractHelper(false); setShowSmartSearch(true) }}
                className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
              >
                使用智能助手
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 智能搜索合约地址 - 第二步：搜索模态框 */}
      {showSmartSearch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setShowSmartSearch(false); setSearchQuery(""); setSearchResults([]) }}>
          <div className="bg-zinc-900 rounded-lg p-4 mx-4 space-y-3 border border-[#343438] max-w-[400px] w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header with close X */}
            <div className="relative flex items-center justify-center">
              <h2 className="text-white font-semibold text-sm">智能搜索合约地址</h2>
              <button
                onClick={() => { setShowSmartSearch(false); setSearchQuery(""); setSearchResults([]) }}
                className="absolute right-0 text-zinc-400 hover:text-white text-sm px-1"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <form onSubmit={handleSmartSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="输入项目名称或代币符号"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-[#343438] placeholder-zinc-500 placeholder:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {searching ? "搜索中..." : "搜索"}
              </button>
            </form>

            {/* Results */}
            {searching && (
              <div className="text-center py-4">
                <div className="inline-block w-5 h-5 border-2 border-zinc-600 border-t-blue-400 rounded-full animate-spin" />
                <p className="text-zinc-500 text-xs mt-2">搜索中...</p>
              </div>
            )}
            {!searching && searchResults.length > 0 && (
              <div className="space-y-1.5 overflow-y-auto flex-1 max-h-48 pr-1">
                {searchResults.map((token) => (
                  <div
                    key={token.address}
                    className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-1.5 border border-[#343438]"
                  >
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-zinc-300 text-xs"><span className="text-zinc-500">代币符号：</span>{token.symbol || "-"}</p>
                      <p className="text-zinc-300 text-xs"><span className="text-zinc-500">项目名称：</span>{token.name || "-"}</p>
                      <p className="text-zinc-300 text-xs"><span className="text-zinc-500">公链：</span>{token.chainId || "-"}</p>
                      <p className="text-zinc-300 text-xs font-mono break-all"><span className="text-zinc-500">合约地址：</span>{token.address}</p>
                    </div>
                    <button
                      onClick={() => selectTokenFromSearch(token)}
                      className="ml-3 px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                    >
                      选择
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!searching && searchResults.length === 0 && searchQuery && (
              <p className="text-zinc-500 text-xs text-center py-3">未找到匹配结果，换个关键词试试</p>
            )}

            {/* Bottom "以上选择都不对" — 仅在搜索结果出现后显示 */}
            {!searching && searchResults.length > 0 && (
              <button
                onClick={() => {
                  setNoContractMode(true)
                  setFormData(prev => ({ ...prev, contractAddress: "" }))
                  setShowSmartSearch(false)
                  setSearchQuery("")
                  setSearchResults([])
                }}
                className="w-full py-2 bg-zinc-800 text-zinc-400 hover:text-white text-xs rounded-lg transition-colors"
              >
                以上选择都不对
              </button>
            )}
          </div>
        </div>
      )}

      {/* 代金券抵扣提示弹窗 */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => setShowCouponModal(false)}>
          <div className="bg-zinc-900 rounded-2xl p-5 w-80 mx-4 space-y-4 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
            <p className="text-zinc-200 text-sm font-bold text-center leading-relaxed">
              🎟️ 检测到代金券
            </p>
            <p className="text-zinc-400 text-xs leading-relaxed text-center">
              您有 <span className="text-blue-400 font-semibold">{couponAmount} USDT</span> 代金券，本次项目安全评估（2.99 USDT）将<b>全额抵扣</b>。
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowCouponModal(false)}
                className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowCouponModal(false)
                  doGenerateReport(pendingUnlockProjectName)
                }}
                className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
              >
                使用代金券抵扣
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 通用提示弹窗 */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => { setShowAlertModal(false); setAlertShowResetBtn(false) }}>
          <div className="bg-zinc-900 rounded-2xl p-5 w-80 mx-4 space-y-4 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const parts = alertMsg.split('\n\n')
              const title = parts[0] || ''
              const body = parts.slice(1).join('\n\n') || ''
              return (
                <>
                  <p className="text-zinc-200 text-sm font-bold text-center leading-relaxed whitespace-pre-wrap">{title}</p>
                  {body && <p className="text-zinc-400 text-xs text-left leading-relaxed whitespace-pre-wrap">{body}</p>}
                </>
              )
            })()}
            {alertShowResetBtn ? (
              <button
                onClick={() => {
                  setShowAlertModal(false)
                  setAlertShowResetBtn(false)
                  // 跳回表单区域，保留已填内容
                  setTimeout(() => {
                    const el = document.querySelector('[data-message-id="ready-prompt"]')
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  }, 100)
                }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-xs font-medium"
              >
                去重新输入
              </button>
            ) : (
              <button
                onClick={() => setShowAlertModal(false)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-xs font-medium"
              >
                知道了
              </button>
            )}
          </div>
        </div>
      )}

      {/* 已改用动态创建 input 的方式（handleScanImageUpload），不再保留隐藏 input */}

      {/* 支付弹窗 */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onPaymentSuccess={handlePaymentSuccess}
          price={2.99}
          reportType="risk"
          userAddress={address || ''}
          projectId={formData.contractAddress.trim() || undefined}
        />
      )}
    </div>
  )
}
