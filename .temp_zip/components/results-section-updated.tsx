import React, { useState } from "react"
import { AlertCircle, Share2 } from "lucide-react"

interface ResultsSectionProps {
  onStaticChange?: (amount: number) => void
  onDynamicChange?: (data: any) => void
}

export function ResultsSection({ onStaticChange, onDynamicChange }: ResultsSectionProps) {
  const [staticAmount, setStaticAmount] = useState(1000)
  const [directReferrals, setDirectReferrals] = useState(0)
  const [indirectReferrals, setIndirectReferrals] = useState(0)
  const [perPersonAmount, setPerPersonAmount] = useState(0)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  const dailyReturn = staticAmount * 0.01
  const weeklyReturn = dailyReturn * 7
  const monthlyReturn = dailyReturn * 30
  const yearlyReturn = dailyReturn * 365
  const annualizedRate = 365

  const directBonus = directReferrals * perPersonAmount * 0.1
  const indirectBonus = indirectReferrals * perPersonAmount * 0.05
  const totalDynamic = directBonus + indirectBonus

  const handleStaticChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Number(e.target.value))
    setStaticAmount(value)
    onStaticChange?.(value)
  }

  return (
    <div className="w-full bg-zinc-900 rounded-lg p-4 space-y-6">
      {/* Header with AI name */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-semibold text-white">明</div>
        <span className="text-sm text-zinc-300 font-medium">明鉴·首席分析师</span>
      </div>

      {/* a. Business Model Interpretation */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">a. 商业模式解读</h3>
        <p className="text-xs text-zinc-300 leading-relaxed">
          这是一个三级返佣模式：你投100U每天得1U，直推拿10%，间推拿5%，团队业绩超10万U额外拿2%。
        </p>
      </div>

      {/* b. Static Return Calculator */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">b. 静态收益计算器</h3>
        <div className="space-y-2">
          <label className="text-xs text-zinc-400">投资金额 (USDT)</label>
          <input
            type="number"
            value={staticAmount}
            onChange={handleStaticChange}
            className="w-full px-3 py-2 bg-zinc-800 text-white text-sm rounded border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left py-2 px-2 text-zinc-400">周期</th>
                <th className="text-right py-2 px-2 text-zinc-400">收益 (USDT)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-700">
                <td className="py-2 px-2 text-zinc-300">每日</td>
                <td className="text-right py-2 px-2 text-white font-medium">{dailyReturn.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-zinc-700">
                <td className="py-2 px-2 text-zinc-300">每周</td>
                <td className="text-right py-2 px-2 text-white font-medium">{weeklyReturn.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-zinc-700">
                <td className="py-2 px-2 text-zinc-300">每月</td>
                <td className="text-right py-2 px-2 text-white font-medium">{monthlyReturn.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-zinc-700">
                <td className="py-2 px-2 text-zinc-300">每年</td>
                <td className="text-right py-2 px-2 text-white font-medium">{yearlyReturn.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-2 px-2 text-zinc-300">年化</td>
                <td className="text-right py-2 px-2 text-white font-medium">{annualizedRate}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* c. Dynamic Return Estimation */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">c. 动态收益估算（单次收益）</h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">直推人数</label>
            <input
              type="number"
              value={directReferrals}
              onChange={(e) => setDirectReferrals(Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1.5 bg-zinc-800 text-white text-xs rounded border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">间推人数</label>
            <input
              type="number"
              value={indirectReferrals}
              onChange={(e) => setIndirectReferrals(Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1.5 bg-zinc-800 text-white text-xs rounded border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">人均投资 (USDT)</label>
            <input
              type="number"
              value={perPersonAmount}
              onChange={(e) => setPerPersonAmount(Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1.5 bg-zinc-800 text-white text-xs rounded border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="bg-zinc-800 rounded p-2.5 space-y-1.5 text-xs">
          <div className="flex justify-between text-zinc-300">
            <span>直推奖励 =</span>
            <span className="text-white font-medium">{directBonus.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-zinc-300">
            <span>间推奖励 =</span>
            <span className="text-white font-medium">{indirectBonus.toFixed(2)} USDT</span>
          </div>
          <div className="flex justify-between text-zinc-200 border-t border-zinc-700 pt-1.5 mt-1.5 font-semibold">
            <span>总动态收益 =</span>
            <span className="text-blue-400">{totalDynamic.toFixed(2)} USDT</span>
          </div>
        </div>
      </div>

      {/* d. Strategy & Layout */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">d. 策略建议与点位布局</h3>
        <p className="text-xs text-zinc-300 leading-relaxed">
          根据您的总预算3000U，推荐分3个账户，每个投资1000U，形成A推B、B推C的层级关系。A作为主账户，重点发展B的团队，协助B再发展3个下线。预计回本周期25天，30天总收益约1200U。
        </p>
        <div className="bg-zinc-800 rounded p-2.5 text-xs text-zinc-300 font-mono space-y-1">
          <div>👤 你（主账户A）</div>
          <div className="ml-4">└── 👤 B（直推）</div>
          <div className="ml-8">├── 👤 C</div>
          <div className="ml-8">├── 👤 D</div>
          <div className="ml-8">└── 👤 E</div>
        </div>
        <p className="text-xs text-zinc-400 mt-2">
          建议将总资金分成3-5个账户，按层级分布：1号账户（顶层）投资1000U，2-3号账户（中层）各投资500U，4-5号账户（底层）各投资200U。
        </p>
      </div>

      {/* e. Capital Dependency Assessment */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">e. 资金依赖评估</h3>
        <p className="text-xs text-zinc-300 leading-relaxed">
          该项目对持续新增资金的依赖程度：极高。一旦新用户增速放缓，极易出现兑付问题。建议密切关注社群中关于提现延迟、规则变更的讨论。
        </p>
      </div>

      {/* f. Risk Checklist */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">f. 风险自查清单</h3>
        <div className="bg-zinc-800 rounded p-2.5 text-xs text-zinc-300 space-y-1">
          <div>✓ 提现到账时间变长</div>
          <div>✓ 社群中出现"到账慢"的抱怨增多</div>
          <div>✓ 新用户注册奖励突然提高</div>
          <div>✓ 提现门槛突然上调</div>
          <div>✓ 官方频繁"系统升级维护"</div>
        </div>
      </div>

      {/* g. Ponzi Warning */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">g. 庞氏骗局警示</h3>
        <div className="flex items-start gap-2 bg-yellow-900/20 rounded p-2.5 border border-yellow-700">
          <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-400">
            该模式包含多级返佣和静态收益，对新增资金高度依赖，可能为金字塔骗局，请谨慎参与。
          </p>
        </div>
      </div>

      {/* h. Disclaimer */}
      <div className="bg-zinc-800 rounded p-2.5 text-xs text-zinc-400 border border-zinc-700">
        <p className="leading-relaxed">
          以上分析基于当前规则，动静态分析仅供参考，不构成投资建议。
        </p>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-600"></div>

      {/* Share Button */}
      <div className="flex justify-center">
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
        >
          <Share2 className="w-4 h-4" />
          分享拆解结果
        </button>
      </div>

      {/* Share Modal */}
      {isShareModalOpen && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div 
            className="bg-zinc-900 rounded-4xl p-5 w-4/5 max-w-80 border border-zinc-700"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#1E1E2F" }}
          >
            {/* Modal Title */}
            <h3 className="text-white font-semibold text-sm mb-2">分享拆解结果</h3>

            {/* Modal Description */}
            <p className="text-zinc-300 text-xs mb-4">
              拆解结果卡片将分享给好友
            </p>

            {/* Modal Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  alert("拆解结果图片生成功能开发中")
                  setIsShareModalOpen(false)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                分享拆解结果
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
