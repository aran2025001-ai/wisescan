import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ChevronLeft, Copy, Check, Info, Share2, BookOpen } from "lucide-react"

// Mock project data
const MOCK_PROJECTS: Record<string, any> = {
  "1": {
    id: "1",
    name: "Uniswap V3",
    address: "0x1111111254fb6c44bac0bed2854e76f90643097d",
    riskLevel: "需谨慎",
    riskScore: 45,
  },
  "2": {
    id: "2",
    name: "OpenSea",
    address: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
    riskLevel: "中等",
    riskScore: 65,
  },
  "3": {
    id: "3",
    name: "Aave Protocol",
    address: "0xbc6da0fe9ad7e36c3130ee5145995e756ed970d9",
    riskLevel: "良好",
    riskScore: 85,
  },
}

function ProjectInfoCard({
  projectName,
  contractAddress,
  onCopyAddress,
  copied,
  onUnlockReport,
  onShare,
  onAnalyzeBusinessModel,
}: any) {
  const [isTokenExpanded, setIsTokenExpanded] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  return (
    <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-4 space-y-4 w-full mx-auto max-w-sm">
      {/* Title */}
      <div className="border-b border-zinc-700 pb-4">
        <h3 className="text-white font-semibold text-sm">项目基本情报</h3>
      </div>

      {/* Project Info Rows */}
      <div className="space-y-3">
        {/* Project Name */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">项目名称</span>
          <span className="text-white text-xs font-medium">{projectName}</span>
        </div>

        {/* Contract Address */}
        <div className="flex justify-between items-start gap-3">
          <span className="text-zinc-400 text-xs flex-shrink-0">合约地址</span>
          <div className="flex items-center gap-1 flex-1 justify-end">
            <span className="text-white text-xs font-mono break-all text-right">{contractAddress}</span>
            <button
              onClick={onCopyAddress}
              className="text-zinc-400 hover:text-white transition-colors p-0.5 flex-shrink-0"
              title="复制地址"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Contract Format Check */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">合约格式校验</span>
          <span className="text-green-400 text-xs font-medium">✅ 有效</span>
        </div>

        {/* Liquidity Locked */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">流动性锁定</span>
          <span className="text-white text-xs font-medium">85% 已锁定</span>
        </div>

        {/* Holder Count */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">持币地址数</span>
          <span className="text-white text-xs font-medium">1,234 个</span>
        </div>

        {/* TOP10 Holding Ratio */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">TOP10 持仓占比</span>
          <span className="text-red-400 text-xs font-medium">78%</span>
        </div>

        {/* Info Completeness */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">信息完整性评分</span>
          <div className="flex items-center gap-1">
            <span className="text-white text-xs font-medium">32%</span>
            <span className="text-zinc-500 text-xs">较低</span>
          </div>
        </div>

        {/* Assessment Count */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 text-xs">评估次数</span>
            <button
              className="text-zinc-400 hover:text-white transition-colors"
              onClick={() => alert("评估次数反映项目被查询的频率，不代表安全性")}
              title="了解更多"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-white text-xs font-medium">1,234 次</span>
        </div>

        {/* Last Evaluation Time */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">最后评估时间</span>
          <span className="text-white text-xs font-medium">2026-06-08</span>
        </div>

        {/* Associated Tokens */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">关联代币</span>
          <button
            onClick={() => setIsTokenExpanded(!isTokenExpanded)}
            className="text-blue-400 hover:text-blue-300 transition-colors text-xs font-medium"
          >
            🔗 多代币（3个）
          </button>
        </div>
        {isTokenExpanded && (
          <div className="space-y-1 text-zinc-300 text-xs mt-2 ml-0 pl-4 border-l border-zinc-600">
            <div className="flex justify-between items-start gap-2">
              <span>MY (主币)</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("0x742d35Cc6634C0532925a3b844Bc454e4438f44e")
                  alert("已复制")
                }}
                className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                title="复制地址"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span>Darwin</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("0x1234567890abcdef1234567890abcdef12345678")
                  alert("已复制")
                }}
                className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                title="复制地址"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span>MYX</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("0xabcdef1234567890abcdef1234567890abcdef12")
                  alert("已复制")
                }}
                className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                title="复制地址"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invite Friend Button */}
      <div className="border-t border-zinc-700 pt-4">
        <button
          onClick={() => setShowInviteModal(true)}
          className="w-full px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <span>邀请朋友</span>
        </button>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg p-6 max-w-xs mx-4 border border-zinc-600 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-sm">邀请朋友使用明鉴</h3>
            <p className="text-zinc-300 text-xs">分享你的邀请链接给朋友，两人都可获得 20% 查询折扣</p>
            <div className="space-y-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("https://wisescan.io/invite?code=USER123")
                    setShowInviteModal(false)
                    alert("邀请链接已复制")
                  }}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  复制邀请链接
                </button>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  取消
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Unlock Full Report Button */}
      <div className="border-t border-zinc-700 pt-4">
        <button
          onClick={onUnlockReport}
          className="w-full px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          <span>解锁全景风险报告</span>
        </button>
      </div>

      {/* 明鉴·风险洞察官 Short Comment */}
      <div className="border-t border-zinc-700 pt-4">
        <h4 className="text-zinc-400 text-xs font-semibold mb-2">明鉴·风险洞察官简短点评</h4>
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
          <p className="text-zinc-300 text-xs leading-relaxed">
            项目方案新颖，市场定位清晰，代币经济模型相对合理。但团队信息披露不足，社区建设初期，早期风险相对较高，建议在小额试水后再决定是否参与。
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border-t border-zinc-700 pt-4 text-center">
        <p className="text-zinc-400 text-xs">
          数据基于公开信息，仅供参考，不构成投资建议
        </p>
      </div>

      {/* Share Button */}
      <div className="border-t border-zinc-700 pt-4">
        <button
          onClick={onShare}
          className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium py-2.5 rounded-full transition-colors"
        >
          <Share2 className="w-4 h-4" />
          分享项目情报
        </button>
      </div>

      {/* Analyze Business Model Button */}
      <div className="pt-3">
        <button
          onClick={onAnalyzeBusinessModel}
          className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium py-2.5 rounded-full transition-colors"
        >
          分析该项目的商业模式
        </button>
      </div>
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  const project = MOCK_PROJECTS[id || ""] || MOCK_PROJECTS["1"]
  const projectName = project.name
  const riskLevel = project.riskLevel
  const contractAddress = project.address

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(contractAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleUnlockReport = () => {
    const confirmed = window.confirm("将为您生成完整风险报告，需支付 2.99 USDT。是否继续？")
    if (confirmed) {
      alert("支付成功，报告生成中（演示模式）")
      setIsPaid(true)
    }
  }

  const handleShare = () => {
    setIsShareModalOpen(true)
  }

  const handleAnalyzeBusinessModel = () => {
    const confirmed = window.confirm("将跳转到商业模式拆解")
    if (confirmed) {
      navigate("/business")
    }
  }

  return (
    <div className="text-white flex flex-col">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-900 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 max-w-sm mx-auto w-full">
          <button
            onClick={() => navigate("/library")}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
            title="返回"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-center text-sm font-semibold flex-1 truncate px-2">{projectName}</h1>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-500/20 text-red-400 whitespace-nowrap flex-shrink-0">
            {riskLevel}
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
            copied={copied}
            onUnlockReport={handleUnlockReport}
            onShare={handleShare}
            onAnalyzeBusinessModel={handleAnalyzeBusinessModel}
          />
        ) : (
          // Show full risk report card
          <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-4 space-y-4 mx-auto max-w-sm">
            {/* Title Area */}
            <div className="border-b border-zinc-700 pb-4">
              <h3 className="text-white font-semibold text-sm">全景风险报告</h3>
              <p className="text-zinc-400 text-xs mt-1">{projectName}</p>
            </div>

            {/* Project Basic Info Section (reused) */}
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-zinc-400 text-xs">项目名称</span>
                <span className="text-white text-xs font-medium">{projectName}</span>
              </div>

              <div className="flex justify-between items-start gap-3">
                <span className="text-zinc-400 text-xs flex-shrink-0">合约地址</span>
                <div className="flex items-center gap-1 flex-1 justify-end">
                  <span className="text-white text-xs font-mono break-all text-right">{contractAddress}</span>
                  <button
                    onClick={handleCopyAddress}
                    className="text-zinc-400 hover:text-white transition-colors p-0.5 flex-shrink-0"
                    title="复制地址"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* ... other info rows same as ProjectInfoCard ... */}
              <div className="flex justify-between items-start">
                <span className="text-zinc-400 text-xs">合约格式校验</span>
                <span className="text-green-400 text-xs font-medium">✅ 有效</span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-zinc-400 text-xs">流动性锁定</span>
                <span className="text-white text-xs font-medium">85% 已锁定</span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-zinc-400 text-xs">持币地址数</span>
                <span className="text-white text-xs font-medium">1,234 个</span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-zinc-400 text-xs">TOP10 持仓占比</span>
                <span className="text-red-400 text-xs font-medium">78%</span>
              </div>
            </div>

            {/* Six-Dimension Radar Chart (text simulation) */}
            <div className="border-t border-zinc-700 pt-4">
              <h4 className="text-zinc-300 font-semibold text-xs mb-2">六维安全评分</h4>
              <div className="space-y-1.5 text-xs text-zinc-200">
                <div>代码安全 25/25 ✓</div>
                <div className="text-yellow-600">团队透明度 8/20</div>
                <div className="text-yellow-600">经济模型 12/20</div>
                <div className="text-yellow-600">社群热度 10/15</div>
                <div className="text-red-600">历史可靠性 4/10</div>
                <div className="text-red-600">合规性 5/10</div>
              </div>
            </div>

            {/* Internet Sentiment Monitoring Summary */}
            <div className="border-t border-zinc-700 pt-4">
              <h4 className="text-zinc-300 font-semibold text-xs mb-2">互联网舆情监测</h4>
              <div className="space-y-1.5 text-xs text-zinc-200">
                <div className="text-red-500">负面关键词：提现困难 23条，锁仓 15条，改规则 8条</div>
                <div className="text-gray-300 italic text-xs mt-2">典型抱怨摘录："6月1日提现到现在还没到账"</div>
                <div className="text-red-400 mt-2">舆情结论：近期负面讨论集中</div>
              </div>
            </div>

            {/* Comprehensive Score */}
            <div className="border-t border-zinc-700 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300 text-xs font-semibold">综合评分</span>
                <span className="text-red-500 text-lg font-bold">{project.riskScore}/100</span>
              </div>
              <p className="text-red-500 text-xs font-semibold mt-1">🔴 高风险</p>
              <p className="text-red-400 text-xs mt-2">❌ 不建议参与</p>
              <p className="text-zinc-300 text-xs mt-2">该项目存在锁仓机制不透明、模式多次变更等风险。</p>
            </div>

            {/* 明鉴风险洞察官 Comprehensive Interpretation */}
            <div className="border-t border-zinc-700 pt-4">
              <h4 className="text-zinc-300 font-semibold text-xs mb-2">明鉴风险洞察官综合解读</h4>
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                <p className="text-zinc-200 text-xs leading-relaxed">
                  该项目在代码层面未审计，团队完全匿名，经济模型中代币锁仓机制不透明。历史记录显示模式已变更2次，用户出金存在障碍。建议用户谨慎参与，控制投入金额。
                </p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="border-t border-zinc-700 pt-4 text-center">
              <p className="text-zinc-400 text-xs">
                数据基于公开信息，仅供参考，不构成投资建议
              </p>
            </div>

            {/* Share Button */}
            <div className="border-t border-zinc-700 pt-4">
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium py-2.5 rounded-full transition-colors"
              >
                <Share2 className="w-4 h-4" />
                分享项目情报
              </button>
            </div>

            {/* Analyze Business Model Button */}
            <div className="pt-3">
              <button
                onClick={handleAnalyzeBusinessModel}
                className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium py-2.5 rounded-full transition-colors"
              >
                分析该项目的商业模式
              </button>
            </div>

            {/* Back Button */}
            <div className="pt-2">
              <button
                onClick={() => setIsPaid(false)}
                className="w-full px-4 py-2 bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
              >
                返回基本情报
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {isShareModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg p-6 max-w-xs mx-4 border border-zinc-600 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-sm">分享项目情报</h3>
            <p className="text-zinc-300 text-xs">项目情报卡片将分享给好友</p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  alert("项目情报图片生成功能开发中，后续将支持")
                  setIsShareModalOpen(false)
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                分享
              </button>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs font-medium transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
