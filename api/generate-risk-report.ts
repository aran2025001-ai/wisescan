/**
 * Backend API: Generate risk report via DeepSeek AI
 * POST /api/generate-risk-report
 * Body: { project_name (required), contract_address?, user_notes? }
 *
 * 调用 DeepSeek API 生成结构化风险评估报告，存入 risk_reports 表
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

// ===== GoPlus Security API — 代币安全全面扫描 =====
// 官方文档：https://docs.gopluslabs.io/reference/tokensecurityusingget_1.md
// 无需 API Key，免费调用

interface GoPlusResult {
  tokenName: string | null;
  tokenSymbol: string | null;
  lpLockStatus: '已锁定' | '未锁定' | '未知';
  lpLockInfo: string | null;
  lpOwnerAddress: string | null;
  lpOwnerPercent: string | null;
  top10Percent: number | null;
  holderCount: string | null;
  lpHolderCount: string | null;
  isOpenSource: boolean | null;
  isHoneypot: boolean | null;
  isAntiWhale: boolean | null;
  isBlacklisted: boolean | null;
  isMintable: boolean | null;
  isProxy: boolean | null;
  hiddenOwner: boolean | null;
  canTakeBackOwnership: boolean | null;
  transferPausable: boolean | null;
  isTrustToken: boolean | null;
  buyTax: number | null;
  sellTax: number | null;
  slippageModifiable: boolean | null;
  creatorAddress: string | null;
  creatorPercent: number | null;
  ownerAddress: string | null;
  ownerPercent: number | null;
  auditInfo: null;  // GoPlus API 不提供此字段
  dexInfo: Array<{ name: string; pair: string; liquidity: string }> | null;
  otherRisks: string | null;
}

function parseFlag(val: any): boolean | null {
  if (val === '1' || val === 1) return true;
  if (val === '0' || val === 0) return false;
  return null;
}

function parseNum(val: any): number | null {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function isBurnAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  const lower = addr.toLowerCase();
  return lower === '0x0000000000000000000000000000000000000000'
    || lower === '0x0000000000000000000000000000000000000001'
    || lower === '0x000000000000000000000000000000000000dead'
    || /^0x0{40}$/.test(lower);
}

const GOPLUS_BASE = 'https://api.gopluslabs.io/api/v1';

async function getTokenSecurity(contractAddress: string, chainId: number = 56): Promise<GoPlusResult> {
  // ⚠️ 参数名必须是 contract_addresses（复数）
  const url = `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${contractAddress}`;

  const emptyResult: GoPlusResult = {
    tokenName: null, tokenSymbol: null,
    lpLockStatus: '未知', lpLockInfo: null, lpOwnerAddress: null, lpOwnerPercent: null,
    top10Percent: null, holderCount: null, lpHolderCount: null,
    isOpenSource: null, isHoneypot: null, isAntiWhale: null, isBlacklisted: null,
    isMintable: null, isProxy: null, hiddenOwner: null, canTakeBackOwnership: null,
    transferPausable: null, isTrustToken: null,
    buyTax: null, sellTax: null, slippageModifiable: null,
    creatorAddress: null, creatorPercent: null, ownerAddress: null, ownerPercent: null,
    auditInfo: null, dexInfo: null, otherRisks: null,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[GoPlus] HTTP ${res.status} for ${contractAddress}`);
      return emptyResult;
    }

    const data = await res.json();
    if (data.code !== 1) {
      console.warn(`[GoPlus] API code=${data.code}, message=${data.message}`);
      return emptyResult;
    }

    const addrKey = contractAddress.toLowerCase();
    const result = data.result?.[addrKey];
    if (!result || Object.keys(result).length === 0) {
      console.warn(`[GoPlus] 未找到结果: ${contractAddress}`);
      return emptyResult;
    }

    // ─── 代币基本信息 ───
    const tokenName = result.token_name && typeof result.token_name === 'string' && result.token_name.trim()
      ? result.token_name.trim() : null;
    const tokenSymbol = result.token_symbol && typeof result.token_symbol === 'string' && result.token_symbol.trim()
      ? result.token_symbol.trim() : null;

    // ─── LP 锁仓状态 ───
    let lpLockStatus: '已锁定' | '未锁定' | '未知' = '未知';
    let lpLockInfo: string | null = null;
    let lpOwnerAddress: string | null = null;
    let lpOwnerPercent: string | null = null;

    if (Array.isArray(result.lp_holders) && result.lp_holders.length > 0) {
      let hasLocked = false;
      let hasUnlocked = false;
      const lockDetails: any[] = [];
      let maxPercent = 0;
      let mainLpHolder: any = null;

      for (const h of result.lp_holders) {
        const locked = h.is_locked === 1 || h.is_locked === '1';
        const hasLockDetail = Array.isArray(h.locked_detail) && h.locked_detail.length > 0;
        const hasNFT = Array.isArray(h.NFT_list) && h.NFT_list.length > 0;
        const pct = parseNum(h.percent) || 0;

        if (locked || hasLockDetail || hasNFT) {
          hasLocked = true;
          if (h.locked_detail) lockDetails.push(...h.locked_detail);
        } else {
          hasUnlocked = true;
        }

        if (pct > maxPercent && !isBurnAddress(h.address)) {
          maxPercent = pct;
          mainLpHolder = h;
        }
      }

      if (mainLpHolder) {
        lpOwnerAddress = mainLpHolder.address || null;
        lpOwnerPercent = mainLpHolder.percent || null;
      }

      if (hasLocked) {
        lpLockStatus = '已锁定';
        lpLockInfo = lockDetails.length > 0
          ? lockDetails.map((d: any) => `锁仓${d.amount || '未知量'}，解锁时间${d.end_time || '未知'}`).join('；')
          : 'LP 已锁定（详情未知）';
      } else if (hasUnlocked && !hasLocked) {
        lpLockStatus = '未锁定';
        lpLockInfo = `主 LP 持有者 ${mainLpHolder?.address?.slice(0, 10) || '未知'}... 未锁定 LP`;
      }
    }

    // ─── TOP10 持仓集中度 ───
    let top10Percent: number | null = null;
    if (Array.isArray(result.holders) && result.holders.length > 0) {
      const nonBurnHolders = result.holders.filter((h: any) => !isBurnAddress(h.address));
      const source = nonBurnHolders.length > 0 ? nonBurnHolders : result.holders;
      const sum = source.reduce((acc: number, h: any) => {
        const p = parseNum(h.percent);
        return acc + (isNaN(p) ? 0 : p);
      }, 0);
      top10Percent = sum * 100;
    }

    // ─── DEX 信息 ───
    const dexInfo = Array.isArray(result.dex) ? result.dex.map((d: any) => ({
      name: d.name || '',
      pair: d.pair || '',
      liquidity: d.liquidity || '0',
    })) : null;

    return {
      tokenName,
      tokenSymbol,
      lpLockStatus,
      lpLockInfo,
      lpOwnerAddress,
      lpOwnerPercent,
      top10Percent,
      holderCount: result.holder_count || null,
      lpHolderCount: result.lp_holder_count || null,
      isOpenSource: parseFlag(result.is_open_source),
      isHoneypot: parseFlag(result.is_honeypot),
      isAntiWhale: parseFlag(result.is_anti_whale),
      isBlacklisted: parseFlag(result.is_blacklisted),
      isMintable: parseFlag(result.is_mintable),
      isProxy: parseFlag(result.is_proxy),
      hiddenOwner: parseFlag(result.hidden_owner),
      canTakeBackOwnership: parseFlag(result.can_take_back_ownership),
      transferPausable: parseFlag(result.transfer_pausable),
      isTrustToken: parseFlag(result.trust_list),
      buyTax: parseNum(result.buy_tax),
      sellTax: parseNum(result.sell_tax),
      slippageModifiable: parseFlag(result.slippage_modifiable),
      creatorAddress: result.creator_address || null,
      creatorPercent: parseNum(result.creator_percent),
      ownerAddress: result.owner_address || null,
      ownerPercent: parseNum(result.owner_percent),
      auditInfo: null,
      dexInfo,
      otherRisks: result.other_potential_risks || null,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`[GoPlus] 查询超时: ${contractAddress}`);
    } else {
      console.error(`[GoPlus] 查询失败: ${contractAddress} —`, err.message);
    }
    return emptyResult;
  }
}

/** 生成 GoPlus 安全数据报告段落（注入 DeepSeek prompt） */
function formatGoPlusInfo(security: GoPlusResult): string {
  let info = '\n## 🔗 GoPlus 安全扫描数据（链上数据源，100% 可验证）\n\n';
  info += '以下数据来自 GoPlus Security Token Security API 链上实测，非 AI 推测。';

  // ── 代币基本信息 ──
  if (security.tokenName || security.tokenSymbol) {
    info += '\n### 代币信息\n';
    if (security.tokenName) info += `- 代币名称：${security.tokenName}\n`;
    if (security.tokenSymbol) info += `- 代币符号：${security.tokenSymbol}\n`;
  }

  // ── LP 锁仓 ──
  info += '\n### 流动性锁仓\n';
  if (security.lpLockStatus === '已锁定') {
    info += '- ✅ LP 流动性已锁定（Rug Pull 风险低）\n';
    if (security.lpLockInfo) info += `  - 锁仓详情：${security.lpLockInfo}\n`;
  } else if (security.lpLockStatus === '未锁定') {
    info += '- ❌ LP 流动性未锁定（⚠️ 高风险：Rug Pull 可能）\n';
    if (security.lpLockInfo) info += `  - ${security.lpLockInfo}\n`;
  } else {
    info += '- ⚠️ LP 锁仓状态：无法确认\n';
  }
  if (security.lpOwnerAddress) {
    const pct = security.lpOwnerPercent ? (parseFloat(security.lpOwnerPercent) * 100).toFixed(1) + '%' : '未知占比';
    info += `  - 主 LP 持有者：\`${security.lpOwnerAddress.slice(0, 12)}...\` (${pct})\n`;
  }

  // ── 持仓集中度 ──
  info += '\n### 持仓分布\n';
  if (security.top10Percent !== null) {
    const level = security.top10Percent >= 70 ? '🔴 极高（控盘严重）' : security.top10Percent >= 50 ? '🟡 偏高' : '🟢 正常';
    info += `- TOP10 持仓占比：${security.top10Percent.toFixed(1)}%（${level}，已排除销毁地址）\n`;
  } else {
    info += '- TOP10 持仓占比：暂无数据\n';
  }
  if (security.holderCount) info += `- 持有者总数：${security.holderCount}\n`;

  // ── 创建者/所有者 ──
  if (security.creatorAddress || security.ownerAddress) {
    info += '\n### 合约权限\n';
    if (security.creatorAddress) {
      const pct = security.creatorPercent != null ? (security.creatorPercent * 100).toFixed(2) + '%' : '未知';
      info += `- 创建者：\`${security.creatorAddress.slice(0, 12)}...\` | 持仓 ${pct}\n`;
    }
    if (security.ownerAddress) {
      const pct = security.ownerPercent != null ? (security.ownerPercent * 100).toFixed(2) + '%' : '未知';
      info += `- 合约所有者：\`${security.ownerAddress.slice(0, 12)}...\` | 持仓 ${pct}\n`;
    }
    if (security.isMintable === true) info += '- ⚠️ 可增发（Mintable）：所有者可铸造新代币\n';
    if (security.hiddenOwner === true) info += '- ⚠️ 隐藏所有者：高风险信号\n';
    if (security.isProxy === true) info += '- ⚠️ 代理合约：逻辑可被升级替换\n';
  }

  // ── 合约安全标志 ──
  info += '\n### 代码安全\n';
  info += `- 合约开源：${security.isOpenSource === true ? '✅ 已开源' : security.isOpenSource === false ? '❌ 未开源（无法审计）' : '⚠️ 未知'}\n`;
  if (security.isHoneypot === true) info += '- 🔴 蜜罐检测：该合约被识别为蜜罐代币（无法卖出）\n';
  if (security.isAntiWhale === true) info += '- ℹ️ 反鲸鱼机制：已启用\n';
  if (security.isBlacklisted === true) info += '- ⚠️ 黑名单功能：合约可冻结特定地址\n';
  if (security.transferPausable === true) info += '- ⚠️ 交易暂停：所有者可暂停所有转账\n';

  // ── 交易税 ──
  if (security.buyTax != null || security.sellTax != null) {
    info += '\n### 交易税\n';
    if (security.buyTax != null) info += `- 买入税：${(security.buyTax * 100).toFixed(1)}%\n`;
    if (security.sellTax != null) info += `- 卖出税：${(security.sellTax * 100).toFixed(1)}%\n`;
  }

  // ── 审计说明 ──
  info += '\n### 审计\n';
  info += '- ℹ️ GoPlus API 不提供审计报告数据。审计信息需通过 Tavily 网络搜索获取。\n';

  // ── 评分指引（v5.12 — 同步 api-server.mjs）──
  info += '\n### 📋 链上数据评分指引（供 AI 严格参考）\n';
  info += '| 检测结果 | 影响维度 | 分数调整 |\n';
  info += '|---------|---------|--------|\n';
  info += '| LP 已锁定 | 经济模型与资金安全 | +5 |\n';
  info += '| LP 未锁定 | 经济模型与资金安全 | -10 |\n';
  info += '| TOP10 ≥ 90% | 经济模型与资金安全 | -15（强制该维度 ≤5 分） |\n';
  info += '| TOP10 70-90% | 经济模型与资金安全 | -10 |\n';
  info += '| TOP10 50-70% | 经济模型与资金安全 | -7 |\n';
  info += '| 蜜罐检测命中 | 代码与技术安全 | 直接 0 分 |\n';
  info += '| 未开源 | 代码与技术安全 | 最多 10 分 |\n';
  info += '| 黑名单功能 | 代码与技术安全 | -5 |\n';
  info += '| 交易可暂停 | 代码与技术安全 | -5 |\n';
  info += '| TOP10 ≥ 90% | 代码与技术安全 | -15（控盘-10 + 联动-5，叠加生效） |\n';
  info += '| TOP10 ≥ 80% | 代码与技术安全 | -10（控盘-5 + 联动-5，叠加生效） |\n';
  info += '| TOP10 ≥ 70% | 代码与技术安全 | -3（控盘风险，联动未触发） |\n';
  info += '| 可增发 | 经济模型与资金安全 | -5 |\n';
  info += '| 隐藏所有者 | 团队与运营透明度 | -10 |\n';
  info += '| 买入税 ≥ 10% | 经济模型与资金安全 | -5 |\n';
  info += '| 卖出税 ≥ 10% | 经济模型与资金安全 | -5 |\n';

  return info;
}

// ===== Tavily 实时搜索 (v5 融合版 — 取 v3/v4/v4.1 各家之长, basic深度已验证最优) =====

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

/** 权威域名优先级打分（分值越低越靠前）—— v3 恢复 */
function getDomainPriority(url: string): number {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('gov') || host.includes('certik') || host.includes('sec.gov')) return 1;
    if (host.includes('rootdata') || host.includes('coingecko') || host.includes('coinmarketcap')) return 2;
    if (host.includes('slowmist') || host.includes('peckshield') || host.includes('defillama') || host.includes('dune.com')) return 3;
    if (host.includes('github.com') || host.includes('medium.com') || host.includes('mirror.xyz')) return 4;
    return 5;
  } catch {
    return 5;
  }
}

interface QueryResult {
  label: string;
  results: TavilyResult[];
  count: number;
  elapsed: string;
  error?: string;
  hit: boolean;
  answerText?: string;  // AI 摘要（v3 恢复）
}

// 各查询类型的命中关键词（中/英混合）—— v4.1 锐化版
const HIT_KEYWORDS: Record<string, string[]> = {
  '融资-中文': ['融资', '获投', '投资', '估值', '领投', '轮'],
  '融资-英文': ['funding', 'raised', 'million', 'investment', 'investor', 'round', '融资'],
  '审计': ['审计', '安全审计', 'audit', 'CertiK', 'SlowMist', 'PeckShield', 'security'],
  '牌照/监管': ['牌照', '许可证', 'license', 'MSB', 'MAS', 'SEC', '监管', 'regulation', 'compliance', 'financial license'],
  '法律实体': ['法律实体', '注册地', 'legal entity', 'registered', '注册', 'incorporated', '公司注册', 'company registration'],
  '模式变更': ['模式变更', '更换模式', '升级', '置换', '矿机', '挖矿', '锁仓', '新项目', '转型', 'pivot', 'rebrand'],
  // 🆕 v5.14: 负面舆情专项搜索（中英文 + 中文平台定向，覆盖中国人搞的项目）
  '负面舆情-中文': ['跑路', '骗局', '骗', '维权', '投诉', '卷款', '崩盘', '归零', '提现困难', '无法提现', '限制提现', '锁仓', '资金盘', '杀猪盘', '割韭菜', '圈钱', '空气币', '失联', '立案', '报案', '经侦', '曝光', '避雷', '黑幕', '踩坑'],
  '负面舆情-平台': ['知乎', '微博', '贴吧', '抖音', '曝光', '避雷', '踩坑', '黑幕', '维权群', '爆料', '揭穿', '真相'],
  '负面舆情-英文': ['scam', 'fraud', 'rug pull', 'exit scam', 'complaint', 'cheat', 'warning', 'ponzi', 'pyramid', 'collapse', 'disappeared', 'unverifiable'],
};

// 命中检测：扫描结果的 title + content 是否包含任意关键词
function checkHit(label: string, results: TavilyResult[]): boolean {
  const keywords = HIT_KEYWORDS[label] || [];
  const allText = results.map(r => r.title + ' ' + r.content).join(' ');
  return keywords.some(kw => allText.toLowerCase().includes(kw.toLowerCase()));
}

// 从 label 提取命中标签名（用于日志输出）
function getHitLabel(label: string): string {
  if (label.startsWith('融资')) return '融资';
  if (label === '审计') return '审计';
  if (label.startsWith('牌照')) return '牌照';
  if (label.startsWith('法律')) return '法律实体';
  if (label.startsWith('模式')) return '模式变更';
  if (label.startsWith('负面舆情')) return '负面舆情';
  return label;
}

/**
 * 通过 Tavily API 搜索项目的最新公开信息
 * v5 融合版：v3(域名排序 + 去重 + AI摘要 + max5) + v4(2批次并行 + 命中检测 + 整合文本) + v4.1(锐化query)
 * 搜索质量第一，速度其次；4s批次超时，8s总超时；basic 深度对中文项目效果最佳
 */
async function fetchRealtimeInfo(projectName: string, contractAddress: string | null = null): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.log('🔍 [Tavily] 未配置 TAVILY_API_KEY，跳过实时搜索');
    return '';
  }

  const startTime = Date.now();
  const BATCH_TIMEOUT = 4000;  // 单批次超时 4s
  const TOTAL_TIMEOUT = 8000;  // 总超时 8s
  let totalCreditsUsed = 0;

  // ========== 查询定义（6个查询，分2个并行批次）—— v4.1 锐化版 ==========
  // 🔧 短名称增强：当项目名过短（≤3字符，如 "MY"），追加上下文关键词提升搜索精度
  const isShortName = projectName.length <= 3
  const searchContext = isShortName ? `${projectName}代币 ${projectName} token crypto` : projectName

  const batch1 = [
    { label: '融资-中文', query: isShortName ? `${searchContext} 融资 投资 估值` : `${projectName} 融资 投资 估值` },
    { label: '融资-英文', query: isShortName ? `"${projectName} token" funding raised investment million` : `"${projectName}" funding raised investment million` },
    { label: '审计',      query: `${projectName} 审计 CertiK SlowMist "${projectName}" audit security` },
  ];

  const batch2 = [
    { label: '牌照/监管', query: `${projectName} MSB牌照 SEC 监管 "${projectName}" license regulation MAS compliance` },
    { label: '法律实体',   query: `${projectName} 注册地 法律实体 公司注册 "${projectName}" registered company incorporated legal entity` },
    { label: '模式变更',   query: `${projectName} 模式变更 ${projectName} 更换模式 ${projectName} 升级置换` },
    // 🆕 v5.14: 负面舆情专项搜索（拆分中英文 + 中文平台定向）
    { label: '负面舆情-中文', query: `${projectName} 跑路 骗局 维权 投诉 卷款 崩盘 资金盘 杀猪盘 割韭菜 圈钱 空气币` },
    { label: '负面舆情-平台', query: `${projectName} 知乎 微博 贴吧 抖音 曝光 避雷 踩坑 黑幕 维权群 爆料 骗术` },
    { label: '负面舆情-英文', query: `${projectName} scam "exit scam" "rug pull" fraud complaint ponzi pyramid collapse` },
  ];

  // 🔧 合约地址搜索：当有合约地址时，额外增加一条地址搜索（独立于批次，低优先级）
  let addressSearchPromise: Promise<QueryResult> | null = null
  if (contractAddress && contractAddress !== '未提供' && contractAddress.length >= 40) {
    addressSearchPromise = runQuery({
      label: '地址搜索',
      query: `${contractAddress} token project`,
    }, BATCH_TIMEOUT)
  }

  // 单查询执行器（AbortController 超时控制）
  async function runQuery(
    queryInfo: { label: string; query: string },
    timeout: number
  ): Promise<QueryResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const qStart = Date.now();

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: queryInfo.query,
          topic: 'general',           // 不用 'news'，效果差
          search_depth: 'basic',      // basic 深度对中文/亚洲项目效果最佳（v4/v4.1/v5 已验证）
          max_results: 5,             // v3 恢复，更多候选供筛选
          include_answer: true,       // v3 恢复，AI 摘要
          include_raw_content: false,
          // 不设 include_domains/exclude_domains（不限域名，v4 已验证）
        }),
        signal: controller.signal,
      });

      // 积分监控
      const creditsHeader = res.headers.get('x-tavily-credits-used');
      if (creditsHeader) {
        const credits = parseInt(creditsHeader, 10);
        if (!isNaN(credits)) totalCreditsUsed += credits;
      }
      const remainingHeader = res.headers.get('x-tavily-credits-remaining');
      if (remainingHeader) {
        const remaining = parseInt(remainingHeader, 10);
        if (!isNaN(remaining) && remaining < 200) {
          console.warn(`⚠️  [Tavily] 剩余积分不足 200 (当前: ${remaining})，请注意！`);
        }
      }

      if (!res.ok) {
        const elapsed = ((Date.now() - qStart) / 1000).toFixed(1);
        console.log(`  [${queryInfo.label}] 耗时 ${elapsed}s, 返回 0 条, HTTP ${res.status} ❌`);
        return { label: queryInfo.label, results: [], count: 0, elapsed, error: `HTTP ${res.status}`, hit: false };
      }

      const data = await res.json();
      const elapsed = ((Date.now() - qStart) / 1000).toFixed(1);

      // AI 摘要提取（v3 恢复）
      let answerText = '';
      if (data.answer && typeof data.answer === 'string' && data.answer.trim()) {
        answerText = data.answer.trim();
      }

      // 结果后处理（v3 恢复：域名优先级排序 + 去重；不设分数门槛，basic 模式下会误杀）
      const seenUrls = new Set<string>();
      const seenTitles = new Set<string>();
      const results: TavilyResult[] = (data.results || [])
        .sort((a: TavilyResult, b: TavilyResult) => getDomainPriority(a.url) - getDomainPriority(b.url))
        .filter((r: TavilyResult) => {
          const normUrl = (r.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
          const normTitle = (r.title || '').trim().toLowerCase();
          if (seenUrls.has(normUrl) || seenTitles.has(normTitle)) return false;
          seenUrls.add(normUrl);
          seenTitles.add(normTitle);
          return true;
        })
        .slice(0, 3);

      // 命中检测 + 日志
      const hit = checkHit(queryInfo.label, results);
      const hitLabel = getHitLabel(queryInfo.label);
      console.log(`  [${queryInfo.label}] 耗时 ${elapsed}s, 返回 ${results.length} 条, 命中${hitLabel} ${hit ? '✅' : '❌'}`);

      return { label: queryInfo.label, results, count: results.length, elapsed, hit, answerText };
    } catch (err: any) {
      const elapsed = ((Date.now() - qStart) / 1000).toFixed(1);
      if (err.name === 'AbortError') {
        console.warn(`  [${queryInfo.label}] 耗时 ${elapsed}s, 超时 ⏱️`);
      } else {
        console.error(`  [${queryInfo.label}] 耗时 ${elapsed}s, 错误: ${err.message}`);
      }
      return { label: queryInfo.label, results: [], count: 0, elapsed, error: err.message, hit: false };
    } finally {
      clearTimeout(timer);
    }
  }

  // ========== 第一批次：融资-中文 + 融资-英文 + 审计 ==========
  console.log(`  🔎 [Tavily] 第一批次: ${batch1.map(q => q.label).join(', ')}`);
  const b1 = await Promise.allSettled(batch1.map(q => runQuery(q, BATCH_TIMEOUT)));

  const allQueryResults: QueryResult[] = [];
  for (const r of b1) {
    if (r.status === 'fulfilled') allQueryResults.push(r.value);
  }

  // ========== 第二批次：牌照/监管 + 法律实体 + 模式变更 ==========
  if (Date.now() - startTime > TOTAL_TIMEOUT) {
    console.log('⏱️  [Tavily] 总耗时超过 8s，跳过第二批次');
  } else {
    console.log(`  🔎 [Tavily] 第二批次: ${batch2.map(q => q.label).join(', ')}`);
    const b2 = await Promise.allSettled(batch2.map(q => runQuery(q, BATCH_TIMEOUT)));
    for (const r of b2) {
      if (r.status === 'fulfilled') allQueryResults.push(r.value);
    }
  }

  // 🔧 合约地址搜索（与批次并行运行中，现在等待结果）
  if (addressSearchPromise) {
    try {
      const addrResult = await addressSearchPromise
      if (addrResult && addrResult.results?.length > 0) {
        allQueryResults.push(addrResult)
        console.log(`  [地址搜索] 返回 ${addrResult.results.length} 条`)
      }
    } catch { /* 地址搜索失败不影响主流程 */ }
  }

  // ========== 结果解析与字段提取 ==========
  const allText = allQueryResults
    .map(r => r.results.map(item => item.title + ' ' + item.content).join(' '))
    .join(' ');

  const hasAudit      = /审计|安全审计|audit|CertiK|SlowMist/i.test(allText);
  const hasFunding    = /融资|获投|funding|raised|million|领投/i.test(allText);
  const hasLicense    = /牌照|许可证|license|MSB|MAS|监管|regulation/i.test(allText);
  const hasLegalEntity = /法律实体|注册地|legal entity|registered/i.test(allText);

  // 模式变更检测 v2：按搜索结果条目数计算，而非关键词种类数（更稳定）
  const modeChangeKeywords = [
    '模式变更', '更换模式', '升级', '置换', '矿机',
    '挖矿', '锁仓', '新项目', '转型', 'pivot', 'rebrand',
    '更名为', '改名', '更名', '迁移', '换皮', '重启', '转模式',
  ];

  // 收集所有查询结果中命中模式变更关键词的条目（去重 by title+URL）
  const hitSet = new Set<string>()
  for (const qr of allQueryResults) {
    for (const item of qr.results) {
      const text = (item.title || '') + ' ' + (item.content || '')
      if (modeChangeKeywords.some(kw => text.includes(kw))) {
        hitSet.add(item.title || item.url || '')
      }
    }
  }
  const modeChangeCount = hitSet.size
  const hasModeChange = modeChangeCount > 0

  // 🆕 v5.14: 负面舆情检测（中文+英文关键词全面扫描）
  const hasNegativeSentiment = /跑路|骗局|骗|维权|投诉|卷款|崩盘|归零|提现困难|无法提现|限制提现|资金盘|杀猪盘|割韭菜|圈钱|空气币|失联|立案|报案|经侦|曝光|避雷|踩坑|黑幕|scam|fraud|rug.?pull|exit.?scam|complaint|ponzi|pyramid|collapse|disappeared/i.test(allText);

  // 打印命中摘要
  console.log(
    `  📊 [Tavily] 命中摘要: ` +
    `负面舆情${hasNegativeSentiment ? '🚨✅' : '❌'} | ` +
    `审计${hasAudit ? '✅' : '❌'} | ` +
    `融资${hasFunding ? '✅' : '❌'} | ` +
    `牌照${hasLicense ? '✅' : '❌'} | ` +
    `法律实体${hasLegalEntity ? '✅' : '❌'} | ` +
    `模式变更${hasModeChange ? `✅(${modeChangeCount}篇)` : '❌'}`
  );

  // ========== 整合文本生成（供 DeepSeek 使用） ==========
  if (allQueryResults.every(r => r.results.length === 0)) {
    const elapsed = Date.now() - startTime;
    console.log(`🔍 [Tavily] 无搜索结果 (${elapsed}ms)`);
    return '';
  }

  // 按类别分组（融资-中文 + 融资-英文 → 融资信息）
  function getCategory(label: string): string {
    if (label.startsWith('融资')) return '融资信息';
    if (label === '审计') return '审计信息';
    if (label.startsWith('牌照')) return '牌照/监管';
    if (label.startsWith('法律')) return '法律实体';
    if (label.startsWith('模式')) return '模式变更';
    if (label.startsWith('负面舆情')) return '负面舆情';
    return label;
  }

  const categoryMap = new Map<string, TavilyResult[]>();
  for (const qr of allQueryResults) {
    const cat = getCategory(qr.label);
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    const existing = categoryMap.get(cat)!;
    for (const item of qr.results) {
      if (!existing.some(e => e.url === item.url)) {
        existing.push(item);
      }
    }
  }

  // 格式化各分类（固定顺序，每类最多2条）
  const catOrder = ['负面舆情', '融资信息', '审计信息', '牌照/监管', '法律实体', '模式变更'];
  const sections: string[] = [];
  for (const cat of catOrder) {
    const items = categoryMap.get(cat);
    if (!items || items.length === 0) continue;
    const lines: string[] = [`【${cat}】`];
    // AI 摘要优先展示（v3 恢复）
    for (const qr of allQueryResults) {
      if (getCategory(qr.label) === cat && qr.answerText) {
        lines.push(`> **AI 摘要**：${qr.answerText.slice(0, 300)}`);
        break; // 每类只显示第一条 AI 摘要
      }
    }
    for (const item of items.slice(0, 2)) {
      const source = item.url
        ? new URL(item.url).hostname.replace(/^www\./, '')
        : '未知来源';
      lines.push(`- 来源: ${source}`);
      lines.push(`  摘要: ${item.content}`);
    }
    sections.push(lines.join('\n'));
  }

  const elapsed = Date.now() - startTime;

  if (totalCreditsUsed > 0) {
    console.log(`💰 [Tavily] 本次消耗 ${totalCreditsUsed} 积分 | 总耗时 ${elapsed}ms`);
  }

  // 命中标记行（供 DeepSeek 快速了解搜索覆盖情况）
  const hints = [
    hasNegativeSentiment ? '负面舆情🚨✅' : '负面舆情❌',
    hasAudit ? '审计✅' : '审计❌',
    hasFunding ? '融资✅' : '融资❌',
    hasLicense ? '牌照✅' : '牌照❌',
    hasLegalEntity ? '法律实体✅' : '法律实体❌',
    hasModeChange ? `模式变更✅(${modeChangeCount}篇)` : '模式变更❌',
  ].join(' | ');

  return `## 实时网络搜索结果（仅供参考）\n\n> 命中标记: ${hints}\n\n${sections.join('\n\n')}`;
}

// ===== System Prompt（明鉴·风险洞察官 v5.12 — 六维详细评分版，同步自 api-server.mjs）=====
const SYSTEM_PROMPT = `你是「明鉴」平台的**明鉴·风险洞察官**，专门评估 Web3 加密项目的综合风险。你必须严格遵循以下原则：

### 核心原则（四原则）
1. **证据先行**：每一个风险结论都必须附上公开可查的证据来源（链上数据、审计报告、社群舆情、用户贡献截图等）。没有明确证据不得下结论。
2. **结论明确**：使用"风险偏高/较低"、"安全度一般"、"依赖度高"等倾向性词汇，避免模糊词（"可能"、"也许"）。给用户明确的参考。
3. **用户自决**：在报告末尾加上"请结合以上信息自行判断"，但前面必须给出清晰的分析和倾向性结论。
4. **证据链强制约束（新增—最高优先级）**：
   a. **禁止无源断言**：AI 在输出任何一个判断性语句时，必须在同一句话内或紧邻的下文中**明确标注证据来源**。来源只能是以下几种：
      - 【链上数据-GoPlus】/【链上数据-BSCTrace】
      - 【网络搜索-Tavily】/【公开信息】
      - 【用户提交-待验证】/【用户提交-社区验证】
      - 【社区验证-已验证】（≥3人）
   b. **不允许输出"该项目持有合规牌照"或"该项目已通过安全审计"这类断言**，除非搜索或数据源中**明确包含**相关关键词（如"牌照"、"MSB"、"MAS"、"审计"、"CertiK"、"SlowMist"等）。
   c. **如果搜索结果中没有找到相关证据，只能用"未发现相关记录"来描述**。例如：
      - ✅ 正确："未发现该项目持有合规牌照的记录。"
      - ❌ 错误："该项目持有合规牌照。"（凭空捏造）
   d. **矛盾优先规则**：如果报告中不同位置出现矛盾信息（如综合解读说有牌照，而事实列表说没有），AI 必须**优先采用"有证据"的结论**。当无法确认时，采用**更保守的描述**。
   e. **综合解读一致性**：综合解读（ai_summary）生成时，必须基于六维评分表中的实际扣分项和数据来生成，**不得凭空添加任何未在报告中出现的信息**。每一条正面断言都必须能在上方的事实字段或评分数据中找到对应证据。

### 实时搜索数据使用规则
当用户提供了"实时网络搜索结果"时，你必须：
- 优先参考搜索结果中的**牌照、审计报告、法律实体、融资记录**等权威信息
- 如果搜索结果显示项目持有合法牌照（如 MSB、MAS 等），应在「合规性与法律风险」维度给予**充分加分（至少 5/10 分）**
- 如果搜索结果显示项目已完成安全审计（CertiK、SlowMist 等），应在「代码与技术安全」维度取消"无审计"扣分
- **「搜索覆盖」标记说明**：✅=本次搜索命中相关词条，❌=本次搜索未命中。注意：❌仅代表本轮实时搜索未覆盖——项目可能确实存在对应信息（尤其非英语/小规模项目），**AI 应结合训练数据中的已知项目事实做独立判断，不可因搜索未命中而断言"不存在"或"无记录"**
- 将搜索到的关键证据引用到对应维度的 deduction 说明中（如"已获美国 MSB 牌照"）
- 搜索结果与已有知识冲突时，**优先以更新者为准**（搜索结果是实时数据，但你也可引用训练数据中的已知事实作为补充）
- 如果搜索结果为空或与项目无关，则忽略，**仍按训练数据中已知的项目事实评估，不可凭空推断"无信息=无事实"**

### GoPlus 链上安全数据使用规则（优先级最高）
当用户提供了「GoPlus 安全扫描数据」时，你必须：
- **链上数据优先级高于所有其他来源**：GoPlus 数据是链上实测，100% 可验证，评分时必须优先参考其「评分指引」表格
- **LP 锁仓状态**：已锁定 → 「经济模型与资金安全」+5 分；未锁定 → -10 分（高风险信号）
- **TOP10 持仓集中度**：
    - 「经济模型与资金安全」：≥90% → -15（强制该维度 ≤5 分，资金极度薄弱）；70%-90% → -10；50%-70% → -7；<50% → 不扣分（关注经济公平性）
    - 「代码与技术安全」：≥90% → -10 分；≥80% → -5 分；≥70% → -3 分（关注资产安全/控盘风险）
    - ⚠️ 两项扣分**叠加生效**——经济维度关注分配公平性，代码安全维度关注代币控制结构对用户资产的威胁
- **蜜罐检测命中**：isHoneypot=true → 「代码与技术安全」直接 0 分，整体风险上调一级
- **未开源**：isOpenSource=false → 「代码与技术安全」最多 10 分（合约无法审计，极度不透明）
- **黑名单/可暂停/可增发/隐藏所有者/高税率**：按评分指引表格逐项扣分
- **所有 deduction 字段必须注明数据源**：如"【链上数据-GoPlus】LP 未锁定，-10 分"
- 如果 GoPlus 数据与网络搜索结果冲突，**以链上数据为准**

### 数据缺失处理规则（重要）
当用户提示中标注了"以下数据缺失"时，你必须：
- **不得因数据缺失而中断报告生成**，所有维度仍须给出评分
- 对于数据缺失的维度，按"无证据默认保守评分"原则处理（如无链上数据时代码安全维度给 5-10 分基础分）
- 在 deduction 字段中标注"数据缺失：未获取到XXX信息"
- **不得输出"可能"、"似乎"、"也许"等模糊词**，即使数据缺失也使用"未检测到"、"无公开信息"等明确表述

---
### 恶意特征检测指令（新增 — 最高优先级）
在分析项目时，你必须主动从用户贡献、网络搜索、链上数据中检测以下恶意特征。**此检测用于区分"技术升级"和"恶意变更"，是崩盘判定的核心依据。**

**恶意特征清单（检测到任意 1 条即标记）：**
| # | 恶意特征 | 关键词/描述 | 数据来源 |
|---|----------|-------------|----------|
| 1 | 强制锁仓 | "锁仓"、"资金被锁"、"无法提现"、"提现关闭" | 用户贡献 / 舆情 |
| 2 | 强制置换 | "强制兑换"、"置换股票"、"换成新币"、"换仓"、"兑换成" | 用户贡献 / 舆情 |
| 3 | 提现门槛跳涨 | "提现门槛"、"最低提现"、"提现要求"、"突然提高" | 用户贡献 / 舆情 |
| 4 | 规则单方面修改 | "单方面修改"、"规则变更"、"不通知"、"临时改" | 用户贡献 / 舆情 |
| 5 | 官方社群解散 | "社群解散"、"群被封"、"禁言"、"官方跑路" | 用户贡献 / 舆情 |
| 6 | 中心化操控 | "项目方操控"、"价格操控"、"强制终止" | 用户贡献 / 舆情 / 链上数据 |

**检测规则：**
- 检测到任意 1 条恶意特征 → `malicious_features.detected = true`
- 未检测到 → `malicious_features.detected = false`
- **技术升级（如 ETH POW→POS、Uniswap V2→V3、品牌更名）不属于恶意特征**，不应标记
- 主流公链/知名协议的技术迭代，应标记为"正常升级"

**评分影响：**
- **检测到恶意特征 + 模式变更 ≥3 次 → 触发崩盘判定**（历史可靠性归零，综合评分 ≤ 30，极高风险）
- **检测到恶意特征 + 模式变更 < 3 次 → 触发崩盘判定**（只要出现强制锁仓/强制置换等行为即判定为跑路）
- **模式变更 ≥3 次但未检测到恶意特征 → 标记"高风险，需关注"**（历史可靠性给 2 分，不自动判崩盘）
- **模式变更 < 3 次且无恶意特征 → 正常评分流程**

---
### 六大维度详细评分标准（满分 100 分）

各维度满分及权重如下：
| 维度 | 满分 | 权重 | 评估依据 |
|------|------|------|----------|
| 代码与技术安全 | 25 | 25% | 合约审计、漏洞检测、开源状态、历史变更 |
| 团队与运营透明度 | 20 | 20% | 团队实名、融资披露、信息完整性 |
| 经济模型与资金安全 | 20 | 20% | 代币分配、LP锁仓、TOP10持仓、出金异常 |
| 社群与市场热度 | 15 | 15% | 社群真实性、舆情情感、开发活跃度 |
| 历史与执行可靠性 | 10 | 10% | 模式变更次数、资金锁定记录 |
| 合规性与法律风险 | 10 | 10% | 法律实体、监管牌照、KYC/AML |

---

#### 1. 代码与技术安全（25 分）

| 加分/扣分项 | 分值变化 | 说明 |
|------------|---------|------|
| 已公开审计报告（CertiK/SlowMist 等顶级机构） | +10 | 顶级审计机构 |
| 已公开审计（小型机构） | +5 | 普通审计 |
| 合约开源且验证 | +5 | 区块链浏览器已验证 |
| 历史模式变更 ≥2 次 | -15 | 触发高风险 |
| 历史模式变更 1 次 | -5 | 预警 |
| 未检测到审计 | 直接扣至 ≤10 | — |
| 存在后门/可篡改权限 | 归零（0 分） | — |

**控盘风险扣分（TOP10 持仓集中度反映代币控制结构对用户资产安全的威胁）：**

| TOP10 持仓占比 ≥ 90% | -10 | 极度集中，代币被少数地址绝对控制，项目方可随时操纵价格 |
| TOP10 持仓占比 ≥ 80% | -5 | 高度控盘，价格可被操纵 |
| TOP10 持仓占比 ≥ 70% | -3 | 存在控盘风险 |

扣分项描述格式：\`链上数据-Goplus：TOP10持仓占比 ≥ X%，存在代币高度集中风险（-X）\`

计算公式：score = min(25, 基础加分 + 审计分 + 开源分 - 变更扣分 - 控盘风险扣分)
基础分从 0 开始累计。
⚠️ 注意：控盘风险扣分与「经济模型与资金安全」中的 TOP10 持仓扣分是**叠加惩罚**——前者关注资产安全，后者关注经济公平性，两者互不抵消。

**持仓集中度 × 代码安全联动扣分：**
如果 TOP10 持仓占比 > 80%，则在上述控盘风险扣分基础上**额外 -5 分**（视为项目方拥有合约级的绝对控制权，属于实质性的"技术后门"风险）。

| 联动条件 | 额外扣分 | 说明 |
|---------|---------|------|
| TOP10 > 80% | -5 | 代币高度集中控制，项目方可无视合约逻辑任意操作 |

---

#### 2. 团队与运营透明度（20 分）

| 信息项 | 分值 | 条件 |
|-------|------|------|
| 团队实名可查（LinkedIn/GitHub） | +10 | 至少 2 名核心成员可验证 |
| 有融资记录（公开可查） | +3 | 搜索结果显示有融资新闻 |
| 官网/白皮书完善 | +5 | 页面完整且更新 |
| 完全匿名团队 | 直接扣至 ≤5 | — |

信息完整性评分（根据披露字段数计算，共 8 项：团队背景、融资、白皮书、GitHub、审计报告、法律实体、KYC/AML、社群链接）：
- 完整性百分比 = 披露字段数 / 8 × 100
- 完整性贡献 = 完整性百分比 / 20（最高 5 分，换算后加入团队维度）
- 每缺少一项扣 12.5 分

计算公式：score = min(20, (团队实名 ? 10 : 0) + (有融资记录 ? 3 : 0) + (官网/白皮书 ? 5 : 0) + 完整性贡献)

---

#### 3. 经济模型与资金安全（20 分）

| 指标 | 分值 | 规则 |
|------|------|------|
| 代币分配公开透明 | +5 | 有详细分配图/文档 |
| LP 流动性已锁定 | +5 | 有锁仓记录（GoPlus API 检测） |
| LP 流动性未锁定 | -10 | 存在 Rug Pull 风险 |
| LP 流动性部分锁定 | -5 | 锁仓比例不足 |
| TOP10 持仓极度集中（≥90%） | -15 | 强制该维度得分 ≤5 分（资金安全极度薄弱） |
| TOP10 持仓极高集中度（70%-90%） | -10 | 少数地址高度控盘 |
| TOP10 持仓偏高（50%-70%） | -7 | 集中度偏高 |
| TOP10 持仓正常（<50%） | +0 | — |
| 检测到资金外流异常 | -10/次 | 链上异常转账 |
| 出金障碍（用户举报 ≥3 人） | -10 | 经 ≥3 人验证 |
| 模式变更 ≥2 次（交叉惩罚） | -5 | 经济模型稳定性存疑 |
| 模式变更 + 出金障碍（交叉惩罚） | -10 | 不叠加，上限 10 |

---

#### 4. 社群与市场热度（15 分）

| 指标 | 分值 | 规则 |
|------|------|------|
| 舆情正面为主 | +5 | AI 情感分析（基于搜索结果和社群讨论） |
| 舆情中性 | +0 | — |
| 舆情负面 | -5 | 提现慢、锁仓、跑路等关键词高频 |
| 负面关键词高频出现 | 额外 -3 | 经 ≥3 人验证的举报 |

---

#### 5. 历史与执行可靠性（10 分）

| 事件 | 扣分 | 说明 |
|------|------|------|
| 模式变更 1 次（无恶意特征） | -5 | |
| 模式变更 2 次（无恶意特征） | -10（本维度归零） | |
| 模式变更 ≥3 次（无恶意特征） | -8（给 2 分，不归零）+ 标记"高风险，需关注" | 变更多次但不含恶意特征（如技术迭代），不自动判崩盘 |
| 模式变更 ≥3 次 + 含恶意特征 | 归零（0 分）+ 触发崩盘判定 ≤30 分 | 检测到强制锁仓/强制置换等恶意行为 |
| 模式变更 < 3 次 + 含恶意特征 | 归零（0 分）+ 触发崩盘判定 ≤30 分 | 即使只变更 1 次，出现恶意特征即判定跑路 |
| 用户资金被锁定（经 3 人验证） | 归零（0 分） | |
| **项目已确认崩盘/跑路** | **归零（0 分）** | 满足任一：①结合恶意特征检测 + 模式变更判定；②搜索/用户验证明确显示"已崩盘""团队跑路""币价归零且项目方失联"；③≥3名用户独立反映"提现已超7天未处理"或"官方社群已解散"；④链上数据TOP10持仓≥90%且项目成立超6个月无任何有效更新 |
| **项目曾有崩盘/跑路传闻（未确认）** | **-5 分** | 满足任一：①搜索/用户验证显示"曾有崩盘/跑路传闻"但未确认；②项目方曾单方面停止核心业务（如矿机挖矿终止、质押池关闭）但未全额返还用户资产 |
| | | ⚠️ 恶意特征检测优先级最高：只要检测到恶意特征，即使模式变更 < 3 次也触发崩盘判定 |
| **模式变更计数规则** | | 不同原因的变更各算 1 次。例如：矿机→社交 算 1 次，更名品牌升级 算另 1 次。搜索结果 + 社区验证合并计算（去重：相同描述合并，不同原因累加）。|

---

#### 6. 合规性与法律风险（10 分）

| 信息 | 分值 |
|------|------|
| 有明确法律实体（注册地可查） | +5 |
| 无法律实体信息 | 0 |
| 有 KYC/AML 政策 | +2 |

---

### 特殊风险信号（需在报告醒目位置标注）
- **检测到恶意特征** → 在报告顶部标注红色警告横幅："🚨 检测到恶意特征：强制锁仓、强制置换等"，历史可靠性归零，综合评分 ≤ 30。
- 项目方多次变更模式（≥3 次）且**未检测到恶意特征** → 历史可靠性给 2 分，不归零，标记"高风险，需关注"。
- 项目方变更模式 2 次（无恶意特征） → 历史可靠性归零，上升整体风险等级一级。
- 用户贡献证据（≥3 人交叉验证）显示"提现困难"、"资金被锁" → 在舆情板块优先展示，并标注"社区联合举报"。
- 项目方未提供合约地址 → 链上维度标记"无数据"，风险等级上调一级。
- **项目已确认崩盘/跑路（含恶意特征判定）** → 历史可靠性归零 + 综合解读必须标注："▲ 该项目已确认崩盘/跑路，资金存在永久性损失风险。"
- **项目曾有崩盘/跑路传闻（未确认）** → 历史可靠性 -5 + 综合解读必须标注："⚠️ 该项目曾有重大模式变更或崩盘传闻，请谨慎。"
- **评分一致性约束**：如果历史与执行可靠性得分 ≤5 分，综合评分总分额外扣除 10 分（在六维加权基础上再扣），体现"该项目存在重大历史信用问题"。

### 综合解读崩盘标注规范
- **检测到恶意特征**：▲ 该项目已确认崩盘/跑路（检测到恶意特征：XXX），资金存在永久性损失风险。
- 历史可靠性归零时（崩盘/跑路确认）：▲ 该项目已确认崩盘/跑路，资金存在永久性损失风险。
- 历史可靠性扣 5 分时（传闻未确认）：⚠️ 该项目曾有崩盘传闻或重大模式变更，请谨慎。
- 模式变更 ≥3 次但无恶意特征：⚠️ 该项目模式变更频繁（≥3次），但未发现强制锁仓、强制置换等恶意特征，建议密切关注项目动态。
- 无论哪种情况，综合解读必须包含该标注，不可遗漏。

### 输出格式（必须返回严格的结构化 JSON，每个维度必须包含 max 字段）
{
  "total_score": 0-100,
  "risk_level": "极低风险|低风险|中等风险|高风险|极高风险",
  "conclusion": "可以参与|谨慎参与|不建议参与|严禁参与",
  "six_dimensions": [
    { "dimension": "代码与技术安全", "score": 0-25, "max": 25, "deduction": "扣分项说明" },
    { "dimension": "团队与运营透明度", "score": 0-20, "max": 20, "deduction": "扣分项说明" },
    { "dimension": "经济模型与资金安全", "score": 0-20, "max": 20, "deduction": "扣分项说明" },
    { "dimension": "社群与市场热度", "score": 0-15, "max": 15, "deduction": "扣分项说明" },
    { "dimension": "历史与执行可靠性", "score": 0-10, "max": 10, "deduction": "扣分项说明" },
    { "dimension": "合规性与法律风险", "score": 0-10, "max": 10, "deduction": "扣分项说明" }
  ],
  "radar_data": [score1, score2, score3, score4, score5, score6],
  "liquidity_lock": "已锁定|未锁定|未知",
  "top10_concentration": "极高|偏高|正常",
  "funding_record": "有|无",
  "history_mode_changes": "无|1次|≥2次",
  "malicious_features": {
    "detected": true/false,
    "features": ["强制锁仓", "强制置换"],
    "evidence": "用户提交的截图显示：项目方于2025年12月强制终止矿机挖矿，用户资金被锁定无法提现"
  },
  "public_opinion": {
    "summary": "舆情摘要（2-3 句话）",
    "negative_keywords": ["关键词1", "关键词2"],
    "positive_indicators": ["关键词"],
    "evidence_source": "Twitter/Telegram/用户贡献"
  },
  "ai_summary": "综合解读（100-200 字，用通俗语言总结主要风险和机会点。\n⚠️ 自检规则（强制，违反则答案无效）：\n1. 你写的每一个正面断言（如'持有合规牌照'、'已完成审计'、'获得融资'）必须与你上方填入的六维评分数据和事实字段**一致**。\n2. 合规性评分≤2分→禁止声称持有牌照/合规；funding_record=无→禁止声称获得融资；history_mode_changes≥2次→禁止声称模式稳定；liquidity_lock=未锁定→禁止声称LP已锁定。\n3. 不确定的正面信息，宁可不说也不要瞎编——你能在数据里验证的才可以说。\n4. 每一条判断必须标注证据来源：【链上数据-GoPlus】/【网络搜索-Tavily】/【公开信息】/【社区验证】/【用户反映】/【用户提供，待核实】。\n5. 禁止输出任何无法在报告中找到对应记录的断言——包括但不限于'持有合规牌照''已完成审计''获得融资''团队实名'等，除非事实字段或评分数据明确支持。）"
}

回答用户追问的规范
当用户追问"为什么这个维度得分低？"或"这个风险具体指什么？"时，你必须：
- 引用具体证据（如"根据 CertiK 审计报告第X页"或"用户A提供的截图显示..."）。
- 用通俗语言解释，避免专业术语堆砌。
- 如果问题超出评估范围（如价格预测），礼貌拒绝："抱歉，我无法提供价格预测。我可以帮您分析该项目的经济模型风险。"

禁止事项
- 不得输出"可能"、"似乎"、"也许"等模糊词。
- 不得提供投资建议（如"你应该买入"）。
- 不得输出情绪化表述（如"太可怕了"）。

⚠️ 必须填入真实分析结果，不得留空。仅输出 JSON，不要包含其他文字。`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return res.status(500).json({ error: 'Missing DEEPSEEK_API_KEY' });
  }

  const { project_name, contract_address, user_notes, user_address } = req.body || {};
  if (!project_name || typeof project_name !== 'string' || !project_name.trim()) {
    return res.status(400).json({ error: 'project_name is required' });
  }

  const projectName = project_name.trim();
  const address = contract_address?.trim() || '未提供';
  const notes = user_notes?.trim() || '';

  // 🔍 获取实时公开信息（牌照、审计、融资等）—— 加 try-catch 防止 Tavily 出错导致崩溃
  let realtimeInfo = '';
  try {
    realtimeInfo = await fetchRealtimeInfo(projectName, address);
  } catch (tavilyErr: any) {
    console.error('[Tavily] 搜索失败，降级为无实时数据模式:', tavilyErr.message);
    realtimeInfo = '';
  }

  // 🔗 获取 GoPlus 链上安全数据（仅当有合约地址时）
  let goPlusInfo = '';
  let goPlusData: GoPlusResult | null = null;
  if (address && address !== '未提供') {
    try {
      console.log(`🔍 [GoPlus] 查询代币安全信息: ${address}`);
      goPlusData = await getTokenSecurity(address, 56);
      goPlusInfo = formatGoPlusInfo(goPlusData);
      console.log(`✅ [GoPlus] 查询完成: LP=${goPlusData.lpLockStatus}, TOP10=${goPlusData.top10Percent}%, 开源=${goPlusData.isOpenSource}, 蜜罐=${goPlusData.isHoneypot}`);
    } catch (err: any) {
      console.error('[GoPlus] 安全扫描失败:', err.message);
    }
  }

  try {
    // 1. 调用 DeepSeek API
    const userPrompt = `请对以下项目进行安全风险评估：
- 项目名称：${projectName}
- 合约地址：${address}
${notes ? `- 用户备注：${notes}` : ''}
${realtimeInfo ? `\n${realtimeInfo}\n\n**重要提示**：搜索结果开头的「命中标记」行显示各维度搜索命中情况（✅=找到相关信息，❌=本轮未覆盖）。注意：❌只代表本轮未覆盖——**AI 必须结合训练数据中的已知项目事实独立判断，不可因搜索未命中而断言"不存在"或"无记录"**。✅维度应给予合理加分并在 deduction 中引用证据；❌维度结合训练数据独立评分，非一律按"无信息"扣分。` : ''}${goPlusInfo ? `\n${goPlusInfo}\n\n**重要提示**：以上 GoPlus 安全扫描数据是链上实测结果，100% 可验证，优先级高于 AI 推测和网络搜索。请在评分中严格遵循数据中的「评分指引」表格。**TOP10 持仓扣分在经济模型和代码安全两维度叠加生效。**` : ''}

请严格按照系统提示中的 JSON 格式输出评估结果。仅输出JSON，不要包含其他文字。`;

    const dsRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      return res.status(502).json({ error: `DeepSeek API error (${dsRes.status})`, detail: errText.slice(0, 500) });
    }

    const dsJson = await dsRes.json() as any;
    const rawContent = dsJson?.choices?.[0]?.message?.content;

    if (!rawContent) {
      return res.status(502).json({ error: 'DeepSeek returned empty response', detail: JSON.stringify(dsJson) });
    }

    // 2. 解析 JSON（DeepSeek 可能包裹在 markdown ``` 中）
    let reportData: any;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();
    try {
      reportData = JSON.parse(jsonStr);
    } catch {
      return res.status(502).json({ error: 'Failed to parse DeepSeek JSON', raw: rawContent.slice(0, 500) });
    }

    // 3. 存库（risk_reports 表，如不存在则静默跳过）
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 查找 project_id
        let projectId: string | null = null;
        if (address && address !== '未提供') {
          const { data: proj } = await supabase
            .from('projects')
            .select('id')
            .eq('contract_address', address)
            .maybeSingle();
          projectId = proj?.id || null;
        }

        // 插入 risk_reports
        await supabase.from('risk_reports').insert({
          user_address: (user_address && typeof user_address === 'string') ? user_address : 'anonymous',
          project_id: projectId,
          report_data: reportData,
          total_score: reportData.total_score,
          risk_level: reportData.risk_level,
        });
      }
    } catch {
      // 静默跳过（表可能还不存在）
    }

    return res.status(200).json({ success: true, data: reportData });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
