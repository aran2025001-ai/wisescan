import { useState, useEffect, useRef, type MutableRefObject } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { useAccount } from "wagmi"
import { Copy, Check, Info, Gift, ChevronRight, AlertCircle, X } from "lucide-react"
import { copyToClipboard } from "../utils/clipboard"
import EvidenceUpload from "./EvidenceUpload"
import ShareButton from "./ShareButton"
import ShareProjectDrawer from "./ShareProjectDrawer"

// ===== 简短点评生成器：固定逻辑，提取所有关键事实，生成≤30字的一句话 =====
function generateShortReview(reportData: any): string {
  if (!reportData) return '数据采集中，解锁查看完整报告'

  const dims = (reportData.six_dimensions || []) as any[]
  const positives: string[] = []
  const negatives: string[] = []

  // 1. 审计状态
  const codeDim = dims.find((d: any) => d.dimension?.includes('代码'))
  if (codeDim) {
    if (codeDim.score >= 18 || codeDim.deduction?.includes('无扣分')) positives.push('已完成审计')
    else if (codeDim.score <= 8 || codeDim.deduction?.includes('未审计')) negatives.push('尚未完成审计')
  }

  // 2. 融资记录
  const funding = reportData.funding_record
  if (funding && funding !== '未知' && funding !== '无' && funding !== '--') positives.push('有融资记录')

  // 3. 合约开源
  if (reportData.onChainData?.goplus?.isOpenSource === true) positives.push('合约开源')

  // 4. LP锁仓
  const lp = reportData.onChainData?.goplus?.lpLockStatus || reportData.liquidity_lock
  if (lp === '已锁定') positives.push('LP已锁定')

  // 5. 团队透明度
  const teamDim = dims.find((d: any) => d.dimension?.includes('团队'))
  if (teamDim?.deduction?.includes('匿名') || teamDim?.score <= 8) negatives.push('团队匿名')

  // 6. 模式变更
  const histDim = dims.find((d: any) => d.dimension?.includes('历史'))
  if (histDim?.deduction?.includes('变更')) {
    const changes = (reportData.history_mode_changes || '').toString()
    const changeCount = parseInt(changes)
    if (!Number.isNaN(changeCount) && changeCount >= 2) {
      negatives.push(`曾有过${changeCount}次模式变更`)
    } else {
      negatives.push('曾有过模式变更')
    }
  }

  // 7. TOP10持仓集中度
  const goplusTop10 = reportData.onChainData?.goplus?.top10Percent
  const t10 = goplusTop10 !== null && goplusTop10 !== undefined
    ? Number(goplusTop10)
    : parseInt(reportData.top10_concentration)
  if (!Number.isNaN(t10) && t10 >= 70) negatives.push('持仓高度集中')

  if (positives.length === 0 && negatives.length === 0) return '数据采集中，解锁查看完整报告'

  const buildSentence = (): string => {
    const posPart = positives.slice(0, 2).join('并')
    const negPart = negatives.slice(0, 2).join('且')
    if (posPart && negPart) {
      return `${posPart}，但${negPart}。`
    } else if (posPart) {
      return `${posPart}，解锁查看详情。`
    } else {
      return `${negPart}，建议深入评估。`
    }
  }

  const sentence = buildSentence()
  return sentence.length <= 30 ? sentence : sentence.slice(0, 28) + '…'
}

interface ProjectInfoCardProps {
  projectName: string
  contractAddress: string
  onCopyAddress?: () => void
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
  reportData?: any
  integrityScore?: number
  integrityLabel?: string
  aiSummary?: string
  assessmentCount?: number
  lastEvaluation?: string
  linkedToken?: string
  isEmbedded?: boolean
  cardStateRef?: MutableRefObject<{ isReportPaid: boolean }>
  // 底部按钮回调
  onUnlock?: () => void
  onAnalyzeBusinessModel?: () => void
  // 证据相关
  onEvidenceChange?: (images: File[], text: string) => void
  evidenceImages?: File[]
  evidenceText?: string
  contributorAddress?: string
}

export default function ProjectInfoCard({
  projectName,
  contractAddress,
  onChainData,
  reportData,
  integrityScore,
  integrityLabel,
  aiSummary,
  assessmentCount = 0,
  lastEvaluation = '--',
  linkedToken = '',
  isEmbedded = false,
  cardStateRef,
  onUnlock,
  onAnalyzeBusinessModel,
  onEvidenceChange,
  evidenceImages = [],
  evidenceText = '',
  contributorAddress = '0xanonymous',
}: ProjectInfoCardProps) {
  const [copied, setCopied] = useState(false)
  const [showInfoPopover, setShowInfoPopover] = useState(false)
  const [isTokenExpanded, setIsTokenExpanded] = useState(false)
  const [isUnlockConfirmOpen, setIsUnlockConfirmOpen] = useState(false)
  const [showEvidenceModal, setShowEvidenceModal] = useState(false)
  const [localInviteCode, setLocalInviteCode] = useState<string>('')
  const [evidenceAlertMsg, setEvidenceAlertMsg] = useState("")
  const [showSubmitResult, setShowSubmitResult] = useState(false)
  const [submitResultMsg, setSubmitResultMsg] = useState("")
  const [modalImages, setModalImages] = useState<File[]>(evidenceImages)
  const [modalText, setModalText] = useState(evidenceText)
  const [inviteCount, setInviteCount] = useState(0)  // 已成功邀请人数（>0 则隐藏邀请横幅）
  const [evidencePreviewUrls, setEvidencePreviewUrls] = useState<string[]>([])

  const navigate = useNavigate()
  const { address } = useAccount()
  const effectiveOnChain = reportData?.onChainData || onChainData

  // 信息完整性评分：外部传入 or 自动计算
  const displayScore = (() => {
    if (integrityScore !== undefined) return integrityScore
    let s = 10
    if (projectName && projectName !== '未命名项目') s += 5
    if (contractAddress && contractAddress !== '0x742d35Cc6634C0532925a3b844Bc454e4438f44e') s += 5
    const hasOnChain = !!effectiveOnChain?.tokenName && effectiveOnChain.tokenName !== '未知'
    if (hasOnChain) s += 20
    if (reportData?.total_score !== undefined && reportData.total_score > 0) s += 20
    if (reportData?.public_opinion) s += 10
    if (reportData?.ai_summary) s += 10
    const score = hasOnChain ? Math.min(s, 95) : Math.min(s, 75)
    return score
  })()
  const displayLabel = integrityLabel || (displayScore >= 70 ? '较高' : displayScore >= 45 ? '中等' : '较低')

  // 流动性锁仓渲染（优先 GoPlus 硬数据，回退 DeepSeek 文本字段）
  const lockRender = (() => {
    // 优先从 GoPlus 硬数据读取
    const goplusLock = effectiveOnChain?.goplus?.lpLockStatus
    if (goplusLock) {
      if (goplusLock === '已锁定' || goplusLock === 'Locked') return { text: '已锁定', color: 'text-green-400', icon: '🔒' }
      if (goplusLock === '部分锁定' || goplusLock === 'Partially Locked') return { text: '部分锁定', color: 'text-yellow-400', icon: '🔓' }
      if (goplusLock === '未锁定' || goplusLock === 'Not Locked') return { text: '未锁定', color: 'text-red-400', icon: '⚠️' }
      // 其他值直接显示
      return { text: goplusLock, color: 'text-zinc-400', icon: '📊' }
    }
    // 回退 DeepSeek 文本字段
    const val = reportData?.liquidity_lock
    if (!val || val === '未知' || val === '--') return null
    if (val.includes('已锁定') || val.includes('Lock')) return { text: val, color: 'text-green-400', icon: '🔒' }
    if (val.includes('部分') || val.includes('Part')) return { text: val, color: 'text-yellow-400', icon: '🔓' }
    return { text: val, color: 'text-red-400', icon: '⚠️' }
  })()

  // TOP10 持仓渲染（优先 GoPlus 硬数据，回退 DeepSeek 文本字段）
  const top10Render = (() => {
    // 优先从 GoPlus 硬数据读取（top10Percent 是 0-100 的数值）
    const goplusTop10 = effectiveOnChain?.goplus?.top10Percent
    if (goplusTop10 !== null && goplusTop10 !== undefined) {
      const pct = Number(goplusTop10)
      if (!Number.isNaN(pct)) {
        const pctStr = Number.isInteger(pct) ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`
        if (pct > 0 && pct < 50) return { text: `${pctStr} · 分布较分散`, color: 'text-green-400', icon: '🟢' }
        if (pct >= 50 && pct < 70) return { text: `${pctStr} · 中度集中`, color: 'text-yellow-400', icon: '🟡' }
        return { text: `${pctStr} · 高度集中`, color: 'text-red-400', icon: '🔴' }
      }
    }
    // 回退 DeepSeek 文本字段
    const val = reportData?.top10_concentration
    if (!val || val === '未知' || val === '--') return null
    const pct = parseInt(val)
    if (Number.isNaN(pct)) {
      if (val.includes('极高') || val.includes('集中')) return { text: val, color: 'text-red-400', icon: '🔴' }
      if (val.includes('中度') || val.includes('偏高')) return { text: val, color: 'text-yellow-400', icon: '🟡' }
      return { text: val, color: 'text-green-400', icon: '🟢' }
    }
    if (pct > 0 && pct < 50) return { text: `${pct}% · 分布较分散`, color: 'text-green-400', icon: '🟢' }
    if (pct >= 50 && pct < 80) return { text: `${pct}% · 中度集中`, color: 'text-yellow-400', icon: '🟡' }
    return { text: `${pct}% · 高度集中`, color: 'text-red-400', icon: '🔴' }
  })()

  // 融资记录渲染
  const fundingRender = (() => {
    const val = reportData?.funding_record
    if (!val || val === '未知' || val === '--' || val === '无') return null
    return { text: val, color: 'text-green-400', icon: '💰' }
  })()

  const handleCopyAddress = async () => {
    const addr = contractAddress || ''
    const ok = await copyToClipboard(addr)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    // 同时通知父组件（父组件可能有自己的 copied 状态同步）
    onCopyAddress?.()
  }

  const handleUnlockReport = () => {
    // 已付费用户 → 跳过支付弹窗，直接解锁/重新生成，不重复扣费
    const paid = cardStateRef?.current?.isReportPaid
    if (paid && onUnlock) {
      onUnlock()
      return
    }
    // 未付费用户 → 打开支付确认弹窗
    setIsUnlockConfirmOpen(true)
  }

  // 证据图片预览URL管理
  useEffect(() => {
    const urls = modalImages.map(file => URL.createObjectURL(file))
    setEvidencePreviewUrls(urls)
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [modalImages])

  // 获取当前钱包地址的邀请码
  useEffect(() => {
    if (!address) return
    fetch(`/api/get-invite-code?address=${address}`)
      .then(r => r.json())
      .then(data => {
        if (data.code) setLocalInviteCode(data.code)
      })
      .catch(() => {})
  }, [address])

  // 获取邀请次数（>0 则隐藏邀请横幅，终身一次）
  useEffect(() => {
    if (!address) { setInviteCount(0); return }
    fetch(`/api/invite/stats?user_address=${address}`)
      .then(r => r.json())
      .then(j => { if (r.ok) setInviteCount(j.invite_count || 0) })
      .catch(() => {})
  }, [address])

  const handleEvidenceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newFiles = Array.from(files)
    const total = modalImages.length + newFiles.length
    if (total > 5) {
      setEvidenceAlertMsg("最多上传5张图片")
      return
    }
    const validTypes = ["image/jpeg", "image/png"]
    const existingKeys = new Set(modalImages.map(f => `${f.name}_${f.size}`))
    const duplicateNames: string[] = []
    const uniqueNewFiles: File[] = []
    for (const file of newFiles) {
      if (!validTypes.includes(file.type)) {
        setEvidenceAlertMsg(`文件 ${file.name} 格式不支持，仅支持 JPG/PNG`)
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setEvidenceAlertMsg(`文件 ${file.name} 超过5MB限制`)
        return
      }
      const key = `${file.name}_${file.size}`
      if (existingKeys.has(key)) {
        duplicateNames.push(file.name)
      } else {
        uniqueNewFiles.push(file)
        existingKeys.add(key)
      }
    }
    if (duplicateNames.length > 0) {
      setEvidenceAlertMsg(`文件 ${duplicateNames.join(", ")} 已存在，已自动跳过重复文件`)
    }
    if (uniqueNewFiles.length === 0) return
    setModalImages(prev => [...prev, ...uniqueNewFiles])
    e.target.value = ""
  }

  const handleRemoveEvidenceImage = (index: number) => {
    setModalImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmitEvidence = () => {
    setEvidenceAlertMsg("")
    if (onEvidenceChange) onEvidenceChange(modalImages, modalText)
    setShowEvidenceModal(false)
    setSubmitResultMsg(`已收到补充证据（图片${modalImages.length}张，文本${modalText.length}字符），将纳入报告。`)
    setShowSubmitResult(true)
  }

  const handleOpenEvidenceModal = () => {
    setModalImages(evidenceImages)
    setModalText(evidenceText)
    setShowEvidenceModal(true)
  }

  // 简短点评：从报告数据中提取关键事实，生成≤30字的一句话
  const shortReview = generateShortReview(reportData)

  // ── 分享卡片所需数据 ──
  const shareTop10Holding = (() => {
    const goplusTop10 = effectiveOnChain?.goplus?.top10Percent
    if (goplusTop10 !== null && goplusTop10 !== undefined) {
      const pct = Number(goplusTop10)
      if (!Number.isNaN(pct)) return pct
    }
    const val = reportData?.top10_concentration
    if (val) {
      const parsed = parseInt(val)
      if (!Number.isNaN(parsed)) return parsed
    }
    return 0
  })()
  const shareRiskLevel = shareTop10Holding >= 70 ? '高度集中' : shareTop10Holding >= 50 ? '中度集中' : '分布较分散'
  const shareRiskColor: 'red' | 'orange' | 'yellow' | 'green' = shareTop10Holding >= 70 ? 'red' : shareTop10Holding >= 50 ? 'yellow' : 'green'

  return (
    <div className={isEmbedded ? "px-4 py-3 space-y-3" : "bg-zinc-800 rounded-lg border border-[#343438] p-4 space-y-4 w-full"}>
      <div className={isEmbedded ? "" : "border-b border-[#343438] pb-4"}>
        <h3 className="text-white font-semibold text-sm text-center">项目基本情报</h3>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">项目名称</span>
          <span className="text-white text-xs font-medium">{projectName}</span>
        </div>
        <div className="flex justify-between items-start gap-3">
          <span className="text-zinc-400 text-xs flex-shrink-0">合约地址</span>
          <div className="flex items-center gap-1 flex-1">
            <span className="text-white text-xs font-mono break-all">{contractAddress}</span>
            <button onClick={handleCopyAddress} className="text-zinc-400 hover:text-white transition-colors p-0.5 flex-shrink-0" title="复制地址">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">流动性锁仓</span>
          {lockRender ? (
            <span className={`text-xs font-medium ${lockRender.color}`}>{lockRender.icon} {lockRender.text}</span>
          ) : (
            <span className="text-[#6B7280] text-xs font-medium">--</span>
          )}
        </div>
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">TOP10 持仓占比</span>
          {top10Render ? (
            <span className={`text-xs font-medium ${top10Render.color}`}>{top10Render.icon} {top10Render.text}</span>
          ) : (
            <span className="text-[#6B7280] text-xs font-medium">--</span>
          )}
        </div>
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">信息完整性评分</span>
          <div className="flex items-center gap-1">
            <span className="text-white text-xs font-medium">{displayScore}%</span>
            <span className="text-zinc-500 text-xs">{displayLabel}</span>
          </div>
        </div>
        <div className="bg-zinc-700 bg-opacity-50 rounded p-2 mt-1">
          <div className="text-zinc-400 text-xs mb-1">明鉴·风险洞察官简短点评</div>
          <p className="text-white font-semibold text-xs">{shortReview}</p>
        </div>
        <div className="flex justify-between items-center pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 text-xs">评估次数</span>
            <div className="relative">
              <button className="text-zinc-400 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setShowInfoPopover(!showInfoPopover) }}>
                <Info className="w-3.5 h-3.5" />
              </button>
              {showInfoPopover && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowInfoPopover(false)} />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-zinc-800 border border-[#343438] rounded-lg p-2.5 w-48 shadow-lg">
                    <p className="text-zinc-300 text-xs leading-relaxed">评估次数反映项目被查询的频率，不代表安全性</p>
                  </div>
                </>
              )}
            </div>
          </div>
          <span className="text-white text-xs font-medium">{(assessmentCount || 0).toLocaleString()} 次</span>
        </div>
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">最后评估时间</span>
          <span className="text-white text-xs font-medium">{lastEvaluation || "--"}</span>
        </div>
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">关联代币</span>
          <button onClick={() => setIsTokenExpanded(!isTokenExpanded)} className="text-blue-400 hover:text-blue-300 transition-colors text-xs font-medium">
            {linkedToken || '--'}
          </button>
        </div>
        {isTokenExpanded && linkedToken && (
          <div className="text-zinc-300 text-xs">
            {effectiveOnChain?.tokenName && effectiveOnChain.tokenName !== '未知' ? `${effectiveOnChain.tokenName} (${linkedToken})` : linkedToken}
            {effectiveOnChain?.totalSupply && effectiveOnChain.totalSupply !== '0' ? ` · 总供应量: ${effectiveOnChain.totalSupply}` : ''}
          </div>
        )}
      </div>

      {/* ===== 免费卡片专属区域，嵌入模式下隐藏 ===== */}
      {!isEmbedded && (<>
        {/* 邀请好友横幅 —— 终身一次，invite_count>0 则隐藏 */}
        {inviteCount === 0 && (
        <ShareButton
          inviteCode={localInviteCode}
          trigger={
            <div className="w-full rounded-3xl mb-3 px-3 py-2.5 flex items-center gap-3 bg-gradient-to-r from-blue-950/50 to-purple-950/50 hover:bg-zinc-700 transition-colors">
              <Gift className="w-5 h-5 flex-shrink-0 text-blue-400" />
              <div className="flex-1">
                <div className="text-xs text-zinc-200">邀请一位朋友，立得 2.99U 代金券</div>
                <div className="text-xs text-zinc-500">可抵扣本次支付</div>
              </div>
              <ChevronRight className="w-5 h-5 flex-shrink-0 text-zinc-500" />
            </div>
          }
        />
        )}

        {/* 解锁按钮 */}
        <div className="border-t border-[#343438] pt-4 mt-4 space-y-2">
          {/* 补充证据按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenEvidenceModal}
              className="text-blue-400 hover:text-blue-300 text-xs underline underline-offset-2 font-medium"
            >
              补充证据
            </button>
            <span className="text-zinc-500 text-[10px]">上传更多资料可提高报告准确性</span>
          </div>

          <button
            onClick={handleUnlockReport}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-2xl text-sm font-semibold transition-all"
          >
            解锁全景风险报告
          </button>
          <p className="text-zinc-500 text-xs leading-relaxed">
            点击后需支付 2.99 USDT 解锁完整风险报告（含六维雷达图、全网舆情监测、AI专家深度解读、商业模式历史变更追踪等）。{"\n"}一次付费，永久查看。
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-zinc-500 text-xs text-center">数据基于公开信息，仅供参考</p>
          <div className="border-t border-[#343438] -mx-4"></div>

          <ShareProjectDrawer
            projectName={projectName}
            contractAddress={contractAddress}
            top10Holding={shareTop10Holding}
            riskLevel={shareRiskLevel}
            riskColor={shareRiskColor}
            infoCompleteness={displayScore}
            completenessLevel={displayLabel}
            review={shortReview}
            className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 hover:text-blue-300 text-white text-xs font-medium py-2.5 rounded-full transition-colors"
          />
          {/* 解锁支付确认弹窗 */}
          {isUnlockConfirmOpen && createPortal(
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => setIsUnlockConfirmOpen(false)}>
              <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-white font-semibold text-sm text-center">解锁全景风险报告</h3>
                <p className="text-zinc-300 text-xs leading-relaxed">将为您生成完整风险报告，需支付 2.99 USDT（当前仅支持BSC链（BEP20）支付）。是否继续？</p>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setIsUnlockConfirmOpen(false)} className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs">取消</button>
                  <button onClick={() => {
                    setIsUnlockConfirmOpen(false)
                    if (onUnlock) onUnlock()
                  }} className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs">确认支付</button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {onAnalyzeBusinessModel && (
            <button
              onClick={onAnalyzeBusinessModel}
              className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 hover:text-blue-300 text-white text-xs font-medium py-2.5 rounded-full transition-colors"
            >
              分析该项目的商业模式
            </button>
          )}
        </div>
      </>)}  {/* isEmbedded 条件结束 */}

            {/* 补充证据模态框 */}
      {showEvidenceModal && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => { setShowEvidenceModal(false); setEvidenceAlertMsg("") }}>
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="relative flex items-center justify-center">
              <h3 className="text-white font-semibold text-sm">补充项目证据</h3>
              <button
                onClick={() => { setShowEvidenceModal(false); setEvidenceAlertMsg("") }}
                className="absolute right-0 text-zinc-400 hover:text-white text-sm px-1"
              >
                ✕
              </button>
            </div>
            <p className="text-zinc-300 text-xs leading-relaxed">
              如果您掌握该项目相关的群聊截图、公告、提现记录或模式变更证据，请上传。这些信息将帮助生成更准确的风险报告。
            </p>
            <EvidenceUpload
              contractAddress={contractAddress}
              projectName={projectName}
              contributorAddress={contributorAddress}
              sourceType="evidence_button"
              maxImages={5}
              onSuccess={(result) => {
                setSubmitResultMsg(`✅ 证据已提交！AI 正在分析图片内容，分析结果将纳入风险报告。`);
                setShowSubmitResult(true);
                setTimeout(() => setShowEvidenceModal(false), 2000);
                if (onEvidenceChange) onEvidenceChange([], modalText);
              }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* 提交结果弹窗 */}
      {showSubmitResult && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => setShowSubmitResult(false)}>
          <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center text-green-400">
              <Check className="w-8 h-8" />
            </div>
            <p className="text-zinc-200 text-xs text-left leading-relaxed">{submitResultMsg}</p>
            <button
              onClick={() => setShowSubmitResult(false)}
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
