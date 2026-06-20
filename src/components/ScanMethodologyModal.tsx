import { X } from 'lucide-react'

interface MethodologySection {
  title: string
  emoji: string
  content: string[]
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
      "用户可支付 1 USDT 刷新报告，获取最新分析",
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

interface ScanMethodologyModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ScanMethodologyModal({ isOpen, onClose }: ScanMethodologyModalProps) {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-zinc-900 rounded-lg w-full max-h-[75vh] max-w-[350px] overflow-hidden pointer-events-auto flex flex-col border border-[#343438]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#343438] flex-shrink-0">
            <h2 className="text-white text-base font-semibold flex-1 text-center">全景扫描方法论</h2>
            <button onClick={onClose} className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-white flex-shrink-0 ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-4 py-4">
            <div className="space-y-4 text-xs text-zinc-400 leading-relaxed">
              <div className="space-y-2">
                <h3 className="text-white font-semibold text-sm">🔍 1. 数据来源与用途</h3>
                <p className="text-zinc-400 text-xs">明鉴综合以下多个权威渠道，交叉验证，确保评估客观性。</p>
                <div className="space-y-1 bg-zinc-800 rounded-lg p-2">
                  {dataSources.map((source, idx) => (
                    <div key={idx} className="text-xs">
                      <p className="text-zinc-200 font-medium">{source.name}</p>
                      <p className="text-zinc-400 text-xs ml-1">{source.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-white font-semibold text-sm">📊 2. 六大维度评分体系</h3>
                <div className="overflow-x-auto rounded-lg">
                  <table className="w-full text-xs bg-zinc-800">
                    <thead>
                      <tr className="border-b border-[#343438] bg-zinc-700">
                        <th className="text-left px-2 py-1.5 text-zinc-300 font-medium border-r border-[#343438]">维度</th>
                        <th className="text-left px-2 py-1.5 text-zinc-300 font-medium border-r border-[#343438]">权重</th>
                        <th className="text-left px-2 py-1.5 text-zinc-300 font-medium">评估点</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dimensionTable.map((row, idx) => (
                        <tr key={idx} className="border-b border-[#343438]">
                          <td className="px-2 py-1.5 text-zinc-200 border-r border-[#343438]">{row.dimension}</td>
                          <td className="px-2 py-1.5 text-zinc-300 border-r border-[#343438]">{row.weight}</td>
                          <td className="px-2 py-1.5 text-zinc-400">{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-white font-semibold text-sm">⚠️ 3. 风险等级与结论</h3>
                <div className="overflow-x-auto rounded-lg">
                  <table className="w-full text-xs bg-zinc-800">
                    <thead>
                      <tr className="border-b border-[#343438] bg-zinc-700">
                        <th className="text-left px-2 py-1.5 text-zinc-300 font-medium border-r border-[#343438]">分数</th>
                        <th className="text-left px-2 py-1.5 text-zinc-300 font-medium border-r border-[#343438]">风险等级</th>
                        <th className="text-left px-2 py-1.5 text-zinc-300 font-medium">结论</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskLevelTable.map((row, idx) => (
                        <tr key={idx} className="border-b border-[#343438]">
                          <td className="px-2 py-1.5 text-zinc-200 border-r border-[#343438]">{row.score}</td>
                          <td className="px-2 py-1.5 text-zinc-200 border-r border-[#343438]">{row.level}</td>
                          <td className="px-2 py-1.5 text-zinc-400">{row.conclusion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {methodologyData.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <h3 className="text-white font-semibold text-sm">{section.emoji} {section.title}</h3>
                  <div className="space-y-1">
                    {section.content.map((text, contentIdx) => (
                      <p key={contentIdx} className="text-zinc-400 text-xs leading-relaxed">{text}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="h-2" />
          </div>
        </div>
      </div>
    </>
  )
}
