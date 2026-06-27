/**
 * 项目事实缓存（Project Ledger）
 * 
 * 两层缓存：
 *   Tier 1 — 报告缓存（完整 DeepSeek 报告，2h TTL）
 *   Tier 2 — 事实缓存（已确认客观事实，永不过期，只增不减）
 * 
 * 存储：Supabase project_facts 表（主），本地 JSON 文件（fallback）
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== 配置 =====
const REPORT_CACHE_TTL_MS = 2 * 60 * 60 * 1000;  // 2 小时
const LOCAL_CACHE_PATH = join(__dirname, '..', '..', '.workbuddy', 'cache', 'project-ledger.json');

// ===== Supabase 客户端（懒加载） =====
let _supabase = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    _supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );
    return _supabase;
  } catch (e) {
    console.warn('[Ledger] Supabase 不可用，降级为本地缓存');
    return null;
  }
}

// ===== 本地缓存（fallback） =====
async function loadLocalCache() {
  try {
    if (!existsSync(LOCAL_CACHE_PATH)) return {};
    const raw = await readFile(LOCAL_CACHE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveLocalCache(data) {
  try {
    const dir = dirname(LOCAL_CACHE_PATH);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await writeFile(LOCAL_CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Ledger] 本地缓存写入失败:', e.message);
  }
}

// ===== 键标准化 =====
function normalizeKey(address) {
  return (address || '').trim().toLowerCase();
}

// ===== 启动同步：Supabase → 本地缓存 =====

/**
 * 启动时将 Supabase project_facts 全量同步到本地 JSON
 * Supabase 是主数据源，本地是 fallback。此函数确保两者一致。
 * - Supabase 有且本地无 → 写入本地
 * - Supabase 有且本地有 → Supabase 版本覆盖（主数据源优先）
 * - 本地有且 Supabase 无 → 保留（可能是新项目尚未同步到 Supabase）
 */
export async function syncLocalCacheFromSupabase() {
  const supabase = await getSupabase();
  if (!supabase) {
    console.log('🔌 [Ledger] Supabase 不可用，跳过本地同步');
    return;
  }

  try {
    const { data: rows, error } = await supabase
      .from('project_facts')
      .select('*');

    if (error) {
      console.warn('[Ledger] 同步失败(Supabase查询):', error.message);
      return;
    }

    if (!rows?.length) {
      console.log('📭 [Ledger] project_facts 为空，跳过同步');
      return;
    }

    const local = await loadLocalCache();
    let synced = 0;

    for (const row of rows) {
      const key = normalizeKey(row.contract_address);
      if (!key) continue;

      const facts = dbRowToFacts(row);

      // 构建本地条目：保留已有字段，用 Supabase 数据覆盖
      const entry = local[key] || {};
      entry.facts = facts;
      entry.projectName = row.project_name || entry.projectName || '';
      entry.updatedAt = row.updated_at || entry.updatedAt || new Date().toISOString();

      // Tier1 缓存同步
      if (row.cached_report && row.cached_at) {
        entry.cachedReport = row.cached_report;
        entry.cachedAt = row.cached_at;
      }

      local[key] = entry;
      synced++;
    }

    await saveLocalCache(local);
    console.log(`🔄 [Ledger] Supabase → 本地同步完成: ${synced} 条 (Supabase: ${rows.length})`);
  } catch (e) {
    console.warn('[Ledger] 同步异常:', e.message);
  }
}

// ===== Tier 1: 报告缓存 =====

/**
 * 检查报告缓存是否命中
 * @returns {{ hit: boolean, report: object|null, cachedAt: string|null }}
 */
export async function getReportCache(contractAddress) {
  const key = normalizeKey(contractAddress);
  if (!key || key === '未提供') return { hit: false, report: null, cachedAt: null };

  // 优先 Supabase
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('project_facts')
        .select('cached_report, cached_at')
        .eq('contract_address', key)
        .maybeSingle();
      if (!error && data?.cached_report && data?.cached_at) {
        const cachedAt = new Date(data.cached_at).getTime();
        if (Date.now() - cachedAt < REPORT_CACHE_TTL_MS) {
          console.log(`📦 [Ledger] Tier1 命中 (Supabase): ${key.slice(0,10)}...`);
          return { hit: true, report: data.cached_report, cachedAt: data.cached_at };
        }
        console.log(`⏰ [Ledger] Tier1 过期 (Supabase): ${key.slice(0,10)}...`);
      }
    } catch (e) {
      console.warn('[Ledger] Tier1 Supabase 查询失败:', e.message);
    }
  }

  // 本地 fallback
  const local = await loadLocalCache();
  const entry = local[key];
  if (entry?.cachedReport && entry?.cachedAt) {
    const cachedAt = new Date(entry.cachedAt).getTime();
    if (Date.now() - cachedAt < REPORT_CACHE_TTL_MS) {
      console.log(`📦 [Ledger] Tier1 命中 (本地): ${key.slice(0,10)}...`);
      return { hit: true, report: entry.cachedReport, cachedAt: entry.cachedAt };
    }
  }
  return { hit: false, report: null, cachedAt: null };
}

/**
 * 保存报告缓存
 */
export async function setReportCache(contractAddress, reportData) {
  const key = normalizeKey(contractAddress);
  if (!key || key === '未提供') return;

  const now = new Date().toISOString();

  // Supabase
  const supabase = await getSupabase();
  if (supabase) {
    try {
      await supabase.from('project_facts').upsert({
        contract_address: key,
        cached_report: reportData,
        cached_at: now,
        last_searched_at: now,
      }, { onConflict: 'contract_address' });
      console.log(`💾 [Ledger] Tier1 已缓存 (Supabase): ${key.slice(0,10)}...`);
    } catch (e) {
      console.warn('[Ledger] Tier1 Supabase 写入失败:', e.message);
    }
  }

  // 本地 fallback
  const local = await loadLocalCache();
  local[key] = { ...(local[key] || {}), cachedReport: reportData, cachedAt: now };
  await saveLocalCache(local);
}

/**
 * 清除报告缓存（Supabase + 本地）
 * 当新证据提交后调用，确保下次报告生成重新注入证据
 */
export async function clearReportCache(contractAddress) {
  const key = normalizeKey(contractAddress);
  if (!key || key === '未提供') return;

  // Supabase
  const supabase = await getSupabase();
  if (supabase) {
    try {
      await supabase.from('project_facts').update({
        cached_report: null,
        cached_at: null,
      }).eq('contract_address', key);
      console.log(`🗑️ [Ledger] Tier1 已清除 (Supabase): ${key.slice(0,10)}...`);
    } catch (e) {
      console.warn('[Ledger] Tier1 Supabase 清除失败:', e.message);
    }
  }

  // 本地 fallback
  const local = await loadLocalCache();
  if (local[key]) {
    delete local[key].cachedReport;
    delete local[key].cachedAt;
    await saveLocalCache(local);
    console.log(`🗑️ [Ledger] Tier1 已清除 (本地): ${key.slice(0,10)}...`);
  }
}

// ===== Tier 2: 事实缓存 =====

/**
 * 空事实对象
 */
function emptyFacts() {
  return {
    modeChangeCount: 0,
    modeChangeArticles: [],
    withdrawIssueCount: 0,
    withdrawIssueEvidence: [],
    fundingRounds: [],
    audits: [],
    top10HoldingPercent: null,
    top10HoldingAt: null,
    legalEntities: [],
    hasLicense: false,
    hasAudit: false,
    hasFunding: false,
    confidenceScore: 0,
    isConfirmed: false,
    totalSearches: 0,
  };
}

/**
 * 获取 Tier 2 事实缓存
 * @returns {{ facts: object, source: 'supabase'|'local'|'none' }}
 */
export async function getFacts(contractAddress) {
  const key = normalizeKey(contractAddress);
  if (!key || key === '未提供') return { facts: emptyFacts(), source: 'none' };

  // 优先 Supabase
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('project_facts')
        .select('*')
        .eq('contract_address', key)
        .maybeSingle();
      if (!error && data) {
        console.log(`📚 [Ledger] Tier2 命中 (Supabase): ${key.slice(0,10)}... modeChangeCount=${data.mode_change_count || 0}`);
        return {
          facts: dbRowToFacts(data),
          source: 'supabase',
        };
      }
    } catch (e) {
      console.warn('[Ledger] Tier2 Supabase 查询失败:', e.message);
    }
  }

  // 本地 fallback
  const local = await loadLocalCache();
  if (local[key]?.facts) {
    console.log(`📚 [Ledger] Tier2 命中 (本地): ${key.slice(0,10)}...`);
    return { facts: local[key].facts, source: 'local' };
  }

  return { facts: emptyFacts(), source: 'none' };
}

function dbRowToFacts(row) {
  return {
    modeChangeCount: row.mode_change_count || 0,
    modeChangeArticles: row.mode_change_articles || [],
    withdrawIssueCount: row.withdraw_issue_count || 0,
    withdrawIssueEvidence: row.withdraw_issue_evidence || [],
    fundingRounds: row.funding_rounds || [],
    audits: row.audits || [],
    top10HoldingPercent: row.top10_holding_percent || null,
    top10HoldingAt: row.top10_holding_at || null,
    legalEntities: row.legal_entities || [],
    hasLicense: row.has_license || false,
    hasAudit: row.has_audit || false,
    hasFunding: row.has_funding || false,
    confidenceScore: row.confidence_score || 0,
    isConfirmed: row.is_confirmed || false,
    totalSearches: row.total_searches || 0,
    verifiedEvidence: row.verified_evidence || [],  // 🆕 社区已验证证据
    is_mode_change_confirmed: row.is_mode_change_confirmed || false,
  };
}

/**
 * 合并事实（只增不减，分类处理）
 * @param {{ facts }} existing 既有事实
 * @param {object} newSearch 新搜索结果
 * @returns {{ facts: object, merged: boolean, changes: string[] }}
 */
export function mergeFacts(existing, newSearch) {
  const merged = { ...existing };
  const changes = [];

  // ── 模式变更次数：累计去重文章数（只增不减） ──
  // ⚠️ 不再用 Math.max() — 那只能保单次最大值，不能跨次累积
  //   正确逻辑：每次搜索找到的新文章追加后，总数 = 去重后文章列表长度
  const newModeCount = Math.max(
    newSearch.modeChangeCount || 0,
    newSearch.hasModeChange ? 1 : 0
  );
  if (newModeCount > merged.modeChangeCount) {
    changes.push(`模式变更(单次搜索): ${merged.modeChangeCount} → ${newModeCount}`);
    merged.modeChangeCount = newModeCount;
  }

  // ── 模式变更文章：去重追加 ──
  if (newSearch.modeChangeArticles?.length) {
    const existingUrls = new Set(merged.modeChangeArticles.map(a => extractUrl(a)));
    let added = 0;
    for (const article of newSearch.modeChangeArticles) {
      if (!existingUrls.has(extractUrl(article))) {
        merged.modeChangeArticles.push(article);
        added++;
      }
    }
    if (added > 0) changes.push(`模式变更文章: +${added}`);
    // 🔧 v5.7: 文章去重追加后，modeChangeCount = 累计去重文章总数
    //   这样第1次搜到文章A → 1次；第2次搜到文章B → 2次（只增不减！）
    const totalUniqueArticles = merged.modeChangeArticles.length;
    if (totalUniqueArticles > merged.modeChangeCount) {
      changes.push(`模式变更(累计去重): ${merged.modeChangeCount} → ${totalUniqueArticles}`);
      merged.modeChangeCount = totalUniqueArticles;
    }
  }

  // ── 出金障碍：累加去重 ──
  if (newSearch.withdrawIssueCount > merged.withdrawIssueCount) {
    changes.push(`出金障碍: ${merged.withdrawIssueCount} → ${newSearch.withdrawIssueCount}`);
    merged.withdrawIssueCount = newSearch.withdrawIssueCount;
  }
  if (newSearch.withdrawIssueEvidence?.length) {
    const existingEv = new Set(merged.withdrawIssueEvidence.map(e => extractUrl(e)));
    let added = 0;
    for (const ev of newSearch.withdrawIssueEvidence) {
      if (!existingEv.has(extractUrl(ev))) {
        merged.withdrawIssueEvidence.push(ev);
        added++;
      }
    }
    if (added > 0) changes.push(`出金障碍证据: +${added}`);
  }

  // ── 融资记录：合并去重（按轮次/金额去重） ──
  if (newSearch.fundingRounds?.length) {
    const existingRounds = new Set(merged.fundingRounds);
    let added = 0;
    for (const round of newSearch.fundingRounds) {
      if (!existingRounds.has(round)) {
        merged.fundingRounds.push(round);
        added++;
      }
    }
    if (added > 0) changes.push(`融资轮次: +${added}`);
    if (merged.fundingRounds.length > 0) merged.hasFunding = true;
  }

  // ── 审计记录：合并去重 ──
  if (newSearch.audits?.length) {
    const existingAudits = new Set(merged.audits);
    let added = 0;
    for (const audit of newSearch.audits) {
      if (!existingAudits.has(audit)) {
        merged.audits.push(audit);
        added++;
      }
    }
    if (added > 0) changes.push(`审计: +${added}`);
    if (merged.audits.length > 0) merged.hasAudit = true;
  }

  // ── 牌照 ──
  if (newSearch.hasLicense && !merged.hasLicense) {
    changes.push('牌照: 新发现');
    merged.hasLicense = true;
  }

  // ── 法律实体：合并验证 ──
  if (newSearch.legalEntities?.length) {
    const existingLe = new Set(merged.legalEntities);
    let added = 0;
    for (const le of newSearch.legalEntities) {
      if (!existingLe.has(le)) {
        merged.legalEntities.push(le);
        added++;
      }
    }
    if (added > 0) changes.push(`法律实体: +${added}`);
  }

  // ── TOP10 持仓：覆盖（动态链上数据，用最新值） ──
  if (newSearch.top10HoldingPercent != null) {
    if (merged.top10HoldingPercent !== newSearch.top10HoldingPercent) {
      changes.push(`TOP10持仓: ${merged.top10HoldingPercent}% → ${newSearch.top10HoldingPercent}%`);
    }
    merged.top10HoldingPercent = newSearch.top10HoldingPercent;
    merged.top10HoldingAt = newSearch.top10HoldingAt || new Date().toISOString();
  }

  // ── 搜索计数 ──
  merged.totalSearches += 1;

  // ── 置信度评分（每累积一次搜索 +5，多来源独立验证 +10） ──
  merged.confidenceScore = Math.min(100,
    (merged.confidenceScore || 0) + 5 +
    (changes.length > 2 ? 5 : 0)
  );

  // ── is_confirmed（≥2 次独立搜索 或 ≥3 人举报） ──
  if (!merged.isConfirmed) {
    if (merged.totalSearches >= 2 || merged.withdrawIssueCount >= 3) {
      merged.isConfirmed = true;
      changes.push('状态: 已确认 ✓');
    }
  }

  return { facts: merged, merged: changes.length > 0, changes };
}

function extractUrl(entry) {
  if (!entry) return '';
  // 兼容两种格式：字符串 或 {title, url, content} 对象
  const str = (typeof entry === 'string') ? entry : (entry.url || entry.title || '');
  if (!str || typeof str !== 'string') return '';
  const m = str.match(/https?:\/\/\S+/);
  return m ? m[0] : str;
}

/**
 * 保存 Tier 2 事实到数据库
 */
export async function saveFacts(contractAddress, projectName, facts, metadata = {}) {
  const key = normalizeKey(contractAddress);
  if (!key || key === '未提供') return;

  const now = new Date().toISOString();

  // Supabase
  const supabase = await getSupabase();
  if (supabase) {
    try {
      await supabase.from('project_facts').upsert({
        contract_address: key,
        project_name: projectName || metadata.effectiveProjectName || '',
        mode_change_count: facts.modeChangeCount,
        mode_change_articles: facts.modeChangeArticles,
        withdraw_issue_count: facts.withdrawIssueCount,
        withdraw_issue_evidence: facts.withdrawIssueEvidence,
        funding_rounds: facts.fundingRounds,
        audits: facts.audits,
        top10_holding_percent: facts.top10HoldingPercent,
        top10_holding_at: facts.top10HoldingAt || null,
        legal_entities: facts.legalEntities,
        has_license: facts.hasLicense,
        has_audit: facts.hasAudit,
        has_funding: facts.hasFunding,
        confidence_score: facts.confidenceScore,
        is_confirmed: facts.isConfirmed,
        total_searches: facts.totalSearches,
        last_searched_at: now,
        detected_chain: metadata.detectedChain || null,
        verified_evidence: facts.verifiedEvidence || [],  // 🆕 保留社区已验证证据
      }, { onConflict: 'contract_address' });
      console.log(`💾 [Ledger] Tier2 已保存 (Supabase): ${key.slice(0,10)}... modeChangeCount=${facts.modeChangeCount}`);
    } catch (e) {
      console.warn('[Ledger] Tier2 Supabase 写入失败:', e.message);
    }
  }

  // 本地 fallback
  const local = await loadLocalCache();
  const entry = local[key] || {};
  entry.facts = facts;
  entry.updatedAt = now;
  if (projectName) entry.projectName = projectName;
  if (metadata.effectiveProjectName) entry.effectiveProjectName = metadata.effectiveProjectName;
  local[key] = entry;
  await saveLocalCache(local);
}

/**
 * 将既有事实注入搜索 prompt
 * @returns {string} 注入文本
 */
export function injectFactsIntoPrompt(facts) {
  if (!facts || facts.totalSearches === 0) return '';

  const lines = ['\n## 🗄️ 项目已知事实（来自项目账本，已多次搜索确认）\n'];
  
  if (facts.modeChangeCount >= 2 && facts.isConfirmed) {
    lines.push(`- ✅ **模式变更≥${facts.modeChangeCount}次**（已确认）`);
    if (facts.modeChangeArticles?.length) {
      const samples = facts.modeChangeArticles.slice(0, 3).join('；');
      lines.push(`  - 证据：${samples}`);
    }
  } else if (facts.modeChangeCount >= 2 && !facts.isConfirmed) {
    lines.push(`- ⚠️ **模式变更${facts.modeChangeCount}次**（待验证，疑似用户举报，仅供参考）`);
  } else if (facts.modeChangeCount === 1) {
    lines.push(`- ⚠️ 模式变更 1 次（待确认）`);
  }

  if (facts.withdrawIssueCount > 0 && facts.isConfirmed) {
    lines.push(`- 🔴 **出金障碍记录**：${facts.withdrawIssueCount} 份证据（已确认）`);
    if (facts.withdrawIssueEvidence?.length) {
      const samples = facts.withdrawIssueEvidence.slice(0, 2).join('；');
      lines.push(`  - 证据：${samples}`);
    }
  } else if (facts.withdrawIssueCount > 0 && !facts.isConfirmed) {
    lines.push(`- ⚠️ **出金障碍记录**：${facts.withdrawIssueCount} 份证据（待验证，仅供参考）`);
  }

  if (facts.fundingRounds?.length) {
    lines.push(`- 💰 融资记录：${facts.fundingRounds.join('、')}`);
  }

  if (facts.audits?.length) {
    lines.push(`- 🔍 审计机构：${facts.audits.join('、')}`);
  }

  if (facts.hasLicense) {
    lines.push(`- 📜 已持有牌照/监管许可`);
  }

  if (facts.legalEntities?.length) {
    lines.push(`- 🏢 法律实体：${facts.legalEntities.join('、')}`);
  }

  // 🆕 社区已验证证据（≥3人交叉验证，纳入项目事实）
  if (facts.verifiedEvidence?.length) {
    const catNames = {
      mode_change: '模式变更',
      withdraw_issue: '出金障碍',
      central_control: '中心化控制',
      team_info: '团队信息',
    };
    lines.push('\n### 👥 社区已验证证据（纳入项目事实）');
    for (const ev of facts.verifiedEvidence) {
      const catName = catNames[ev.category] || '其他';
      const preview = (ev.content || '').slice(0, 100);
      lines.push(`- ✅ 【${catName}】${preview}（${ev.verification_count || 3}人验证，${ev.verified_at?.slice(0, 10) || '未知日期'}）`);
    }
  }

  if (facts.confidenceScore >= 50) {
    lines.push(`\n> 以上事实来自 ${facts.totalSearches} 次独立搜索，置信度 ${facts.confidenceScore}%${facts.isConfirmed ? '（已确认）' : ''}。请在此基础上评估，不要降级已有事实。`);
  }

  return lines.join('\n') + '\n';
}

/**
 * 从搜索标志提取可缓存的事实
 */
export function extractFactsFromSearch(searchFlags, onChainData) {
  const facts = emptyFacts();
  
  // 模式变更
  if (searchFlags.hasModeChange && searchFlags.modeChangeCount > 0) {
    facts.modeChangeCount = searchFlags.modeChangeCount;
  }
  if (searchFlags.modeChangeArticles?.length) {
    facts.modeChangeArticles = [...searchFlags.modeChangeArticles];
  }

  // 出金障碍
  if (searchFlags.hasWithdrawIssue) {
    facts.withdrawIssueCount = searchFlags.withdrawIssueCount || 1;
  }
  if (searchFlags.withdrawIssueEvidence?.length) {
    facts.withdrawIssueEvidence = [...searchFlags.withdrawIssueEvidence];
  }

  // 融资
  if (searchFlags.fundingRounds?.length) {
    facts.fundingRounds = [...searchFlags.fundingRounds];
  }

  // 审计
  if (searchFlags.audits?.length) {
    facts.audits = [...searchFlags.audits];
  }

  // 牌照
  facts.hasLicense = searchFlags.hasLicense || false;
  facts.hasAudit = searchFlags.hasAudit || false;
  facts.hasFunding = searchFlags.hasFunding || false;

  // 法律实体
  if (searchFlags.legalEntities?.length) {
    facts.legalEntities = [...searchFlags.legalEntities];
  }

  // TOP10 持仓
  if (onChainData?.goplus?.top10Percent != null) {
    facts.top10HoldingPercent = onChainData.goplus.top10Percent;
    facts.top10HoldingAt = new Date().toISOString();
  }

  facts.totalSearches = 1;
  facts.confidenceScore = 10;  // 初始置信度

  return facts;
}

/**
 * 从用户备注中提取事实（待验证事实，v5.8）
 *
 * 与 extractFactsFromSearch 不同，user notes 来自社群内部（微信群/QQ群），
 * Tavily 可能搜不到。这些事实标记为"待验证"但仍计入缓存，
 * 以确保交叉惩罚等逻辑能基于用户举报正确触发。
 *
 * 提取策略：
 * - 按句号/换行切分段落
 * - 每个段落检测模式变更、出金障碍等关键词
 * - 每段最多计为1次模式变更事件（去重）
 *
 * @param {string} userNotes
 * @returns {object|null} facts 对象或 null（无可提取内容）
 */
export function extractFactsFromUserNotes(userNotes) {
  if (!userNotes || !userNotes.trim()) return null;

  const notes = userNotes.trim();
  const facts = emptyFacts();

  // 按句号/换行切分段落
  const segments = notes
    .split(/[。\n；\r]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 5);

  if (segments.length === 0) return null;

  // ── 模式变更关键词 ──
  const modeChangeActions = [
    '模式发生变更', '模式变更', '更换模式',
    '终止', '停运', '关闭', '下架',
    '强制兑换股票', '兑换股票', '强制兑换', '兑换上市股票',
    '迁移', '转型', '转为', '改为',
    '商业模式结束', '商业模式变更', '不再支持',
    '矿机', '产币减量',
  ];

  // ── 出金障碍关键词 ──
  const withdrawActions = [
    '提现受控', '提现较慢', '提现慢', '提现延迟', '提现困难', '无法提现',
    '未兑现', '未兑付', '不兑现',
    '人工审核', '中心化严重', '中心化',
    '锁仓', '锁定期', '强制锁',
    '出金', '冻结',
  ];

  const seenModeTitles = new Set();
  let withdrawIssueCount = 0;

  for (const seg of segments) {
    // 模式变更检测
    const matchedMode = modeChangeActions.find(kw => seg.includes(kw));
    if (matchedMode) {
      // 去重：同一段落只计一次
      const dedupKey = seg.slice(0, 40);
      if (!seenModeTitles.has(dedupKey)) {
        seenModeTitles.add(dedupKey);
        facts.modeChangeArticles.push({
          title: `用户反馈: ${seg.slice(0, 50)}`,
          content: seg.slice(0, 200),
          url: '',
          source: 'user_notes',
        });
      }
    }

    // 出金障碍检测
    const matchedWithdraw = withdrawActions.find(kw => seg.includes(kw));
    if (matchedWithdraw) {
      withdrawIssueCount++;
      facts.withdrawIssueEvidence.push(
        `【${matchedWithdraw}】${seg.slice(0, 100)} (来源: 用户反馈)`
      );
    }
  }

  // ── 汇总 ──
  if (facts.modeChangeArticles.length > 0) {
    facts.modeChangeCount = facts.modeChangeArticles.length;
  }
  if (withdrawIssueCount > 0) {
    facts.withdrawIssueCount = withdrawIssueCount;
    facts.hasWithdrawIssue = true;
  }

  // 用户信息置信度低于搜索（待验证）
  facts.confidenceScore = 1;
  facts.totalSearches = 0;
  facts.source = 'user_notes';

  return facts;
}

/**
 * v5.9.1: 存储用户备注为证据（写入 evidence_submissions）
 *
 * 安全设计：
 * - 每条证据生成 hash（基于内容前缀），相同事实不会重复入库
 * - 冲突时递增 verification_count（跨用户累积）
 * - verification_count ≥ 3 → 自动标记 status='verified'
 * - 已验证证据在下一次评分时通过 getVerifiedEvidence() 注入 prompt
 *
 * @param {string} contractAddress
 * @param {string} projectName
 * @param {string} userNotes
 * @param {string|null} contributorAddress
 * @returns {Promise<{stored:number, verified:number}>}
 */
export async function storeUserEvidence(contractAddress, projectName, userNotes, contributorAddress = null) {
  if (!userNotes?.trim()) return { stored: 0, verified: 0 };

  const parsed = extractFactsFromUserNotes(userNotes);
  if (!parsed) return { stored: 0, verified: 0 };

  const supabase = await getSupabase();
  if (!supabase) {
    console.log('📝 [Evidence] Supabase 不可用，跳过存储');
    return { stored: 0, verified: 0 };
  }

  const key = contractAddress.toLowerCase();

  // ── Step 1: 获取/创建 project_facts 行（满足 FK 约束）──
  let projectId;
  try {
    const { data: existing } = await supabase
      .from('project_facts')
      .select('id')
      .eq('contract_address', key)
      .maybeSingle();

    if (existing?.id) {
      projectId = existing.id;
    } else {
      // 创建最小行（saveFacts 稍后会补全）
      const { data: created } = await supabase
        .from('project_facts')
        .insert({
          contract_address: key,
          project_name: projectName || '',
          mode_change_count: 0,
          confidence_score: 1,
          is_confirmed: false,
          total_searches: 0,
        })
        .select('id')
        .single();
      projectId = created?.id;
    }
  } catch (e) {
    console.warn('📝 [Evidence] 获取 project_facts.id 失败:', e.message);
    return { stored: 0, verified: 0 };
  }

  if (!projectId) {
    console.warn('📝 [Evidence] projectId 为空，跳过');
    return { stored: 0, verified: 0 };
  }

  // ── Step 2: 收集待入库证据 ──
  const items = [];

  // 模式变更证据
  for (const article of parsed.modeChangeArticles || []) {
    const contentKey = article.content.slice(0, 80);
    items.push({
      project_cache_id: projectId,
      contributor_address: contributorAddress || 'anonymous',
      content_type: 'text',
      content: article.content,
      evidence_hash: simpleHash(contentKey),
      evidence_category: 'mode_change',
      status: 'pending',
      verification_count: 1,
    });
  }

  // 出金障碍证据
  for (const ev of parsed.withdrawIssueEvidence || []) {
    const contentKey = ev.slice(0, 80);
    items.push({
      project_cache_id: projectId,
      contributor_address: contributorAddress || 'anonymous',
      content_type: 'text',
      content: ev,
      evidence_hash: simpleHash(contentKey),
      evidence_category: 'withdraw_issue',
      status: 'pending',
      verification_count: 1,
    });
  }

  // ── Step 3: 逐条 upsert（冲突 → 递增 verification_count）──
  let stored = 0;
  let newlyVerified = 0;

  for (const item of items) {
    try {
      // 查是否已存在同类证据
      const { data: existing } = await supabase
        .from('evidence_submissions')
        .select('id, verification_count, status')
        .eq('project_cache_id', projectId)
        .eq('evidence_hash', item.evidence_hash)
        .maybeSingle();

      if (existing) {
        // 冲突 → 递增计数
        const newCount = (existing.verification_count || 0) + 1;
        const shouldVerify = newCount >= 3 && existing.status !== 'verified';
        const newStatus = shouldVerify ? 'verified' : existing.status;

        await supabase
          .from('evidence_submissions')
          .update({
            verification_count: newCount,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (shouldVerify) {
          newlyVerified++;
          console.log(`✅ [Evidence] 已验证! ${item.evidence_category}: "${item.content.slice(0, 30)}..." (${newCount}人)`);
        } else {
          console.log(`📝 [Evidence] 验证累计: ${item.evidence_category} → ${newCount}人 (status=${newStatus})`);
        }
        stored++;
      } else {
        // 新证据入库
        await supabase
          .from('evidence_submissions')
          .insert(item);
        stored++;
        console.log(`📝 [Evidence] 新证据入库: ${item.evidence_category}: "${item.content.slice(0, 30)}..."`);
      }
    } catch (e) {
      console.warn(`📝 [Evidence] 单条存储失败 (${item.evidence_category}):`, e.message);
    }
  }

  if (stored > 0) {
    console.log(`📝 [Evidence] 存储完成: ${stored} 条, 新验证通过: ${newlyVerified}`);
  }

  return { stored, verified: newlyVerified };
}

/**
 * 简单字符串 hash（用于证据去重）
 * @param {string} str
 * @returns {string}
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'ev_' + Math.abs(hash).toString(36);
}
