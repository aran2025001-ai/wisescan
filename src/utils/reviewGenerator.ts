// ===== 综合解读生成器 v3：接收 NormalizedReport（类型干净、无 typeof 保护） =====

import type { NormalizedReport } from './normalizeReport'

const AUDIT_FIRMS = ['CertiK', 'certik', 'Certik', 'SlowMist', '慢雾', 'Peckshield', 'Hacken', 'Quantstamp', 'OpenZeppelin']

function extractAuditFirms(deduction: string): string[] {
  const found: string[] = []
  for (const firm of AUDIT_FIRMS) {
    if (deduction.includes(firm)) {
      const display = firm.toLowerCase() === 'certik' ? 'CertiK' : firm
      if (!found.includes(display)) found.push(display)
    }
  }
  return found
}

function parseModeChangeCount(str: string): number {
  if (!str || str === '无') return 0
  if (str.includes('≥2') || str.includes('多次') || str.includes('数次')) return 2
  const match = str.match(/(\d+)次/)
  if (match) return parseInt(match[1], 10)
  return str !== '无' ? 1 : 0
}

/**
 * 生成 60-100 字综合解读。
 * 输入已经过 normalizeReportData() 清洗，字段类型 100% 确定。
 *
 * 结构：优点句 → 风险句 → 倾向性结论句
 */
export function generateComprehensiveReview(data: NormalizedReport): string {
  if (!data) return '数据采集中，综合解读暂不可用。'

  const dims = data.six_dimensions
  const totalScore = data.total_score

  const strengths: string[] = []
  const regularRisks: string[] = []
  const criticalMarkers: string[] = []

  const codeDim = dims.find(d => d.dimension.includes('代码'))
  const teamDim = dims.find(d => d.dimension.includes('团队'))
  const histDim = dims.find(d => d.dimension.includes('历史'))
  const compDim = dims.find(d => d.dimension.includes('合规'))

  // --- 审计 ---
  if (codeDim) {
    const firms = extractAuditFirms(codeDim.deduction)
    if (firms.length >= 2) {
      strengths.push(`已完成 ${firms[0]} 和 ${firms[1]} 双重审计`)
    } else if (firms.length === 1) {
      strengths.push(`已完成 ${firms[0]} 审计`)
    } else if (codeDim.score >= 18) {
      strengths.push('已完成审计')
    } else if (codeDim.deduction.includes('未审计') || codeDim.score <= 8) {
      regularRisks.push('尚未完成审计')
    }
  }

  // --- 合约开源 ---
  if (data.onChainData?.goplus?.isOpenSource === true) {
    strengths.push('合约开源')
  }

  // --- 融资 ---
  const funding = data.funding_record
  if (funding && funding !== '未知' && funding !== '无' && funding !== '--') {
    strengths.push('获机构融资')
  }

  // --- LP 锁仓 ---
  const lpLockDetail = data.onChainData?.goplus?.lpLockInfo
  if (data.liquidity_lock === '已锁定' || (lpLockDetail !== null && lpLockDetail !== undefined && lpLockDetail !== '')) {
    if (lpLockDetail) {
      const yearMatch = lpLockDetail.match(/(\d{4})\s*年/)
      if (yearMatch) {
        strengths.push(`LP 锁定至 ${yearMatch[1]} 年`)
      } else {
        strengths.push('LP 已锁定')
      }
    } else {
      strengths.push('LP 已锁定')
    }
  }

  // --- 团队 ---
  if (teamDim) {
    if (teamDim.deduction.includes('匿名') || teamDim.score <= 8) {
      criticalMarkers.push('团队完全匿名')
    } else if (teamDim.deduction.includes('实名') || teamDim.score >= 16) {
      strengths.push('团队实名可查')
    }
  }

  // --- 模式变更 ---
  const modeCount = parseModeChangeCount(data.history_mode_changes)
  if (modeCount === 1) {
    regularRisks.push('模式曾变更')
  } else if (modeCount >= 2) {
    criticalMarkers.push('模式已变更多次')
  }

  // --- TOP10 持仓 ---
  const top10Raw = data.top10_concentration
  let top10Percent = 0
  if (top10Raw.includes('极高')) top10Percent = 90
  else if (top10Raw.includes('偏高')) top10Percent = 70
  else if (top10Raw.includes('正常')) top10Percent = 30
  else {
    const numMatch = top10Raw.match(/(\d+)/)
    if (numMatch) top10Percent = parseInt(numMatch[1], 10)
  }
  if (top10Percent >= 90) {
    criticalMarkers.push('持仓极度集中')
  } else if (top10Percent >= 70) {
    regularRisks.push('持仓高度集中')
  }

  // --- 合规 ---
  // 🔧 v5.13: "未搜索到牌照" 不等于 "持有牌照"，必须区分正面/负面语境
  if (compDim) {
    const compDeduction = compDim.deduction || '';
    // 正面：扣分理由明确提到"持有"/"已获"牌照而非否定描述
    const hasConfirmedLicense = /持有.*牌|持牌|已.*牌|合规牌|牌照.*合规/.test(compDeduction) &&
                                !/未搜索|数据缺失|无法确认|无.*牌|暂未|暂无/.test(compDeduction);
    if (hasConfirmedLicense && compDim.score >= 5) {
      strengths.push('持有合规牌照');
    } else if (compDim.score <= 3) {
      regularRisks.push('无合规记录');
    }
  }

  // --- 资金出金障碍 ---
  if (histDim?.deduction.includes('出金') || histDim?.deduction.includes('资金障碍')) {
    criticalMarkers.push('资金出金障碍记录')
  }

  // ===== 倾向性 & 建议 =====
  let tendency: string
  let advice: string
  if (totalScore >= 75) {
    tendency = '整体风险较低'
    advice = '可关注其生态发展'
  } else if (totalScore >= 60) {
    tendency = '整体风险中等'
    advice = '建议小仓观察'
  } else if (totalScore >= 40) {
    tendency = '整体风险偏高'
    advice = '建议谨慎参与'
  } else {
    tendency = '整体风险偏高'
    advice = '不建议参与'
  }

  // ===== 构建输出 =====
  let result = ''
  if (strengths.length > 0) result += strengths.join('，') + '。'

  const allRisks = [...regularRisks, ...criticalMarkers]
  if (allRisks.length > 0) {
    result += (strengths.length > 0 ? '但' : '') + allRisks.join('，') + '。'
  }

  result += `${tendency}，${advice}。`

  // ===== 字数校验 =====
  let charCount = 0
  for (const ch of result) {
    charCount += ch.charCodeAt(0) <= 0x7F ? 0.5 : 1
  }
  if (charCount > 110 && result.length > 90) {
    result = result.slice(0, 105) + '…'
  }
  if (charCount < 50 && allRisks.length === 0) {
    result = result.replace(/。$/, '，各项指标表现均衡。')
  }

  return result
}
