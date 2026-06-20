import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { AlertCircle, Users, Lightbulb, ShieldAlert } from "lucide-react"
import { renderEvidenceTaggedText } from "../utils/evidenceTags"
import ReactECharts from 'echarts-for-react'
import ShareButton from "./ShareButton"

/**
 * BusinessReportCard - 接受 DeepSeek API 返回的动态数据
 * 兼容旧版（无 reportData 时显示占位提示）
 */
interface TreeNode {
  name: string
  children?: TreeNode[]
  itemStyle?: { color?: string }
}

interface BusinessReportCardProps {
  reportData?: {
    pattern_type?: string
    plain_explanation?: string
    static_calculator?: {
      daily_rate?: number
      investment?: number
      daily_profit?: number
      weekly_profit?: number
      monthly_profit?: number
      yearly_profit?: number
      amplification_note?: string
      account_type?: string
    }
    dynamic_calculator?: {
      direct_referral_rate?: number
      indirect_referral_rate?: number
      team_bonus_threshold?: number
      team_bonus_rate?: number
    }
    strategy_suggestion?: string
    risk_warning?: string
    risk_assessment?: {
      level?: string
      triggers?: string[]
      pressure_test?: string
    }
    visualization_hint?: string
    visualization_tree?: TreeNode
  }
  /** 旧版兼容：计算器默认值 */
  defaultStaticAmount?: number
  defaultDirectReferrals?: number
  defaultIndirectReferrals?: number
  defaultPerPersonAmount?: number
  onStaticChange?: (amount: number) => void
  onShare?: () => void
  onAssessRisk?: () => void
  /** 从详情页跳转过来时，隐藏"评估该项目风险"按钮 */
  hideAssessRisk?: boolean
}

/** ECharts Tree 选项构建 */
function buildTreeOption(treeData: TreeNode) {
  // 递归设置节点颜色
  function colorNodes(node: TreeNode) {
    if (node.name.includes('共识') || node.name.startsWith('B')) {
      node.itemStyle = { color: '#22c55e' }
    } else {
      node.itemStyle = { color: '#6b7280' }
    }
    if (node.name === '你' || node.name.startsWith('你')) {
      node.itemStyle = { color: '#3b82f6' }
    }
    node.children?.forEach(colorNodes)
  }
  const cloned = JSON.parse(JSON.stringify(treeData))
  colorNodes(cloned)

  return {
    tooltip: { trigger: 'item' as const, triggerOn: 'mousemove' as const },
    series: [{
      type: 'tree',
      data: [cloned],
      orient: 'vertical' as const,
      roam: true,
      initialTreeDepth: 2,
      label: {
        position: 'bottom' as const,
        verticalAlign: 'middle' as const,
        align: 'center' as const,
        fontSize: 10,
        color: '#e4e4e7',
      },
      leaves: { label: { position: 'bottom' as const } },
      expandAndCollapse: true,
      lineStyle: { color: '#52525b', width: 1.5 },
      itemStyle: { borderWidth: 2 },
    }],
  }
}

/** 纯文本树形图降级 */
function textTree(treeData: TreeNode, indent = '') {
  if (!treeData) return ''
  let result = `${indent}${treeData.name}\n`
  if (treeData.children) {
    treeData.children.forEach((child, i) => {
      const isLast = i === treeData.children!.length - 1
      const prefix = isLast ? '└── ' : '├── '
      const childIndent = indent + (isLast ? '    ' : '│   ')
      result += `${indent}${prefix}${child.name}\n`
      if (child.children) result += textTree(child, childIndent)
    })
  }
  return result
}

export function BusinessReportCard({
  reportData,
  defaultStaticAmount = 1000,
  defaultDirectReferrals = 0,
  defaultIndirectReferrals = 0,
  defaultPerPersonAmount = 0,
  onStaticChange,
  onShare,
  onAssessRisk,
  hideAssessRisk = false,
}: BusinessReportCardProps) {
  // ---- 计算器状态（API 数据作为初始值，用户可调整）----
  const sc = reportData?.static_calculator
  const dc = reportData?.dynamic_calculator

  const [investment, setInvestment] = useState(
    () => sc?.investment ?? defaultStaticAmount ?? 1000
  )
  const [dailyRate, setDailyRate] = useState(
    () => sc?.daily_rate ?? 0.01
  )
  const [directRate, setDirectRate] = useState(
    () => dc?.direct_referral_rate ?? 0.10
  )
  const [indirectRate, setIndirectRate] = useState(
    () => dc?.indirect_referral_rate ?? 0.05
  )
  const [directReferrals, setDirectReferrals] = useState(defaultDirectReferrals)
  const [indirectReferrals, setIndirectReferrals] = useState(defaultIndirectReferrals)
  const [perPersonAmount, setPerPersonAmount] = useState(defaultPerPersonAmount)

  const [isAssessRiskModalOpen, setIsAssessRiskModalOpen] = useState(false)

  // 当 API 数据到达后，用新默认值重置计算器
  useEffect(() => {
    if (sc?.investment) setInvestment(sc.investment)
    if (sc?.daily_rate) setDailyRate(sc.daily_rate)
    if (dc?.direct_referral_rate) setDirectRate(dc.direct_referral_rate)
    if (dc?.indirect_referral_rate) setIndirectRate(dc.indirect_referral_rate)
  }, [reportData])

  const dailyReturn = investment * dailyRate
  const weeklyReturn = dailyReturn * 7
  const monthlyReturn = dailyReturn * 30
  const yearlyReturn = dailyReturn * 365
  const annualizedRate = +(dailyRate * 365 * 100).toFixed(0)

  const directBonus = directReferrals * perPersonAmount * directRate
  const indirectBonus = indirectReferrals * perPersonAmount * indirectRate
  const totalDynamic = directBonus + indirectBonus

  const handleInvestmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(0, Number(e.target.value))
    setInvestment(v)
    onStaticChange?.(v)
  }

  const hasData = !!reportData

  return (
    <div className="w-full bg-zinc-900 rounded-lg overflow-hidden">
      {/* Title Bar */}
      <div className="bg-gradient-to-r from-blue-950/50 to-purple-950/50 px-4 py-2 border-b border-[#343438]">
        <h3 className="text-white font-semibold text-base text-center">商业模式拆解报告</h3>
        <p className="text-zinc-400 text-xs mt-1 text-center">明鉴·首席分析师出品</p>
      </div>

      <div className="p-4 space-y-6">
        {/* 1. 商业模式解读 */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-50">1. 商业模式解读</h3>
          {hasData ? (
            <div className="text-xs text-zinc-50 leading-relaxed whitespace-pre-wrap">
              {renderEvidenceTaggedText(reportData.plain_explanation || '（暂无解读）', "text-xs text-zinc-50 leading-relaxed whitespace-pre-wrap")}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 leading-relaxed italic">请先输入项目规则并点击"开始拆解"生成报告。</p>
          )}
        </div>

        {/* 2. 静态收益计算器 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-50">2. 静态投资收益计算器</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">投资金额 (USDT)</label>
              <input
                type="number"
                value={investment}
                onChange={handleInvestmentChange}
                className="w-full px-3 py-2 bg-zinc-800 text-zinc-50 text-sm rounded border border-[#343438] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">日收益率 (%)</label>
              <input
                type="number"
                step="0.01"
                value={+(dailyRate * 100).toFixed(2)}
                onChange={(e) => setDailyRate(Math.max(0, Number(e.target.value)) / 100)}
                className="w-full px-3 py-2 bg-zinc-800 text-zinc-50 text-sm rounded border border-[#343438] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#343438]">
                  <th className="text-left py-2 px-2 text-zinc-400">周期</th>
                  <th className="text-right py-2 px-2 text-zinc-400">收益 (USDT)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#343438]">
                  <td className="py-2 px-2 text-zinc-50">每日</td>
                  <td className="text-right py-2 px-2 text-zinc-50 font-medium">{dailyReturn.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-[#343438]">
                  <td className="py-2 px-2 text-zinc-50">每周</td>
                  <td className="text-right py-2 px-2 text-zinc-50 font-medium">{weeklyReturn.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-[#343438]">
                  <td className="py-2 px-2 text-zinc-50">每月</td>
                  <td className="text-right py-2 px-2 text-zinc-50 font-medium">{monthlyReturn.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-[#343438]">
                  <td className="py-2 px-2 text-zinc-50">每年</td>
                  <td className="text-right py-2 px-2 text-zinc-50 font-medium">{yearlyReturn.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-zinc-50">年化</td>
                  <td className="text-right py-2 px-2 text-zinc-50 font-medium">{annualizedRate}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. 动态推广收益估算 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-50">3. 动态推广收益估算</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">直推人数</label>
              <input
                type="number"
                value={directReferrals}
                onChange={(e) => setDirectReferrals(Math.max(0, Number(e.target.value)))}
                className="w-full px-2 py-1.5 bg-zinc-800 text-zinc-50 text-xs rounded border border-[#343438] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">间推人数</label>
              <input
                type="number"
                value={indirectReferrals}
                onChange={(e) => setIndirectReferrals(Math.max(0, Number(e.target.value)))}
                className="w-full px-2 py-1.5 bg-zinc-800 text-zinc-50 text-xs rounded border border-[#343438] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">人均投资 (U)</label>
              <input
                type="number"
                value={perPersonAmount}
                onChange={(e) => setPerPersonAmount(Math.max(0, Number(e.target.value)))}
                className="w-full px-2 py-1.5 bg-zinc-800 text-zinc-50 text-xs rounded border border-[#343438] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="bg-zinc-800 rounded p-2.5 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-50">
              <span>直推奖励 ({+(directRate * 100).toFixed(0)}%) =</span>
              <span className="font-medium">{directBonus.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-zinc-50">
              <span>间推奖励 ({+(indirectRate * 100).toFixed(0)}%) =</span>
              <span className="font-medium">{indirectBonus.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-zinc-50 border-t border-[#343438] pt-1.5 mt-1.5 font-semibold">
              <span>总动态收益 =</span>
              <span className="text-blue-400">{totalDynamic.toFixed(2)} USDT</span>
            </div>
          </div>
        </div>

        {/* 4. 策略建议 */}
        {hasData && reportData.strategy_suggestion && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-50 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              4. 策略建议与点位布局
            </h3>
            <div className="text-xs text-zinc-50 leading-relaxed whitespace-pre-wrap">
              {renderEvidenceTaggedText(reportData.strategy_suggestion, "text-xs text-zinc-50 leading-relaxed whitespace-pre-wrap")}
            </div>
            {reportData.visualization_tree ? (
              <div className="bg-zinc-800/60 rounded-lg p-3 border border-zinc-700/50 mt-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-zinc-400">点位布局图</span>
                </div>
                <ReactECharts
                  option={buildTreeOption(reportData.visualization_tree)}
                  style={{ height: 300, width: '100%' }}
                  showLoading={false}
                />
              </div>
            ) : reportData.visualization_hint ? (
              <div className="bg-zinc-800 rounded p-2.5 text-xs text-zinc-50 font-mono space-y-1 whitespace-pre-wrap">
                {renderEvidenceTaggedText(reportData.visualization_hint, "text-xs text-zinc-50 font-mono whitespace-pre-wrap")}
              </div>
            ) : null}
          </div>
        )}

        {/* 5. 风险警示 */}
        {hasData && (reportData.risk_warning || reportData.risk_assessment) && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-50 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-yellow-500" />
              5. 风险警示
            </h3>
            {reportData.risk_assessment?.level && (
              <div className="flex items-center gap-2 bg-red-900/20 rounded-t-lg px-3 py-1.5 border border-red-800/50 border-b-0">
                <span className="text-xs font-semibold text-red-400">风险等级：</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  reportData.risk_assessment.level === '高风险' ? 'bg-red-600/30 text-red-300' :
                  reportData.risk_assessment.level === '中风险' ? 'bg-yellow-600/30 text-yellow-300' :
                  'bg-green-600/30 text-green-300'
                }`}>{reportData.risk_assessment.level}</span>
              </div>
            )}
            <div className="flex items-start gap-2 bg-yellow-900/20 rounded-lg p-3 border border-yellow-700/50">
              <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-xs">
                {reportData.risk_warning && (
                  <div className="text-yellow-400 leading-relaxed">
                    {renderEvidenceTaggedText(reportData.risk_warning, "text-xs text-yellow-400 leading-relaxed")}
                  </div>
                )}
                {reportData.risk_assessment?.triggers?.map((t, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-red-400 flex-shrink-0">⚠️</span>
                    <span className="text-zinc-300 leading-relaxed">{t}</span>
                  </div>
                ))}
                {reportData.risk_assessment?.pressure_test && (
                  <div className="bg-red-900/30 rounded p-2 mt-1 text-red-300 font-medium">
                    💰 {reportData.risk_assessment.pressure_test}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 6. Disclaimer + Buttons */}
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">以上分析基于您提供的规则文本，动静态分析仅供参考，不构成投资建议。</p>
          <div className="border-t border-[#343438] -mx-4"></div>

          <ShareButton
            type="business"
            data={{
              projectName: name,
              patternType: reportData?.pattern_type,
              businessSummary: reportData?.plain_explanation,
              riskLabel: reportData?.risk_assessment?.level,
            }}
            label="分享拆解结果"
            className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 hover:text-blue-300 text-white text-xs font-medium py-2.5 rounded-full transition-colors"
          />

          {!hideAssessRisk && (
            <button
              onClick={() => setIsAssessRiskModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 hover:text-blue-300 text-white text-xs font-medium py-2.5 rounded-full transition-colors"
            >
              评估该项目风险
            </button>
          )}
        </div>

        {/* 评估该项目风险 确认弹窗 */}
        {isAssessRiskModalOpen && createPortal(
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setIsAssessRiskModalOpen(false)}>
            <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-white font-semibold text-sm text-center">评估该项目风险</h3>
              <p className="text-zinc-300 text-xs leading-relaxed text-left">将跳转到项目安全评估页面，对该项目进行安全评估。</p>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setIsAssessRiskModalOpen(false)} className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-xs">取消</button>
                <button onClick={() => { setIsAssessRiskModalOpen(false); onAssessRisk?.() }} className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs">确认跳转</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}
