// ============================================================
// 数据归一化适配器 — DeepSeek JSON → 确定类型
//
// AI 返回的字段类型不可靠（string √, number √, object √, null √…）
// 本层统一清洗，下游只用 NormalizedReport，永不接触原始脏数据。
// ============================================================

/** 归一化后的六维评分维度 */
export interface NormalizedDimension {
  dimension: string
  score: number
  max: number
  deduction: string
}

/** 归一化后的 GoPlus 链上数据 */
export interface NormalizedGoPlus {
  isOpenSource: boolean | null
  lpLockInfo: string | null
  lpLockStatus: string | null
  top10Percent: number | null
}

/** 归一化后的链上数据 */
export interface NormalizedOnChain {
  tokenName: string
  tokenSymbol: string
  tokenDecimals: number
  totalSupply: string
  goplus: NormalizedGoPlus
}

/** 归一化后的报告数据 — 所有字段类型确定 */
export interface NormalizedReport {
  total_score: number
  risk_level: string
  conclusion: string
  six_dimensions: NormalizedDimension[]
  history_mode_changes: string
  top10_concentration: string
  liquidity_lock: string
  funding_record: string
  public_opinion_summary: string
  public_opinion_negative_keywords: string[]
  ai_summary: string
  onChainData: NormalizedOnChain | null
}

// ---- 工具函数 ----

function ensureString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return fallback
}

function ensureNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    if (!Number.isNaN(n)) return n
  }
  return fallback
}

function ensureBoolean(v: unknown, fallback: boolean | null = null): boolean | null {
  if (typeof v === 'boolean') return v
  return fallback
}

/** 维度满分映射 — 当 API 不返回 max 时补全 */
const DIMENSION_MAX: Record<string, number> = {
  '代码与技术安全': 25,
  '团队与运营透明度': 20,
  '经济模型与资金安全': 20,
  '社群与市场热度': 15,
  '历史与执行可靠性': 10,
  '合规性与法律风险': 10,
}

/**
 * 归一化原始报告数据。
 * 输入可以是 DeepSeek 返回的完整 JSON、部分字段、甚至 null/undefined。
 * 输出始终是干净、类型确定的 NormalizedReport。
 */
export function normalizeReportData(raw: any): NormalizedReport {
  // 顶层保护
  const data = raw && typeof raw === 'object' ? raw : {}

  // 六维数组归一化
  const rawDims = Array.isArray(data.six_dimensions) ? data.six_dimensions : []
  const six_dimensions: NormalizedDimension[] = rawDims.map((d: any) => {
    const dimension = ensureString(d?.dimension, '未知维度')
    const max = d && typeof d.max === 'number' && d.max > 0
      ? d.max
      : (DIMENSION_MAX[dimension] || 10)
    const score = Math.min(ensureNumber(d?.score, 0), max)
    const deduction = ensureString(d?.deduction, '无')
    return { dimension, score, max, deduction }
  })

  // 舆情归一化
  const publicOpinion = data.public_opinion
  const public_opinion_summary = typeof publicOpinion === 'string'
    ? publicOpinion
    : ensureString(publicOpinion?.summary, '')
  const public_opinion_negative_keywords = Array.isArray(publicOpinion?.negative_keywords)
    ? publicOpinion.negative_keywords.filter((k: unknown) => typeof k === 'string')
    : []

  // 链上数据归一化
  const onChainRaw = data.onChainData
  let onChainData: NormalizedOnChain | null = null
  if (onChainRaw && typeof onChainRaw === 'object') {
    const goplusRaw = onChainRaw.goplus || {}
    onChainData = {
      tokenName: ensureString(onChainRaw.tokenName, '未知'),
      tokenSymbol: ensureString(onChainRaw.tokenSymbol, '--'),
      tokenDecimals: ensureNumber(onChainRaw.tokenDecimals, 18),
      totalSupply: ensureString(onChainRaw.totalSupply, '--'),
      goplus: {
        isOpenSource: ensureBoolean(goplusRaw.isOpenSource, null),
        lpLockInfo: goplusRaw.lpLockInfo != null ? ensureString(goplusRaw.lpLockInfo, null as any) : null,
        lpLockStatus: ensureString(goplusRaw.lpLockStatus || goplusRaw.lpLockStatus, ''),
        top10Percent: goplusRaw.top10Percent != null ? ensureNumber(goplusRaw.top10Percent, null as any) : null,
      },
    }
  }

  return {
    total_score: ensureNumber(data.total_score, 0),
    risk_level: ensureString(data.risk_level, '未知'),
    conclusion: ensureString(data.conclusion, ''),
    six_dimensions,
    history_mode_changes: ensureString(data.history_mode_changes, '无'),
    top10_concentration: ensureString(data.top10_concentration, ''),
    liquidity_lock: ensureString(data.liquidity_lock, ''),
    funding_record: ensureString(data.funding_record, ''),
    public_opinion_summary,
    public_opinion_negative_keywords,
    ai_summary: ensureString(data.ai_summary, ''),
    onChainData,
  }
}
