import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ChevronLeft, AlertCircle, Share2 } from 'lucide-react'

export default function BusinessReportDetailPage() {
  const navigate = useNavigate()
  const [staticAmount, setStaticAmount] = useState(1000)
  const [directReferrals, setDirectReferrals] = useState(5)
  const [indirectReferrals, setIndirectReferrals] = useState(10)
  const [perPersonAmount, setPerPersonAmount] = useState(500)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  const projectName = 'MY Project'
  const contractAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'

  const dailyReturn = staticAmount * 0.01
  const weeklyReturn = dailyReturn * 7
  const monthlyReturn = dailyReturn * 30
  const yearlyReturn = dailyReturn * 365
  const annualizedRate = 365

  const directBonus = directReferrals * perPersonAmount * 0.1
  const indirectBonus = indirectReferrals * perPersonAmount * 0.05
  const totalDynamic = directBonus + indirectBonus

  return (
    <div className="text-white flex flex-col">
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-4 border-b border-neutral-800 bg-black/95 backdrop-blur-sm">
        <button
          onClick={() => navigate('/profile/business-models')}
          className="flex items-center justify-center w-10 h-10 text-white hover:opacity-70 transition-opacity"
          aria-label="返回"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold flex-1 text-center">{projectName}</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#1E1E2F] rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-semibold text-white">明</div>
              <span className="text-sm text-neutral-300 font-medium">明鉴·首席分析师</span>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">a. 商业模式解读</h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                这是一个三级返佣模式：你投100U每天得1U，直推拿10%，间推拿5%，团队业绩超10万U额外拿2%。该模式主要依靠新增用户的资金来维持返佣，对市场持续增长高度依赖。
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">b. 静态收益计算器</h3>
              <div className="space-y-2">
                <label className="text-xs text-neutral-400">投资金额 (USDT)</label>
                <input
                  type="number"
                  value={staticAmount}
                  onChange={(e) => setStaticAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-neutral-800 text-white text-sm rounded border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-700">
                      <th className="text-left py-2 px-2 text-neutral-400">周期</th>
                      <th className="text-right py-2 px-2 text-neutral-400">收益 (USDT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-neutral-700">
                      <td className="py-2 px-2 text-neutral-300">每日</td>
                      <td className="text-right py-2 px-2 text-white font-medium">{dailyReturn.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-neutral-700">
                      <td className="py-2 px-2 text-neutral-300">每周</td>
                      <td className="text-right py-2 px-2 text-white font-medium">{weeklyReturn.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-neutral-700">
                      <td className="py-2 px-2 text-neutral-300">每月</td>
                      <td className="text-right py-2 px-2 text-white font-medium">{monthlyReturn.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-neutral-700">
                      <td className="py-2 px-2 text-neutral-300">每年</td>
                      <td className="text-right py-2 px-2 text-white font-medium">{yearlyReturn.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-neutral-300">年化</td>
                      <td className="text-right py-2 px-2 text-white font-medium">{annualizedRate}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">c. 动态收益估算（单次收益）</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">直推人数</label>
                  <input
                    type="number"
                    value={directReferrals}
                    onChange={(e) => setDirectReferrals(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2 py-1.5 bg-neutral-800 text-white text-xs rounded border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">间推人数</label>
                  <input
                    type="number"
                    value={indirectReferrals}
                    onChange={(e) => setIndirectReferrals(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2 py-1.5 bg-neutral-800 text-white text-xs rounded border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">人均投资 (USDT)</label>
                  <input
                    type="number"
                    value={perPersonAmount}
                    onChange={(e) => setPerPersonAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full px-2 py-1.5 bg-neutral-800 text-white text-xs rounded border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="bg-neutral-800 rounded p-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-neutral-300">
                  <span>直推奖励 =</span>
                  <span className="text-white font-medium">{directBonus.toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>间推奖励 =</span>
                  <span className="text-white font-medium">{indirectBonus.toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-neutral-200 border-t border-neutral-700 pt-1.5 mt-1.5 font-semibold">
                  <span>总动态收益 =</span>
                  <span className="text-blue-400">{totalDynamic.toFixed(2)} USDT</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">d. 策略建议与点位布局</h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                根据您的总预算3000U，推荐分3个账户，每个投资1000U，形成A推B、B推C的层级关系。A作为主账户，重点发展B的团队，协助B再发展3个下线。预计回本周期25天，30天总收益约1200U。
              </p>
              <div className="bg-neutral-800 rounded p-2.5 text-xs text-neutral-300 font-mono space-y-1">
                <div>👤 你（主账户A）</div>
                <div className="ml-4">└── 👤 B（直推）</div>
                <div className="ml-8">├── 👤 C</div>
                <div className="ml-8">├── 👤 D</div>
                <div className="ml-8">└── 👤 E</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">e. 资金依赖评估</h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                该项目对持续新增资金的依赖程度：极高。一旦新用户增速放缓，极易出现兑付问题。建议密切关注社群中关于提现延迟、规则变更的讨论。
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">f. 风险自查清单</h3>
              <div className="bg-neutral-800 rounded p-2.5 text-xs text-neutral-300 space-y-1">
                <div>✓ 提现到账时间变长</div>
                <div>✓ 社群中出现"到账慢"的抱怨增多</div>
                <div>✓ 新用户注册奖励突然提高</div>
                <div>✓ 提现门槛突然上调</div>
                <div>✓ 官方频繁"系统升级维护"</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">g. 庞氏骗局警示</h3>
              <div className="flex items-start gap-2 bg-yellow-900/20 rounded p-2.5 border border-yellow-700">
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">
                  该模式包含多级返佣和静态收益，对新增资金高度依赖，可能为金字塔骗局，请谨慎参与。
                </p>
              </div>
            </div>

            <div className="bg-neutral-800 rounded p-2.5 text-xs text-neutral-400 border border-neutral-700">
              <p className="leading-relaxed">
                以上分析基于当前规则，动静态分析仅供参考，不构成投资建议。用户需自行承担由此产生的一切风险和后果。
              </p>
            </div>

            <div className="h-px bg-neutral-700" />

            <div className="flex justify-end">
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
              >
                <Share2 size={16} />
                分享拆解报告
              </button>
            </div>
          </div>
        </div>
      </div>

      {isShareModalOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div
            className="bg-[#1E1E2F] rounded-2xl p-6 w-4/5 max-w-80 border border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-sm mb-3">分享拆解报告</h3>
            <p className="text-neutral-300 text-xs mb-6">
              拆解结果卡片将分享给好友
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  alert('分享图片功能开发中')
                  setIsShareModalOpen(false)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                分享拆解报告
              </button>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
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
