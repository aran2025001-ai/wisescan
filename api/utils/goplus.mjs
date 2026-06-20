// api/utils/goplus.mjs
// GoPlus Security API — 免费代币安全检测（支持 BSC/ETH 等多链）
// 官方文档：https://docs.gopluslabs.io/reference/tokensecurityusingget_1.md
// 无需 API Key，免费调用（有限速，建议每个地址缓存结果）
//
// 更新日志：
// 2026-06-15 v2：补充 is_anti_whale、creator/owner、tax、mintable、proxy 等完整安全字段
//                    注：GoPlus Token Security API 不提供 audit_info 字段（已查文档确认）

const GOPLUS_BASE = 'https://api.gopluslabs.io/api/v1';

/**
 * 支持的链 ID 映射
 */
export const CHAIN_ID = {
  bsc: 56,
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114,
  base: 8453,
};

/**
 * 安全地将字符串 "1"/"0" 转为 boolean | null
 */
function parseFlag(val) {
  if (val === '1' || val === 1) return true;
  if (val === '0' || val === 0) return false;
  return null;
}

/**
 * 安全地将字符串数值转为数字
 */
function parseNum(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

/**
 * 判断地址是否为销毁/空地址
 */
function isBurnAddress(addr) {
  if (!addr) return false;
  const lower = addr.toLowerCase();
  return lower === '0x0000000000000000000000000000000000000000'
    || lower === '0x0000000000000000000000000000000000000001'
    || lower === '0x000000000000000000000000000000000000dead'
    || /^0x0{40}$/.test(lower);
}

/**
 * 查询代币安全信息（完整版 v2）
 *
 * @param {string} contractAddress - 代币合约地址
 * @param {number} chainId - 链 ID（默认 56 = BSC）
 * @returns {Promise<GoPlusResult>}
 */
export async function getTokenSecurity(contractAddress, chainId = 56) {
  // ⚠️ 参数名必须是 contract_addresses（复数），contract_address（单数）返回 2007 错误
  const url = `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${contractAddress}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[GoPlus] HTTP ${res.status} for ${contractAddress}`);
      return emptyResult();
    }

    const data = await res.json();

    // GoPlus 返回格式：{ code: 1, message: "OK", result: { "<lowercase_addr>": { ... } } }
    if (data.code !== 1) {
      console.warn(`[GoPlus] API code=${data.code}, message=${data.message} for ${contractAddress}`);
      return emptyResult();
    }

    // 结果以地址（小写）为 key
    const addrKey = contractAddress.toLowerCase();
    const result = data.result?.[addrKey];

    if (!result || Object.keys(result).length === 0) {
      console.warn(`[GoPlus] 未找到结果: ${contractAddress}`);
      return emptyResult();
    }

    // ─── LP 锁仓状态 ───────────────────────────────────────
    let lpLockStatus = '未知';
    let lpLockInfo = null;
    let lpOwnerAddress = null;
    let lpOwnerPercent = null;
    const rawLpHolders = [];

    if (Array.isArray(result.lp_holders) && result.lp_holders.length > 0) {
      let hasLocked = false;
      let hasUnlocked = false;
      const lockDetails = [];

      // 找到最大 LP 持有者（通常是主 DEX pair）
      let maxPercent = 0;
      let mainLpHolder = null;

      for (const h of result.lp_holders) {
        const isLocked = h.is_locked === 1 || h.is_locked === '1';
        const hasLockDetail = Array.isArray(h.locked_detail) && h.locked_detail.length > 0;
        const hasNFT = Array.isArray(h.NFT_list) && h.NFT_list.length > 0;

        const pct = parseNum(h.percent) || 0;

        rawLpHolders.push({
          address: h.address || '',
          tag: h.tag || '',
          percent: h.percent || '0',
          isLocked: isLocked || hasLockDetail || hasNFT,
          lockedDetail: h.locked_detail || null,
        });

        if (isLocked || hasLockDetail || hasNFT) {
          hasLocked = true;
          if (h.locked_detail) lockDetails.push(...h.locked_detail);
        } else {
          hasUnlocked = true;
        }

        // 跟踪最大 LP 持有者（即主 DEX pair 地址）
        if (pct > maxPercent && !isBurnAddress(h.address)) {
          maxPercent = pct;
          mainLpHolder = h;
        }
      }

      // 提取主 LP 持有者信息
      if (mainLpHolder) {
        lpOwnerAddress = mainLpHolder.address || null;
        lpOwnerPercent = mainLpHolder.percent || null;
      }

      if (hasLocked) {
        lpLockStatus = '已锁定';
        lpLockInfo = lockDetails.length > 0
          ? lockDetails.map(d => `锁仓${d.amount || '未知量'}，解锁时间${d.end_time || '未知'}`).join('；')
          : 'LP 已锁定（详情未知）';
      } else if (hasUnlocked && !hasLocked) {
        lpLockStatus = '未锁定';
        lpLockInfo = `主 LP 持有者 ${mainLpHolder?.address?.slice(0, 10) || '未知'}... 未锁定 LP`;
      }
    }

    // ─── TOP10 持仓集中度（排除销毁地址）────────────────────
    let top10Percent = null;
    let top1Percent = null;   // TOP1 持仓占比
    if (Array.isArray(result.holders) && result.holders.length > 0) {
      const nonBurnHolders = result.holders.filter(h => !isBurnAddress(h.address));
      const source = nonBurnHolders.length > 0 ? nonBurnHolders : result.holders;
      const sum = source.reduce((acc, h) => {
        const p = parseNum(h.percent);
        return acc + (isNaN(p) ? 0 : p);
      }, 0);
      top10Percent = sum * 100; // 小数→百分比

      // TOP1 持仓占比（排除销毁地址后排名第一的地址）
      const top1 = source[0];
      top1Percent = (top1 && !isNaN(parseNum(top1.percent))) ? parseNum(top1.percent) * 100 : null;
    }

    // ─── 核心安全字段 ─────────────────────────────────────
    const isOpenSource   = parseFlag(result.is_open_source);
    const isHoneypot     = parseFlag(result.is_honeypot);
    const isAntiWhale    = parseFlag(result.is_anti_whale);    // 新增
    const isBlacklisted  = parseFlag(result.is_blacklisted);
    const isMintable     = parseFlag(result.is_mintable);      // 新增：可增发
    const isProxy        = parseFlag(result.is_proxy);         // 新增：代理合约
    const hiddenOwner    = parseFlag(result.hidden_owner);     // 新增：隐藏所有者
    const canTakeBackOwnership = parseFlag(result.can_take_back_ownership); // 新增
    const transferPausable     = parseFlag(result.transfer_pausable);       // 新增
    const buyTax         = parseNum(result.buy_tax);           // 新增：买入税率
    const sellTax        = parseNum(result.sell_tax);          // 新增：卖出税率
    const slippageModifiable = parseFlag(result.slippage_modifiable);       // 新增

    // ─── 创建者/所有者信息 ─────────────────────────────────
    const creatorAddress  = result.creator_address || null;
    const creatorPercent  = parseNum(result.creator_percent);  // 小数
    const ownerAddress    = result.owner_address || null;
    const ownerPercent    = parseNum(result.owner_percent);

    // ─── 持有者统计 ───────────────────────────────────────
    const holderCount     = result.holder_count || null;
    const lpHolderCount   = result.lp_holder_count || null;

    // ─── DEX 信息 ─────────────────────────────────────────
    const dexInfo = Array.isArray(result.dex) ? result.dex.map(d => ({
      name: d.name || '',
      pair: d.pair || '',
      liquidity: d.liquidity || '0',
    })) : null;

    // ─── 信任列表 ─────────────────────────────────────────
    const isTrustToken   = parseFlag(result.trust_list);
    const otherRisks     = result.other_potential_risks || null;

    // ─── 审计信息 ─────────────────────────────────────────
    // ⚠️ GoPlus Token Security API v1 不提供 audit_info 字段（已查官方文档确认）
    // 审计数据需通过其他渠道获取（Tavily 搜索 CertiK/SlowMist 等）
    const auditInfo = null;

    // ─── 代币基本信息 ─────────────────────────────────
    const tokenName = result.token_name || null;
    const tokenSymbol = result.token_symbol || null;

    return {
      // 代币基本信息
      tokenName,
      tokenSymbol,
      // 锁仓
      lpLockStatus,
      lpLockInfo,
      lpOwnerAddress,       // 新增：主 LP 持有者地址
      lpOwnerPercent,       // 新增：主 LP 持有者占比

      // 持仓
      top10Percent,
      top1Percent,          // 新增：第一大持仓占比
      holderCount,
      lpHolderCount,        // 新增

      // 安全标志
      isOpenSource,
      isHoneypot,
      isAntiWhale,          // 新增
      isBlacklisted,
      isMintable,           // 新增
      isProxy,              // 新增
      hiddenOwner,          // 新增
      canTakeBackOwnership,  // 新增
      transferPausable,     // 新增
      isTrustToken,         // 新增

      // 税务
      buyTax,               // 新增
      sellTax,              // 新增
      slippageModifiable,   // 新增

      // 创建者/所有者
      creatorAddress,       // 新增
      creatorPercent,       // 新增
      ownerAddress,
      ownerPercent,         // 新增

      // 审计（GoPlus API 不提供，标注为 null 以区别于"未查询"）
      auditInfo,

      // 其他
      dexInfo,
      otherRisks,           // 新增
      rawLpHolders: rawLpHolders.length > 0 ? rawLpHolders : null,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[GoPlus] 查询超时: ${contractAddress}`);
    } else {
      console.error(`[GoPlus] 查询失败: ${contractAddress} —`, err.message);
    }
    return emptyResult();
  }
}

/**
 * 返回空结果（查询失败时的降级值）
 */
function emptyResult() {
  return {
    tokenName: null,
    tokenSymbol: null,
    lpLockStatus: '未知',
    lpLockInfo: null,
    lpOwnerAddress: null,
    lpOwnerPercent: null,
    top10Percent: null,
    top1Percent: null,
    holderCount: null,
    lpHolderCount: null,
    isOpenSource: null,
    isHoneypot: null,
    isAntiWhale: null,
    isBlacklisted: null,
    isMintable: null,
    isProxy: null,
    hiddenOwner: null,
    canTakeBackOwnership: null,
    transferPausable: null,
    isTrustToken: null,
    buyTax: null,
    sellTax: null,
    slippageModifiable: null,
    creatorAddress: null,
    creatorPercent: null,
    ownerAddress: null,
    ownerPercent: null,
    auditInfo: null,
    dexInfo: null,
    otherRisks: null,
    rawLpHolders: null,
  };
}

/**
 * 快捷查询：仅获取 LP 锁仓状态
 * @param {string} contractAddress
 * @param {number} chainId
 * @returns {Promise<'已锁定'|'未锁定'|'未知'>}
 */
export async function getLiquidityLockStatus(contractAddress, chainId = 56) {
  const { lpLockStatus } = await getTokenSecurity(contractAddress, chainId);
  return lpLockStatus;
}

/**
 * 快捷查询：获取 TOP10 持仓集中度百分比
 * @param {string} contractAddress
 * @param {number} chainId
 * @returns {Promise<number|null>}
 */
export async function getTop10Concentration(contractAddress, chainId = 56) {
  const { top10Percent } = await getTokenSecurity(contractAddress, chainId);
  return top10Percent;
}
