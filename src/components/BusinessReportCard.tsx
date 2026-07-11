import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { AlertCircle, Users, Lightbulb, ShieldAlert } from "lucide-react"
import { renderEvidenceTaggedText } from "../utils/evidenceTags"
import ReactECharts from 'echarts-for-react'
import ShareButton from "./ShareButton"
import BusinessShareDrawer from "./BusinessShareDrawer"

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
    // 新版参数化引擎
    static_engine?: {
      has_static: boolean
      products: Array<{
        name: string
        description?: string
        min_invest_usd?: number | null
        min_invest_token?: string
        effective_min_invest_token?: string
        investment_token?: string
        daily_rate?: number
        daily_rate_unit?: string
        cycles?: number[]
        cycle_unit?: string
        compound_apy?: number
        features?: string[]
      }>
      amplification?: {
        has_amplification: boolean
        recharge_times?: number
        reinvest_times?: number
        description?: string
      }
      special_switches?: Array<{
        name: string
        type: 'multiplier' | 'toggle'
        value?: number
        description?: string
      }>
    }
    dynamic_engine?: {
      has_dynamic: boolean
      income_rules: Array<{
        name: string
        method: string
        generation_table?: Array<{ directs: number; generations: number }>
        tiers?: Array<{ level: string; stake_usd?: number; team_performance?: number; rate: number }>
        nodes?: Array<{ name: string; generations: number; markets?: number }>
        reward_rate?: number
        reward_base?: string
        level_decay?: {
          has_decay?: boolean
          first_level_rate?: number
          decay_per_level?: number
          min_rate?: number
          min_level?: number
          description?: string
        }
        formula?: string
        formula_example?: string
      }>
      special_mechs?: Array<{ name: string; type: string; description: string }>
    }
    // 兼容旧版
    static_calculator?: { daily_rate?: number; investment?: number }
    dynamic_calculator?: { direct_referral_rate?: number; indirect_referral_rate?: number }
    // 通用字段
    strategy_suggestion?: string
    risk_warning?: string
    risk_assessment?: { level?: string; triggers?: string[]; pressure_test?: string }
    visualization_hint?: string
    visualization_tree?: TreeNode
  }
  defaultStaticAmount?: number
  defaultDirectReferrals?: number
  defaultIndirectReferrals?: number
  defaultPerPersonAmount?: number
  onStaticChange?: (amount: number) => void
  onShare?: () => void
  onAssessRisk?: () => void
  hideAssessRisk?: boolean
}

/** ECharts Tree 选项构建 */
function buildTreeOption(treeData: TreeNode) {
  // 递归设置节点颜色
  function colorNodes(node: TreeNode) {
    const name = node?.name || ''
    if (name.includes('共识') || name.startsWith('B')) {
      node.itemStyle = { color: '#22c55e' }
    } else {
      node.itemStyle = { color: '#6b7280' }
    }
    if (name === '你' || name.startsWith('你')) {
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
      initialTreeDepth: 3,
      scaleLimit: { min: 0.8, max: 2 },
      animationDurationUpdate: 300,
      label: {
        position: 'bottom' as const,
        verticalAlign: 'middle' as const,
        align: 'center' as const,
        fontSize: 10,
        color: '#e4e4e7',
        formatter: (params: any) => {
          const name = params.name || '';
          if (name.length <= 6) return name;
          let result = '';
          for (let i = 0; i < name.length; i += 6) {
            result += name.slice(i, i + 6) + '\n';
          }
          return result.trim();
        },
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
  // ---- 参数化引擎状态 ----
  const se = reportData?.static_engine
  const de = reportData?.dynamic_engine
  const useNewEngine = !!(se?.products?.length || de?.income_rules?.length)

  // 旧版兼容
  const sc = !useNewEngine ? reportData?.static_calculator : undefined
  const dc = !useNewEngine ? reportData?.dynamic_calculator : undefined

  // 静态：产品选择
  const products = se?.products || []
  const [activeProductIdx, setActiveProductIdx] = useState(0)
  const activeProduct = products[activeProductIdx] || products[0] || null
  const [activeCycleIdx, setActiveCycleIdx] = useState(0)
  const cycles = activeProduct?.cycles || []

  // 静态：基础输入
  const [investmentStr, setInvestmentStr] = useState('1000')
  const investment = Number(investmentStr) || 0
  const dailyRate = activeProduct?.daily_rate ?? sc?.daily_rate ?? null
  // ✅ 动态代币汇率：用户可手动输入当前价格（代币价格实时变动）
  const hasTokenUnit = !!(activeProduct?.investment_token && activeProduct?.investment_token !== 'USDT')
  const [tokenPriceStr, setTokenPriceStr] = useState('')
  const tokenPrice = Number(tokenPriceStr) || 0
  const minInvestTokenNum = Number(activeProduct?.min_invest_token?.replace(/[^0-9.]/g, '')) || 0
  // ✅ 实际自掏腰包最低金额（优先用 AI 提取的 effective_min_invest_token，更准确）
  const effectiveMinTokenText = activeProduct?.effective_min_invest_token || activeProduct?.min_invest_token
  const effectiveMinTokenNum = Number(effectiveMinTokenText?.replace(/[^0-9.]/g, '')) || 0
  const effectiveMinTokenDisplay = effectiveMinTokenText || null
  // ✅ U 估算必须基于"实际自掏腰包"的代币数量，不是名义门槛
  const minInvestUsdDisplay = tokenPrice > 0 && effectiveMinTokenNum > 0 ? Math.round(effectiveMinTokenNum * tokenPrice).toString() : null

  // 静态：特殊开关
  const specialSwitches = se?.special_switches || []
  const [switchStates, setSwitchStates] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (specialSwitches.length && Object.keys(switchStates).length === 0) {
      const init: Record<string, boolean> = {}
      specialSwitches.forEach(s => { init[s.name] = false })
      setSwitchStates(init)
    }
  }, [reportData])

  // 静态：放大倍数
  const amp = se?.amplification
  const hasAmp = amp?.has_amplification && !!amp?.recharge_times

  // 静态：计算
  const effectiveInv = hasAmp ? investment * (amp.recharge_times || 1) : investment
  // ✅ dailyRate 为 null 时整条计算链置为 null，避免 0*null = 0 的假数据
  const dailyReturn = dailyRate != null ? effectiveInv * dailyRate : null
  let finalDailyReturn = dailyReturn
  if (finalDailyReturn != null) {
    for (const s of specialSwitches) {
      // ✅ 涡轮机制默认乘2，即使 AI 未传 value 或 value 为 0 也要生效
      if (s.type === 'multiplier' && switchStates[s.name]) {
        finalDailyReturn *= (Number(s.value) || 2)
      }
    }
  }
  // ✅ 所有周期收益统一使用 finalDailyReturn（含涡轮加速）
  const weeklyReturn = finalDailyReturn != null ? finalDailyReturn * 7 : null
  const monthlyReturn = finalDailyReturn != null ? finalDailyReturn * 30 : null
  const yearlyReturn = finalDailyReturn != null ? finalDailyReturn * 365 : null
  const annualizedRate = dailyRate != null ? +(dailyRate * 365 * 100).toFixed(0) : null
  // ✅ 前端计算年复利（取代 AI 不可靠的生成）
  const calculatedCompoundApy = dailyRate != null ? Math.round(((1 + dailyRate) ** 365 - 1) * 100) : null
  // ✅ 周期总收益：让周期按钮真正起作用
  const cycleDays = cycles[activeCycleIdx] || 360
  const cycleTotalReturn = finalDailyReturn != null ? finalDailyReturn * cycleDays : null

  // 动态：根据收入规则渲染
  const [dynInputs, setDynInputs] = useState<Record<string, string>>({})
  const dynRules = de?.income_rules || []

  // 旧版兼容
  const [directRateStr, setDirectRateStr] = useState('0.10')
  const directRate = Number(directRateStr) || 0
  const [indirectRateStr, setIndirectRateStr] = useState('0.05')
  const indirectRate = Number(indirectRateStr) || 0
  const [directReferralsStr, setDirectReferralsStr] = useState('0')
  const directReferrals = Number(directReferralsStr) || 0
  const [indirectReferralsStr, setIndirectReferralsStr] = useState('0')
  const indirectReferrals = Number(indirectReferralsStr) || 0
  const [perPersonAmountStr, setPerPersonAmountStr] = useState('0')
  const perPersonAmount = Number(perPersonAmountStr) || 0
  const [isAssessRiskModalOpen, setIsAssessRiskModalOpen] = useState(false)

  // 等级下拉框展开状态（自定义下拉，兼容手机 WebView）
  const [openDropdownRule, setOpenDropdownRule] = useState<string | null>(null)

  // 点击外部关闭下拉框（无遮挡，不阻止滚动）
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => {
    if (!openDropdownRule) return
    const handler = (e: PointerEvent) => {
      const targetContainer = dropdownRefs.current[openDropdownRule]
      if (!targetContainer || !targetContainer.contains(e.target as Node)) {
        setOpenDropdownRule(null)
      }
    }
    const t = setTimeout(() => document.addEventListener('pointerdown', handler), 0)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', handler) }
  }, [openDropdownRule])

  const directBonus = directReferrals * perPersonAmount * directRate
  const indirectBonus = indirectReferrals * perPersonAmount * indirectRate
  const totalDynamic = directBonus + indirectBonus

  // 旧版兼容：API数据重置
  useEffect(() => {
    if (!useNewEngine && dc?.direct_referral_rate) setDirectRateStr(String(dc.direct_referral_rate))
    if (!useNewEngine && dc?.indirect_referral_rate) setIndirectRateStr(String(dc.indirect_referral_rate))
  }, [reportData])

  const handleInvestmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInvestmentStr(e.target.value)
    const num = Number(e.target.value)
    if (!isNaN(num)) onStaticChange?.(Math.max(0, num))
  }

  const hasData = !!reportData

  /** 计算动态规则具体收益 */
  function calcDynamicRule(rule: typeof dynRules[0]): { label: string; value: string }[] {
    const results: { label: string; value: string }[] = []
    if (rule.method === 'generations' && rule.generation_table?.length) {
      const directs = Number(dynInputs[`${rule.name}_directs`] || '0')
      // 查表确定代数
      let maxGens = 0
      for (const row of rule.generation_table) {
        if (directs >= row.directs) maxGens = Math.max(maxGens, row.generations)
      }
      const perGenAmount = Number(dynInputs[`${rule.name}_per_gen`] || '0')
      const rate = rule.reward_rate || 0
      let total = 0
      for (let i = 0; i < maxGens; i++) {
        const decay = rule.level_decay?.has_decay
          ? (rule.level_decay.first_level_rate != null
            ? Math.max(rule.level_decay.min_rate || 0, rule.level_decay.first_level_rate - i * (rule.level_decay.decay_per_level || 0))
            : 1.0)
          : 1.0
        total += perGenAmount * rate * decay
      }
      results.push({ label: `代数(${maxGens > 0 ? maxGens + '代' : '无代数数据'})`, value: maxGens > 0 ? Math.round(total) + ' U/日' : '数据缺失' })
    } else if (rule.method === 'tiers' && rule.tiers?.length) {
      // 用户手动选择的等级
      const selectedTierIdx = Number(dynInputs[`${rule.name}_tier_idx`] || '0')
      const safeIdx = Math.min(Math.max(0, selectedTierIdx), rule.tiers.length - 1)
      const selectedTier = rule.tiers[safeIdx]
      const effectiveLevel = selectedTier?.level || ''
      const effectiveRate = selectedTier != null ? Number(selectedTier.rate) || 0 : 0
      // ✅ 团队业绩 × 等级比例 = 预估日收益（动态推广按比例直接计算，不依赖日化率）
      const performance = Number(dynInputs[`${rule.name}_perf`] || '0')
      const tierEarnings = performance * effectiveRate
      const ratePct = effectiveRate > 0 ? `（${(effectiveRate*100).toFixed(0)}%）` : ''
      results.push({ label: `等级选择`, value: `${effectiveLevel || '—'}${ratePct}` })
      // 如果选了等级但该等级无 rate 数据，明确提示
      if (effectiveLevel && effectiveRate <= 0 && performance > 0) {
        results.push({ label: '预估日收益', value: '数据缺失（该等级未识别）' })
      } else {
        results.push({ label: '预估日收益', value: (tierEarnings > 0 ? Math.round(tierEarnings) : '—') + ' U' })
      }
    } else if (rule.method === 'node' && rule.nodes?.length) {
      const nodeIdx = Number(dynInputs[`${rule.name}_node_idx`] || '0')
      const node = rule.nodes[nodeIdx] || rule.nodes[0]
      if (node) {
        results.push({ label: `节点(${node.name})`, value: `${node.generations}代` })
        const markets = node.markets ? ` ${node.markets}个市场` : ''
        results.push({ label: '条件', value: markets || '—' })
      }
    }
    return results
  }

  return (
    <div className="w-full bg-zinc-900 rounded-lg overflow-hidden">
      {/* Title Bar */}
      <div className="bg-gradient-to-r from-blue-950/50 to-purple-950/50 px-4 py-2 border-b border-[#343438]">
        <h3 className="text-white font-semibold text-lg text-center">商业模式拆解报告</h3>
        <p className="text-zinc-400 text-sm mt-1 text-center">明鉴·首席分析师出品</p>
      </div>

      <div className="p-4 space-y-6">
        {/* 1. 商业模式解读 */}
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-zinc-50">1. 商业模式解读</h3>
          {hasData ? (
            <div className="text-sm text-zinc-50 leading-relaxed whitespace-pre-wrap">
              {renderEvidenceTaggedText(reportData.plain_explanation || '（暂无解读）', "text-sm text-zinc-50 leading-relaxed whitespace-pre-wrap")}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 leading-relaxed italic">请先输入项目规则并点击"开始拆解"生成报告。</p>
          )}
        </div>

        {/* 2. 静态收益计算器 */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-zinc-50">2. 静态投资收益计算器</h3>

          {/* 产品 Tab 栏 */}
          {products.length > 1 && (
            <div className="flex flex-wrap gap-1.5 border-b border-[#343438] pb-2">
              {products.map((p, i) => (
                <button key={i} onClick={() => { setActiveProductIdx(i); setActiveCycleIdx(0) }}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${i === activeProductIdx ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >{p.name}</button>
              ))}
            </div>
          )}

          {/* 产品信息 */}
          {activeProduct && (
            <div className="text-sm text-zinc-500 bg-zinc-800/50 rounded px-2.5 py-1.5">
              {activeProduct.description || activeProduct.name}
              {activeProduct.features?.length ? ` | 特性: ${activeProduct.features.join(', ')}` : ''}
              {/* 代币计价项目：不显示固定的 min_invest_usd，只显示代币数量 */}
              {hasTokenUnit ? (
                <>
                  {activeProduct.min_invest_token ? ` | 最低: ${activeProduct.min_invest_token}` : ''}
                  {effectiveMinTokenDisplay && effectiveMinTokenDisplay !== activeProduct.min_invest_token ? ` | 实际自掏腰包最低: ${effectiveMinTokenDisplay}` : ''}
                  {minInvestUsdDisplay ? ` ≈ ${minInvestUsdDisplay}U` : '（价格实时变动，请输入当前汇率）'}
                </>
              ) : (
                <>
                  {activeProduct.min_invest_usd ? ` | 最低: ${activeProduct.min_invest_usd}U` : ''}
                  {activeProduct.min_invest_token ? ` | 最低: ${activeProduct.min_invest_token}` : ''}
                </>
              )}
            </div>
          )}

          {/* 动态汇率输入（仅代币计价项目显示） */}
          {hasTokenUnit && (
            <div className="space-y-1">
              <label className="text-sm text-zinc-400">当前 1{activeProduct?.investment_token} = 多少 U</label>
              <input
                type="number"
                value={tokenPriceStr}
                onChange={(e) => setTokenPriceStr(e.target.value)}
                placeholder="请输入当前市场价，如 0.05"
                className="w-full px-3 py-2 bg-zinc-800 text-zinc-50 text-base rounded border border-[#343438] focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-sm text-zinc-400">投资金额 (USDT)</label>
              <input type="number" value={investmentStr} onChange={handleInvestmentChange}
                className="w-full px-3 py-2 bg-zinc-800 text-zinc-50 text-base rounded border border-[#343438] focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-zinc-400">日收益率</label>
              <div className="w-full px-3 py-2 bg-zinc-700 text-zinc-400 text-base rounded border border-zinc-600">
                {activeProduct
                  ? (dailyRate != null && dailyRate > 0 ? `${(dailyRate*100).toFixed(2)}%` : dailyRate === 0 ? '0%' : '未识别')
                  : (sc?.daily_rate != null && sc.daily_rate > 0 ? `${(sc.daily_rate*100).toFixed(2)}%` : '未识别')}
              </div>
            </div>
          </div>

          {/* 周期选择 */}
          {cycles.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm text-zinc-400">周期</label>
              <div className="flex flex-wrap gap-1.5">
                {cycles.map((c, i) => (
                  <button key={i} onClick={() => setActiveCycleIdx(i)}
                    className={`text-xs px-2.5 py-1 rounded-full ${i === activeCycleIdx ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                  >{c}{activeProduct?.cycle_unit || '天'}</button>
                ))}
              </div>
            </div>
          )}

          {/* 放大倍数 */}
          {hasAmp && (
            <div className="text-sm text-zinc-400 bg-zinc-800/60 rounded px-2.5 py-1.5">
              {amp.description || `充值${amp.recharge_times}倍，复投${amp.reinvest_times}倍`}
            </div>
          )}

          {/* 特殊开关 */}
          {specialSwitches.length > 0 && (
            <div className="space-y-1.5">
              {specialSwitches.map((s, i) => (
                <label key={i} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={!!switchStates[s.name]} onChange={() => setSwitchStates(p => ({...p, [s.name]: !p[s.name]}))}
                    className="accent-blue-500" />
                  {s.name}：{s.description}
                </label>
              ))}
            </div>
          )}

          {/* 收益表格 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#343438]">
                  <th className="text-left py-2 px-2 text-zinc-400">周期</th>
                  <th className="text-right py-2 px-2 text-zinc-400">收益 (USDT)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#343438]">
                  <td className="py-2 px-2 text-zinc-50">每日</td>
                  <td className="text-right py-2 px-2 text-zinc-50 font-medium">{finalDailyReturn != null ? Math.round(finalDailyReturn) : '---'}</td>
                </tr>
                <tr className="border-b border-[#343438]">
                  <td className="py-2 px-2 text-zinc-50">每周</td>
                  <td className="text-right py-2 px-2 text-zinc-50 font-medium">{weeklyReturn != null ? Math.round(weeklyReturn) : '---'}</td>
                </tr>
                <tr className="border-b border-[#343438]">
                  <td className="py-2 px-2 text-zinc-50">每月</td>
                  <td className="text-right py-2 px-2 text-zinc-50 font-medium">{monthlyReturn != null ? Math.round(monthlyReturn) : '---'}</td>
                </tr>
                <tr className="border-b border-[#343438]">
                  <td className="py-2 px-2 text-zinc-50">每年</td>
                  <td className="text-right py-2 px-2 text-zinc-50 font-medium">{yearlyReturn != null ? Math.round(yearlyReturn) : '---'}</td>
                </tr>
                {cycles.length > 0 && cycleDays !== 360 && (
                  <tr className="border-b border-[#343438]">
                    <td className="py-2 px-2 text-blue-400">{cycleDays}{activeProduct?.cycle_unit || '天'}周期总收益</td>
                    <td className="text-right py-2 px-2 text-blue-400 font-medium">{cycleTotalReturn != null ? Math.round(cycleTotalReturn) + ' USDT' : '---'}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-2 px-2 text-zinc-50">年化</td>
                  <td className="text-right py-2 px-2 text-zinc-50 font-medium">{annualizedRate != null ? annualizedRate + '%' : '---'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-yellow-400">年复利</td>
                  <td className="text-right py-2 px-2 text-yellow-400 font-medium">{calculatedCompoundApy != null ? '≈' + calculatedCompoundApy.toLocaleString() + '%' : '---'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. 动态推广收益估算 */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-zinc-50">3. 动态推广收益估算</h3>

          {/* 新版：按收入规则渲染 */}
          {useNewEngine && dynRules.length > 0 ? dynRules.map((rule, ri) => {
            const results = calcDynamicRule(rule)

            return <div key={ri} className="bg-zinc-800/40 rounded p-2.5 space-y-2">
              <p className="text-sm text-zinc-300 font-medium">{rule.name}</p>

              {/* 代数制 — 有代数表才显示输入，否则只显示名称 */}
              {rule.method === 'generations' && rule.generation_table?.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-sm text-zinc-400">直推人数</label>
                    <input type="number" value={dynInputs[`${rule.name}_directs`] || ''}
                      onChange={(e) => setDynInputs(p => ({...p, [`${rule.name}_directs`]: e.target.value}))}
                      className="w-full px-2 py-1.5 bg-zinc-800 text-zinc-50 text-sm rounded border border-[#343438]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-zinc-400">每代业绩 (U)</label>
                    <input type="number" value={dynInputs[`${rule.name}_per_gen`] || ''}
                      onChange={(e) => setDynInputs(p => ({...p, [`${rule.name}_per_gen`]: e.target.value}))}
                      className="w-full px-2 py-1.5 bg-zinc-800 text-zinc-50 text-sm rounded border border-[#343438]" />
                  </div>
                </div>
              )}

              {/* 等级制 */}
              {rule.method === 'tiers' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-sm text-zinc-400">团队业绩 (U)</label>
                    <input type="number" value={dynInputs[`${rule.name}_perf`] || ''}
                      onChange={(e) => setDynInputs(p => ({...p, [`${rule.name}_perf`]: e.target.value}))}
                      className="w-full px-2 py-1.5 bg-zinc-800 text-zinc-50 text-sm rounded border border-[#343438]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-zinc-400">你的等级</label>

                    {/* 自定义下拉组件（兼容手机 WebView，不用原生 select） */}
                    <div className="relative" ref={el => { dropdownRefs.current[rule.name] = el }}>
                      <button
                        type="button"
                        onClick={() => setOpenDropdownRule(openDropdownRule === rule.name ? null : rule.name)}
                        className="w-full px-2 py-1.5 bg-zinc-800 text-zinc-50 text-sm rounded border border-[#343438] text-left flex items-center justify-between"
                        style={{ WebkitAppearance: 'none', appearance: 'none' }}
                      >
                        <span>
                          {(() => {
                            const idx = dynInputs[`${rule.name}_tier_idx`] || '0'
                            const t = rule.tiers[Number(idx)]
                            return t ? (t.level || 'V' + (Number(idx)+1)) + ' — ' + (t.rate ? (t.rate*100).toFixed(0) + '%' : '—') : '选择等级'
                          })()}
                        </span>
                        <span className="text-zinc-500 text-[10px] transition-transform duration-150"
                          style={{ transform: openDropdownRule === rule.name ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >▾</span>
                      </button>

                      {openDropdownRule === rule.name && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-zinc-800 border border-zinc-600 rounded max-h-40 overflow-y-auto shadow-lg" style={{ touchAction: 'pan-y' }}>
                          {rule.tiers.map((t, ti) => {
                            const isSelected = String(ti) === (dynInputs[`${rule.name}_tier_idx`] || '0')
                            return (
                              <button
                                key={ti}
                                type="button"
                                onClick={() => {
                                  setDynInputs(p => ({...p, [`${rule.name}_tier_idx`]: String(ti)}))
                                  setOpenDropdownRule(null)
                                }}
                                className={`w-full text-left px-2.5 py-1.5 text-sm border-b border-zinc-700/50 last:border-b-0 ${isSelected ? 'bg-blue-600/30 text-blue-300' : 'bg-zinc-800 text-zinc-50 hover:bg-zinc-700'}`}
                              >
                                {t.level || 'V' + (ti+1)}
                                <span className="text-zinc-500 ml-1">— {(t.rate ? (t.rate*100).toFixed(0) : '—')}%</span>
                                {t.stake_usd ? <span className="text-zinc-500 ml-1">(质押:{t.stake_usd}U)</span> : t.stake ? <span className="text-zinc-500 ml-1">(质押:{t.stake})</span> : ''}
                                {t.team_performance ? <span className="text-zinc-500 ml-1">(业绩:{t.team_performance.toLocaleString()}U)</span> : t.teamPerformance ? <span className="text-zinc-500 ml-1">(业绩:{t.teamPerformance.toLocaleString()}U)</span> : ''}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 节点制 */}
              {rule.method === 'node' && rule.nodes?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {rule.nodes.map((n, ni) => (
                    <button key={ni} onClick={() => setDynInputs(p => ({...p, [`${rule.name}_node_idx`]: String(ni)}))}
                      className={`text-xs px-2.5 py-1 rounded-full ${String(ni) === (dynInputs[`${rule.name}_node_idx`] || '0') ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                    >{n.name}</button>
                  ))}
                </div>
              )}

              {/* 结果 */}
              {results.length > 0 && (
                <div className="bg-zinc-900 rounded p-2 space-y-1">
                  {results.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm text-zinc-50">
                      <span>{r.label}</span>
                      <span className="font-medium text-blue-400">{r.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 公式说明 */}
              {rule.formula && (
                <details className="text-sm">
                  <summary className="text-zinc-500 cursor-pointer">公式说明</summary>
                  <p className="mt-1 text-zinc-400">{rule.formula}</p>
                  {rule.formula_example && <p className="text-zinc-500 mt-0.5">例：{rule.formula_example}</p>}
                </details>
              )}
            </div>
          }) : null}

          {/* 特殊机制展示 */}
          {de?.special_mechs?.length ? (
            <div className="bg-yellow-900/10 rounded p-2 space-y-1">
              <p className="text-sm text-yellow-500 font-medium">特殊机制</p>
              {de.special_mechs.map((m, i) => (
                <p key={i} className="text-sm text-zinc-400">• {m.name}：{m.description}</p>
              ))}
            </div>
          ) : null}

          {/* 旧版兼容 */}
          {!useNewEngine && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-sm text-zinc-400">直推人数</label>
                  <input type="number" value={directReferralsStr} onChange={(e) => setDirectReferralsStr(e.target.value)}
                    className="w-full px-2 py-1.5 bg-zinc-800 text-zinc-50 text-sm rounded border border-[#343438]" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-zinc-400">间推人数</label>
                  <input type="number" value={indirectReferralsStr} onChange={(e) => setIndirectReferralsStr(e.target.value)}
                    className="w-full px-2 py-1.5 bg-zinc-800 text-zinc-50 text-sm rounded border border-[#343438]" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-zinc-400">人均投资 (U)</label>
                  <input type="number" value={perPersonAmountStr} onChange={(e) => setPerPersonAmountStr(e.target.value)}
                    className="w-full px-2 py-1.5 bg-zinc-800 text-zinc-50 text-sm rounded border border-[#343438]" />
                </div>
              </div>
              <div className="bg-zinc-800 rounded p-2.5 space-y-1.5 text-sm">
                <div className="flex justify-between text-zinc-50">
                  <span>直推奖励({(directRate*100).toFixed(0)}%)</span>
                  <span className="font-medium">{Math.round(directBonus)} USDT</span>
                </div>
                <div className="flex justify-between text-zinc-50">
                  <span>间推奖励({(indirectRate*100).toFixed(0)}%)</span>
                  <span className="font-medium">{Math.round(indirectBonus)} USDT</span>
                </div>
                <div className="flex justify-between text-zinc-50 border-t border-[#343438] pt-1.5 mt-1.5 font-semibold">
                  <span>总动态</span>
                  <span className="text-blue-400">{Math.round(totalDynamic)} USDT</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 4. 策略建议 */}
        {hasData && reportData.strategy_suggestion && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-50 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              4. 策略建议与点位布局
            </h3>
            <div className="text-sm text-zinc-50 leading-relaxed whitespace-pre-wrap">
              {renderEvidenceTaggedText(reportData.strategy_suggestion, "text-sm text-zinc-50 leading-relaxed whitespace-pre-wrap")}
            </div>
            {reportData.visualization_tree ? (
              <div className="bg-zinc-800/60 rounded-lg p-3 border border-zinc-700/50 mt-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm text-zinc-400">点位布局图</span>
                </div>
                <ReactECharts
                  option={buildTreeOption(reportData.visualization_tree)}
                  style={{ height: 360, width: '100%' }}
                  showLoading={false}
                />
              </div>
            ) : reportData.visualization_hint ? (
              <div className="bg-zinc-800 rounded p-2.5 text-sm text-zinc-50 font-mono space-y-1 whitespace-pre-wrap">
                {renderEvidenceTaggedText(reportData.visualization_hint, "text-sm text-zinc-50 font-mono whitespace-pre-wrap")}
              </div>
            ) : null}
          </div>
        )}

        {/* 5. 风险警示 */}
        {hasData && (reportData.risk_warning || reportData.risk_assessment) && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-50 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-yellow-500" />
              5. 风险警示
            </h3>
            {reportData.risk_assessment?.level && (
              <div className="flex items-center gap-2 bg-red-900/20 rounded-t-lg px-3 py-1.5 border border-red-800/50 border-b-0">
                <span className="text-sm font-semibold text-red-400">风险等级：</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  reportData.risk_assessment.level === '高风险' ? 'bg-red-600/30 text-red-300' :
                  reportData.risk_assessment.level === '中风险' ? 'bg-yellow-600/30 text-yellow-300' :
                  'bg-green-600/30 text-green-300'
                }`}>{reportData.risk_assessment.level}</span>
              </div>
            )}
            <div className="flex items-start gap-2 bg-yellow-900/20 rounded-lg p-3 border border-yellow-700/50">
              <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                {reportData.risk_warning && (
                  <div className="text-yellow-400 leading-relaxed">
                    {renderEvidenceTaggedText(reportData.risk_warning, "text-sm text-yellow-400 leading-relaxed")}
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
          <p className="text-sm text-zinc-500">以上分析基于您提供的规则文本，动静态分析仅供参考，不构成投资建议。</p>
          <div className="border-t border-[#343438] -mx-4"></div>

          <BusinessShareDrawer
            reportData={reportData}
            trigger={
              <button className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 hover:text-blue-300 text-white text-sm font-medium py-2.5 rounded-full transition-colors">
                分享拆解结果
              </button>
            }
          />

          {!hideAssessRisk && (
            <button
              onClick={() => setIsAssessRiskModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 hover:text-blue-300 text-white text-sm font-medium py-2.5 rounded-full transition-colors"
            >
              评估该项目风险
            </button>
          )}
        </div>

        {/* 评估该项目风险 确认弹窗 */}
        {isAssessRiskModalOpen && createPortal(
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999]" onClick={() => setIsAssessRiskModalOpen(false)}>
            <div className="bg-zinc-900 rounded-lg p-4 w-80 mx-4 space-y-3 border border-[#343438]" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-white font-semibold text-base text-center">评估该项目风险</h3>
              <p className="text-zinc-300 text-sm leading-relaxed text-left">将跳转到项目安全评估页面，对该项目进行安全评估。</p>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setIsAssessRiskModalOpen(false)} className="flex-1 py-1.5 px-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-sm">取消</button>
                <button onClick={() => { setIsAssessRiskModalOpen(false); onAssessRisk?.() }} className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm">确认跳转</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  )
}
