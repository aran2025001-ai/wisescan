import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Copy, Check, Share2 } from 'lucide-react'
import { useState } from 'react'

export default function ReportDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [copied, setCopied] = useState(false)
  const [isReportShareModalOpen, setIsReportShareModalOpen] = useState(false)

  const projectName = `MY Project`
  const contractAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
  const riskLevel = '高风险'
  const score = '45'

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(contractAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="text-white flex flex-col">
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-4 border-b border-neutral-800 bg-black/95 backdrop-blur-sm">
        <button
          onClick={() => navigate('/profile/reports')}
          className="flex items-center justify-center w-10 h-10 text-white hover:opacity-70 transition-opacity"
          aria-label="返回"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold flex-1 text-center truncate">{projectName}</h1>
        <div className="w-10 flex justify-end">
          {riskLevel === '高风险' && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
              {riskLevel}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 pb-8">
          <div className="w-full bg-[#1E1E2F] rounded-2xl border border-zinc-700 overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 px-4 py-4 border-b border-zinc-700">
              <h2 className="text-white font-semibold text-lg">全景风险报告</h2>
              <p className="text-zinc-400 text-sm mt-1">明鉴·风险洞察官出品</p>
            </div>

            <div className="px-4 py-4 border-b border-zinc-700 space-y-3 bg-zinc-900/30">
              <h3 className="text-white font-semibold text-sm">项目基本情报</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-start">
                  <span className="text-zinc-400">项目名称</span>
                  <span className="text-white font-medium">{projectName}</span>
                </div>
                <div className="flex justify-between items-start gap-3">
                  <span className="text-zinc-400 flex-shrink-0">合约地址</span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="text-white font-mono text-xs break-all text-right">{contractAddress}</span>
                    <button
                      onClick={handleCopyAddress}
                      className="text-zinc-400 hover:text-white transition-colors flex-shrink-0"
                      title="复制地址"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-zinc-400">合约格式校验</span>
                  <span className="text-green-400 font-medium">✅ 有效</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-zinc-400">流动性锁定</span>
                  <span className="text-white font-medium">85% 已锁定</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-zinc-400">持币地址数</span>
                  <span className="text-white font-medium">1,234 个</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-zinc-400">TOP10 持仓占比</span>
                  <span className="text-red-400 font-medium">78%</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-zinc-400">信息完整性评分</span>
                  <div className="flex items-center gap-1">
                    <span className="text-white font-medium">32%</span>
                    <span className="text-zinc-500 text-xs">较低</span>
                  </div>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-zinc-400">评估次数</span>
                  <span className="text-white font-medium">1,234 次</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-zinc-400">最后评估时间</span>
                  <span className="text-white font-medium">2026-06-10</span>
                </div>
              </div>
            </div>

            <div className="px-4 py-4 border-b border-zinc-700 space-y-2 bg-zinc-900/30">
              <h3 className="text-white font-semibold text-sm mb-3">六维风险雷达</h3>
              <p className="text-zinc-300 text-xs font-mono whitespace-pre leading-relaxed">
{`代码与技术安全 ██████████ 25/25
团队透明度 ████████ 8/20
经济模型 ████████████ 12/20
社群热度 ██████████ 10/15
历史可靠性 ████ 4/10
合规性 █████ 5/10`}
              </p>
            </div>

            <div className="px-4 py-4 border-b border-zinc-700 space-y-3 bg-zinc-900/30">
              <h3 className="text-white font-semibold text-sm mb-2">六维详细评分</h3>
              <div className="space-y-2">
                {[
                  { name: '代码与技术安全（25%）', score: '25 / 25', deduction: '无' },
                  { name: '团队与运营透明度（20%）', score: '8 / 20', deduction: '团队匿名' },
                  { name: '经济模型与资金安全（20%）', score: '12 / 20', deduction: '代币锁仓不透明' },
                  { name: '社群与市场热度（15%）', score: '10 / 15', deduction: '僵尸粉较多' },
                  { name: '历史与执行可靠性（10%）', score: '4 / 10', deduction: '模式变更2次' },
                  { name: '合规性与法律风险（10%）', score: '5 / 10', deduction: '无法律实体' },
                ].map((dim, idx) => (
                  <div key={idx} className="border-t border-zinc-700 pt-2">
                    <p className="text-blue-400 font-semibold text-xs mb-1">{dim.name}</p>
                    <p className="text-zinc-300 text-xs mb-1">得分：{dim.score}</p>
                    <p className="text-zinc-400 text-xs">扣分项：{dim.deduction}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-4 border-b border-zinc-700 space-y-3 bg-zinc-900/30">
              <h3 className="text-white font-semibold text-sm">互联网舆情监测摘要</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <p className="text-zinc-300 mb-1">负面关键词：</p>
                  <p className="text-red-400 ml-2">提现困难 23条，锁仓 15条，改规则 8条</p>
                </div>
                <div>
                  <p className="text-zinc-300 mb-1">典型抱怨摘录：</p>
                  <div className="ml-2 bg-zinc-700/50 rounded p-2 italic text-zinc-200 text-xs">
                    "6月1日提现到现在还没到账"（来源：微信社群）
                  </div>
                </div>
                <div>
                  <p className="text-zinc-300 mb-1">舆情结论：</p>
                  <p className="text-yellow-500 ml-2 font-semibold text-xs">近期负面讨论集中，提现障碍被多次提及</p>
                </div>
              </div>
            </div>

            <div className="px-4 py-4 border-b border-zinc-700 space-y-3 bg-zinc-900/30">
              <h3 className="text-white font-semibold text-sm">综合评分与风险等级</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-300">综合评分</span>
                  <span className="text-white font-bold">{score} / 100</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-300">风险等级</span>
                  <span className="text-red-500 font-bold">{riskLevel}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-300">建议</span>
                  <span className="text-red-500 font-bold">❌ 不建议参与</span>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-2 mt-2">
                  <p className="text-red-400 text-xs leading-relaxed">
                    该项目存在锁仓机制不透明、模式多次变更等风险，建议谨慎。
                  </p>
                </div>
              </div>
            </div>

            <div className="px-4 py-4 border-b border-zinc-700 space-y-3 bg-zinc-900/30">
              <h3 className="text-white font-semibold text-sm">明鉴风险洞察官综合解读</h3>
              <p className="text-zinc-300 text-xs leading-relaxed">
                该项目在代码安全方面表现不错，但在团队透明度和经济模型方面存在明显短板。持币分布集中、项目信息不完整等问题增加了风险。
              </p>
              <p className="text-zinc-300 text-xs leading-relaxed">
                建议：(1) 等待团队公开更多信息；(2) 监测后续舆情变化；(3) 如选择参与，应严格控制投入规模。
              </p>
            </div>

            <div className="px-4 py-4 space-y-2 bg-zinc-800/50">
              <h3 className="text-white font-semibold text-xs">⚖️ 免责声明</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                本报告基于公开API、链上数据及用户贡献信息自动生成。明鉴不对信息的绝对准确性、完整性或时效性作任何保证。用户应自行核实并承担投资风险。平台不提供任何投资建议。
              </p>
            </div>

            <div className="h-px bg-zinc-600 mx-4"></div>

            <div className="px-4 py-3 flex justify-center">
              <button
                onClick={() => setIsReportShareModalOpen(true)}
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
              >
                <Share2 className="w-4 h-4" />
                分享项目报告
              </button>
            </div>
          </div>
        </div>
      </div>

      {isReportShareModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsReportShareModalOpen(false)}
        >
          <div
            className="bg-[#1E1E2F] rounded-lg p-6 w-4/5 max-w-sm border border-zinc-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-base mb-2">分享项目报告</h3>
            <p className="text-zinc-300 text-sm mb-6">
              项目报告卡片将分享给好友
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  alert('分享图片功能开发中')
                  setIsReportShareModalOpen(false)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                分享
              </button>
              <button
                onClick={() => setIsReportShareModalOpen(false)}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
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
