"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronLeft, Plus, Mic, Keyboard, Send, BookOpen, AlertCircle, X, Copy, Check, Info, Gift, ChevronRight, Share2 } from "lucide-react"

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
}

const initialWelcomeMessage = `👋 你是不是也遇到过——
项目看着很火，投进去就跑路？
白皮书全是术语，根本看不懂？
群里都说好，一提现就卡？

我是明鉴风险洞察官。我的工作就是帮你提前看穿这些风险。

你只需要：把项目名称、合约地址、或者任何你看到的资料发给我。你给得越全，我分析得越准。

第一步完全免费：我会给你一份"快速扫描"，告诉你合约有没有问题、持币是不是集中、信息披露了多少。

如果你想看更深度的全景风险报告（包括六维诊断图、全网舆情、AI综合安全解读），只需要 2.99 USDT —— 相当于少吃一顿快餐，但可能帮你避开一个几万块的坑。`

interface MethodologySection {
  title: string
  content: string[]
  emoji?: string
}

interface DimensionRow {
  dimension: string
  weight: string
  points: string
}

interface RiskLevelRow {
  score: string
  level: string
  conclusion: string
}

const dataSources = [
  { name: "BscScan / Etherscan", desc: "获取合约地址、持币分布、流动性锁定、交易记录" },
  { name: "GoPlus Security", desc: "检测合约漏洞、蜜罐风险、授权异常" },
  { name: "RugCheck", desc: "识别 Rug Pull 风险、代币经济模型基础问题" },
  { name: "RootData", desc: "查询融资记录、投资机构、团队背景、代币解锁信息" },
  { name: "CoinGecko", desc: "获取代币价格、市值、交易量、流动性池、官网及社媒链接" },
  { name: "Dune Analytics", desc: "自定义追踪用户行为、跨链活动、鲸鱼钱包动向" },
  { name: "Messari", desc: "参考项目研究报告、市场情绪指标、行业新闻" },
  { name: "Coinhawk", desc: "聚合链上+链下数据输出风险评分参考" },
  { name: "Twitter/Telegram/百度/微博", desc: "舆情关键词与情感分析" },
  { name: "用户贡献", desc: "经三重交叉验证的截图与聊天记录" },
]

const dimensionTable: DimensionRow[] = [
  { dimension: "代码与技术安全", weight: "25%", points: "合约审计、漏洞检测、权限控制、历史变更" },
  { dimension: "团队与运营透明度", weight: "20%", points: "团队实名、融资披露、信息完整性" },
  { dimension: "经济模型与资金安全", weight: "20%", points: "代币分配、LP锁仓、资金外流" },
  { dimension: "社群与市场热度", weight: "15%", points: "社群真实性、舆情分析、开发活跃度" },
  { dimension: "历史与执行可靠性", weight: "10%", points: "模式变更次数、出金异常" },
  { dimension: "合规性与法律风险", weight: "10%", points: "法律实体、牌照、KYC/AML" },
]

const riskLevelTable: RiskLevelRow[] = [
  { score: "90-100", level: "极低风险", conclusion: "可以参与" },
  { score: "75-89", level: "低风险", conclusion: "可以参与" },
  { score: "60-74", level: "中等风险", conclusion: "谨慎参与" },
  { score: "40-59", level: "高风险", conclusion: "不建议参与" },
  { score: "0-39", level: "极高风险", conclusion: "严禁参与" },
]

const methodologyData: MethodologySection[] = [
  {
    title: "动态更新机制",
    emoji: "🔄",
    content: [
      "报告基于评估时的公开数据生成，项目状态可能变化",
      "用户可支付 1 USDT 刷新报告，获取最��分析",
      "历史报告保存在\"我的\"页面，支持对比查看",
    ]
  },
  {
    title: "免责声明",
    emoji: "⚖️",
    content: [
      "本工具所有报告均基于公开API、链上数据及用户贡献信息自动生成。",
      "明鉴不对信息的绝对准确性、完整性或时效性作任何保证。",
      "用户应自行核实并承担投资风险。平台不提供任何投资建议。",
    ]
  }
]

// 项目基本情报卡片组件
interface ProjectInfoCardProps {
  projectName: string
  contractAddress: string
  onCopyAddress: () => void
  copied: boolean
  onUnlockReport?: (projectName: string) => void
}

function RiskReportCard({ 
  projectName, 
  contractAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  onCopyAddress,
  copied
}: { 
  projectName: string
  contractAddress?: string
  onCopyAddress?: () => void
  copied?: boolean
}) {
  const [isTokenExpanded, setIsTokenExpanded] = useState(false)
  const [isReportShareModalOpen, setIsReportShareModalOpen] = useState(false)

  return (
    <div className="w-full bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
      {/* 报告标题 */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 px-4 py-3 border-b border-zinc-700">
        <h3 className="text-white font-semibold text-base">全景风险报告 - {projectName}</h3>
        <p className="text-zinc-400 text-xs mt-1">明鉴·风险洞察官出品</p>
      </div>

      {/* 项目基本情报部分 */}
      <div className="px-4 py-3 border-b border-zinc-700 bg-zinc-800/30">
        <div className="mb-3 pb-3 border-b border-zinc-700">
          <h4 className="text-white font-semibold text-xs">项目基本情报</h4>
        </div>

        {/* 项目信息行 */}
        <div className="space-y-3 text-xs">
          {/* 项目名称 */}
          <div className="flex justify-between items-start">
            <span className="text-zinc-400">项目名称</span>
            <span className="text-white font-medium">{projectName}</span>
          </div>

          {/* 合约地址 */}
          <div className="flex justify-between items-start gap-3">
            <span className="text-zinc-400 flex-shrink-0">合约地址</span>
            <div className="flex items-center gap-1 flex-1">
              <span className="text-white font-mono break-all text-xs">{contractAddress}</span>
              {onCopyAddress && (
                <button 
                  onClick={onCopyAddress}
                  className="text-zinc-400 hover:text-white transition-colors p-0.5 flex-shrink-0"
                  title="复制地址"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* 合约格式校验 */}
          <div className="flex justify-between items-start">
            <span className="text-zinc-400">合约格式校验</span>
            <span className="text-green-400 font-medium">✅ 有效</span>
          </div>

          {/* 流动性锁定 */}
          <div className="flex justify-between items-start">
            <span className="text-zinc-400">流动性锁定</span>
            <span className="text-white font-medium">85% 已锁定</span>
          </div>

          {/* 持币地址数 */}
          <div className="flex justify-between items-start">
            <span className="text-zinc-400">持币地址数</span>
            <span className="text-white font-medium">1,234 个</span>
          </div>

          {/* TOP10持仓占比 */}
          <div className="flex justify-between items-start">
            <span className="text-zinc-400">TOP10 持仓占比</span>
            <span className="text-red-400 font-medium">78%</span>
          </div>

          {/* 信息完整性评分 */}
          <div className="flex justify-between items-start">
            <span className="text-zinc-400">信息完整性评分</span>
            <div className="flex items-center gap-1">
              <span className="text-white font-medium">32%</span>
              <span className="text-zinc-500">较低</span>
            </div>
          </div>

          {/* 明鉴·风险洞察官简短点评 */}
          <div className="bg-zinc-700 bg-opacity-50 rounded p-2 mt-2 mb-2">
            <div className="flex items-start gap-2">
              <span className="text-zinc-400 flex-shrink-0">明鉴·风险洞察官简短点评：</span>
              <p className="text-white italic font-semibold">合约未审计，持币地址高度集中</p>
            </div>
          </div>

          {/* 评估次数 */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400">评估次数</span>
              <button 
                className="text-zinc-400 hover:text-white transition-colors"
                onClick={() => alert("评估次数反映项目被查询的频率，不代表安全性")}
                title="了解更多"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-white font-medium">1,234 次</span>
          </div>

          {/* 最��评估���间 */}
          <div className="flex justify-between items-start">
            <span className="text-zinc-400">最后评估时间</span>
            <span className="text-white font-medium">2026-06-08</span>
          </div>

          {/* 关联代币 */}
          <div className="flex justify-between items-start">
            <span className="text-zinc-400">关联代币</span>
            <button 
              onClick={() => setIsTokenExpanded(!isTokenExpanded)}
              className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              🔗 多代币（3个）
            </button>
          </div>
          {isTokenExpanded && (
            <div className="text-zinc-300 ml-0 pl-0">
              MY, Darwin, MYX
            </div>
          )}
        </div>
      </div>

      {/* 分隔线 */}
      <div className="border-b border-zinc-700"></div>

      {/* 雷达图文字模拟 */}
      <div className="px-4 py-3 border-b border-zinc-700 bg-zinc-800/50">
        <p className="text-zinc-200 text-xs leading-relaxed whitespace-pre-wrap font-mono">
雷达图：
代码安全 ████████████████████████ 25/25
团队透明度 ████████ 8/20
经济模型 ████████████ 12/20
社群热度 ██████████ 10/15
历史可靠性 ████ 4/10
合规性 █████ 5/10
        </p>
      </div>

      {/* 详细评分表 */}
      <div className="px-4 py-3 space-y-3">
        <div className="text-sm">
          <p className="text-blue-400 font-semibold mb-1">代码与技术安全（25%）</p>
          <p className="text-zinc-300 text-xs mb-1">得分：25 / 25</p>
          <p className="text-zinc-400 text-xs">扣分项：无</p>
        </div>

        <div className="text-sm border-t border-zinc-700 pt-3">
          <p className="text-blue-400 font-semibold mb-1">团队与运营透明度（20%）</p>
          <p className="text-zinc-300 text-xs mb-1">得分：8 / 20</p>
          <p className="text-zinc-400 text-xs">扣分项：团队匿名</p>
        </div>

        <div className="text-sm border-t border-zinc-700 pt-3">
          <p className="text-blue-400 font-semibold mb-1">经济模型与资金安全（20%）</p>
          <p className="text-zinc-300 text-xs mb-1">得分：12 / 20</p>
          <p className="text-zinc-400 text-xs">扣分项：代币锁仓不透明</p>
        </div>

        <div className="text-sm border-t border-zinc-700 pt-3">
          <p className="text-blue-400 font-semibold mb-1">社群与市场热度（15%）</p>
          <p className="text-zinc-300 text-xs mb-1">得分：10 / 15</p>
          <p className="text-zinc-400 text-xs">扣分项：僵尸粉较多</p>
        </div>

        <div className="text-sm border-t border-zinc-700 pt-3">
          <p className="text-blue-400 font-semibold mb-1">历史与执行可靠性（10%）</p>
          <p className="text-zinc-300 text-xs mb-1">得分：4 / 10</p>
          <p className="text-zinc-400 text-xs">扣分项：模式变更2次</p>
        </div>

        <div className="text-sm border-t border-zinc-700 pt-3">
          <p className="text-blue-400 font-semibold mb-1">合规性与法律风险（10%）</p>
          <p className="text-zinc-300 text-xs mb-1">得分：5 / 10</p>
          <p className="text-zinc-400 text-xs">扣分项：无法律实体</p>
        </div>
      </div>

      {/* 互联网舆情监测摘要 */}
      <div className="px-4 py-3 border-t border-zinc-700 bg-zinc-800/30">
        <h4 className="text-white font-semibold text-xs mb-3">互联网舆情监测摘要</h4>
        
        <div className="space-y-3 text-xs">
          {/* 负面关键词 */}
          <div>
            <p className="text-zinc-300 mb-1">负面关键词：</p>
            <p className="text-red-400 ml-2">提现困难 23条，锁仓 15条，改规则 8条</p>
          </div>

          {/* 典型抱怨摘录 */}
          <div>
            <p className="text-zinc-300 mb-1">典型抱怨摘录：</p>
            <div className="ml-2 bg-zinc-700/50 rounded p-2 italic text-zinc-200">
              "6月1日提现到现在还没到账"（来源：微信社群）
            </div>
          </div>

          {/* 舆情结论 */}
          <div>
            <p className="text-zinc-300 mb-1">舆情结论：</p>
            <p className="text-yellow-500 ml-2 font-semibold">近期负面讨论集中，提现障碍被多次提及</p>
          </div>
        </div>
      </div>

      {/* 综合评分与风险等级 */}
      <div className="px-4 py-3 border-t border-zinc-700 bg-zinc-800/30 space-y-3">
        <h4 className="text-white font-semibold text-xs">综合评分与风险等级</h4>
        
        {/* 综合评分 */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-300">综合评分</span>
          <span className="text-white font-bold">45 / 100</span>
        </div>

        {/* 风险等级 */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-300">风险等级</span>
          <span className="text-red-500 font-bold">高风险</span>
        </div>

        {/* 建议 */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-300">建议</span>
          <span className="text-red-500 font-bold">❌ 不建议参与</span>
        </div>

        {/* 一句话总结 */}
        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 mt-2">
          <p className="text-red-400 text-xs leading-relaxed">
            该项目存在锁仓机制不透明、模式多次变更等风险，建议谨慎。
          </p>
        </div>
      </div>

      {/* 明鉴·风险洞察官综合解读 */}
      <div className="px-4 py-3 border-t border-zinc-700 bg-zinc-800/30">
        <h4 className="text-white font-semibold text-xs mb-2">明鉴·风险洞察官综合解读</h4>
        <p className="text-zinc-200 text-xs leading-relaxed">
          该项目在代码层面未审计，团队完全匿名，且经济模型中代币锁仓不透明。历史记录显示模式已变更2次，用户出金存在障碍。互联网舆情中多次提及提现困难。综合评估风险较高，建议用户谨慎参与，控制投入金额。
        </p>
      </div>

      {/* 免责声明 */}
      <div className="px-4 py-3 border-t border-zinc-700 bg-zinc-700/20">
        <h4 className="text-white font-semibold text-xs mb-2">免责声明</h4>
        <p className="text-zinc-300 text-xs leading-relaxed">
          本报告基于公开信息生成，仅供参考，不构成投资建议。用户应自行核实并承担风险。
        </p>
      </div>

      {/* 分隔线 */}
      <div className="h-px bg-gray-600 mx-4"></div>

      {/* 分享按钮（居中） */}
      <div className="px-4 py-1.5 flex justify-center">
        <button
          onClick={() => setIsReportShareModalOpen(true)}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
        >
          <Share2 className="w-4 h-4" />
          分享项目情报
        </button>
      </div>

      {/* 分享模态框 */}
      {isReportShareModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsReportShareModalOpen(false)}
        >
          <div 
            className="bg-zinc-900 rounded-4xl p-5 w-4/5 max-w-80 border border-zinc-700"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#1E1E2F" }}
          >
            {/* 模态框标题 */}
            <h3 className="text-white font-semibold text-sm mb-2">分享项目情报</h3>

            {/* 模态框说明文字 */}
            <p className="text-zinc-300 text-xs mb-4">
              项目情报卡片将分享给好友
            </p>

            {/* 模态框按钮 */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  alert("项目情报图片生成功能开发中，后续将支持")
                  setIsReportShareModalOpen(false)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                分享
              </button>
              <button
                onClick={() => setIsReportShareModalOpen(false)}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs font-medium transition-colors"
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

function ProjectInfoCard({ projectName, contractAddress, onCopyAddress, copied, onUnlockReport }: ProjectInfoCardProps) {
  const [isTokenExpanded, setIsTokenExpanded] = useState(false)
  const [isReportUnlocked, setIsReportUnlocked] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  
  const handleUnlockReport = () => {
    const confirmed = confirm("将为您生成完整风险报告，需支付 2.99 USDT。是否继续？")
    if (confirmed) {
      alert("支付功能开发中，当前为演示模式。将展示模拟数据。")
      setIsReportUnlocked(true)
      if (onUnlockReport) {
        onUnlockReport(projectName)
      }
    }
  }
  
  return (
    <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-4 space-y-4 w-full">
      {/* 标题 */}
      <div className="border-b border-zinc-700 pb-4">
        <h3 className="text-white font-semibold text-sm">项目基本情报</h3>
      </div>

      {/* 项目信息行 */}
      <div className="space-y-3">
        {/* 项目名称 */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">项目名称</span>
          <span className="text-white text-xs font-medium">{projectName}</span>
        </div>

        {/* 合约地址 */}
        <div className="flex justify-between items-start gap-3">
          <span className="text-zinc-400 text-xs flex-shrink-0">合约地址</span>
          <div className="flex items-center gap-1 flex-1">
            <span className="text-white text-xs font-mono break-all">{contractAddress}</span>
            <button 
              onClick={onCopyAddress}
              className="text-zinc-400 hover:text-white transition-colors p-0.5 flex-shrink-0"
              title="复制地址"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 合约格式校验 */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">合约格式校验</span>
          <span className="text-green-400 text-xs font-medium">✅ 有效</span>
        </div>

        {/* 流动性锁定 */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">流动性锁定</span>
          <span className="text-white text-xs font-medium">85% 已锁定</span>
        </div>

        {/* 持币地址数 */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">持币地址数</span>
          <span className="text-white text-xs font-medium">1,234 个</span>
        </div>

        {/* TOP10持仓占比 */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">TOP10 持仓占比</span>
          <span className="text-red-400 text-xs font-medium">78%</span>
        </div>

        {/* 信息完整性评分 */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">信息完整性评分</span>
          <div className="flex items-center gap-1">
            <span className="text-white text-xs font-medium">32%</span>
            <span className="text-zinc-500 text-xs">较低</span>
          </div>
        </div>

        {/* 明鉴·风险洞察官简短点评 */}
        <div className="bg-zinc-700 bg-opacity-50 rounded p-3 mt-3">
          <div className="flex items-start gap-2">
            <span className="text-zinc-400 text-xs flex-shrink-0">明鉴·风险洞察官简短点评：</span>
            <p className="text-white text-xs italic font-semibold">合约未审计，持币地址高度集中</p>
          </div>
        </div>

        {/* 评估次数 */}
        <div className="flex justify-between items-center pt-2">
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

        {/* 最后评估时间 */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">最后评估时间</span>
          <span className="text-white text-xs font-medium">2026-06-08</span>
        </div>

        {/* 关联代币 */}
        <div className="flex justify-between items-start">
          <span className="text-zinc-400 text-xs">关联代币</span>
          <button 
            onClick={() => setIsTokenExpanded(!isTokenExpanded)}
            className="text-blue-400 hover:text-blue-300 transition-colors text-xs font-medium"
          >
            ���� 多代币（3个）
          </button>
        </div>
        {isTokenExpanded && (
          <div className="text-zinc-300 text-xs ml-0 pl-0">
            MY, Darwin, MYX
          </div>
        )}
      </div>

      {/* 邀请朋友横幅 */}
      <button 
        onClick={(e) => {
          e.stopPropagation()
          const inviteLink = "https://wisescan.io/invite?code=USER123"
          const userInput = window.prompt("邀请朋友\n长按复制", inviteLink)
          if (userInput !== null) {
            alert("分享卡片功能后续上线")
          }
        }}
        className="w-full rounded-3xl mb-3 px-3 py-2.5 flex items-center gap-3 bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity" 
        style={{ backgroundColor: "#1E1E2F" }}
      >
        <Gift className="w-5 h-5 flex-shrink-0" style={{ color: "#60A5FA" }} />
        <span className="text-sm flex-1 text-left" style={{ color: "#E5E7EB" }}>
          邀请一位朋友，立得 2.99U 代金券（可抵扣本次支付）
        </span>
        <ChevronRight className="w-5 h-5 flex-shrink-0 text-zinc-500" />
      </button>

      {/* 底部按钮 */}
      <div className="border-t border-zinc-700 pt-4 mt-4 space-y-2">
        <button 
          onClick={handleUnlockReport}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-2xl text-sm font-semibold transition-all"
        >
          解锁全景风险报告
        </button>
        
        {/* 按钮下方提示 */}
        <p className="text-zinc-500 text-xs text-center leading-relaxed">
          点击后需支付 2.99 USDT 解锁完整风险报告（含六维雷达图、全网舆情监测、AI专家深度解读、商业模式历史变更追踪等）。一次付费，永久查看。
        </p>
      </div>

      {/* 底部提示 */}
      <p className="text-zinc-500 text-xs text-center">数据基于公开信息，仅供参考</p>

      {/* 分隔线 */}
      <div className="h-px bg-gray-600 mx-4"></div>

      {/* 分享按钮（居中） */}
      <div className="px-4 py-1.5 flex justify-center">
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
        >
          <Share2 className="w-4 h-4" />
          分享项目情报
        </button>
      </div>

      {/* 分享模态框 */}
      {isShareModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div 
            className="bg-zinc-900 rounded-4xl p-5 w-4/5 max-w-80 border border-zinc-700"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#1E1E2F" }}
          >
            {/* 模态框标题 */}
            <h3 className="text-white font-semibold text-sm mb-2">分享项目情报</h3>

            {/* 模态框说明文字 */}
            <p className="text-zinc-300 text-xs mb-4">
              项目情报卡片将分享给好友
            </p>

            {/* 模态框按钮 */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  alert("项目情报图片生成功能开发中，后续将支持")
                  setIsShareModalOpen(false)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                分享
              </button>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs font-medium transition-colors"
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

export default function ProjectAssessment() {
  const [messages, setMessages] = useState<Message[]>([
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
      id: "3",
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
  ])
  const [inputValue, setInputValue] = useState("")
  const [isVoiceMode, setIsVoiceMode] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [showMethodologyModal, setShowMethodologyModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showNewConversationModal, setShowNewConversationModal] = useState(false)
  
  const handleOpenModal = useCallback(() => {
    setShowMethodologyModal(true);
  }, []);
  
  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("0x742d35Cc6634C0532925a3b844Bc454e4438f44e")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("[v0] Copy failed:", err)
    }
  }, [])
  
  const [formData, setFormData] = useState({
    projectName: "",
    contractAddress: "",
    website: "",
    community: "",
    whitepaper: "",
    remarks: "",
    images: [],
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: "正在分析项目信息中... 这是一个演示回复。",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiResponse])
    }, 800)
  }

  const toggleInputMode = () => {
    setIsVoiceMode(!isVoiceMode)
    setInputValue("")
  }

  const handleVoiceStart = () => {
    setIsRecording(true)
  }

  const handleVoiceEnd = () => {
    setIsRecording(false)
  }

  const handleImageUpload = () => {
    console.log("[v0] Image upload button clicked")
  }

  const handleNewConversation = () => {
    setShowNewConversationModal(true)
  }

  const confirmNewConversation = () => {
    // 清空消息列表，只保留初始欢迎语
    setMessages([
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
        id: "3",
        type: "ai",
        content: "准备好了吗？在下方输入项目名称或合��地址，开始查第一个项目。",
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
        content: "如果您知道该项目曾经变更过模式（如矿机→质押）或项目方团队有过负面历史，您可以在下方输入框用文字或语音进一步说���。当您认为信息已完整提供，您可点击下方按钮，开始进行项目审查。",
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
    ])

    // 清空表单输入
    setFormData({
      projectName: "",
      contractAddress: "",
      website: "",
      community: "",
      whitepaper: "",
      remarks: "",
      images: [],
    })

    // 清空输入框
    setInputValue("")

    // 重置语音/文字模式
    setIsVoiceMode(true)
    setIsRecording(false)

    // 关闭确认框
    setShowNewConversationModal(false)

    // ���动到页面顶部
    setTimeout(() => {
      messagesEndRef.current?.parentElement?.scrollTo({ top: 0, behavior: "smooth" })
    }, 100)
  }

  const handleBackClick = () => {
    const confirmMessage = `对话记录将在退出后清空。
全景风险报告已保存在"我的"历史报告中，可随时查看。

确定退出吗？`
    
    if (window.confirm(confirmMessage)) {
      window.history.back()
    }
  }

  const handleReportUnlock = (projectName: string) => {
    setTimeout(() => {
      const reportCardComponent = (
        <RiskReportCard 
          projectName={projectName} 
          contractAddress="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
          onCopyAddress={handleCopyAddress}
          copied={copied}
        />
      )
      
      const reportMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: "ai",
        content: reportCardComponent,
        messageType: "card",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, reportMessage])
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 500)
  }

  const handleScanButtonClick = (buttonMessageId: string) => {
    // 直接生成项目基本情报卡片，不生成用户消息
    setTimeout(() => {
      const cardComponent = (
        <ProjectInfoCard
          projectName="MY Project"
          contractAddress="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
          onCopyAddress={handleCopyAddress}
          copied={copied}
          onUnlockReport={handleReportUnlock}
        />
      )

      const cardMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: cardComponent,
        messageType: "card",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, cardMessage])
    }, 1500)
  }

  return (
    <div className="flex flex-col h-screen w-full max-w-sm mx-auto bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-black sticky top-0 z-10">
        <button 
          onClick={handleBackClick}
          className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-semibold flex-1 text-center">项目安全评估</h1>
        <button
          onClick={handleNewConversation}
          className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0 flex items-center gap-1"
          title="开始新对话"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs">新对话</span>
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.type === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            {true && (
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  message.type === "ai"
                    ? "bg-blue-500 text-white"
                    : "bg-green-500 text-white"
                }`}
              >
                {message.type === "ai" ? "明" : "我"}
              </div>
            )}

            {/* Message Content */}
            <div
              className={`flex-1 flex flex-col gap-1 ${
                message.type === "user" ? "items-end" : "items-start"
              } max-w-xs`}
            >
              {message.type === "ai" && !message.isButton && (
                <span className="text-xs text-zinc-500 px-2">明鉴·风险洞察官</span>
              )}
              
              {/* Button Message */}
              {message.isButton ? (
                <div className="flex flex-col gap-2 items-start">
                  <button 
                    onClick={handleOpenModal}
                    className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold flex items-center gap-2 transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>{message.content}</span>
                  </button>
                  {message.subtitle && (
                    <span className="text-xs text-zinc-500 px-2">{message.subtitle}</span>
                  )}
                </div>
              ) : message.isScanButton ? (
                /* Scan Button Message */
                <div className="flex flex-col gap-2 items-start w-full">
                  <button 
                    onClick={() => handleScanButtonClick(message.id)}
                    className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-semibold transition-colors"
                  >
                    {message.content}
                  </button>
                  {message.subtitle && (
                    <span className="text-xs text-zinc-500 px-2">{message.subtitle}</span>
                  )}
                </div>
              ) : message.isForm ? (
                /* Form Message */
                <div className="w-full bg-zinc-900 rounded-lg p-4 space-y-4">
                  <span className="text-xs text-zinc-400">请尽可能完整��提供以下信息。你给得越详细，评估就越精准。</span>
                  
                  {/* Project Name */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">项目名称 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="输入项目名称"
                      value={formData.projectName}
                      onChange={(e) => setFormData({...formData, projectName: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Contract Address */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">合约地址 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="输入合约地址"
                      value={formData.contractAddress}
                      onChange={(e) => setFormData({...formData, contractAddress: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">官网链接 <span className="text-zinc-500 text-xs">(可选)</span></label>
                    <input
                      type="text"
                      placeholder="https://"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Community */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">社群链接 <span className="text-zinc-500 text-xs">(可选)</span></label>
                    <input
                      type="text"
                      placeholder="https://t.me/xxx 或 https://twitter.com/xxx"
                      value={formData.community}
                      onChange={(e) => setFormData({...formData, community: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-zinc-500">提供 Telegram、Discord、Twitter 等链接，可帮助分析社群舆情</span>
                  </div>

                  {/* Whitepaper */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">项目白皮书/文档链接 <span className="text-zinc-500 text-xs">(可选)</span></label>
                    <input
                      type="text"
                      placeholder="https://xxx.com/whitepaper.pdf"
                      value={formData.whitepaper}
                      onChange={(e) => setFormData({...formData, whitepaper: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Remarks */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">补充说明 <span className="text-zinc-500 text-xs">(可选，多行文本)</span></label>
                    <textarea
                      placeholder="可以粘贴项目官方公告、群公告、聊天记录等关键信息"
                      value={formData.remarks}
                      onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                      className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
                    />
                    <span className="text-xs text-zinc-500">你提供的线索越多，越能发现隐藏风险</span>
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-2">
                    <label className="text-sm text-white">上传图片/截图 <span className="text-zinc-500 text-xs">(可选)</span></label>
                    <div className="flex items-center gap-0 bg-zinc-800 border border-zinc-700 rounded px-3 py-2">
                      <input
                        type="text"
                        placeholder="聊天截图、提现失败截图等"
                        readOnly
                        className="flex-1 bg-transparent text-white text-sm placeholder-zinc-600 focus:outline-none"
                      />
                      <button
                        onClick={handleImageUpload}
                        className="flex-shrink-0 px-2 py-0.5 bg-zinc-600 hover:bg-zinc-500 text-zinc-300 text-xs rounded transition-colors"
                      >
                        上传
                      </button>
                    </div>
                    <span className="text-xs text-zinc-500">最多20张，支持 JPG、PNG，��张不超过5MB。可上传模式图、群聊记录、公告截图等</span>
                  </div>

                  {/* Security Warning */}
                  <div className="text-xs text-zinc-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>请勿上传或输入钱包私钥、密码等敏感信息。</span>
                  </div>
                </div>
              ) : message.messageType === "card" ? (
                /* Card Message */
                <div className="w-full">
                  {message.content}
                </div>
              ) : (
                /* Text Message */
                <div
                  className={`px-4 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
                    message.type === "ai"
                      ? "bg-zinc-800 text-zinc-200"
                      : "bg-green-500 text-white"
                  }`}
                >
                  {message.content}
                </div>
              )}
              
              {!message.isForm && !message.isScanButton && message.messageType !== "card" && (
                <span className="text-xs text-zinc-600 px-2">
                  {message.timestamp.toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-800 bg-black p-4">
        <div className="flex items-center gap-2">
          {/* Mode Toggle Button */}
          <button
            onClick={toggleInputMode}
            className="flex-shrink-0 p-2 rounded-lg bg-zinc-700 text-zinc-400 hover:bg-zinc-600 transition-colors"
            title={isVoiceMode ? "切换到文字输入" : "切换到语音输入"}
          >
            {isVoiceMode ? (
              <Keyboard className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Main Button - Voice or Input */}
          {isVoiceMode ? (
            <button
              onMouseDown={handleVoiceStart}
              onMouseUp={handleVoiceEnd}
              onMouseLeave={handleVoiceEnd}
              onTouchStart={handleVoiceStart}
              onTouchEnd={handleVoiceEnd}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all text-sm ${
                isRecording
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
              }`}
            >
              {isRecording ? "松开发送" : "按住说话"}
            </button>
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage()
                }
              }}
              placeholder="输入项目名称或合约地址..."
              className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          )}

          {/* Send Button (only in text mode) */}
          {!isVoiceMode && (
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                inputValue.trim()
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              }`}
              title="发送"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Methodology Modal */}
      {showMethodologyModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-20 z-40"
            onClick={() => setShowMethodologyModal(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-zinc-800 rounded-lg w-full h-4/5 max-w-md overflow-hidden pointer-events-auto flex flex-col border border-zinc-700"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-700 flex-shrink-0">
                <h2 className="text-white text-base font-semibold flex-1 text-center">全景扫描方法论</h2>
                <button
                  onClick={() => setShowMethodologyModal(false)}
                  className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-white flex-shrink-0 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="overflow-y-auto flex-1 px-4 py-4">
                <div className="space-y-4">
                  {/* Section 1: Data Sources */}
                  <div className="space-y-2">
                    <h3 className="text-white font-semibold text-sm">🔍 1. 数据来源与用途</h3>
                    <p className="text-zinc-400 text-xs">明鉴综合以下多个权威渠道，交叉验证，确保评估客观性。</p>
                    <div className="space-y-1 bg-zinc-700 bg-opacity-50 rounded p-2">
                      {dataSources.map((source, idx) => (
                        <div key={idx} className="text-xs">
                          <p className="text-zinc-200 font-medium">{source.name}</p>
                          <p className="text-zinc-400 text-xs ml-1">{source.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Dimensions Table */}
                  <div className="space-y-2">
                    <h3 className="text-white font-semibold text-sm">📊 2. 六大维度评分体系</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs bg-zinc-700 bg-opacity-30 rounded">
                        <thead>
                          <tr className="border-b border-zinc-600 bg-zinc-700 bg-opacity-50">
                            <th className="text-left px-2 py-1.5 text-zinc-300 font-medium border-r border-zinc-600">维度</th>
                            <th className="text-left px-2 py-1.5 text-zinc-300 font-medium border-r border-zinc-600">权重</th>
                            <th className="text-left px-2 py-1.5 text-zinc-300 font-medium">评估点</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dimensionTable.map((row, idx) => (
                            <tr key={idx} className="border-b border-zinc-600">
                              <td className="px-2 py-1.5 text-zinc-200 border-r border-zinc-600">{row.dimension}</td>
                              <td className="px-2 py-1.5 text-zinc-300 border-r border-zinc-600">{row.weight}</td>
                              <td className="px-2 py-1.5 text-zinc-400">{row.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3: Risk Levels Table */}
                  <div className="space-y-2">
                    <h3 className="text-white font-semibold text-sm">⚠️ 3. 风险等级与结论</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs bg-zinc-700 bg-opacity-30 rounded">
                        <thead>
                          <tr className="border-b border-zinc-600 bg-zinc-700 bg-opacity-50">
                            <th className="text-left px-2 py-1.5 text-zinc-300 font-medium border-r border-zinc-600">分数</th>
                            <th className="text-left px-2 py-1.5 text-zinc-300 font-medium border-r border-zinc-600">风险等级</th>
                            <th className="text-left px-2 py-1.5 text-zinc-300 font-medium">结论</th>
                          </tr>
                        </thead>
                        <tbody>
                          {riskLevelTable.map((row, idx) => (
                            <tr key={idx} className="border-b border-zinc-600">
                              <td className="px-2 py-1.5 text-zinc-200 border-r border-zinc-600">{row.score}</td>
                              <td className="px-2 py-1.5 text-zinc-200 border-r border-zinc-600">{row.level}</td>
                              <td className="px-2 py-1.5 text-zinc-400">{row.conclusion}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Other sections */}
                  {methodologyData.map((section, idx) => (
                    <div key={idx} className="space-y-1">
                      <h3 className="text-white font-semibold text-sm">
                        {section.emoji} {section.title}
                      </h3>
                      <div className="space-y-1">
                        {section.content.map((text, contentIdx) => (
                          <p key={contentIdx} className="text-zinc-400 text-xs leading-relaxed">
                            {text}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer spacing */}
                <div className="h-2" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Conversation Confirm Modal */}
      {showNewConversationModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-4 max-w-xs mx-4 space-y-3 border border-zinc-600">
            <h2 className="text-white font-semibold text-sm text-center">新建对话</h2>
            <p className="text-zinc-300 text-xs text-center">将清空当前对话，开始新的安全评估。是否继续？</p>
            <div className="flex gap-3">
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
    </div>
  )
}

