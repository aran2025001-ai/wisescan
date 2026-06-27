/**
 * 本地 API 服务器（使用 Node.js 内建模块，零外部依赖）
 * 
 * 处理 /api/generate-risk-report 和 /api/add-project
 * 启动：node api/api-server.mjs
 * 端口：3002
 */

import { createServer } from 'node:http';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// NodeReal BSC 链上数据（代币信息、余额等）
import { getTokenInfo, getContractStatus, formatSupply } from './utils/bsctrace.mjs';
import { getTokenSecurity } from './utils/goplus.mjs';
import { analyzeImage, analyzeImageBase64 } from './utils/multimodal.mjs';

// 项目事实缓存（Project Ledger）— 两层缓存 + 事实只增不减
import {
  getReportCache, setReportCache, clearReportCache,
  getFacts, mergeFacts, saveFacts,
  syncLocalCacheFromSupabase,
  extractFactsFromSearch, extractFactsFromUserNotes, injectFactsIntoPrompt,
  storeUserEvidence,
} from './cache/project-ledger.mjs';
import { searchWithFallback } from './utils/search-fallback.mjs';
import { handleAdmin } from './admin.mjs';

// 加载 .env + .env.local（.env.local 覆盖 .env）
function loadEnv() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = dirname(__filename);
  const envPath     = resolve(__dirname, '..', '.env');
  const envLocalPath = resolve(__dirname, '..', '.env.local');
  let loaded = [];

  // 1. 加载 .env（基础配置）
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    parseEnvContent(envContent);
    loaded.push('.env');
  } catch {
    console.warn('⚠️  无法读取 .env 文件（可忽略，如使用 .env.local）');
  }

  // 2. 加载 .env.local（本地覆盖，优先级更高）
  try {
    const envLocalContent = readFileSync(envLocalPath, 'utf-8');
    parseEnvContent(envLocalContent);
    loaded.push('.env.local');
  } catch {
    // .env.local 不存在是正常的
  }

  if (loaded.length > 0) {
    console.log(`✅ 环境变量加载成功: ${loaded.join(' + ')}`);
  } else {
    console.warn('⚠️  未找到任何 .env 文件，将依赖系统环境变量');
  }

  // 辅助：解析 env 文件内容并设置 process.env
  function parseEnvContent(content) {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        let key   = match[1].trim();
        let value = match[2].trim();
        // 移除首尾引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

// 调试：检查环境变量
console.log('🔍 环境变量检查:', {
  VITE_DEEPSEEK_API_KEY: process.env.VITE_DEEPSEEK_API_KEY ? '✓ 已设置' : '✗ 未设置',
  VITE_SUPABASE_URL:     process.env.VITE_SUPABASE_URL ? '✓ 已设置' : '✗ 未设置',
  TAVILY_API_KEY:        process.env.TAVILY_API_KEY      ? '✓ 已设置' : '✗ 未设置（实时搜索已禁用）',
  NODEREAL_API_KEY:      process.env.NODEREAL_API_KEY   ? '✓ 已设置' : '✗ 未设置（链上数据已禁用）',
  NODEREAL_RPC_URL:     process.env.NODEREAL_RPC_URL  || '✗ 未设置',
});

const PORT = process.env.PORT || 3002;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// 防刷缓存（内存 Map，服务重启后重置）
const antiSpamCache = new Map();

// ===== System Prompt（明鉴·风险洞察官 v3 — 详细评分版）=====
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

### 用户补充证据处理规则（主动分析）
当用户提供了"用户补充信息"时，请按以下规则**主动分析**，而非被动引用：
- **主动提取**：分析用户提交的文字信息，提取关键事实（项目方身份、模式细节、风险事件、时间节点等）
- **交叉比对**：将用户提供的信息与你的搜索结果、训练数据交叉比对，优先采用有证据支持的信息
- **图片证据**：如果用户上传了图片，其描述（如"项目方发布的矿机挖矿终止公告"）应视为一条独立证据，在报告中说明"用户提供了关于XX的截图证据"
- **来源标注**：在报告正文中明确标注哪些信息来自用户贡献（用「据用户提交…」），哪些来自 AI 搜索（用「据公开信息…」）
- **矛盾处理**：如果用户信息与搜索结果矛盾，在"局限性"中说明差异，不强行统一
- **未验证标识**：未经 ≥3 人交叉验证的用户信息，评分时标注"用户反馈，待验证"，可适度参考但不应作为主要评分依据
- **已验证信息**：经 ≥3 名独立用户交叉验证通过的证据，系统会在「## 社区已验证证据」段落中单独列出，届时必须严格执行（标注"【社区已验证】"前缀）
- **防止滥用**：单一用户的举报不应导致评分剧烈变化，避免项目方恶意攻击竞争对手
- **⚠️ 单条待验证证据不触发恶意特征**：标注"【用户提供，待核实】"的证据仅用于参考，不得作为恶意特征检测（malicious_features）的判定依据。恶意特征判定必须依赖多源交叉验证（见恶意特征检测指令）。

### 社区已验证证据处理规则（强制生效）
当提示中包含「## 【用户/社区补充信息】」段落时，证据按验证状态分为三档，你必须严格遵守以下标注规范：

| 证据状态 | 标注前缀 | 评分规则 |
|----------|----------|----------|
| verified（≥3人验证） | 【社区验证】 | 强制纳入评分，视为可信事实 |
| partial（1-2人验证） | 【用户反映】 | 作为参考信息，适度影响评分 |
| pending（0人验证） | 【用户提供，待核实】 | 仅供参考，不应用作强制惩罚依据 |

具体规则：
- 验证通过的"出金障碍"证据 → 历史可靠性归零 + 经济模型 -10 分
- 验证通过的"模式变更"证据 → history_mode_changes 计入次数
- 验证通过的"中心化控制"证据 → 代码安全/经济模型相应扣分
- 多条证据指向同一风险点请综合表述，并在报告末尾"局限性"中说明证据数量和验证状态
- 在 deduction 字段中明确标注证据来源和验证状态（如"3人验证的出金障碍报告，历史可靠性归零"）

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
- **多源交叉验证原则**：必须有 ≥2 个独立来源同时指向同一恶意特征，才可标记为 malicious_features.detected = true
- 可接受的独立来源包括：网络搜索命中（≥1篇）、已验证证据（≥3人，标注【社区验证】）、部分验证证据（1-2人，标注【用户反映】）
- **以下情况可以判定：**
  - 网络搜索 ≥2 篇独立文章命中相同特征 → ✅ 直接判定
  - 网络搜索 1 篇 + 至少 1 条已验证/部分验证证据 → ✅ 判定
  - 网络搜索 0 篇 + ≥3 条相同特征的待验证证据（标注【用户提供，待核实】）→ ✅ 判定（多条独立用户反映）
  - 已验证证据（≥3人验证）直接命中 → ✅ 判定
- **以下情况不应判定：**
  - 仅 1 条待验证证据（0人验证，标注【用户提供，待核实】）→ ❌ 不判定（单一用户提交不足为证）
  - 技术升级（如 ETH POW→POS、Uniswap V2→V3、品牌更名）→ ❌ 不属于恶意特征
- 主流公链/知名协议的技术迭代，应标记为"正常升级"
- 未检测到 → malicious_features.detected = false

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
  "ai_summary": "综合解读（100-200 字，用通俗语言总结主要风险和机会点。\n⚠️ 自检规则（强制，违反则答案无效）：\n1. 你写的每一个正面断言（如'持有合规牌照'、'已完成审计'、'获得融资'）必须与你上方填入的六维评分数据和事实字段**一致**。\n2. 合规性评分≤2分→禁止声称持有牌照/合规；funding_record=无→禁止声称获得融资；history_mode_changes≥2次→禁止声称模式稳定；liquidity_lock=未锁定→禁止声称LP已锁定。\n3. 不确定的正面信息，宁可不说也不要瞎编——你能在数据里验证的才可以说。\n4. 每一条判断必须标注证据来源：【链上数据-GoPlus】/【网络搜索-Tavily】/【公开信息】/【社区验证】/【用户反映】/【用户提供，待核实】。\n5. 禁止输出任何无法在报告中找到对应记录的断言——包括但不限于'持有合规牌照''已完成审计''获得融资''团队实名'等，除非事实字段或评分数据明确支持。\n如引用了用户证据，必须使用【社区验证】/【用户反映】/【用户提供，待核实】标注）"
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

// ===== Helpers =====
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function jsonRes(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

// 🆕 英文术语统一替换为中文白话（面向中文用户，确保可读性）
function localizeEnTerms(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(/exit\s*scam/gi, '卷款跑路')
    .replace(/rug\s*pull/gi, '撤池跑路')
    .replace(/\brugged\b/gi, '被跑路')
    .replace(/\brug\b/gi, '跑路')
    .replace(/scammer/gi, '骗子')
    .replace(/\bscam\b/gi, '骗局')
    .replace(/\bponzi\b/gi, '庞氏骗局')
    .replace(/phishing/gi, '钓鱼攻击')
    .replace(/honeypot/gi, '蜜罐陷阱')
    .replace(/whitelist/gi, '白名单')
    .replace(/blacklist/gi, '黑名单')
    .replace(/airdrop/gi, '空投')
    .replace(/staking/gi, '质押')
    .replace(/yield\s*farming/gi, '收益农场')
    .replace(/liquidity\s*pool/gi, '流动性池')
    .replace(/governance\s*token/gi, '治理代币')
    .replace(/decentralized\s*exchange/gi, '去中心化交易所')
    .replace(/centralized\s*exchange/gi, '中心化交易所')
    .replace(/KYC/gi, '身份认证')
    .replace(/AML/gi, '反洗钱');
}

// ===== Supabase =====
async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );
}

// 异步存库：项目 upsert + risk_reports insert（不阻塞主流程）
async function storeRiskReport(address, user_address, reportData, referencedEvidenceIds) {
  try {
    const supabase = await getSupabase();
    // 1. upsert 项目
    if (address && address !== '未提供') {
      const { data: proj } = await supabase.from('projects').select('id, assessment_count').eq('contract_address', address.toLowerCase()).maybeSingle();
      if (proj) {
        await supabase.from('projects').update({
          assessment_count: (proj.assessment_count || 0) + 1,
          last_eval_time: new Date().toISOString(),
        }).eq('id', proj.id);
      } else {
        await supabase.from('projects').insert({
          name: reportData?.project_name || '未命名项目',
          contract_address: address.toLowerCase(),
          chain: reportData?.chain || '未知',
          assessment_count: 1,
          last_eval_time: new Date().toISOString(),
        });
      }
    }
    // 2. 查 project_id
    let projectId = null;
    if (address && address !== '未提供') {
      const { data: proj } = await supabase.from('projects').select('id').eq('contract_address', address.toLowerCase()).maybeSingle();
      projectId = proj?.id || null;
    }
    // 3. 写入 risk_reports（先插新记录，再删旧记录）
    const userAddr = (user_address && typeof user_address === 'string') ? user_address.toLowerCase() : 'anonymous';
    const { data: inserted, error: insErr } = await supabase.from('risk_reports').insert({
      user_address: userAddr,
      project_id: projectId,
      report_data: reportData,
      total_score: reportData?.total_score || 0,
      risk_level: reportData?.risk_level || '未知',
      evidence_ids: referencedEvidenceIds.length > 0 ? referencedEvidenceIds : null,
    }).select('id');
    if (insErr) throw insErr;
    const newId = inserted?.[0]?.id;
    console.log(`💾 存库成功: id=${newId?.slice(0,8)} address=${address?.slice(0,12)} project=${projectId?.slice(0,8) || 'N/A'} score=${reportData?.total_score}`);
    // 4. 清理旧记录：该用户该项目的旧报告（排除新插入的）
    if (newId && projectId) {
      supabase.from('risk_reports').delete()
        .eq('project_id', projectId)
        .ilike('user_address', userAddr)
        .neq('id', newId)
        .then(() => console.log('🧹 旧报告已清理'))
        .catch(() => {});
    }
    // 5. 标记证据已引用（异步）
    if (referencedEvidenceIds.length > 0) {
      supabase.from('evidence_submissions').update({ used_in_report: true }).in('id', referencedEvidenceIds).then();
    }
  } catch (err) {
    console.warn('⚠️ storeRiskReport 异常:', err.message);
  }
}

// ===== Handlers =====
async function handleAddProject(req, res) {
  const body = await readBody(req);
  const { name, contract_address, chain } = body;

  if (!name || !contract_address) {
    return jsonRes(res, 400, { error: 'name and contract_address are required' });
  }

  const supabase = await getSupabase();
  const trimmedName = name.trim();
  const trimmedAddr = contract_address.trim().toLowerCase();

  // 根据合约地址查重
  const { data: existing, error: selectError } = await supabase
    .from('projects')
    .select('id, name, assessment_count, previous_names')
    .eq('contract_address', trimmedAddr)
    .maybeSingle();

  if (selectError) {
    console.warn('⚠️  Supabase 查询失败:', selectError.message);
    return jsonRes(res, 500, { error: selectError.message });
  }

  if (existing) {
    // 已存在：检查名称是否变更
    const nameChanged = existing.name !== trimmedName;
    const updateData = {
      assessment_count: (existing.assessment_count || 0) + 1,
      last_eval_time: new Date().toISOString(),
    };

    if (nameChanged) {
      // 名称变更：记录曾用名，更新当前名称
      const previousNames = existing.previous_names || [];
      previousNames.push({
        name: existing.name,
        updated_at: new Date().toISOString(),
      });
      updateData.name = trimmedName;
      updateData.previous_names = previousNames;
      updateData.name_updated_at = new Date().toISOString();
      console.log(`📝 项目名称变更: "${existing.name}" → "${trimmedName}"`);
    }

    const { error: updateError } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', existing.id);

    if (updateError) {
      console.warn('⚠️  Supabase 更新失败:', updateError.message);
    } else {
      console.log(`✅ 项目已更新: ${trimmedName} (${trimmedAddr})`);
    }

    return jsonRes(res, 200, { success: true, updated: true, nameChanged });
  }

  // 不存在：插入新记录
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: trimmedName,
      contract_address: trimmedAddr,
      chain: chain || 'BSC',
      assessment_count: 1,
      previous_names: [],
    })
    .select()
    .single();

  if (error) return jsonRes(res, 500, { error: error.message });
  console.log(`✅ 项目已添加: ${trimmedName} (${trimmedAddr})`);
  return jsonRes(res, 200, { success: true, data, updated: false });
}

// ===== 多链合约地址识别与验证 =====
const CHAIN_RPC_MAP = {
  ethereum: [
    'https://1rpc.io/eth',                     // ✅ ~940ms (稳定)
    'https://ethereum-rpc.publicnode.com',    // ⚠️ 时好时坏，可能超时
    'https://eth.llamarpc.com',                // ⚠️ 不稳定 (521)
  ],
  bsc: [
    'https://bsc.publicnode.com',              // ✅ ~740ms
    'https://bsc-rpc.publicnode.com',          // ✅ ~750ms
    'https://1rpc.io/bsc',                     // ⚠️ 不稳定 (400)
  ],
  polygon: [
    'https://polygon-rpc.com',
    'https://polygon.llamarpc.com',
  ],
  arbitrum: [
    'https://arb1.arbitrum.io/rpc',
  ],
  optimism: [
    'https://mainnet.optimism.io',
  ],
  avalanche: [
    'https://api.avax.network/ext/bc/C/rpc',
  ],
  base: [
    'https://mainnet.base.org',           // ✅ ~1025ms (官方, 稳定)
    'https://1rpc.io/base',               // ✅ ~1800ms
  ],
  zksync: [
    'https://mainnet.era.zksync.io',      // ✅ ~1148ms (官方)
  ],
  linea: [
    'https://linea-rpc.publicnode.com',   // ✅ ~1361ms
    'https://1rpc.io/linea',              // ✅ ~1416ms
    'https://rpc.linea.build',            // ✅ ~1522ms (官方)
  ],
  scroll: [
    'https://rpc.scroll.io',              // ✅ ~1717ms (官方)
    'https://scroll-rpc.publicnode.com',  // ✅ ~2237ms
  ],
  tron: [
    'https://api.trongrid.io',
    'https://api.trongrid.io',
  ],
  solana: [
    'https://api.mainnet-beta.solana.com',
    'https://solana-rpc.publicnode.com',
  ],
}

/** 根据地址格式自动识别链 */
function detectChain(address) {
  if (!address || address === '未提供') return null

  // TRON: 以 T 开头，34 字符，base58
  if (/^T[A-Za-z1-9]{33}$/.test(address)) return 'tron'

  // Solana: base58，32-44 字符，不以 0x 或 T 开头
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'solana'

  // EVM 链: 0x + 40 hex 字符
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) {
    // 无法从地址格式区分具体 EVM 链，全部尝试
    return 'evm'
  }

  return null
}

/** 在指定链/链族上验证合约地址 */
async function isValidContract(address, { fastMode = false } = {}) {
  const chain = detectChain(address)
  if (!chain) {
    console.log(`❌ 无法识别地址格式: ${address}`)
    return { valid: false, chain: 'unknown', reason: '无法识别该地址的链类型' }
  }

  console.log(`🔍 检测到链类型: ${chain} → ${address}${fastMode ? ' [快速模式]' : ''}`)

  if (chain === 'tron') {
    return await verifyTronContract(address)
  }

  if (chain === 'solana') {
    return await verifySolanaContract(address)
  }

  // EVM 链族
  if (chain === 'evm') {
    return await verifyEvmContract(address, { fastMode })
  }

  return { valid: true, chain, reason: '' }
}

/** EVM 链族验证（重写版 — Promise.any 竞速 + 精准阈值）
 *  - 所有 RPC 全并行，1s 单探针超时
 *  - Promise.any：任何 RPC 找到合约 → 立即返回（最短 ~200ms）
 *  - fastMode: ETH+BSC+Polygon+Arbitrum+Base (5 链, ~11 探针)
 *  - full mode: 全部 10 条 EVM 链
 *  - 拒绝策略：≥2 条不同链确认"非合约" → 拦截
 *    （避免某链 RPC 全挂而导致误杀）
 */
async function verifyEvmContract(address, { fastMode = false } = {}) {
  const t0 = Date.now()
  const chainList = fastMode
    ? ['ethereum', 'bsc', 'polygon', 'arbitrum', 'base']
    : ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'base', 'zksync', 'linea', 'scroll']

  // 摊平：每条链的所有 RPC URL 都作为独立探针
  const probes = []
  for (const cn of chainList) {
    for (const url of (CHAIN_RPC_MAP[cn] || [])) {
      probes.push({ chain: cn, url })
    }
  }

  async function singleProbe({ chain, url }) {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), 1500) // 1.5s 单探针超时（应对 RPC 间歇性慢响应）
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'eth_getCode',
          params: [address, 'latest'], id: 1,
        }),
        signal: ctrl.signal,
      })
      clearTimeout(tid)
      if (!res.ok) return { found: false, chain, error: true }
      const json = await res.json()
      if (json?.result && json.result !== '0x') {
        return { found: true, chain }
      }
      return { found: false, chain }
    } catch {
      clearTimeout(tid)
      return { found: false, chain, error: true }
    }
  }

  const probePromises = probes.map(singleProbe)
  const TOTAL_PROBES = probePromises.length

  // 🚀 Promise.any：第一个找到合约的探针立即胜出
  try {
    const firstFound = await Promise.any(
      probePromises.map(async (p) => {
        const result = await p
        if (result.found) return result
        throw new Error('not-found')
      })
    )
    const elapsed = Date.now() - t0
    console.log(`✅ 合约验证通过 [${elapsed}ms]: ${address} (${firstFound.chain})`)
    return { valid: true, chain: firstFound.chain, reason: '' }
  } catch {
    // 没有探针找到合约 → 收集全部结果诊断
  }

  // 收集全部结果（大多数应已完成）
  const allResults = await Promise.allSettled(probePromises)

  let foundChain = null
  let notContractCount = 0
  let errorCount = 0
  const notContractChains = new Set()

  for (const r of allResults) {
    if (r.status === 'fulfilled') {
      if (r.value.found) {
        foundChain = r.value.chain
      } else if (r.value.error) {
        errorCount++
      } else {
        notContractCount++
        notContractChains.add(r.value.chain)
      }
    } else {
      errorCount++
    }
  }

  if (foundChain) {
    // 晚期发现（理论上 Promise.any 已经截获，但兜底）
    const elapsed = Date.now() - t0
    console.log(`✅ 合约验证通过 (late) [${elapsed}ms]: ${address} (${foundChain})`)
    return { valid: true, chain: foundChain, reason: '' }
  }

  const elapsed = Date.now() - t0
  console.log(`🔍 EVM 验证 [${elapsed}ms]: notContract=${notContractCount} chains=${[...notContractChains].join(',')} errors=${errorCount}/${TOTAL_PROBES}`)

  // 🔑 精准拒绝：超过半数链都确认"非合约" → 拦截
  //     阈值 = Math.ceil(链条数 / 2)：fastMode(5链)需≥3，fullMode(10链)需≥5
  //     每链至少一个探针成功返回非合约才算数（有 RPC 错误的链不参与计数）
  const rejectThreshold = Math.ceil(chainList.length / 2)
  if (notContractChains.size >= rejectThreshold) {
    console.log(`❌ ${notContractChains.size} 条链确认非合约: ${address}`)
    return {
      valid: false, chain: 'evm',
      reason: `该地址在 ${notContractChains.size} 条 EVM 链上均未找到合约代码，可能是 EOA 钱包地址`
    }
  }

  // 全部 RPC 不可用 → 服务降级
  if (errorCount >= TOTAL_PROBES) {
    console.log(`❌ 所有 EVM RPC 不可用 [${elapsed}ms]`)
    return {
      valid: false, chain: 'evm',
      reason: '链上验证服务暂时不可用（全部 RPC 节点无响应），请稍后重试'
    }
  }

  // 不确定 → 放行（不挡用户）
  console.log(`⚠️ EVM 验证不确定 [${elapsed}ms]: ${address}，放行`)
  return { valid: true, chain: 'evm', reason: '部分 RPC 不可用，验证结果仅供参考' }
}

/** TRON 链验证 */
async function verifyTronContract(address) {
  for (const rpcUrl of CHAIN_RPC_MAP.tron) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${rpcUrl}/v1/accounts/${address}`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) continue
      const json = await res.json()
      // TRON 账户存在且有合约代码
      if (json.data && json.data.length > 0) {
        const acct = json.data[0]
        if (acct.type === 'Contract' || acct.code) {
          console.log(`✅ 合约验证通过: ${address} (tron)`)
          return { valid: true, chain: 'tron', reason: '' }
        }
        // 是普通账户，不是合约
        console.log(`❌ TRON 地址是普通账户: ${address}`)
        return { valid: false, chain: 'tron', reason: '该 TRON 地址是普通账户，不是智能合约' }
      }
      // 账户不存在
      console.log(`❌ TRON 账户不存在: ${address}`)
      return { valid: false, chain: 'tron', reason: '该 TRON 地址不存在' }
    } catch { /* 继续尝试 */ }
  }
  return { valid: true, chain: 'tron', reason: '' } // RPC 都失败，放行
}

/** Solana 链验证 */
async function verifySolanaContract(address) {
  for (const rpcUrl of CHAIN_RPC_MAP.solana) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'getAccountInfo',
          params: [address, { encoding: 'base64' }], id: 1,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) continue
      const json = await res.json()
      if (json?.result?.value) {
        const executable = json.result.value.executable
        if (executable) {
          console.log(`✅ 合约验证通过: ${address} (solana)`)
          return { valid: true, chain: 'solana', reason: '' }
        }
        console.log(`❌ Solana 地址不是可执行程序: ${address}`)
        return { valid: false, chain: 'solana', reason: '该 Solana 地址是普通账户，不是智能合约（Program）' }
      }
      console.log(`❌ Solana 账户不存在: ${address}`)
      return { valid: false, chain: 'solana', reason: '该 Solana 地址不存在' }
    } catch { /* 继续尝试 */ }
  }
  return { valid: true, chain: 'solana', reason: '' } // RPC 都失败，放行
}

// ===== Tavily 实时搜索 (v5 融合版 — 取 v3/v4/v4.1 各家之长, basic深度已验证最优) =====

/** 权威域名优先级打分（分值越低越靠前）—— v3 恢复 */
function getDomainPriority(url) {
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

// 各查询类型的命中关键词（中/英混合）—— v4.1 锐化版
const HIT_KEYWORDS = {
  '融资-中文': ['融资', '获投', '投资', '估值', '领投', '轮'],
  '融资-英文': ['funding', 'raised', 'million', 'investment', 'investor', 'round', '融资'],
  '审计':     ['审计', '安全审计', 'audit', 'CertiK', 'SlowMist', 'PeckShield', 'security'],
  '牌照/监管': ['牌照', '许可证', 'license', 'MSB', 'MAS', 'SEC', '监管', 'regulation', 'compliance', 'financial license'],
  '法律实体':  ['法律实体', '注册地', 'legal entity', 'registered', '注册', 'incorporated', '公司注册', 'company registration'],
  '模式变更':  ['模式变更', '更换模式', '升级', '置换', '矿机', '挖矿', '锁仓', '新项目', '转型', 'pivot', 'rebrand'],
  '负面舆情-中文': ['跑路', '骗局', '骗', '维权', '投诉', '卷款', '崩盘', '归零', '提现困难', '无法提现', '限制提现', '锁仓', '资金盘', '杀猪盘', '割韭菜', '圈钱', '空气币', '失联', '立案', '报案', '经侦', '曝光', '避雷', '黑幕', '踩坑'],
  '负面舆情-平台': ['知乎', '微博', '贴吧', '抖音', '曝光', '避雷', '踩坑', '黑幕', '维权群', '爆料', '揭穿', '真相'],
  '负面舆情-英文': ['scam', 'fraud', 'rug pull', 'exit scam', 'complaint', 'cheat', 'warning', 'ponzi', 'pyramid', 'collapse', 'disappeared', 'unverifiable'],
};

// 命中检测：扫描结果的 title + content 是否包含任意关键词
function checkHit(label, results) {
  const keywords = HIT_KEYWORDS[label] || [];
  const allText = results.map(r => r.title + ' ' + r.content).join(' ');
  return keywords.some(kw => allText.toLowerCase().includes(kw.toLowerCase()));
}

// 从 label 提取命中标签名（用于日志输出）
function getHitLabel(label) {
  if (label.startsWith('融资')) return '融资';
  if (label === '审计') return '审计';
  if (label.startsWith('牌照')) return '牌照';
  if (label.startsWith('法律')) return '法律实体';
  if (label.startsWith('模式')) return '模式变更';
  if (label.startsWith('负面舆情')) return '负面舆情';
  return label;
}

// ===== 用合约地址反查项目真名 =====
// 原理：用户可能输入错误的项目名（如代币简称"MY"而非真名"Metya"）
// 合约地址是唯一标识，用它搜索可找到真正项目名，避免被用户错误输入牵着走
async function resolveProjectName(contractAddress, userProvidedName, tokenName, tokenSymbol) {
  if (!contractAddress || contractAddress === '未提供' || contractAddress.length < 40) {
    return { resolvedName: userProvidedName, aliases: [], originalName: userProvidedName }
  }

  let candidates = []
  // 从 onChain 数据构建候选别名
  if (tokenName && tokenName !== '未知') {
    const cleanName = tokenName.replace(/\s*Token\s*$/i, '').trim()
    if (cleanName && cleanName.length > 1 && cleanName !== userProvidedName) candidates.push(cleanName)
  }
  if (tokenSymbol && tokenSymbol !== '未知' && tokenSymbol !== userProvidedName) candidates.push(tokenSymbol)

  // 判断用户是否可能填错了（名称太短，像代币代码）
  const looksLikeTokenSymbol = /^[A-Z0-9]{2,6}$/i.test(userProvidedName) && userProvidedName.length <= 5
  const isTooShort = userProvidedName.length <= 3

  if (!looksLikeTokenSymbol && !isTooShort && candidates.length === 0) {
    return { resolvedName: userProvidedName, aliases: [], originalName: userProvidedName }
  }

  // 用合约地址做一次 Tavily 快速搜索，提取真实项目名
  try {
    console.log(`🔍 [NameResolve] 合约地址反查项目名: ${contractAddress.slice(0, 12)}... (用户输入: ${userProvidedName})`)
    const tavilyKey = process.env.TAVILY_API_KEY
    if (!tavilyKey) {
      console.log('⚠️  [NameResolve] 无 Tavily Key，使用 onChain 数据替代')
      if (candidates.length > 0) {
        return {
          resolvedName: candidates[0],
          aliases: [userProvidedName, ...candidates.slice(1)].filter((v, i, a) => a.indexOf(v) === i),
          originalName: userProvidedName
        }
      }
      return { resolvedName: userProvidedName, aliases: [], originalName: userProvidedName }
    }

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tavilyKey}` },
      body: JSON.stringify({
        query: `${contractAddress.slice(0, 12)} crypto token project`,
        include_answer: true,
        max_results: 5,
        search_depth: 'basic',
        topic: 'general',
      }),
    })
    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      console.log('  [NameResolve] 无搜索结果')
      if (candidates.length > 0) {
        return {
          resolvedName: candidates[0],
          aliases: [userProvidedName, ...candidates.slice(1)].filter((v, i, a) => a.indexOf(v) === i),
          originalName: userProvidedName
        }
      }
      return { resolvedName: userProvidedName, aliases: [], originalName: userProvidedName }
    }

    // 收集所有标题 + AI 摘要文本
    const allText = (data.answer || '') + ' ' + data.results.map(r => r.title).join(' ')

    // 策略1：查找 "FullName (SYMBOL)" 模式
    const matches = [...allText.matchAll(/([\w\.]{3,30})\s*[\(（]\s*([\w]{2,8})\s*[\)）]/g)]
    for (const m of matches) {
      const fullName = m[1].replace(/\b(token|coin|crypto)\b/gi, '').trim()
      const symbol = m[2]
      if ((symbol.toUpperCase() === userProvidedName.toUpperCase() || symbol.toUpperCase() === (tokenSymbol || '').toUpperCase()) && fullName.length > 2) {
        const capitalized = fullName.charAt(0).toUpperCase() + fullName.slice(1)
        const foundAliases = [userProvidedName]
        if (tokenSymbol && tokenSymbol !== '未知' && tokenSymbol !== userProvidedName) foundAliases.push(tokenSymbol)
        console.log(`  ✅ [NameResolve] 发现项目名: "${capitalized}" (别名: ${foundAliases.join(', ')})`)
        return { resolvedName: capitalized, aliases: foundAliases, originalName: userProvidedName }
      }
    }

    // 策略2："MY token / Metya" 或反向括号格式
    const revMatches = [...allText.matchAll(/([\w]{2,6})\s*[\(（/／]\s*([\w\.]{3,30})\s*[\)）]/g)]
    for (const m of revMatches) {
      const symbol = m[1]
      const fullName = m[2].replace(/\b(token|coin|crypto)\b/gi, '').trim()
      if ((symbol.toUpperCase() === userProvidedName.toUpperCase() || symbol.toUpperCase() === (tokenSymbol || '').toUpperCase()) && fullName.length > 2) {
        const capitalized = fullName.charAt(0).toUpperCase() + fullName.slice(1)
        const foundAliases = [userProvidedName]
        if (tokenSymbol && tokenSymbol !== '未知' && tokenSymbol !== userProvidedName) foundAliases.push(tokenSymbol)
        console.log(`  ✅ [NameResolve] 发现项目名(逆向): "${capitalized}" (别名: ${foundAliases.join(', ')})`)
        return { resolvedName: capitalized, aliases: foundAliases, originalName: userProvidedName }
      }
    }

    // 策略3：用答案摘要简单判断
    if (data.answer && data.answer.length > 20) {
      const userIdx = data.answer.toLowerCase().indexOf(userProvidedName.toLowerCase())
      if (userIdx >= 0) {
        const nearby = data.answer.substring(Math.max(0, userIdx - 50), Math.min(data.answer.length, userIdx + 100))
          .match(/([\w\.]{3,30})\s*(token|coin|代币)/gi)
        if (nearby && nearby.length > 0) {
          const alt = nearby[0].replace(/\b(token|coin|代币)\b/gi, '').trim()
          if (alt.length > 2 && alt.toUpperCase() !== userProvidedName.toUpperCase()) {
            const capitalized = alt.charAt(0).toUpperCase() + alt.slice(1)
            console.log(`  ✅ [NameResolve] 从摘要发现: "${capitalized}"`)
            return { resolvedName: capitalized, aliases: [userProvidedName], originalName: userProvidedName }
          }
        }
      }
    }

    console.log('  [NameResolve] 未能从搜索结果提取项目名，使用原名')

  } catch (err) {
    console.error('  [NameResolve] 搜索异常:', err.message)
  }

  // 兜底：用 onChain 数据中最长的候选名
  if (candidates.length > 0) {
    const best = candidates.sort((a, b) => b.length - a.length)[0]
    return {
      resolvedName: best,
      aliases: [userProvidedName, ...candidates.filter(c => c !== best)].filter((v, i, a) => a.indexOf(v) === i),
      originalName: userProvidedName
    }
  }

  return { resolvedName: userProvidedName, aliases: [], originalName: userProvidedName }
}

/**
 * 通过 Tavily API 搜索项目的最新公开信息
 * v5 融合版：v3(域名排序 + 去重 + AI摘要 + max5) + v4(2批次并行 + 命中检测 + 整合文本) + v4.1(锐化query)
 * 搜索质量第一，速度其次；4s批次超时，8s总超时；basic 深度对中文项目效果最佳
 */
async function fetchRealtimeInfo(projectName, contractAddress = null, skipCategories = new Set(), fundingIsKnown = false) {
  const startTime = Date.now();
  const BATCH_TIMEOUT = 4000;  // 单批次超时 4s
  const TOTAL_TIMEOUT = 8000;  // 总超时 8s

  // ========== 精简后的 5 条核心搜索（v5.15）==========
  // 原则：去重冗余项，每条搜索覆盖一个维度；Tavily 失败自动降级 DuckDuckGo
  const isShortName = projectName.length <= 3
  const searchContext = isShortName ? `${projectName}代币 ${projectName} token crypto` : projectName

  // 5 条核心搜索（覆盖安全审计、融资、牌照合规、法律实体、负面舆情）
  const allQueries = [
    { label: '审计', query: `${projectName} 审计 CertiK SlowMist "${projectName}" audit security` },
    { label: '融资', query: isShortName ? `${searchContext} 融资 投资 估值 funding raised investment million` : `${projectName} 融资 投资 估值 funding raised investment million` },
    { label: '牌照/监管', query: `${projectName} MSB牌照 SEC 监管 "${projectName}" license regulation MAS compliance` },
    { label: '法律实体', query: `${projectName} 注册地 法律实体 公司注册 "${projectName}" registered company incorporated legal entity` },
    { label: '负面舆情', query: `${projectName} 跑路 骗局 维权 scam rug pull fraud complaint 割韭菜 资金盘` },
  ];

  console.log(`  🔎 [搜索] 执行 ${allQueries.length} 条查询 (Tavily→DuckDuckGo降级)`);

  const tavilyApiKey = process.env.TAVILY_API_KEY;
  const engineLog = []; // 记录每次搜索使用的引擎

  // 5 条查询并行执行，每条各自降级
  const results = await Promise.allSettled(
    allQueries.map(q => searchSingle(q.label, q.query, tavilyApiKey, BATCH_TIMEOUT, engineLog))
  );

  const allQueryResults = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allQueryResults.push(r.value);
  }

  // 耗时分段记录
  const searchElapsed = Date.now() - startTime;

  // ─── 单条搜索执行器（含 Tavily→DuckDuckGo 降级）────────
  async function searchSingle(label, query, apiKey, timeout, engineLog) {
    const qStart = Date.now();
    const fallbackResult = await searchWithFallback(query, apiKey, timeout, engineLog);
    const elapsed = ((Date.now() - qStart) / 1000).toFixed(1);

    // 命中检测
    const hit = checkHit(label, fallbackResult.results);
    const hitLabel = getHitLabel(label);
    const engineIcon = fallbackResult.engine === 'tavily' ? '🔍' : fallbackResult.engine === 'duckduckgo' ? '🦆' : '❌';
    console.log(`  ${engineIcon} [${label}] 耗时 ${elapsed}s, ${fallbackResult.engine || '无引擎'}, 返回 ${fallbackResult.results.length} 条, 命中${hitLabel} ${hit ? '✅' : '❌'}`);

    return {
      label,
      results: fallbackResult.results,
      count: fallbackResult.results.length,
      elapsed,
      hit,
      answerText: fallbackResult.answerText || '',
    };
  }

  // ========== 结果解析与字段提取 ==========
  const allText = allQueryResults
    .map(r => r.results.map(item => item.title + ' ' + item.content).join(' '))
    .join(' ');

  const hasAudit      = /审计|安全审计|audit|CertiK|SlowMist/i.test(allText);
  const hasFunding    = /融资|获投|funding|raised|million|领投/i.test(allText);
  const hasLicense    = /牌照|许可证|license|MSB|MAS|监管|regulation/i.test(allText);
  const hasLegalEntity = /法律实体|注册地|legal entity|registered/i.test(allText);

  // 🆕 v5.14: 负面舆情检测（中文+英文关键词全面扫描）
  const hasNegativeSentiment = /跑路|骗局|骗|维权|投诉|卷款|崩盘|归零|提现困难|无法提现|限制提现|资金盘|杀猪盘|割韭菜|圈钱|空气币|失联|立案|报案|经侦|曝光|避雷|踩坑|黑幕|scam|fraud|rug.?pull|exit.?scam|complaint|ponzi|pyramid|collapse|disappeared/i.test(allText);
  searchHitNegative = hasNegativeSentiment;

  // 模式变更检测 v2：按搜索结果条目数计算，而非关键词种类数（更稳定）
  const modeChangeKeywords = [
    '模式变更', '更换模式', '升级', '置换', '矿机',
    '挖矿', '锁仓', '新项目', '转型', 'pivot', 'rebrand',
    '更名为', '改名', '更名', '迁移', '换皮', '重启', '转模式',
  ];
  
  // 收集所有查询结果中命中模式变更关键词的条目（去重 by title+URL）
  const hitSet = new Set()
  const modeChangeArticles = []  // 🆕 v5.7: 收集文章对象供缓存累积
  for (const qr of allQueryResults) {
    for (const item of qr.results) {
      const text = (item.title || '') + ' ' + (item.content || '')
      if (modeChangeKeywords.some(kw => text.includes(kw))) {
        const key = item.title || item.url || ''
        if (!hitSet.has(key)) {
          hitSet.add(key)
          modeChangeArticles.push({
            title: item.title,
            url: item.url,
            content: (item.content || '').slice(0, 200),  // 保存简要内容
          })
        }
      }
    }
  }
  const modeChangeCount = hitSet.size
  const hasModeChange = modeChangeCount > 0

  // 打印命中摘要
  console.log(
    `  📊 [搜索] 命中摘要: ` +
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
    console.log(`🔍 [搜索] 无搜索结果 (${elapsed}ms)`);
    return { text: '', flags: { hasAudit: false, hasFunding: false, hasLicense: false, hasLegalEntity: false, hasModeChange: false, modeChangeCount: 0, hasNegativeSentiment: false } };
  }

  // 按类别分组
  function getCategory(label) {
    if (label === '融资') return '融资信息';
    if (label === '审计') return '审计信息';
    if (label === '牌照/监管') return '牌照/监管';
    if (label === '法律实体') return '法律实体';
    if (label === '负面舆情') return '负面舆情';
    return label;
  }

  const categoryMap = new Map();
  for (const qr of allQueryResults) {
    const cat = getCategory(qr.label);
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    const existing = categoryMap.get(cat);
    for (const item of qr.results) {
      if (!existing.some(e => e.url === item.url)) {
        existing.push(item);
      }
    }
  }

  // 格式化各分类（固定顺序，每类最多3条）
  const catOrder = ['负面舆情', '融资信息', '审计信息', '牌照/监管', '法律实体'];
  const sections = [];
  for (const cat of catOrder) {
    const items = categoryMap.get(cat);
    if (!items || items.length === 0) continue;
    const lines = [`【${cat}】`];
    // AI 摘要优先展示（v3 恢复）
    for (const qr of allQueryResults) {
      if (getCategory(qr.label) === cat && qr.answerText) {
        lines.push(`> **AI 摘要**：${qr.answerText.slice(0, 300)}`);
        break; // 每类只显示第一条 AI 摘要
      }
    }
    for (const item of items.slice(0, 3)) {  // v5.10: 2→3，每类多1条给DeepSeek更多参考
      const source = item.url
        ? new URL(item.url).hostname.replace(/^www\./, '')
        : '未知来源';
      lines.push(`- 来源: ${source}`);
      lines.push(`  摘要: ${item.content}`);
    }
    sections.push(lines.join('\n'));
  }

  const elapsed = Date.now() - startTime;

  // 命中标记行（供 DeepSeek 快速了解搜索覆盖情况）
  const hints = [
    hasNegativeSentiment ? '负面舆情🚨✅' : '负面舆情❌',
    hasAudit ? '审计✅' : '审计❌',
    hasFunding ? '融资✅' : '融资❌',
    hasLicense ? '牌照✅' : '牌照❌',
    hasLegalEntity ? '法律实体✅' : '法律实体❌',
    hasModeChange ? `模式变更✅(${modeChangeCount}项)` : '模式变更❌',
  ].join(' | ');

  return { text: `## 实时网络搜索结果（仅供参考，不替代 AI 判断）\n\n> **重要**：以下仅为实时互联网搜索命中的结果。未搜到不代表项目不存在相关信息（可能是搜索覆盖不全、项目信息不对中文开放等）。AI 评估时**必须结合训练数据中的已知项目事实做独立判断**，不可因搜索未命中而忽略客观事实。\n\n> 搜索覆盖: ${hints}\n\n${sections.join('\n\n')}`, flags: { hasAudit, hasFunding, hasLicense, hasLegalEntity, hasModeChange, modeChangeCount, modeChangeArticles, hasNegativeSentiment } };
}

// ===== 阶段三：证据文本构建辅助函数 =====
// 按状态分类将证据格式化为 Prompt 可用的文本块
// 参数：
//   evidences - 证据数组 [{id, content, image_description, image_url, evidence_category, verification_count}]
//   statusLabel - 中文状态标签，如 "已验证（≥3人确认，强制纳入评分）"
//   annotatePrefix - AI 引用时的标注前缀，如 "社区验证"、"用户反映"、"用户提供，待核实"
function buildEvidenceText(evidences, statusLabel, annotatePrefix) {
  if (!evidences || evidences.length === 0) return '';
  const lines = [];
  for (const ev of evidences) {
    const catMap = { mode_change: '模式变更', withdraw_issue: '出金障碍', central_control: '中心化控制', team_info: '团队信息' };
    const catName = catMap[ev.evidence_category] || '其他';
    let parts = [];
    if (ev.content) parts.push(ev.content.slice(0, 120));
    if (ev.image_description) parts.push(`📷图片分析：${ev.image_description.slice(0, 150)}`);
    if (ev.image_url && !ev.image_description) parts.push(`📷图片链接：${ev.image_url}`);
    const body = parts.join('；');
    const vcNote = ev.verification_count > 0 ? `（${ev.verification_count}人验证）` : '';
    lines.push(`- 【${catName}】${body}${vcNote}`);
  }
  return `\n### ${statusLabel}（${evidences.length}条）\n${lines.join('\n')}\n> AI 引用时请标注"【${annotatePrefix}】"`;
}

async function handleGenerateReport(req, res) {
  const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return jsonRes(res, 500, { error: 'Missing DEEPSEEK_API_KEY' });
  }

  const body = await readBody(req);
  const { project_name, contract_address, user_notes, user_notes_images, quick_verify, user_address } = body;

  if (!project_name || !project_name.trim()) {
    return jsonRes(res, 400, { error: 'project_name is required' });
  }

  // ── 后端支付校验（防匿名调用 + 防刷）───────
  const callerAddr = user_address?.trim() || '';
  if (!callerAddr) {
    return jsonRes(res, 403, { error: 'user_address is required for payment validation' });
  }

  // 30秒防刷：同一用户 + 同一合约地址，禁止重复调用
  // ⚠️ 快速验证（quick_verify）不触发防刷，也不写缓存，避免 blocking 紧接着的正常报告请求
  const antiSpamKey = `report_spam_${callerAddr.toLowerCase()}_${(contract_address || '').toLowerCase()}`;
  const lastCall = antiSpamCache.get(antiSpamKey);
  const now = Date.now();
  if (!quick_verify && lastCall && (now - lastCall) < 30000) {
    console.warn(`🚫 防刷拦截: ${callerAddr.slice(0,10)}... / ${(contract_address || '').slice(0,10)}... (间隔 ${((now - lastCall)/1000).toFixed(1)}s)`);
    return jsonRes(res, 429, { error: '请勿频繁调用，30秒后再试' });
  }
  if (!quick_verify) {
    antiSpamCache.set(antiSpamKey, now);
  }

  const projectName = project_name.trim();
  const address = contract_address?.trim() || '未提供';
  let detectedChain = 'unknown';

  // 🔗 合约地址验证（格式检查 + 链上验证）
  if (address && address !== '未提供') {
    detectedChain = detectChain(address) || 'evm'

    if (quick_verify) {
      // 🆕 v5.11: 先查缓存 — 已经扫描归档的项目（project_facts 中有记录）
      //    直接放行，不必重新链上验证。
      //    防止 RPC 波动/超时导致已知合约被误判"非合约"。
      let cacheVerified = false
      if (address) {
        try {
          const { source } = await getFacts(address)
          if (source !== 'none') {
            console.log(`📦 [quick_verify] 缓存命中（${source}），跳过链上验证: ${address}`)
            cacheVerified = true
          }
        } catch (e) {
          console.log(`⚠️ [quick_verify] 缓存查询异常（降级链上验证）: ${e.message}`)
        }
      }

      if (!cacheVerified) {
        // 🔗 链上快速验证（5 条主流 EVM 链: ETH/BSC/Polygon/Arbitrum/Base）
        //    失败后自动降级为全量扫描（10 条 EVM 链 + TRON/Solana）
        //    防止 Linea/Scroll/zkSync/Optimism/Avalanche 等链上的合约被误杀
        console.log(`🔗 快速验证合约地址: ${address}`)
        let result = await isValidContract(address, { fastMode: true })
        if (!result.valid) {
          console.log(`⚠️ 快速验证未命中，降级全量扫描: ${address}`)
          result = await isValidContract(address, { fastMode: false })
          if (!result.valid) {
            console.log(`❌ 全量扫描也失败: ${address} — ${result.reason}`)
            const chainLabel =
              result.chain === 'evm' ? 'EVM 兼容链（ETH/BSC/Polygon/Arbitrum/Base 等 10 链）'
              : result.chain === 'tron' ? 'TRON 链'
              : result.chain === 'solana' ? 'Solana 链'
              : result.chain
            return jsonRes(res, 200, {
              success: false,
              verified: false,
              error: `合约地址验证失败：${result.reason}。\n\n请检查地址和链类型是否正确。`,
            })
          }
        }
        detectedChain = result.chain
        console.log(`✅ 合约验证通过: ${address} (${detectedChain})`)
      } else {
        // 缓存旁路通过 — 不需要链上验证
        console.log(`✅ [quick_verify] 缓存旁路通过: ${address}`)
      }
    } else {
      // 🔗 完整验证：验所有 12 条链（10 EVM + TRON + Solana）
      // 🆕 v5.11: 先查缓存 — 已归档的项目直接放行
      let cacheVerified = false
      if (address) {
        try {
          const { source } = await getFacts(address)
          if (source !== 'none') {
            console.log(`📦 [完整验证] 缓存命中（${source}），跳过链上验证: ${address}`)
            cacheVerified = true
          }
        } catch (e) {
          console.log(`⚠️ [完整验证] 缓存查询异常（降级链上验证）: ${e.message}`)
        }
      }
      if (!cacheVerified) {
        console.log(`🔗 完整验证合约地址: ${address}`)
        const result = await isValidContract(address)
        detectedChain = result.chain
        if (!result.valid) {
          console.log(`❌ 合约地址验证失败: ${address} (${result.chain})`)
          const chainLabel =
            result.chain === 'evm' ? 'EVM 兼容链（ETH/BSC/Polygon/Arbitrum/Base 等 10 链）'
            : result.chain === 'tron' ? 'TRON 链'
            : result.chain === 'solana' ? 'Solana 链'
            : result.chain
          return jsonRes(res, 200, {
            success: false,
            error: `合约地址验证失败：${result.reason}。\n请检查地址和链类型是否正确。`,
          })
        }
        detectedChain = result.chain
        console.log(`✅ 合约地址验证通过: ${address} (${detectedChain})`)
      } else {
        console.log(`✅ [完整验证] 缓存旁路通过: ${address}`)
      }
    }
  }

  // 🚀 快速验证模式：返回验证结果
  if (quick_verify) {
    return jsonRes(res, 200, {
      success: true,
      verified: true,
      chain: detectedChain,
      data: {
        chain: detectedChain,
        verified_at: new Date().toISOString(),
      },
    })
  }

  // 🆕 Tier 1: 报告缓存检查（2h TTL）
  // ⚠️ 即使命中缓存，也必须拉取链上数据（onChainData）并应用交叉惩罚——
  //    链上数据不缓存，2h 内 tokenSymbol 和评分修正是必需的
  let tier1CachedData = null;
  let tier1CachedAt = null;
  if (address && address !== '未提供') {
    const { hit, report, cachedAt } = await getReportCache(address);
    if (hit && report) {
      tier1CachedData = report;
      tier1CachedAt = cachedAt;
      console.log(`📦 [Ledger] Tier1 命中！(cached: ${cachedAt}) — 将修正后返回`);
    }
  }

  const notes = user_notes?.trim() || '';

  // 🆕 处理表单"补充说明"中的图片：上传 + AI 分析（并行，不阻塞）
  let formImageAnalysis = '';
  const userImages = Array.isArray(user_notes_images) ? user_notes_images.filter(Boolean) : [];
  if (userImages.length > 0 && address && address !== '未提供') {
    console.log(`🖼️ [表单图片] 收到 ${userImages.length} 张图片，开始上传 + AI 分析...`);
    const imgResults = await Promise.allSettled(
      userImages.map(async (b64, i) => {
        const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
        const fileName = `form_${address.toLowerCase()}_${Date.now()}_${i}.png`;
        try {
          const supabase = await getSupabase();
          const { error: upErr } = await supabase.storage
            .from('evidence-images')
            .upload(fileName, Buffer.from(base64Data, 'base64'), {
              contentType: 'image/png',
              upsert: false,
            });
          if (upErr) {
            console.error(`[表单图片] 上传失败 (${i}):`, upErr.message);
            return null;
          }
          const { data: urlData } = supabase.storage
            .from('evidence-images')
            .getPublicUrl(fileName);
          const publicUrl = urlData?.publicUrl;
          if (publicUrl) {
            const desc = await analyzeImage(publicUrl);
            return desc ? `[图片${i+1}] ${desc}` : null;
          }
        } catch (err) {
          console.error(`[表单图片] 处理失败 (${i}):`, err.message);
        }
        return null;
      })
    );
    const imgDescriptions = imgResults
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);
    if (imgDescriptions.length > 0) {
      formImageAnalysis = '\n\n## 用户提交的图片分析\n' + imgDescriptions.join('\n\n');
      console.log(`🖼️ [表单图片] ${imgDescriptions.length}/${userImages.length} 张图片分析成功`);
    }
  }

  // 将表单图片分析合并到 notes（供 DeepSeek 使用）
  const effectiveNotes = notes + formImageAnalysis;
  
  // 🔗 获取 BSC 链上数据（仅当检测到 BSC 链时，通过 NodeReal RPC）
  // ⚠️ 顺序调整：先获取链上数据 + GoPlus，再用合约地址反查正确项目名，最后才做 Tavily 搜索
  //    避免用户填错项目名（如"MY"而非"Metya"）导致搜索结果不准
  let onChainInfo = '';
  let onChainData = null;  // 结构化链上数据，随 API 响应返回给前端
  if (address && address !== '未提供' && detectedChain === 'bsc') {
    try {
      console.log(`🔗 [NodeReal] 获取链上数据: ${address}`);
      const [tokenInfo, contractStatus] = await Promise.all([
        getTokenInfo(address),
        getContractStatus(address),
      ]);
      const formattedSupply = formatSupply(tokenInfo.totalSupply, tokenInfo.decimals);
      onChainData = {
        tokenName: tokenInfo.name,
        tokenSymbol: tokenInfo.symbol,
        totalSupply: formattedSupply,
        decimals: tokenInfo.decimals,
        isContract: contractStatus.isContract,
        codeSize: contractStatus.codeSize,
        chain: 'bsc',
      };
      onChainInfo = `
## 链上数据（NodeReal RPC）
- 代币名称：${tokenInfo.name} (${tokenInfo.symbol})
- 小数位数：${tokenInfo.decimals}
- 总供应量：${formattedSupply}
- 合约状态：${contractStatus.isContract ? `✅ 已验证合约 (bytecode ${contractStatus.codeSize} 字节)` : '❌ 非合约地址或无法读取'}`;
      console.log(`✅ [NodeReal] 链上数据获取成功: ${tokenInfo.name} (${tokenInfo.symbol})`);
    } catch (err) {
      console.error('[NodeReal] 获取链上数据失败:', err.message);
      onChainInfo = '\n## 链上数据\n- 暂无法获取链上数据（RPC 连接失败，请检查 NODEREAL_RPC_URL 配置）\n';
    }
  } else if (address && address !== '未提供' && detectedChain !== 'unknown') {
    onChainInfo = `\n## 链上数据\n- 当前链（${detectedChain}）暂未接入链上数据 RPC，链上指标将由 AI 根据公开信息估算。\n`;
  }

  // 🔍 GoPlus Security — 缓存路径也需要 GoPlus 数据（否则缓存命中时前端 onChainData.goplus 缺失）
  const evmChains = ['bsc', 'ethereum', 'evm', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'base', 'linea', 'scroll', 'zksync'];
  const goplusChainMap = { bsc: 56, ethereum: 1, polygon: 137, arbitrum: 42161, optimism: 10, avalanche: 43114, base: 8453, linea: 59144, scroll: 534352, zksync: 324 };
  const isEvmAddress = evmChains.includes(detectedChain);
  const goplusChainId = goplusChainMap[detectedChain] || 56;
  if (address && address !== '未提供' && isEvmAddress) {
    try {
      const security = await getTokenSecurity(address, goplusChainId);
      const goPlusData = {
        tokenName: security.tokenName,            // 🆕 关联代币：非BSC链的唯一tokenSymbol来源
        tokenSymbol: security.tokenSymbol,        // 🆕 关联代币
        lpLockStatus: security.lpLockStatus,
        lpLockInfo: security.lpLockInfo,
        lpOwnerAddress: security.lpOwnerAddress,
        lpOwnerPercent: security.lpOwnerPercent,
        top10Percent: security.top10Percent,
        top1Percent: security.top1Percent,       // 新增：第一大持仓
        holderCount: security.holderCount,
        lpHolderCount: security.lpHolderCount,
        isOpenSource: security.isOpenSource,
        isHoneypot: security.isHoneypot,
        isAntiWhale: security.isAntiWhale,
        isBlacklisted: security.isBlacklisted,
        isMintable: security.isMintable,
        isProxy: security.isProxy,
        hiddenOwner: security.hiddenOwner,
        transferPausable: security.transferPausable,
        buyTax: security.buyTax,
        sellTax: security.sellTax,
        creatorAddress: security.creatorAddress,
        creatorPercent: security.creatorPercent,
        ownerAddress: security.ownerAddress,
        ownerPercent: security.ownerPercent,
        isTrustToken: security.isTrustToken,
        dexInfo: security.dexInfo,
        otherRisks: security.otherRisks,
      };
      if (!onChainData) onChainData = {};
      onChainData.goplus = goPlusData;

      // 🆕 非BSC链：从 GoPlus 提取 tokenSymbol 放到 onChainData 顶层（前端 linkedToken 数据源）
      if (!onChainData.tokenSymbol && goPlusData.tokenSymbol) {
        onChainData.tokenName = goPlusData.tokenName;
        onChainData.tokenSymbol = goPlusData.tokenSymbol;
      }

      console.log(`🔍 [GoPlus] 已获取安全数据: lock=${security.lpLockStatus}, top10=${security.top10Percent}%, symbol=${goPlusData.tokenSymbol || 'N/A'}`);
    } catch (err) {
      console.error('[GoPlus] 安全扫描失败:', err.message);
      if (!onChainData) onChainData = {};
      onChainData.goplus = { lpLockStatus: '未知', lpLockInfo: null, top10Percent: null, top1Percent: null, isOpenSource: null };
    }
  }

  // 🆕 Tier 1 缓存命中后快速返回（onChainData 已包含 GoPlus 数据，交叉惩罚在返回前修正）
  if (tier1CachedData) {
    const reportData = { ...tier1CachedData };  // shallow copy 避免修改缓存

    // 🔧 v5.6：缓存命中也要执行交叉惩罚修正
    // Tier 2 事实缓存中 modeChangeCount 可能已累积，但缓存的 AI 报告里 score 是旧的
    let cachedModeCount = 0;
    if (address && address !== '未提供') {
      const { facts } = await getFacts(address);
      cachedModeCount = facts?.modeChangeCount || 0;

      // 🚨 缓存命中时检测已确认崩盘/跑路证据（verifiedEvidence 中 ≥3 人验证的证据）
      const hasCrashEvidence = facts?.verifiedEvidence?.some(ev =>
        /崩盘|跑路|rug.?pull|exit.?scam|团队失联|关停|停止运营|crashed|scam/i.test(ev.content || '')
      );
      if (hasCrashEvidence) {
        const histDim = reportData.six_dimensions?.find(d => d.dimension?.includes('历史'));
        if (histDim && histDim.score > 0) {
          const oldScore = histDim.score;
          histDim.score = 0;
          histDim.deduction = (histDim.deduction || '') + '；🚨 项目已确认崩盘/跑路（社区验证），历史可靠性强制归零';
          console.log(`🚨 [缓存→崩盘检测] 检测到已确认崩盘证据，历史可靠性 ${oldScore} → 0`);
        }
        // 提前重算 total_score（崩盘历史归零后需反映在总分）
        const _CRASH_DIM = {
          '代码与技术安全': { maxScore: 25, weight: 0.25 },
          '团队与运营透明度': { maxScore: 20, weight: 0.20 },
          '经济模型与资金安全': { maxScore: 20, weight: 0.20 },
          '社群与市场热度': { maxScore: 15, weight: 0.15 },
          '历史与执行可靠性': { maxScore: 10, weight: 0.10 },
          '合规性与法律风险': { maxScore: 10, weight: 0.10 },
        };
        let newTotal = 0;
        for (const d of (reportData.six_dimensions || [])) {
          const key = Object.keys(_CRASH_DIM).find(k => d.dimension?.includes(k));
          if (key && d.score != null) {
            const { maxScore, weight } = _CRASH_DIM[key];
            newTotal += (d.score / maxScore) * weight * 100;
          }
        }
        reportData.total_score = Math.min(100, Math.round(newTotal));
        console.log(`🚨 [缓存→崩盘检测] 总分重算后: ${reportData.total_score}`);
      }

      if (cachedModeCount >= 2) {
        const econDim = reportData.six_dimensions?.find(d => d.dimension?.includes('经济模型'));
        if (econDim) {
          const hasWithdrawIssue = /出金障碍|出金异常|提现困难|资金.*锁|无法提现|置换/.test(econDim.deduction || '');
          const maxAllowedScore = hasWithdrawIssue ? 10 : 15;
          if (econDim.score > maxAllowedScore) {
            const penalty = econDim.score - maxAllowedScore;
            econDim.score = maxAllowedScore;
            econDim.deduction = (econDim.deduction || '') + `；⚠️ 模式变更≥${cachedModeCount}次，经济模型稳定性存疑（缓存修正-${penalty}）`;
            console.log(`🔧 [缓存→交叉惩罚] Tier1命中后修正: econ.score ${econDim.score + penalty} → ${econDim.score}, modeChangeCount=${cachedModeCount}`);
            // 重算 total_score（加权归一化，与其他路径一致）
            const _DIM_SPEC = {
              '代码与技术安全': { maxScore: 25, weight: 0.25 },
              '团队与运营透明度': { maxScore: 20, weight: 0.20 },
              '经济模型与资金安全': { maxScore: 20, weight: 0.20 },
              '社群与市场热度': { maxScore: 15, weight: 0.15 },
              '历史与执行可靠性': { maxScore: 10, weight: 0.10 },
              '合规性与法律风险': { maxScore: 10, weight: 0.10 },
            };
            let newTotal = 0;
            for (const d of (reportData.six_dimensions || [])) {
              const key = Object.keys(_DIM_SPEC).find(k => d.dimension?.includes(k));
              if (key && d.score != null) {
                const { maxScore, weight } = _DIM_SPEC[key];
                newTotal += (d.score / maxScore) * weight * 100;
              }
            }
            reportData.total_score = Math.min(100, Math.round(newTotal));
          }
        }
      }
    }

    // 🔥 评分一致性约束：历史可靠性 ≤5 → 额外 -10（独立于模式变更交叉惩罚）
    const cacheHistDim = reportData.six_dimensions?.find(d => d.dimension?.includes('历史'));
    if (cacheHistDim && cacheHistDim.score != null && cacheHistDim.score <= 5) {
      reportData.total_score = Math.max(0, reportData.total_score - 10);
      console.log(`🔧 [缓存→历史惩罚] 历史可靠性=${cacheHistDim.score}分，总分 -10`);
    }
    // 🚨 已崩盘硬性封顶（缓存路径，独立于模式变更）
    if (cacheHistDim && cacheHistDim.score === 0) {
      // 🔥 v5.19: 检查是否有已验证的恶意特征证据（如强制锁仓/强制置换）
      const hasMaliciousEvidence = facts?.verifiedEvidence?.some(ev =>
        /强制锁仓|资金被锁|强制置换|强制兑换|提现关闭|社群解散|项目方操控|强制终止|单方面修改/.test(ev.content || '')
      );
      // 区分归零原因：≥3次变更 + 有恶意证据 → 封顶；=2次 → 不封顶；≥3次 + 无恶意 → 封顶但标注"高风险"
      const shouldCap = (cachedModeCount >= 3) || (cachedModeCount < 2);
      if (shouldCap) {
        // 如果模式变更≥3次但无恶意证据 → 用高风险替代崩盘封顶
        if (cachedModeCount >= 3 && !hasMaliciousEvidence && !hasCrashEvidence) {
          // 修正历史维度为 2 分（不归零）
          cacheHistDim.score = 2;
          cacheHistDim.deduction = (cacheHistDim.deduction || '') + '；⚠️ 模式变更≥3次但未检测到恶意特征，标记为高风险（缓存修正）';
          console.log(`🔧 [缓存→恶意特征] 模式变更≥${cachedModeCount}次无恶意特征，历史维度改为 2/10，跳过崩盘封顶`);
          // 不执行封顶，跳过下方封顶代码
        } else {
          const beforeCap = reportData.total_score;
          reportData.total_score = Math.min(reportData.total_score, 35);
          const reason = cachedModeCount >= 3 ? `模式变更≥${cachedModeCount}次` : `已确认崩盘/跑路`;
          if (beforeCap !== reportData.total_score) {
            console.log(`🚨 [缓存→崩盘封顶] ${reason}，总分 ${beforeCap} → ${reportData.total_score}（强制 ≤35）`);
          }
          reportData.risk_level = '极高风险';
          reportData.conclusion = '严禁参与（该项目已确认崩盘/跑路，资金存在永久性损失风险）';
        }
      } else {
        console.log(`🔧 [缓存→封顶跳过] 模式变更=${cachedModeCount}次，历史归零但不封顶`);
      }
    }

    // ========== 🆕 缓存幻觉统一清理（对所有缓存命中生效，不限于崩盘路径）==========
    // 清理 ai_summary 中与六维得分矛盾的幻觉文本
    if (reportData.ai_summary && typeof reportData.ai_summary === 'string') {
      // 合规性 ≤2 分 → 清理牌照相关幻觉
      const cacheComplianceDim = reportData.six_dimensions?.find(d => d.dimension?.includes('合规'));
      if (cacheComplianceDim && cacheComplianceDim.score != null && cacheComplianceDim.score <= 2) {
        reportData.ai_summary = reportData.ai_summary
          .replace(/[^。]*持有合规牌照[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*合规牌照[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*持牌经营[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*已获.*牌[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*牌照[^，。]*合规[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*获.*牌[^。]*(?:[。]|$)/g, '')
          .trim();
        console.log(`🧹 [缓存→幻觉清理] 合规性=${cacheComplianceDim.score}分，清理牌照类幻觉文本`);
      }
      // 代码安全 ≤5 分 → 清理审计类幻觉
      const cacheCodeDim = reportData.six_dimensions?.find(d => d.dimension?.includes('代码'));
      if (cacheCodeDim && cacheCodeDim.score != null && cacheCodeDim.score <= 5) {
        reportData.ai_summary = reportData.ai_summary
          .replace(/[^。]*已完成安全审计[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*通过.*审计[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*审计报告.*通过[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*CertiK[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*SlowMist[^。]*(?:[。]|$)/g, '')
          .trim();
        console.log(`🧹 [缓存→幻觉清理] 代码安全=${cacheCodeDim.score}分，清理审计类幻觉文本`);
      }
    }

    // 清理 public_opinion 中的 AI 幻觉（牌照等）
    if (reportData.public_opinion) {
      const cleanText = (t) => typeof t === 'string'
        ? t.replace(/[^。]*持有合规牌照[^。]*(?:[。]|$)/g, '')
           .replace(/[^。]*合规牌照[^。]*(?:[。]|$)/g, '')
           .replace(/[^。]*持牌经营[^。]*(?:[。]|$)/g, '')
           .trim()
        : t;

      if (typeof reportData.public_opinion === 'object') {
        if (reportData.public_opinion.summary) {
          reportData.public_opinion.summary = cleanText(reportData.public_opinion.summary);
        }
      } else {
        reportData.public_opinion = cleanText(reportData.public_opinion);
      }
    }

    // ========== 🆕 英文术语统一替换为中文白话（缓存路径）==========

    if (reportData.ai_summary && typeof reportData.ai_summary === 'string') {
      reportData.ai_summary = localizeEnTerms(reportData.ai_summary);
    }
    if (reportData.public_opinion) {
      if (typeof reportData.public_opinion === 'object') {
        if (reportData.public_opinion.summary) {
          reportData.public_opinion.summary = localizeEnTerms(reportData.public_opinion.summary);
        }
      } else if (typeof reportData.public_opinion === 'string') {
        reportData.public_opinion = localizeEnTerms(reportData.public_opinion);
      }
    }

    // ========== 🆕 v5.13: TOP10 ≥ 90% → 历史维度自动归零（缓存路径）==========
    const cacheTop10 = onChainData?.goplus?.top10Percent;
    if (cacheTop10 != null && cacheTop10 >= 90) {
      const cacheAutoHistDim = reportData.six_dimensions?.find(d => d.dimension?.includes('历史'));
      if (cacheAutoHistDim && cacheAutoHistDim.score > 0) {
        console.log(`🚨 [缓存→自动修正] TOP10=${cacheTop10}%≥90%，历史维度 ${cacheAutoHistDim.score}/10 → 0/10`);
        cacheAutoHistDim.score = 0;
        cacheAutoHistDim.deduction = (cacheAutoHistDim.deduction || '') + '；🚨 TOP10持仓≥' + cacheTop10 + '%，代币被少数地址绝对控制';
      }
    }

    return jsonRes(res, 200, {
      success: true,
      data: reportData,
      chain: detectedChain,
      onChainData,  // ✅ 不再返回 null！
      fromCache: true,
      cachedAt: tier1CachedAt,
    });
  }

  // 🔍 GoPlus 数据已在上方（缓存路径+非缓存路径）统一获取
  //    此处仅构建 GoPlus 文本段落供 DeepSeek prompt 使用（非缓存路径）
  if (!onChainData?.goplus && address && address !== '未提供') {
    // fallback: 如果上方获取失败，给一个默认空对象
    if (!onChainData) onChainData = {};
    onChainData.goplus = { lpLockStatus: '未知', lpLockInfo: null, top10Percent: null, top1Percent: null, isOpenSource: null };
  }
  const gd = onChainData?.goplus;
  const goPlusLockStatus = gd?.lpLockStatus || '未知';
  const goPlusTop10Percent = gd?.top10Percent ?? null;
  const goPlusTop1Percent = gd?.top1Percent ?? null;   // 新增：TOP1 占比

  // 非缓存路径：构建 GoPlus 文本段落注入 DeepSeek prompt
  if (!tier1CachedData && gd) {
      let goPlusInfo = '\n## 🔗 GoPlus 安全扫描数据（链上数据源，100% 可验证）\n\n';
      goPlusInfo += '以下数据来自 GoPlus Security Token Security API 链上实测，非 AI 推测。';

      // ── LP 锁仓 ──
      goPlusInfo += '\n### 流动性锁仓\n';
      if (goPlusLockStatus === '已锁定') {
        goPlusInfo += '- ✅ LP 流动性已锁定（Rug Pull 风险低）\n';
        if (gd.lpLockInfo) goPlusInfo += `  - 锁仓详情：${gd.lpLockInfo}\n`;
      } else if (goPlusLockStatus === '未锁定') {
        goPlusInfo += '- ❌ LP 流动性未锁定（⚠️ 高风险：Rug Pull 可能）\n';
        if (gd.lpLockInfo) goPlusInfo += `  - ${gd.lpLockInfo}\n`;
      } else {
        goPlusInfo += '- ⚠️ LP 锁仓状态：无法确认（该项目 LP 数据未被收录或不在 DEX 交易）\n';
      }
      if (gd.lpOwnerAddress) {
        goPlusInfo += `  - 主 LP 持有者：\`${gd.lpOwnerAddress.slice(0, 12)}...\` (${gd.lpOwnerPercent ? (parseFloat(gd.lpOwnerPercent) * 100).toFixed(1) + '%' : '未知占比'})\n`;
      }

      // ── 持仓集中度 ──
      goPlusInfo += '\n### 持仓分布\n';
      if (goPlusTop10Percent !== null) {
        const level = goPlusTop10Percent >= 70 ? '🔴 极高（控盘严重）' : goPlusTop10Percent >= 50 ? '🟡 偏高' : '🟢 正常';
        goPlusInfo += `- TOP10 持仓占比：${goPlusTop10Percent.toFixed(1)}%（${level}，已自动排除销毁地址）\n`;
        if (goPlusTop1Percent !== null) {
          goPlusInfo += `- TOP1 持仓占比：${goPlusTop1Percent.toFixed(1)}%\n`;
        }
      } else {
        goPlusInfo += '- TOP10 持仓占比：暂无数据\n';
      }
      if (gd.holderCount) goPlusInfo += `- 持有者总数：${gd.holderCount}\n`;
      if (gd.lpHolderCount) goPlusInfo += `- LP 持有者数量：${gd.lpHolderCount}\n`;

      // ── 创建者/所有者 ──
      if (gd.creatorAddress || gd.ownerAddress) {
        goPlusInfo += '\n### 合约权限\n';
        if (gd.creatorAddress) {
          const creatorPct = gd.creatorPercent != null ? (gd.creatorPercent * 100).toFixed(2) + '%' : '未知';
          goPlusInfo += `- 创建者：\`${gd.creatorAddress.slice(0, 12)}...\` | 持仓 ${creatorPct}\n`;
        }
        if (gd.ownerAddress) {
          const ownerPct = gd.ownerPercent != null ? (gd.ownerPercent * 100).toFixed(2) + '%' : '未知';
          goPlusInfo += `- 合约所有者：\`${gd.ownerAddress.slice(0, 12)}...\` | 持仓 ${ownerPct}\n`;
        }
        if (gd.isMintable === true) goPlusInfo += '- ⚠️ 可增发（Mintable）：所有者可铸造新代币 → 可能触发抛售\n';
        if (gd.hiddenOwner === true) goPlusInfo += '- ⚠️ 隐藏所有者：合约所有者已隐藏 → 高风险信号\n';
        if (gd.isProxy === true) goPlusInfo += '- ⚠️ 代理合约：逻辑可被升级替换 → 需额外审计\n';
      }

      // ── 合约安全标志 ──
      goPlusInfo += '\n### 代码安全\n';
      goPlusInfo += `- 合约开源：${gd.isOpenSource === true ? '✅ 已开源' : gd.isOpenSource === false ? '❌ 未开源（无法审计，最高风险）' : '⚠️ 未知'}\n`;
      if (gd.isHoneypot === true) goPlusInfo += '- 🔴 蜜罐检测：该合约被识别为蜜罐代币（无法卖出）\n';
      if (gd.isAntiWhale === true) goPlusInfo += '- ℹ️ 反鲸鱼机制：已启用（限制大额交易/持仓）\n';
      if (gd.isBlacklisted === true) goPlusInfo += '- ⚠️ 黑名单功能：合约可冻结特定地址\n';
      if (gd.transferPausable === true) goPlusInfo += '- ⚠️ 交易暂停：所有者可暂停所有转账\n';
      if (gd.isTrustToken === true) goPlusInfo += '- ✅ 信任列表：该代币在 GoPlus 信任名单中\n';

      // ── 交易税 ──
      if (gd.buyTax != null || gd.sellTax != null) {
        goPlusInfo += '\n### 交易税\n';
        if (gd.buyTax != null) {
          const level = gd.buyTax >= 0.1 ? '🔴 极高' : gd.buyTax >= 0.05 ? '🟡 偏高' : '🟢 正常';
          goPlusInfo += `- 买入税：${(gd.buyTax * 100).toFixed(1)}%（${level}）\n`;
        }
        if (gd.sellTax != null) {
          const level = gd.sellTax >= 0.1 ? '🔴 极高' : gd.sellTax >= 0.05 ? '🟡 偏高' : '🟢 正常';
          goPlusInfo += `- 卖出税：${(gd.sellTax * 100).toFixed(1)}%（${level}）\n`;
        }
      }

      // ── 审计说明 ──
      goPlusInfo += '\n### 审计\n';
      goPlusInfo += '- ℹ️ GoPlus Token Security API 不提供审计报告字段（已查官方文档确认）。';
      goPlusInfo += '审计数据需通过 Tavily 网络搜索模块获取（CertiK、SlowMist 等审计机构报告）。\n';

      // ── 其他风险 ──
      if (gd.otherRisks) {
        goPlusInfo += '\n### 其他风险\n';
        goPlusInfo += `- ⚠️ ${gd.otherRisks}\n`;
      }

      // ── 评分指引 ──
      goPlusInfo += '\n### 📋 链上数据评分指引（供 AI 严格参考）\n';
      goPlusInfo += '| 检测结果 | 影响维度 | 分数调整 |\n';
      goPlusInfo += '|---------|---------|--------|\n';
      goPlusInfo += '| LP 已锁定 | 经济模型与资金安全 | +5 |\n';
      goPlusInfo += '| LP 未锁定 | 经济模型与资金安全 | -10 |\n';
      goPlusInfo += '| TOP10 ≥ 90% | 经济模型与资金安全 | -15（强制该维度 ≤5 分） |\n';
      goPlusInfo += '| TOP10 70-90% | 经济模型与资金安全 | -10 |\n';
      goPlusInfo += '| TOP10 50-70% | 经济模型与资金安全 | -7 |\n';
      goPlusInfo += '| 蜜罐检测命中 | 代码与技术安全 | 直接 0 分 |\n';
      goPlusInfo += '| 未开源 | 代码与技术安全 | 最多 10 分 |\n';
      goPlusInfo += '| 黑名单功能 | 代码与技术安全 | -5 |\n';
      goPlusInfo += '| 交易可暂停 | 代码与技术安全 | -5 |\n';
      goPlusInfo += '| TOP10 ≥ 90% | 代码与技术安全 | -15（控盘-10 + 联动-5，叠加生效） |\n';
      goPlusInfo += '| TOP10 ≥ 80% | 代码与技术安全 | -10（控盘-5 + 联动-5，叠加生效） |\n';
      goPlusInfo += '| TOP10 ≥ 70% | 代码与技术安全 | -3（控盘风险，联动未触发） |\n';
      goPlusInfo += '| 可增发 | 经济模型与资金安全 | -5 |\n';
      goPlusInfo += '| 隐藏所有者 | 团队与运营透明度 | -10 |\n';
      goPlusInfo += '| 买入税 ≥ 10% | 经济模型与资金安全 | -5 |\n';
      goPlusInfo += '| 卖出税 ≥ 10% | 经济模型与资金安全 | -5 |\n';

      // 追加到 onChainInfo
      onChainInfo += goPlusInfo;
      console.log(`✅ [GoPlus] 文本构建完成: LP=${goPlusLockStatus}, TOP10=${goPlusTop10Percent}%, 开源=${gd.isOpenSource}`);
  }

  // 🔍 合约地址反查项目真名 + Tavily 搜索
  // 用合约地址唯一标识反查正确项目名，避免用户输入错误（如把"Metya"填成"MY"）导致搜索失准
  let effectiveProjectName = projectName
  let projectAliases = []
  if (address && address !== '未提供') {
    try {
      const nameResolution = await resolveProjectName(
        address,
        projectName,
        onChainData?.tokenName || null,
        onChainData?.tokenSymbol || null
      )
      effectiveProjectName = nameResolution.resolvedName
      projectAliases = nameResolution.aliases
      if (effectiveProjectName !== projectName) {
        console.log(`🔄 [NameResolve] 项目名已修正: "${projectName}" → "${effectiveProjectName}" (别名: ${projectAliases.join(', ')})`)
      }
    } catch (nameErr) {
      console.error('[NameResolve] 名称反查失败，使用原始名称:', nameErr.message)
    }
  }

  // 🆕 Tier 2: 获取既有事实缓存
  const { facts: existingFacts, source: factsSource } = address && address !== '未提供'
    ? await getFacts(address)
    : { facts: null, source: 'none' };

  // 🆕 Gap 驱动跳过策略（v5.6）：不"盲降"，按事实稳定度分类
  // 原则：只增不减——已发生的事实不会消失，但搜索结果不一定准，需要反复验证
  //   ✅ 可完全跳：牌照（一旦确认不会撤销，搜索结果可信度高）
  //   ⚠️ 只减量不全跳：融资（可能新轮次）2→1条、法律实体（Tavily 噪音大，反复验证）→ 保持1条
  //   🔒 永远全量：模式变更、最新动态（事实随时变化）、审计（可能新报告）
  const skipCategories = new Set();
  let fundingIsKnown = false;
  let legalEntityKnown = false;
  if (existingFacts) {
    const totalSearches = existingFacts.totalSearches || 0;

    // 牌照：确认后完全跳过（牌照通常不会撤销，搜索结果可信）
    if (existingFacts.hasLicense) {
      skipCategories.add('牌照');
    }

    // 融资：已知有融资记录 → 不全跳，只减量（保留1条中文搜索新轮次）
    if (existingFacts.hasFunding && existingFacts.fundingRounds?.length > 0) {
      fundingIsKnown = true;
    }

    // 法律实体：已有记录 → 不全跳，保持1条持续验证（⚠️ Tavily 对此类信息噪音大，
    // 注册地可能每次搜到不同结果，需要反复搜索交叉验证，不能盲跳）
    if (existingFacts.legalEntities?.length > 0) {
      legalEntityKnown = true;
    }

    // 审计：永远不跳（新审计报告随时发布）
    // 模式变更+最新动态：永远不跳

    const skippedList = [...skipCategories];
    const keptCount = 2  // 模式变更 + 最新动态（永远保留）
      + (fundingIsKnown ? 1 : 2)  // 融资：已知→1条, 未知→2条
      + 1  // 审计（永远不跳，1条）
      + (skipCategories.has('牌照') ? 0 : 1)
      + 1;  // 法律实体（永远不跳，1条，Tavily 噪音大需反复验证）
    console.log(`📚 [Ledger] 项目已搜索 ${totalSearches} 次, 置信度=${existingFacts.confidenceScore || 0}, 跳过[${skippedList.join(',') || '无'}], 融资${fundingIsKnown ? '减量' : '全量'}, 法律实体${legalEntityKnown ? '已知(持续验证)' : '未确认'} → 执行${keptCount}条查询`);
  } else {
    console.log(`📚 [Ledger] 无缓存记录 → 全量7条查询`);
  }

  // 🔍 获取实时公开信息（牌照、审计、融资等）—— 使用正确的项目名搜索
  let realtimeInfo = '';
  let searchFlags = { hasAudit: false, hasFunding: false, hasLicense: false, hasLegalEntity: false, hasModeChange: false, modeChangeCount: 0 };
  const tavilyStart = Date.now();
  try {
    const result = await fetchRealtimeInfo(effectiveProjectName, address, skipCategories, fundingIsKnown);
    realtimeInfo = result.text;
    searchFlags = result.flags;
    console.log(`⏱️ [搜索] 完成，耗时 ${((Date.now() - tavilyStart) / 1000).toFixed(1)}s (5条查询, Tavily→DuckDuckGo降级)`);
  } catch (tavilyErr) {
    console.error('[搜索] 失败，降级为无实时数据模式:', tavilyErr.message);
    realtimeInfo = '';
  }

  // 🆕 提取新事实 + 与既有事实合并
  // 🔥 关键修复：首次搜索也要创建初始缓存，否则 mergedFacts 永远为 null → 后处理全部失效
  let mergedFacts = null;
  let factsPrompt = '';
  if (address && address !== '未提供') {
    const newFacts = extractFactsFromSearch(searchFlags, onChainData);
    if (existingFacts) {
      // 有缓存：合并
      const result = mergeFacts(existingFacts, newFacts);
      mergedFacts = result.facts;
      factsPrompt = injectFactsIntoPrompt(mergedFacts);
      if (result.merged && result.changes.length > 0) {
        console.log(`📚 [Ledger] 事实已更新: ${result.changes.join(', ')}`);
      } else {
        console.log(`📚 [Ledger] 事实无变化 (source: ${factsSource})`);
      }
    } else {
      // 🔥 无缓存：用当前搜索结果创建初始事实（也会保存到 DB）
      mergedFacts = newFacts;
      factsPrompt = injectFactsIntoPrompt(mergedFacts);
      console.log(`📚 [Ledger] 🆕 首次搜索，创建初始事实: modeChangeCount=${mergedFacts.modeChangeCount}, funding=${mergedFacts.fundingRounds?.length || 0}条, audit=${mergedFacts.hasAudit}, confidence=${mergedFacts.confidenceScore}`);
    }
  }

  // v5.9: 用户备注不直接用于评分，仅作为待验证信息传给 AI
  // 防止恶意用户通过假备注操纵评分；真正采纳需要 ≥3 人独立验证（未来实现）
  if (notes) {
    console.log(`📝 [UserNotes] 用户备注已记录，但不直接用于评分（需≥3人验证）`);
  }
  let verifiedEvidenceText = '';
  // v5.9+阶段三：三态证据查询（verified/partial/pending） + 注入 Prompt + 收集 ID
  let referencedEvidenceIds = [];
  let evidenceCounts = { verified: 0, partial: 0, pending: 0 };
  let searchHitNegative = false;
  if (address && address !== '未提供') {
    try {
      const supabase = await getSupabase();
      const { data: projForEvidence } = await supabase
        .from('project_facts')
        .select('id')
        .eq('contract_address', address.toLowerCase())
        .maybeSingle();
      const projectCacheId = projForEvidence?.id || 0;

      if (projectCacheId > 0) {
        // 一次性查询所有证据，按状态分类
        const { data: allEvidence, error: allEvErr } = await supabase
          .from('evidence_submissions')
          .select('id, evidence_category, content, verification_count, image_url, image_description, status, content_type')
          .eq('project_cache_id', projectCacheId)
          .order('created_at', { ascending: false });

        if (allEvidence && allEvidence.length > 0) {
          const verified = allEvidence.filter(e => e.status === 'verified');
          const partial = allEvidence.filter(e => e.status === 'partial');
          const pending = allEvidence.filter(e => e.status === 'pending');

          // 收集所有证据 ID（用于 risk_reports.evidence_ids）
          referencedEvidenceIds = allEvidence.map(e => e.id);

          // 构建三态证据文本块
          const parts = [];
          if (verified.length > 0) parts.push(buildEvidenceText(verified, '已验证证据（≥3人确认，强制纳入评分）', '社区验证'));
          if (partial.length > 0) parts.push(buildEvidenceText(partial, '部分验证证据（1-2人验证，参考）', '用户反映'));
          if (pending.length > 0) parts.push(buildEvidenceText(pending, '待验证证据（0人验证，仅供参考）', '用户提供，待核实'));

          if (parts.length > 0) {
            verifiedEvidenceText = `\n## 【用户/社区补充信息】\n\n> **证据标注规范**：\n> - 引自已验证证据 → 标注"【社区验证】"\n> - 引自部分验证证据 → 标注"【用户反映】"\n> - 引自待验证证据 → 标注"【用户提供，待核实】"\n> - 多条证据指向同一风险点请综合表述，在报告末尾"局限性"中说明证据数量。\n\n${parts.join('\n\n')}`;
            console.log(`📝 [证据] 注入 ${allEvidence.length} 条证据到 prompt（verified=${verified.length}, partial=${partial.length}, pending=${pending.length}）`);
            // 记录证据分类数量（供后续恶意特征二次验证用）
            evidenceCounts = { verified: verified.length, partial: partial.length, pending: pending.length };
          }

          // v5.9.1: 已验证证据 → mergedFacts（触发交叉惩罚）
          if (mergedFacts && verified.length > 0) {
            let vmc = 0, vwi = 0;
            for (const ev of verified) {
              if (ev.evidence_category === 'mode_change') vmc++;
              if (ev.evidence_category === 'withdraw_issue') vwi++;
            }
            if (vmc > 0) {
              mergedFacts.modeChangeCount = Math.max(mergedFacts.modeChangeCount || 0, vmc);
              mergedFacts.isConfirmed = true;
              const msg = `🔧 [证据→Facts] 模式变更: ${mergedFacts.modeChangeCount} 次（含已验证证据）`;
              console.log(msg);
              require('node:fs').appendFileSync('C:/Users/ASUS/WorkBuddy/Claw/wisescan/debug-evidence.log', new Date().toISOString() + ' ' + msg + '\n');
            }
            if (vwi > 0) {
              mergedFacts.withdrawIssueCount = Math.max(mergedFacts.withdrawIssueCount || 0, vwi);
              mergedFacts.hasWithdrawIssue = true;
              mergedFacts.isConfirmed = true;
              console.log(`🔧 [证据→Facts] 出金障碍: ${mergedFacts.withdrawIssueCount} 条（含已验证证据）`);
            }
          }
        } else {
          console.log('📝 [证据] 该项目无已提交证据');
        }
      }
    } catch (evErr) {
      console.warn('⚠️ 获取证据失败（忽略）:', evErr.message);
    }
  }

  console.log(`\n📡 [${new Date().toLocaleTimeString()}] DeepSeek API: ${effectiveProjectName} (${address.slice(0, 12)}...)`);

  // 📊 构建数据可用性说明（告知 DeepSeek 哪些数据可用、哪些缺失）
  const dataStatusLines = [];
  const missingDataLines = [];
  if (realtimeInfo) {
    dataStatusLines.push('✅ 实时网络搜索结果：已获取');
  } else {
    dataStatusLines.push('⚠️ 实时网络搜索结果：缺失');
    missingDataLines.push('网络搜索（牌照、审计报告、融资记录等公开信息）');
  }
  if (onChainData) {
    const goplusStatus = onChainData.goplus?.lpLockStatus === '已锁定' ? '已获取（GoPlus LP 已锁定）'
      : onChainData.goplus?.lpLockStatus === '未锁定' ? '已获取（GoPlus LP 未锁定）'
      : '已获取（代币基本信息）'
    dataStatusLines.push(`✅ 链上数据（代币信息、合约状态、GoPlus 安全扫描）：${goplusStatus}`);
  } else if (address && address !== '未提供' && detectedChain !== 'bsc') {
    dataStatusLines.push('⚠️ 链上数据：当前链暂未接入 RPC');
    missingDataLines.push('链上数据（代币持仓分布、LP 锁仓情况、TOP10 持仓占比等）');
  } else if (!address || address === '未提供') {
    dataStatusLines.push('⚠️ 链上数据：未提供合约地址');
    missingDataLines.push('链上数据（代币信息、合约状态、持仓分布等）');
  }
  if (effectiveNotes) {
    dataStatusLines.push('✅ 用户补充证据：已提供');
  }

  const missingHint = missingDataLines.length > 0
    ? `\n\n## ⚠️ 数据缺失提示\n以下数据当前不可用，请在对应维度按"无证据默认保守评分"原则处理，并在 deduction 中标注"数据缺失"：\n${missingDataLines.map(l => `- ${l}`).join('\n')}\n\n**重要**：不得因数据缺失而跳过评分或中断报告生成。`
    : '';

  const userPrompt = `请对以下项目进行安全风险评估：
- 项目名称：${effectiveProjectName}${projectAliases.length ? ` (别名/代币: ${projectAliases.join(', ')})` : ''}
- 合约地址：${address}
- 所在链：${detectedChain === 'ethereum' ? '以太坊 (Ethereum)' : detectedChain === 'bsc' ? '币安智能链 (BSC)' : detectedChain === 'polygon' ? 'Polygon' : detectedChain === 'tron' ? '波场 (TRON)' : detectedChain === 'solana' ? 'Solana' : detectedChain === 'evm' ? 'EVM 兼容链' : detectedChain}
${effectiveNotes ? `\n## 【用户/社区补充信息】（来源：用户提交，可能未经交叉验证）\n${effectiveNotes}\n\n**请你**：\n1. 主动分析以上文字信息，提取关键事实（项目方身份、模式细节、风险事件、时间节点等）。\n2. 将用户提供的信息与你的搜索结果进行交叉比对，优先采用有证据支持的信息。\n3. 如用户上传了图片，其描述应视为一条独立证据，在报告中说明"用户提供了关于XX的截图证据"。\n4. 在报告正文中明确标注哪些信息来自用户贡献（用"据用户提交…"），哪些来自 AI 搜索（用"据公开信息…"）。\n5. 如果用户信息与搜索结果矛盾，在"局限性"中说明差异，不强行统一。` : ''}${verifiedEvidenceText}
## 数据可用性说明
${dataStatusLines.join('\n')}${missingHint}${realtimeInfo ? `\n${realtimeInfo}\n\n**重要提示**：搜索结果开头的「搜索覆盖」行显示本次搜索是否找到相关公开信息（✅=本次搜到，❌=本次未搜到）。注意：❌仅表示本轮实时搜索未命中——可能因为项目规模小/非英语内容/搜索随机性等原因。**AI 必须结合训练数据中的已知事实独立判断**，不可因搜索未命中而忽略已有的项目信息。对❌维度的评分说明请写"本次搜索未覆盖"而非"不存在"。` : ''}${onChainInfo ? `\n${onChainInfo}\n\n**重要提示**：以上链上数据来自 NodeReal BSC RPC，是真实的链上读数（代币名称、总供应量、合约状态）。请在评估中参考这些信息，尤其是对代币基本信息的判断。` : ''}${factsPrompt ? `\n${factsPrompt}\n\n**重要提示**：以上「项目已知事实」来自历史多次搜索的累积确认。请不要降低或否定这些已确认事实（例如模式变更次数只能增加不能减少）。如有新的证据发现，可追加补充。` : ''}
请严格按照系统提示中的 JSON 格式输出评估结果。仅输出JSON，不要包含其他文字。`;

  try {
    const startTime = Date.now();
    const dsRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    console.log(`⏱️  响应: ${Date.now() - startTime}ms, 状态: ${dsRes.status}`);

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      console.error('❌ DeepSeek 错误:', errText.slice(0, 200));
      return jsonRes(res, 502, { error: `DeepSeek error ${dsRes.status}`, detail: errText.slice(0, 300) });
    }

    const dsJson = await dsRes.json();
    const rawContent = dsJson?.choices?.[0]?.message?.content;
    if (!rawContent) return jsonRes(res, 502, { error: 'Empty response' });

    // 解析
    const m = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = m ? m[1].trim() : rawContent.trim();
    let reportData;
    try { reportData = JSON.parse(jsonStr); }
    catch { return jsonRes(res, 502, { error: 'JSON parse failed' }); }

    // 🚨 提取恶意特征检测结果（如有）
    const maliciousFeatures = reportData.malicious_features?.detected === true
      ? { detected: true, features: reportData.malicious_features.features || [], evidence: reportData.malicious_features.evidence || '' }
      : { detected: false, features: [], evidence: null };

    // 🔒 恶意特征二次验证：防止单条 pending 证据误触发
    // 如果仅 pending 证据命中（无搜索、无已验证），应清除恶意特征标记
    if (maliciousFeatures.detected && !searchHitNegative && evidenceCounts.verified === 0 && evidenceCounts.partial === 0 && evidenceCounts.pending <= 2) {
      const onlyPending = evidenceCounts.pending > 0 && evidenceCounts.verified === 0 && evidenceCounts.partial === 0 && !searchHitNegative;
      if (onlyPending) {
        console.log('🔒 [恶意特征二次验证] 仅 pending 证据触发，无搜索佐证，清除恶意特征标记');
        maliciousFeatures.detected = false;
        maliciousFeatures.features = [];
        maliciousFeatures.evidence = null;
        reportData.malicious_features = { detected: false, features: [], evidence: null };
      }
    }

    // ===== 稳定评分系统 v2：加权归一化算法（确定性，同输入同输出）=====
    if (Array.isArray(reportData.six_dimensions) && reportData.six_dimensions.length > 0) {

      // 📐 六维权重 + 满分值（固定，不可变）
      const DIMENSION_SPEC = {
        '代码与技术安全':   { weight: 0.25, maxScore: 25 },
        '团队与运营透明度': { weight: 0.20, maxScore: 20 },
        '经济模型与资金安全': { weight: 0.20, maxScore: 20 },
        '社群与市场热度':   { weight: 0.15, maxScore: 15 },
        '历史与执行可靠性': { weight: 0.10, maxScore: 10 },
        '合规性与法律风险': { weight: 0.10, maxScore: 10 },
      }

      let totalWeighted = 0
      let missingCount = 0

      for (const dim of reportData.six_dimensions) {
        const name = dim.dimension || ''
        const spec = DIMENSION_SPEC[name]
        if (!spec) continue

        let score = typeof dim.score === 'number' && !isNaN(dim.score) ? dim.score : 0
        const max = dim.max || spec.maxScore

        // 异常处理：缺失或非法 → 0 分 + 日志
        if (typeof dim.score !== 'number' || isNaN(dim.score)) {
          console.log(`⚠️ [评分] 维度 "${name}" 得分缺失，设为 0，deduction=${dim.deduction || '未知'}`)
          missingCount++
          score = 0
        }

        // 归一化：score/max * weight * 100（满分100）
        const safeMax = max > 0 ? max : spec.maxScore
        const normalized = (score / safeMax) * spec.weight * 100
        totalWeighted += normalized

        // 补充 max 字段（确保前端雷达图有正确的满分值）
        if (!dim.max) dim.max = safeMax
      }

      const aiTotal = reportData.total_score
      reportData.total_score = Math.round(totalWeighted)

      // 历史可靠性 ≤5 → 在 deduction 标注（总分惩罚由最终校准统一执行）
      const histDimCheck = reportData.six_dimensions?.find(d => d.dimension?.includes('历史'))
      if (histDimCheck && histDimCheck.score != null && histDimCheck.score <= 5) {
        if (histDimCheck.score === 0) {
          histDimCheck.deduction = (histDimCheck.deduction || '') + '；⚠️ 已触发崩盘/跑路信号，综合总分额外-10'
        }
      }

      // 替换所有缺失维度的 deduction
      if (missingCount > 0 && !reportData.six_dimensions.some(d => d.deduction?.includes('数据缺失'))) {
        reportData.six_dimensions.forEach(d => {
          if ((typeof d.score !== 'number' || isNaN(d.score)) && !d.deduction?.includes('数据缺失')) {
            d.deduction = (d.deduction || '') + '（数据缺失，计0分）'
          }
        })
      }

      // 🎯 风险等级判定（新阈值）
      const total = reportData.total_score
      let newRiskLevel, newConclusion

      if (total >= 90)      { newRiskLevel = '极低风险'; newConclusion = '可以参与' }
      else if (total >= 75) { newRiskLevel = '低风险';   newConclusion = '可以参与' }
      else if (total >= 60) { newRiskLevel = '中等风险'; newConclusion = '谨慎参与' }
      else if (total >= 40) { newRiskLevel = '高风险';   newConclusion = '不建议参与' }
      else                  { newRiskLevel = '极高风险'; newConclusion = '严禁参与' }

      reportData.risk_level = newRiskLevel
      reportData.conclusion = newConclusion

      console.log(`🔧 [评分] AI原始总分${aiTotal} → 加权归一化${total}(${newRiskLevel} / ${newConclusion}) | 各维:m${missingCount}`)

      // 🔧 服务端修正 history_mode_changes — 三源交叉验证（缓存 > 搜索 > AI）
      // 原则：缓存事实只增不减，已确认的变更次数不可被降级
      const parseAIModeCount = (str) => {
        if (!str || str === '无') return 0
        if (str.includes('≥2') || str.includes('多次') || str.includes('数次') ||
            str.includes('3次') || str.includes('4次') || str.includes('5次')) return 2
        if (str.includes('1次') || str.includes('一次')) return 1
        return str !== '无' && str !== '' ? 1 : 0
      }
      const aiModeCount = parseAIModeCount(reportData.history_mode_changes)
      const searchModeCount = searchFlags.hasModeChange ? searchFlags.modeChangeCount : 0
      const cachedModeCount = mergedFacts?.modeChangeCount || 0  // 🆕 项目缓存事实（多次搜索累积，只增不减）
      
      // 🔥 v5.4: 统一修正函数 —— 不仅改文字，还改分数！
      const applyHistoryCorrection = (source, newModeText, recordCount) => {
        if (reportData.history_mode_changes !== newModeText) {
          const oldText = reportData.history_mode_changes || '无'
          reportData.history_mode_changes = newModeText
          console.log(`🔧 模式变更修正 (${source}): "${oldText}" → "${newModeText}"`)
        }
        const histDim = reportData.six_dimensions?.find(d => d.dimension?.includes('历史'))
        if (histDim) {
          // 修正 deduction 文字
          const oldDeduction = histDim.deduction
          histDim.deduction = histDim.deduction?.replace(/模式变更\d*次?/, '模式变更≥2次') || `模式变更≥2次`
          if (histDim.deduction !== oldDeduction) {
            console.log(`🔧 历史维度 deduction 修正: "${oldDeduction}" → "${histDim.deduction}"`)
          }
          // 🔥 v5.19: 区分恶意特征
          // 模式变更≥2次 → 检查是否有恶意特征
          if (newModeText.includes('≥2') && histDim.score > 0) {
            if (maliciousFeatures.detected) {
              // 有恶意特征 → 历史归零（崩盘判定）
              const oldScore = histDim.score
              histDim.score = 0
              histDim.max = 10
              console.log(`🚨 [恶意特征] 历史维度 score 修正: ${oldScore}/10 → 0/10 (检测到恶意特征: ${maliciousFeatures.features.join(', ')})`)
            } else {
              // 无恶意特征 → 给 2 分（高风险但不判崩盘）
              const oldScore = histDim.score
              histDim.score = Math.min(histDim.score, 2)
              histDim.max = 10
              histDim.deduction = (histDim.deduction || '') + '；⚠️ 模式变更频繁但未检测到恶意特征，建议密切关注项目动态'
              console.log(`🔧 [正常升级] 历史维度 score 修正: ${oldScore}/10 → 2/10 (模式变更≥2次，未检测到恶意特征)`)
            }
          }
        }
      }

      if (cachedModeCount >= 2 && aiModeCount < 2) {
        applyHistoryCorrection('缓存', `≥${cachedModeCount}次`, cachedModeCount)
        console.log(`  └─ 来源: 项目账本 (${mergedFacts?.totalSearches || 0}次搜索累积)`)
      } else if (cachedModeCount === 1 && aiModeCount === 0 && searchModeCount === 0) {
        // 缓存有1次记录但AI和搜索都没发现 → 信任缓存
        reportData.history_mode_changes = '1次'
        console.log(`🔧 模式变更补录（缓存）: AI未提及 → 1次`)
      } else if (searchModeCount >= 2 && aiModeCount < 2) {
        applyHistoryCorrection('搜索', `≥${searchModeCount}次`, searchModeCount)
      } else if (searchModeCount === 0 && aiModeCount > 0 && reportData.history_mode_changes !== '无') {
        // 搜索没找到但 AI 说有一次 → 保持 AI 判断，不降为"无"
        console.log(`🔧 模式变更: AI判断${reportData.history_mode_changes}, 搜索未命中 → 保持AI判断`)
      } else if (searchModeCount > 0 || cachedModeCount > 0 || aiModeCount > 0) {
        console.log(`🔧 模式变更: AI=${reportData.history_mode_changes || '无'}, 搜索=${searchModeCount}篇, 缓存=${cachedModeCount}次 → 无需修正`)
      }

      // 🔧 交叉惩罚：模式变更 ≥2 次 → 经济模型连带扣分
      // 🆕 v5.9.1 修复：直接查 DB 获取已验证证据，不依赖 mergedFacts 时序
      const getEffectiveModeChangeCount = async () => {
        // 1. 从 mergedFacts 读（已验证缓存）
        const fromCache = (mergedFacts?.isConfirmed) ? (mergedFacts?.modeChangeCount || 0) : 0;
        // 2. 直接查 DB 获取已验证证据（绕过 mergedFacts 时序问题）
        let fromVerified = 0;
        try {
          const supabase = await getSupabase();
          if (supabase && address && address !== '未提供') {
            const { data: pf } = await supabase
              .from('project_facts')
              .select('id')
              .eq('contract_address', address.toLowerCase())
              .maybeSingle();
            if (pf?.id) {
              const { data: ev } = await supabase
                .from('evidence_submissions')
                .select('evidence_category')
                .eq('project_cache_id', pf.id)
                .eq('status', 'verified');
              fromVerified = (ev || []).filter(e => e.evidence_category === 'mode_change').length;
            }
          }
        } catch (e) { /* ignore */ }
        const fromSearch = searchFlags.hasModeChange ? searchFlags.modeChangeCount : 0;
        const fromAI = parseAIModeCount(reportData.history_mode_changes);
        const result = Math.max(fromCache, fromVerified, fromSearch, fromAI);
        console.log(`🔧 [交叉惩罚] DB验证: fromCache=${fromCache}, fromVerified=${fromVerified}, fromSearch=${fromSearch}, fromAI=${fromAI} → ${result}`);
        return result >= 2 ? result : 0;
      };
      const effectiveModeCount = await getEffectiveModeChangeCount();
      
      // 日志：输出三源数据便于排查
      console.log(`🔧 [交叉惩罚] 三源数据: 缓存(isConfirmed=${mergedFacts?.isConfirmed}, modeChange=${mergedFacts?.modeChangeCount || 0}), 搜索=${searchFlags.modeChangeCount}, AI=${reportData.history_mode_changes || 'N/A'}, 有效值=${effectiveModeCount}`)
      
      if (effectiveModeCount >= 2) {
        const econDim = reportData.six_dimensions?.find(d => d.dimension?.includes('经济模型'))
        if (econDim) {
          // ✅ v5.2 新策略：不看 deduction 文字（不可靠），直接看 score 数值
          // 模式变更≥2次 → 经济模型最多只能得 15 分（即至少扣5分）
          // 如果当前 score > 15 → 说明还没扣或扣不够 → 强制补扣
          const hasWithdrawIssue = /出金障碍|出金异常|提现困难|资金.*锁|无法提现|置换/.test(econDim.deduction || '')
          const maxAllowedScore = hasWithdrawIssue ? 10 : 15  // 有出金障碍最多10分，否则最多15分
          
          console.log(`🔧 [交叉惩罚] 经济模型当前 score=${econDim.score}, 上限=${maxAllowedScore}, deduction预览="${(econDim.deduction || '').slice(0, 60)}"`)
          
          if (econDim.score > maxAllowedScore) {
            // ❌ 分数超限 → 强制扣分
            const penalty = econDim.score - maxAllowedScore
            const penaltyDesc = hasWithdrawIssue
              ? '；⚠️ 模式变更≥2次+出金障碍，经济模型稳定性严重存疑（服务端强制-' + penalty + '）'
              : '；⚠️ 模式变更≥2次，经济模型稳定性存疑（服务端强制-' + penalty + '）'
            const oldScore = econDim.score
            econDim.score = maxAllowedScore
            econDim.deduction = (econDim.deduction || '') + penaltyDesc
            const penaltySource = (mergedFacts?.modeChangeCount || 0) >= 2 ? '缓存' : (searchFlags.hasModeChange ? '搜索' : 'AI报告')
            console.log(`🔧 [交叉惩罚] ✅ 强制执行! ${oldScore} → ${econDim.score}/20 (penalty=-${penalty}${hasWithdrawIssue ? ', 含出金障碍' : ''}, 来源:${penaltySource})`)
            // 同步重算 total_score
            const DIM_SPEC = {
              '代码与技术安全': 25, '团队与运营透明度': 20, '经济模型与资金安全': 20,
              '社群与市场热度': 15, '历史与执行可靠性': 10, '合规性与法律风险': 10,
            }
            const DIM_WEIGHT = {
              '代码与技术安全': 0.25, '团队与运营透明度': 0.20, '经济模型与资金安全': 0.20,
              '社群与市场热度': 0.15, '历史与执行可靠性': 0.10, '合规性与法律风险': 0.10,
            }
            let newTotal = 0
            for (const dim of reportData.six_dimensions || []) {
              const maxScore = DIM_SPEC[dim.dimension] || dim.max || 20
              const weight = DIM_WEIGHT[dim.dimension] || 0.15
              newTotal += (dim.score / maxScore) * weight * 100
            }
            reportData.total_score = Math.min(100, Math.round(newTotal))
            console.log(`🔧 total_score 重算: ${reportData.total_score}`)
          } else {
            // score 已在合理范围（≤maxAllowedScore），无需修正
            console.log(`🔧 [交叉惩罚] ⏭️ 跳过: 经济模型 score=${econDim.score} ≤ 上限${maxAllowedScore}, 无需强制扣分`)
          }
        } else {
          console.log(`🔧 [交叉惩罚] ⚠️ 未找到经济模型维度! six_dimensions=${(reportData.six_dimensions || []).map(d => d.dimension).join(',')}`)
        }
      }  // ← end: if (effectiveModeCount >= 2)

      // 📝 服务端修正：已验证证据（≥3人确认）→ 强制纳入评分
      //   注意：仅对 status='verified' 的证据生效，pending/partial 不影响评分
      if (address && address !== '未提供') {
        try {
          // 初始化 supabase 客户端（本块独立，不依赖其他块的变量）
          const supabase = await getSupabase();
          const { data: verifiedEv } = await supabase
            .from('evidence_submissions')
            .select('evidence_category, content, image_description')
            .eq('project_cache_id', (await supabase
              .from('project_facts')
              .select('id')
              .eq('contract_address', address.toLowerCase())
              .maybeSingle())?.data?.id || 0)
            .eq('status', 'verified');
          if (verifiedEv && verifiedEv.length > 0) {
            console.log(`📝 [证据→修正] 发现 ${verifiedEv.length} 条已验证证据，开始强制修正评分`);
            let verifiedCorrections = [];

            for (const ev of verifiedEv) {
              const cat = ev.evidence_category || '';
              const content = ((ev.content || '') + ' ' + (ev.image_description || '')).toLowerCase();

              // 1. 出金障碍
              if (cat === 'withdraw_issue' || /提现困难|无法提现|出金|资金被锁|冻结/.test(content)) {
                if (!verifiedCorrections.includes('出金障碍')) {
                  verifiedCorrections.push('出金障碍');
                  const histDim = reportData.six_dimensions?.find(d => d.dimension?.includes('历史'));
                  if (histDim && histDim.score > 0) {
                    histDim.score = 0;
                    histDim.deduction = (histDim.deduction || '') + '；【社区已验证】资金提取异常';
                    console.log(`📝 [证据→修正] 历史可靠性归零（已验证出金障碍）`);
                  }
                  const econDimV = reportData.six_dimensions?.find(d => d.dimension?.includes('经济模型'));
                  if (econDimV && !econDimV.deduction?.includes('社区已验证')) {
                    econDimV.score = Math.max(0, econDimV.score - 10);
                    econDimV.deduction = (econDimV.deduction || '') + '；【社区已验证】出金障碍记录，-10';
                    console.log(`📝 [证据→修正] 经济模型 -10（已验证出金障碍）`);
                  }
                }
              }

              // 2. 模式变更
              if (cat === 'mode_change' || /模式变更|更名|改名|换模式/.test(content)) {
                if (!verifiedCorrections.includes('模式变更')) {
                  verifiedCorrections.push('模式变更');
                  const currentModeCount = parseAIModeCount(reportData.history_mode_changes);
                  if (currentModeCount < 2) {
                    reportData.history_mode_changes = '≥2次';
                    console.log(`📝 [证据→修正] history_mode_changes 升级为 ≥2次（已验证模式变更）`);
                  }
                  // 触发交叉惩罚
                  const econDimV2 = reportData.six_dimensions?.find(d => d.dimension?.includes('经济模型'));
                  if (econDimV2 && !econDimV2.deduction?.includes('社区已验证')) {
                    econDimV2.score = Math.max(0, econDimV2.score - 5);
                    econDimV2.deduction = (econDimV2.deduction || '') + '；【社区已验证】模式变更≥2次，-5';
                    console.log(`📝 [证据→修正] 经济模型 -5（已验证模式变更）`);
                  }
                }
              }

              // 3. 中心化控制
              if (cat === 'central_control' || /中心化|可操控|后门|超级权限|owner|管理员/.test(content)) {
                if (!verifiedCorrections.includes('中心化控制')) {
                  verifiedCorrections.push('中心化控制');
                  const codeDimV = reportData.six_dimensions?.find(d => d.dimension?.includes('代码'));
                  if (codeDimV && codeDimV.score > 5) {
                    codeDimV.score = Math.max(5, codeDimV.score - 5);
                    codeDimV.deduction = (codeDimV.deduction || '') + '；【社区已验证】中心化控制/超级权限风险，-5';
                    console.log(`📝 [证据→修正] 代码安全 -5（已验证中心化控制）`);
                  }
                }
              }
            }

            if (verifiedCorrections.length > 0) {
              // 重算 total_score
              const DIM_SPEC_V = {
                '代码与技术安全': 25, '团队与运营透明度': 20, '经济模型与资金安全': 20,
                '社群与市场热度': 15, '历史与执行可靠性': 10, '合规性与法律风险': 10,
              };
              const DIM_WEIGHT_V = {
                '代码与技术安全': 0.25, '团队与运营透明度': 0.20, '经济模型与资金安全': 0.20,
                '社群与市场热度': 0.15, '历史与执行可靠性': 0.10, '合规性与法律风险': 0.10,
              };
              let newTotal = 0;
              for (const dim of reportData.six_dimensions || []) {
                const maxScore = DIM_SPEC_V[dim.dimension] || dim.max || 20;
                const weight = DIM_WEIGHT_V[dim.dimension] || 0.15;
                newTotal += (dim.score / maxScore) * weight * 100;
              }
              reportData.total_score = Math.min(100, Math.round(newTotal));
              console.log(`📝 [证据→修正] total_score 重算: ${reportData.total_score}（已验证证据: ${verifiedCorrections.join(', ')}）`);
            }
          }
        } catch (verifiedErr) {
          console.warn('⚠️ 已验证证据修正失败（忽略）:', verifiedErr.message);
        }
      }

      // 🔧 服务端修正合规性维度 — 基于搜索是否命中牌照关键词
      const complianceDim = reportData.six_dimensions?.find(d => d.dimension?.includes('合规'))
      if (complianceDim) {
        if (searchFlags.hasLicense && complianceDim.score < 5) {
          console.log(`🔧 合规维度修正: 搜索命中牌照关键词，${complianceDim.score} → 5 (保底)`)
          complianceDim.score = 5
          if (!complianceDim.deduction?.includes('牌照')) {
            complianceDim.deduction = (complianceDim.deduction?.replace(/无|未知/g, '') || '') + '有牌照记录'
          }
        }
      }

      // 🔧 用户举报记录 — 存入举报验证队列（不直接修分，需多用户交叉验证后确认）
      //   仅在 prompt 层面增强权重（标注"待验证"），不在此处强制修正分数
      //   详见：user_reports 表 + 举报验证系统（≥3用户同类型举报 → 确认 → 触发强制修正）
      if (notes) {
        console.log(`📝 [举报] 用户提供了备注（待验证），已注入 prompt 供 AI 参考`)
        // TODO: 将举报写入 user_reports 表（举报验证系统）
        // TODO: 检查该地址该类型是否已有 ≥3 独立用户举报 → 若已确认，在此触发强制修正
      }
    }

    // 🔧 v5.13: TOP10 持仓极度集中（≥90%）→ 自动修正历史维度归零
    // SYSTEM_PROMPT 规则要求"TOP10≥90% 且 项目成立超6个月无更新 → 历史归零"
    // 但 AI 无法判断合约部署时间，所以在此用代码层强制执行
    const goplusTop10 = onChainData?.goplus?.top10Percent;
    if (goplusTop10 != null && goplusTop10 >= 90) {
      const autoHistDim = reportData.six_dimensions?.find(d => d.dimension?.includes('历史'));
      if (autoHistDim && autoHistDim.score > 0) {
        console.log(`🚨 [自动修正] TOP10=${goplusTop10}%≥90%，历史维度 ${autoHistDim.score}/10 → 0/10（极度控盘=实质跑路信号）`);
        autoHistDim.score = 0;
        autoHistDim.deduction = (autoHistDim.deduction || '') + '；🚨 TOP10持仓占比≥' + goplusTop10 + '%，代币被少数地址绝对控制，判定为实质性跑路风险';
      }
    }

    // 🔧 最终一致性校准：历史惩罚 + 风险等级重算
    console.log(`🔍 [DEBUG] 进入最终校准，total_score=${reportData?.total_score}, has_six_dimensions=${!!reportData?.six_dimensions}`);
    const finalHistDim = reportData.six_dimensions?.find(d => d.dimension?.includes('历史'));
    if (finalHistDim && finalHistDim.score != null && finalHistDim.score <= 5) {
      const beforeFinal = reportData.total_score;
      // 避免重复减（只在尚未减过的情况下减）
      // 减去10但确保不低于0
      reportData.total_score = Math.max(0, beforeFinal - 10);
      if (beforeFinal !== reportData.total_score) {
        console.log(`🔧 [最终校准] 历史可靠性=${finalHistDim.score}分，总分 ${beforeFinal} → ${reportData.total_score}`);
      }
    }

    // 🚨 项目状态前置判断：已崩盘硬性封顶（事件权重 > 指标权重）
    // 区分三种归零原因：
    //   - 已崩盘/跑路（modeCount<2 且 history=0）→ 封顶 ≤35
    //   - 模式变更≥3次 + 恶意特征（modeCount≥3, history=0, malicious=true）→ 封顶 ≤35 + 极高风险
    //   - 模式变更≥3次 - 无恶意特征（modeCount≥3, history=0, malicious=false）→ 不封顶，标注高风险
    //   - 模式变更2次（modeCount=2 且 history=0）→ 仅归零，不封顶
    if (finalHistDim && finalHistDim.score === 0) {
      const mc = (typeof effectiveModeCount === 'number') ? effectiveModeCount : 0;
      // 🔥 v5.19: 模式变更≥3次但无恶意特征 → 不封顶
      if (mc >= 3 && !maliciousFeatures.detected) {
        // 修正历史维度为 2 分（修正AI可能错误的归零）
        finalHistDim.score = 2;
        finalHistDim.deduction = (finalHistDim.deduction || '') + '；⚠️ 模式变更≥3次但未检测到恶意特征，标记为高风险（服务端修正）';
        console.log(`🔧 [最终校准] 模式变更≥${mc}次无恶意特征，历史维度改为 2/10，跳过崩盘封顶`);
        // 重新计算总分（历史维度已改为2分）
        const _DIM_SPEC_FINAL = {
          '代码与技术安全': { maxScore: 25, weight: 0.25 },
          '团队与运营透明度': { maxScore: 20, weight: 0.20 },
          '经济模型与资金安全': { maxScore: 20, weight: 0.20 },
          '社群与市场热度': { maxScore: 15, weight: 0.15 },
          '历史与执行可靠性': { maxScore: 10, weight: 0.10 },
          '合规性与法律风险': { maxScore: 10, weight: 0.10 },
        };
        let newTotal = 0;
        for (const d of (reportData.six_dimensions || [])) {
          const key = Object.keys(_DIM_SPEC_FINAL).find(k => d.dimension?.includes(k));
          if (key && d.score != null) {
            const { maxScore, weight } = _DIM_SPEC_FINAL[key];
            newTotal += (d.score / maxScore) * weight * 100;
          }
        }
        reportData.total_score = Math.min(100, Math.round(newTotal));
      } else {
        const shouldCap = (mc >= 3) || (mc < 2);
        if (shouldCap) {
          const beforeCap = reportData.total_score;
          reportData.total_score = Math.min(beforeCap, 35);
          if (beforeCap !== reportData.total_score) {
            const reason = mc >= 3 ? `模式变更≥3次` : `已确认崩盘/跑路`;
            console.log(`🚨 [崩盘封顶] ${reason}，总分 ${beforeCap} → ${reportData.total_score}（强制 ≤35）`);
          }
        } else {
          console.log(`🔧 [封顶跳过] 模式变更=2次，历史归零但不封顶（总分保持 ${reportData.total_score}）`);
        }
      }
    }
    // 基于最终总分重算风险等级
    const finalTotal = reportData.total_score;
    if (finalTotal >= 90)      { reportData.risk_level = '极低风险'; reportData.conclusion = '可以参与'; }
    else if (finalTotal >= 75) { reportData.risk_level = '低风险';   reportData.conclusion = '可以参与'; }
    else if (finalTotal >= 60) { reportData.risk_level = '中等风险'; reportData.conclusion = '谨慎参与'; }
    else if (finalTotal >= 40) { reportData.risk_level = '高风险';   reportData.conclusion = '不建议参与'; }
    else                       { reportData.risk_level = '极高风险'; reportData.conclusion = '严禁参与'; }

    // 🚨 已崩盘项目强制标注（覆盖风险等级判断，双重保险）
    if (finalHistDim && finalHistDim.score === 0) {
      // 🔥 v5.19: 检查是否有恶意特征确定崩盘标注
      if (!maliciousFeatures.detected && (typeof effectiveModeCount === 'number' ? effectiveModeCount : 0) >= 3) {
        // 模式变更≥3次但无恶意特征 → 标注高风险而非崩盘
        const highRiskTotal = reportData.total_score;
        if (highRiskTotal >= 60) {
          reportData.risk_level = '中等风险';
          reportData.conclusion = '谨慎参与';
        } else if (highRiskTotal >= 40) {
          reportData.risk_level = '高风险';
          reportData.conclusion = '不建议参与';
        } else {
          reportData.risk_level = '高风险';
          reportData.conclusion = '不建议参与（该项目模式变更频繁，但未检测到恶意特征，建议密切关注）';
        }
        reportData.ai_summary = '⚠️ 该项目模式变更频繁（≥3次），但未发现强制锁仓、强制置换等恶意特征，建议密切关注项目动态。' + (reportData.ai_summary || '');
      } else {
        reportData.risk_level = '极高风险';
        reportData.conclusion = '严禁参与（该项目已确认崩盘/跑路，资金存在永久性损失风险）';
        // 在 ai_summary 中追加恶意特征信息（如有）
        if (maliciousFeatures.detected) {
          reportData.ai_summary = `🚨 检测到恶意特征：${maliciousFeatures.features.join('、')}。${maliciousFeatures.evidence || ''} ${reportData.ai_summary || ''}`;
        }
      }
    }

    console.log(`✅ 报告: 总分${reportData.total_score}, 等级: ${reportData.risk_level}`);

    // 存库（异步，不阻塞返回）
    storeRiskReport(address, user_address, reportData, referencedEvidenceIds).catch(err => {
      console.warn('⚠️ 存库失败（不影响报告返回）:', err.message);
    });

    // 🆕 保存 Tier 1 报告缓存 + Tier 2 事实缓存（异步，不阻塞返回）
    Promise.allSettled([
      setReportCache(address, reportData),
      mergedFacts ? saveFacts(address, effectiveProjectName, mergedFacts, { detectedChain, effectiveProjectName }) : Promise.resolve(),
    ]).then(async ([r1, r2]) => {
      if (r1.status === 'fulfilled') console.log('📦 [Ledger] Tier1+2 缓存已保存');

      // v5.9.1: 用户备注 → evidence_submissions（异步，不阻塞）
      if (notes) {
        try {
          const result = await storeUserEvidence(address, effectiveProjectName, notes);
          if (result.stored > 0) {
            console.log(`📝 [Evidence] 用户备注已存入证据库: ${result.stored} 条, 新验证通过: ${result.verified}`);
          }
        } catch (evErr) {
          console.warn('⚠️ 存储用户证据失败（忽略）:', evErr.message);
        }
      }
    });

    // ========== 🆕 AI 幻觉清理（非缓存路径：AI 刚生成的内容也需自检）==========
    if (reportData.ai_summary && typeof reportData.ai_summary === 'string') {
      const nonCacheComplianceDim = reportData.six_dimensions?.find(d => d.dimension?.includes('合规'));
      if (nonCacheComplianceDim && nonCacheComplianceDim.score != null && nonCacheComplianceDim.score <= 2) {
        reportData.ai_summary = reportData.ai_summary
          .replace(/[^。]*持有合规牌照[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*合规牌照[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*持牌经营[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*已获.*牌[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*牌照[^，。]*合规[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*获.*牌[^。]*(?:[。]|$)/g, '')
          .trim();
        console.log(`🧹 [非缓存→ai_summary幻觉清理] 合规性=${nonCacheComplianceDim.score}分，清理牌照类幻觉文本`);
      }
      const nonCacheCodeDim = reportData.six_dimensions?.find(d => d.dimension?.includes('代码'));
      if (nonCacheCodeDim && nonCacheCodeDim.score != null && nonCacheCodeDim.score <= 5) {
        reportData.ai_summary = reportData.ai_summary
          .replace(/[^。]*已完成安全审计[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*通过.*审计[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*审计报告.*通过[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*CertiK[^。]*(?:[。]|$)/g, '')
          .replace(/[^。]*SlowMist[^。]*(?:[。]|$)/g, '')
          .trim();
        console.log(`🧹 [非缓存→ai_summary幻觉清理] 代码安全=${nonCacheCodeDim.score}分，清理审计类幻觉文本`);
      }
    }
    if (reportData.public_opinion) {
      const cleanText = (t) => typeof t === 'string'
        ? t.replace(/[^。]*持有合规牌照[^。]*(?:[。]|$)/g, '')
           .replace(/[^。]*合规牌照[^。]*(?:[。]|$)/g, '')
           .replace(/[^。]*持牌经营[^。]*(?:[。]|$)/g, '')
           .trim()
        : t;
      if (typeof reportData.public_opinion === 'object') {
        if (reportData.public_opinion.summary) {
          reportData.public_opinion.summary = cleanText(reportData.public_opinion.summary);
        }
      } else {
        reportData.public_opinion = cleanText(reportData.public_opinion);
      }
    }

    // ========== 🆕 英文术语统一替换为中文白话（非缓存路径）==========
    if (reportData.ai_summary && typeof reportData.ai_summary === 'string') {
      reportData.ai_summary = localizeEnTerms(reportData.ai_summary);
    }
    if (reportData.public_opinion) {
      if (typeof reportData.public_opinion === 'object') {
        if (reportData.public_opinion.summary) {
          reportData.public_opinion.summary = localizeEnTerms(reportData.public_opinion.summary);
        }
      } else if (typeof reportData.public_opinion === 'string') {
        reportData.public_opinion = localizeEnTerms(reportData.public_opinion);
      }
    }

    // 🆕 无合约地址提示：非Web3项目数据有限
    if (!address || address === '未提供' || address === 'undefined' || address === '') {
      const noWeb3Note = '⚠️ 提示：该项目未提供合约地址，链上数据无法获取，评估结果仅供参考。如项目不属于Web3领域，评估维度可能不适用。';
      if (reportData.ai_summary && typeof reportData.ai_summary === 'string') {
        reportData.ai_summary = reportData.ai_summary + '\n\n' + noWeb3Note;
      } else {
        reportData.ai_summary = noWeb3Note;
      }
    }

    return jsonRes(res, 200, { success: true, data: reportData, chain: detectedChain, onChainData, resolvedName: effectiveProjectName, projectAliases, originalName: projectName });
  } catch (err) {
    console.error('❌ 内部错误:', err.message);
    return jsonRes(res, 500, { error: err.message });
  }
}

// ===== Business Report System Prompt =====
const BUSINESS_SYSTEM_PROMPT = `你是「明鉴」平台的**明鉴·首席分析师**，专门拆解加密项目的商业模式（如多级返佣、分红盘、矿机挖矿等）。你必须严格遵循以下原则：

【一、规则提取阶段 — 必采字段清单】
按以下 11 个核心模块提取用户输入的规则文本。如果某个模块未提及，在报告中标注"未提及"。

1. 项目名称与代币符号
2. 注册与激活规则 — 注册赠送/直推奖励/激活门槛
3. 充值/复投规则 — 充值放大倍数/复投放大倍数/两者差异
4. 账户类型与权益 — 账户分类/权益差异/升级条件
5. 静态收益规则 — 计算基数/日收益率(区分类型)/释放周期/持有上限
6. 动态收益规则 — 奖励项目/比例/代数规则/晋级条件
7. 社区/节点规则 — 节点类型与层级/考核条件/权益
8. 烧伤机制 — 是否区分账户类型/规则差异/触发条件
9. 提现规则 — 首次门槛/再次门槛/手续费/时间限制
10. 代币信息 — 合约地址/公链
11. 特殊规则 — 复投与充值是否相同/锁仓期/出金限制

【二、计算与展示规范】
2.1 放大倍数差异：若充值放大≠复投放大，计算器标注"充值按X倍，复投按Y倍（效率为X/Y%）"
2.2 多账户类型：默认最高收益类型展示，标注激活条件
2.3 烧伤机制：以表格展示(账户类型/静态烧伤/动态烧伤/触发条件)
2.4 提现门槛阶梯：标注"首次X，再次Y，门槛提高Z倍"

【三、策略建议生成规则】
基于11字段，逐一检查可操作策略点。必须包含：最低参与门槛/账户类型选择/直推数量建议/复投vs充值效率对比/节点升级路径。

【四、风险等级自动判定规则】
高风险触发条件（满足任一即标记）：
1. 静态收益+多级返佣(≥2级)+无利润来源 → 庞氏特征
2. 提现手续费≥20%且门槛跳涨≥5倍 → 出金障碍
3. 动态收益依赖团队充值/复投/提现 → 拉人头特征
4. 账户类型收益差距≥2倍 → 歧视性分配
输出格式：风险等级 + 触发项编号列表

【五、资金压力测试】
有完整数据→估算每日静态支出/需新增资金。无完整数据→"对新增资金依赖度极高"

【六、报告内容规范】

6.1 **商业模式解读（plain_explanation）必须遵守**：
- 字数控制在 200-300 字，不超过 300 字（包括标点）
- 用大白话解释，不用"复述"方式。目标是用户读完后能自己复述"这模式是干嘛的"
- 禁止出现"未提及"、"XX无"、"XX不存在"等无信息量表述
- 如果原始规则文本超过500字，优先提取最关键信息做概括；详细字段放到规则明细部分
- 示例：❌ "复投效率为充值70%，但复投可增加持币量。"
  ✅ "复投只有首次充值70%效率，建议优先用于激活新账户，而不是复投。"

6.2 **策略建议（strategy_suggestion）格式**：
- 必须包含至少1条 ⭐ 核心建议（标注⭐）
- 按"必须做 → 建议做 → 注意避开"三层顺序排列
- 每个建议单独成行，不用长段落
- 示例格式：
  ⭐ 核心建议：充值至少50MY激活共识账户（否则只有0.2%日收益）
  📌 收益最大化：直推至少5个共识账户→解锁15代动态奖励
  ⚠️ 注意事项：复投效率仅为首次充值70%，建议优先激活新账户

6.3 **风险警示（risk_warning + risk_assessment）格式**：
- 至少包含 2 条风险
- 每条风险必须包含"具体表现 + 潜在后果"
- 使用"该模式…一旦…可能导致…"结构
- 示例：✅ "该模式静态收益0.4%/日依赖新增资金维持，一旦新用户增速放缓，可能导致提现困难或收益缩水。"

【七、JSON输出格式】
{
  "pattern_type": "模式类型",
  "plain_explanation": "按11字段组织，标注未提及项",
  "static_calculator": {
    "daily_rate": 0.01, "investment": 1000,
    "daily_profit": 10, "weekly_profit": 70,
    "monthly_profit": 300, "yearly_profit": 3650,
    "amplification_note": "充值5倍/复投3.5倍",
    "account_type": "共识账户(需充值≥50MY)"
  },
  "dynamic_calculator": {
    "direct_referral_rate": 0.10,
    "indirect_referral_rate": 0.05,
    "team_bonus_threshold": 100000,
    "team_bonus_rate": 0.02
  },
  "strategy_suggestion": "最低门槛/账户选择/直推建议/复投对比/节点路径",
  "risk_assessment": {
    "level": "高风险",
    "triggers": ["静态收益+多级返佣→庞氏特征", "提现门槛跳涨→出金障碍"],
    "pressure_test": "每日需新增X USDT"
  },
  "risk_warning": "该模式对新增资金依赖度高。",
  "visualization_hint": "树形图：A→B→C,D,E",
  "visualization_tree": {"name":"你（共识账户）","children":[{"name":"B1（共识）","children":[{"name":"C1"},{"name":"C2"}]},{"name":"B2（共识）","children":[{"name":"C3"}]},{"name":"B3（共识）"},{"name":"B4（共识）"},{"name":"B5（共识）","children":[{"name":"C4"},{"name":"C5"}]}]},
  "share_card": {
    "project_name": "【强制规则 - 项目名称】\n(1) 前端已提供 → 直接原样填入，禁止修改/重新提取/替换。例：前端提供'MYBX' → 本字段必须='MYBX'。\n(2) 前端未提供 → 从规则文本开头提取纯代号（2-10个字母数字）。例：'MYBX是...'→提取'MYBX'；'BTC生态...'→提取'BTC'。\n(3) 禁止返回：'用户自定义'、描述性句子、或幻觉生成的名称。\n(4) 确实无法提取 → 返回'未命名项目'。",
    "pattern_type": "模式类型名称（2-8字，如：三级返佣、矩阵制、静态分红）",
    "structure": "如果有明确的返佣层级结构，用 → 连接表示（如'直推→间推→团队奖'，不超过15字）；无明确层级则返回 null",
    "rule_summary": "规则极简摘要，**只写数字和关键词，不写完整句子**。格式示例：'直推10%，间推5%' 或 '静态分红+动态返佣'。**禁止**出现'充值'、'放大'、'用户可以通过'等动词或描述性词语。长度控制在**8个字以内**。）",
    "watch_points": ["风险维度极简标签，每个标签**不超过4个字**，用风险名词，不用描述句。示例：'资金池、新增用户、提现门槛'。**禁止**出现'依赖'、'跳涨'、'拉人'等动词或动态描述。最多3个标签，按重要程度排序。"]
  }
}

⚠️ visualization_tree 的直推节点数量必须与 strategy_suggestion 中的直推建议数量保持一致。如果策略建议"直推至少5个"，树形图必须有5个直推节点。
⚠️ 如果规则信息不足以生成 visualization_tree，将 visualization_tree 设为 null。
仅输出JSON，不要包含其他文字。

【证据引用规范】
- 已验证→"【社区验证】"
- 部分验证→"【用户反映】"
- 待验证→"【用户提供，待核实】"

【禁止事项】
- 不得承诺"稳赚不赔"
- 不得输出绝对化的崩盘时间
- 不得输出情绪化表述
- 不得留空字段
- ⚠️ 当规则文本中包含"用户上传了项目截图，AI 视觉分析提取内容如下"时，代表用户未填写文字规则但上传了截图。你必须以截图分析内容为主要依据，输出完整的商业模式分析报告，不得回复"未提供规则""无规则"或类似内容。`;

async function handleGenerateBusinessReport(req, res) {
  const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return jsonRes(res, 500, { error: 'Missing DEEPSEEK_API_KEY' });
  }

  const body = await readBody(req);
  const { project_name, rule_text, rules_text, investment, referrals, user_notes, user_notes_images, user_address, contract_address } = body;
  const projectNameTrimmed = (project_name || '').trim();
  const finalRuleText = (rule_text || rules_text || '').trim();

  console.log(`\n📡 [${new Date().toLocaleTimeString()}] 商业模式分析: ${projectNameTrimmed || '(未提供项目名称)'}`);

  // 🖼️ 处理用户上传的图片：先用 base64 直传 GPT-4o 分析（最可靠），再异步上传 Supabase 持久化
  let formImageAnalysis = '';
  const userImages = Array.isArray(user_notes_images) ? user_notes_images.filter(Boolean) : [];
  if (userImages.length > 0) {
    console.log(`🖼️ [商业模式图片] 收到 ${userImages.length} 张图片，开始 AI 直读分析...`);
    const imgPrefix = (projectNameTrimmed || 'business').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);
    const imgResults = await Promise.allSettled(
      userImages.map(async (b64, i) => {
        const base64Data = b64.includes(',') ? b64.split(',')[1] : b64;
        try {
          // ★ 第一步：直接用 base64 给 GPT-4o 分析（不依赖 Supabase，最可靠）
          const desc = await analyzeImageBase64(base64Data, 'image/png');
          if (!desc) {
            console.warn(`[商业模式图片] 图片${i+1} AI 分析返回空`);
            return null;
          }
          console.log(`[商业模式图片] 图片${i+1} 分析成功 (${desc.length}字):`, desc.slice(0, 80) + '...');

          // ★ 第二步：异步上传 Supabase 持久化（best-effort，不影响分析结果）
          const fileName = `business_${imgPrefix}_${Date.now()}_${i}.png`;
          const supabase = await getSupabase();
          supabase.storage
            .from('evidence-images')
            .upload(fileName, Buffer.from(base64Data, 'base64'), {
              contentType: 'image/png',
              upsert: false,
            })
            .then(({ error: upErr }) => {
              if (upErr) console.error(`[商业模式图片] 上传持久化失败 (${i}):`, upErr.message);
            })
            .catch(err => console.error(`[商业模式图片] 上传持久化异常 (${i}):`, err.message));

          return `[用户上传图片${i+1}] ${desc}`;
        } catch (err) {
          console.error(`[商业模式图片] 处理失败 (${i}):`, err.message);
          return null;
        }
      })
    );
    const imgDescriptions = imgResults
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);
    if (imgDescriptions.length > 0) {
      formImageAnalysis = '\n\n## 用户上传的图片内容分析（由 AI 视觉识别提取）\n' + imgDescriptions.join('\n\n');
      console.log(`🖼️ [商业模式图片] ${imgDescriptions.length}/${userImages.length} 张图片分析成功`);
    } else {
      console.warn('🖼️ [商业模式图片] 所有图片分析均失败，跳过图片内容注入');
    }
  }

  // 阶段三：查询该项目已提交的证据
  let businessEvidenceText = '';
  let bizReferencedEvidenceIds = [];
  const evAddress = contract_address || '';
  if (evAddress) {
    try {
      const supabase = await getSupabase();
      const { data: projForBiz } = await supabase
        .from('project_facts')
        .select('id')
        .eq('contract_address', evAddress.toLowerCase())
        .maybeSingle();
      if (projForBiz?.id) {
        const { data: bizEv } = await supabase
          .from('evidence_submissions')
          .select('id, evidence_category, content, verification_count, image_url, image_description, status, content_type')
          .eq('project_cache_id', projForBiz.id)
          .order('created_at', { ascending: false });

        if (bizEv && bizEv.length > 0) {
          bizReferencedEvidenceIds = bizEv.map(e => e.id);
          const verified = bizEv.filter(e => e.status === 'verified');
          const partial = bizEv.filter(e => e.status === 'partial');
          const pending = bizEv.filter(e => e.status === 'pending');
          const patternEv = bizEv.filter(e => e.content_type === 'pattern_image');

          const parts = [];
          if (patternEv.length > 0) {
            const plines = patternEv.map(e => {
              const desc = e.image_description || e.content || '';
              return `- 📊模式图：${desc.slice(0, 200)}（${e.verification_count}人验证，状态：${e.status}）`;
            });
            parts.push(`\n### 用户上传的模式图（${patternEv.length}张）\n> 优先参考以下模式图分析结果来识别模式结构和返佣数据\n${plines.join('\n')}`);
          }
          if (verified.length > 0) parts.push(buildEvidenceText(verified, '已验证证据（≥3人确认）', '社区验证'));
          if (partial.length > 0) parts.push(buildEvidenceText(partial, '部分验证证据（1-2人验证）', '用户反映'));
          if (pending.length > 0) parts.push(buildEvidenceText(pending, '待验证证据', '用户提供，待核实'));

          if (parts.length > 0) {
            businessEvidenceText = `\n\n【用户/社区补充信息】\n${parts.join('\n\n')}`;
            console.log(`📝 [商业模式证据] 注入 ${bizEv.length} 条证据（模式图=${patternEv.length}, verified=${verified.length}, partial=${partial.length}, pending=${pending.length}）`);
          }
        }
      }
    } catch (bizEvErr) {
      console.warn('⚠️ 商业模式证据查询失败（忽略）:', bizEvErr.message);
    }
  }

  const userPrompt = `【任务】分析以下加密项目的商业模式，严格按照 System Prompt 的 JSON 格式输出结果。

${projectNameTrimmed ? `【强制】前端已提供项目名称："${projectNameTrimmed}"。share_card.project_name 字段【必须】原样填入"${projectNameTrimmed}"，【禁止】修改、【禁止】重新提取、【禁止】替换为其他值。违反此规则将导致错误。` : '【注意】前端未提供项目名称，请从规则文本开头提取纯项目代号（2-10个字母数字），禁止提取描述性词语。确实无法提取则返回"未命名项目"。'}

项目名称：${projectNameTrimmed || '（未提供，请从规则文本开头提取纯代号）'}
${finalRuleText ? `规则文本：${finalRuleText}` : formImageAnalysis ? `规则文本：用户上传了项目截图，AI 视觉分析提取内容如下：\n${formImageAnalysis.replace(/^## 用户上传的图片内容分析（由 AI 视觉识别提取）\n\n/mg, '').trim()}` : '规则文本：未提供'}
${investment ? `投资金额：${investment} U` : '投资金额：未指定'}
${referrals ? `推广人数：${referrals} 人` : '推广人数：未指定'}
${user_notes ? `补充信息：${user_notes}` : ''}
${formImageAnalysis && !finalRuleText ? '' : formImageAnalysis}
${businessEvidenceText}

请基于用户提供的规则文本进行分析。如果规则文本为空但用户上传了图片（即上方"用户上传的图片内容分析"部分有内容），则以图片分析结果作为主要依据进行分析，不要报告"未提供规则"或"无规则"。`;

  try {
    const startTime = Date.now();
    const dsRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: BUSINESS_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 4096,
      }),
    });

    console.log(`⏱️  响应: ${Date.now() - startTime}ms, 状态: ${dsRes.status}`);

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      console.error('❌ DeepSeek 错误:', errText.slice(0, 200));
      return jsonRes(res, 502, { error: `DeepSeek error ${dsRes.status}`, detail: errText.slice(0, 300) });
    }

    const dsJson = await dsRes.json();
    const rawContent = dsJson?.choices?.[0]?.message?.content;
    if (!rawContent) return jsonRes(res, 502, { error: 'Empty response' });

    const m = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = m ? m[1].trim() : rawContent.trim();
    let reportData;
    try { reportData = JSON.parse(jsonStr); }
    catch { return jsonRes(res, 502, { error: 'JSON parse failed' }); }

    console.log(`✅ 商业模式分析完成: ${reportData.pattern_type || '未知类型'}`);

    // 存储到数据库
    let reportId = null;
    try {
      const supabase = await getSupabase();
      const { data: inserted, error: dbErr } = await supabase
        .from('business_reports')
        .insert({
          user_address: user_address || null,
          project_name: projectNameTrimmed || '未命名项目',
          rule_text: finalRuleText || null,
          report_data: reportData,
          pattern_type: reportData.pattern_type || null,
          created_at: new Date().toISOString(),
        })
        .select('id');
      
      if (dbErr) {
        console.warn('⚠️  Supabase 存储失败:', dbErr.message);
      } else {
        reportId = inserted?.[0]?.id || null;
        console.log('💾 business_reports 存储 OK, id:', reportId);
      }
    } catch (dbErr) {
      console.warn('⚠️ business_reports 存储异常:', dbErr.message);
    }
    console.log(`📦 [商业模式] 存库完成`);

    return jsonRes(res, 200, { success: true, data: reportData, report_id: reportId });
  } catch (err) {
    console.error('❌ 内部错误:', err.message);
    return jsonRes(res, 500, { error: err.message });
  }
}

// ===== AI 项目名称标准化 =====
async function handleNormalizeProjectName(req, res) {
  const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return jsonRes(res, 500, { error: 'Missing DEEPSEEK_API_KEY' });
  }

  const body = await readBody(req);
  const { name } = body;

  if (!name || !name.trim()) {
    return jsonRes(res, 400, { error: 'name is required' });
  }

  const trimmedName = name.trim();
  const now = Date.now();

  try {
    // === 第1步：先查 Supabase 是否已存在该项目（节省AI调用成本 + 保证一致性）===
    const supabase = await getSupabase();
    let existingProject = null;

    // a) 按精确名称匹配
    const { data: byName } = await supabase
      .from('projects')
      .select('id, name, aliases')
      .eq('name', trimmedName)
      .maybeSingle();

    if (byName) {
      existingProject = byName;
    }

    // b) 按别名匹配（用户输入的是某个已存在项目的别名）
    if (!existingProject) {
      const { data: byAlias } = await supabase
        .from('projects')
        .select('id, name, aliases')
        .contains('aliases', [trimmedName])
        .maybeSingle();

      if (byAlias) {
        existingProject = byAlias;
        console.log(`📦 通过别名匹配到已存在项目: "${trimmedName}" → "${byAlias.name}"`);
      }
    }

    // 如果找到了已存在项目，直接返回（无需调用AI）
    if (existingProject) {
      console.log(`✅ 命中已有项目: "${existingProject.name}", 无需AI调用`);
      const allAliases = existingProject.aliases || [];
      if (!allAliases.includes(trimmedName)) {
        allAliases.push(trimmedName);
      }

      return jsonRes(res, 200, {
        success: true,
        data: {
          original_name: trimmedName,
          standard_name: existingProject.name,
          aliases: [...new Set(allAliases)], // 去重
          project_type: '已收录项目',
          confidence: 1.0,
          reason: `已在项目库中收录为 "${existingProject.name}"`,
          existing_project_id: existingProject.id,
          existing_project_name: existingProject.name,
        },
        timing: `${Date.now() - now}ms`,
      });
    }

    // === 第2步：未命中已有项目 → 调用 AI 智能识别 ===
    console.log(`🔍 未命中已有项目，调用 DeepSeek 分析: "${trimmedName}"`);
    const dsRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是"明鉴"平台的AI助手，专门负责标准化Web3项目名称。
            
你的任务：
1. 分析用户输入的项目名称
2. 识别这是哪个Web3项目（DeFi、GameFi、SocialFi、公链等）
3. 返回该项目的标准化名称（使用最广为人知的名称）
4. 列出所有常见别名（包括：代币符号、旧名称、英文全称、中文名等）

输出格式（严格JSON）：
{
  "standard_name": "标准化项目名称（如：MY）",
  "aliases": ["所有已知别名（如：Metya, MET, MY Group）"],
  "project_type": "项目类型（如：Web3社交平台）",
  "confidence": 0.95,  // 置信度 0-1
  "reason": "判断依据（简短说明）"
}

注意：
- 如果用户输的是代币符号（如：MY），要识别对应的项目全称
- 如果项目名称有多个常用名，选择最广为人知的那个
- 置信度 < 0.5 表示无法识别，可能是新项目或输入错误
- 只输出JSON，不要其他文字`,
          },
          {
            role: 'user',
            content: `用户输入了项目名称："${trimmedName}"。\n请分析并返回标准化名称。`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      console.warn('⚠️  DeepSeek API 调用失败:', errText.slice(0, 100));
      // 降级：返回原始名称
      return jsonRes(res, 200, {
        success: true,
        data: {
          original_name: trimmedName,
          standard_name: trimmedName,
          aliases: [],
          project_type: '未知',
          confidence: 0.3,
          reason: 'AI 调用失败，使用原始名称',
        },
      });
    }

    const dsJson = await dsRes.json();
    const content = dsJson.choices?.[0]?.message?.content || '{}';

    let aiResult;
    try {
      aiResult = JSON.parse(content);
    } catch (parseErr) {
      console.warn('⚠️  AI 返回JSON解析失败:', content.slice(0, 100));
      aiResult = {
        standard_name: trimmedName,
        aliases: [],
        confidence: 0.3,
        reason: 'AI 返回格式错误',
      };
    }

    // AI 路径：无已存在项目，直接返回AI结果
    const response = {
      success: true,
      data: {
        original_name: trimmedName,
        standard_name: aiResult.standard_name || trimmedName,
        aliases: aiResult.aliases || [],
        project_type: aiResult.project_type || '未知',
        confidence: aiResult.confidence || 0.5,
        reason: aiResult.reason || '',
        existing_project_id: null,
        existing_project_name: null,
      },
      timing: `${Date.now() - now}ms`,
    };

    console.log(`✅ AI 标准化完成: "${trimmedName}" → "${response.data.standard_name}" (置信度: ${response.data.confidence})`);
    return jsonRes(res, 200, response);
  } catch (err) {
    console.error('❌ AI 标准化失败:', err.message);
    // 降级：返回原始名称
    return jsonRes(res, 200, {
      success: true,
      data: {
        original_name: trimmedName,
        standard_name: trimmedName,
        aliases: [],
        confidence: 0.3,
        reason: `AI 调用异常: ${err.message}`,
      },
    });
  }
}

// ===== Token Info（BSCTrace 链上数据）=====
async function handleTokenInfo(req, res) {
  const body = await readBody(req);
  const { address, chain } = body;

  if (!address) {
    return jsonRes(res, 400, { error: 'address is required' });
  }

  // 仅 BSC 链支持 BSCTrace RPC
  if (chain && chain !== 'bsc') {
    return jsonRes(res, 200, {
      supported: false,
      chain,
      message: `当前链（${chain}）暂未接入链上数据 RPC`,
    });
  }

  try {
    const [tokenInfo, contractStatus] = await Promise.all([
      getTokenInfo(address),
      getContractStatus(address),
    ]);
    const formattedSupply = formatSupply(tokenInfo.totalSupply, tokenInfo.decimals);

    return jsonRes(res, 200, {
      supported: true,
      chain: 'bsc',
      tokenInfo: {
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        totalSupply: tokenInfo.totalSupply,
        formattedSupply,
      },
      contractStatus: {
        isContract: contractStatus.isContract,
        codeSize: contractStatus.codeSize,
      },
    });
  } catch (err) {
    console.error('[TokenInfo] 获取失败:', err.message);
    return jsonRes(res, 500, { error: `获取链上数据失败: ${err.message}` });
  }
}

// ===== 对话 API（阶段四：证据融入对话）=====
async function handleChat(req, res) {
  if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' });
  try {
    const body = await readBody(req);
    const { project_name, contract_address, message, chat_history, user_address, conversation_count, is_paid, page } = body;

    if (!message || !message.trim()) {
      return jsonRes(res, 400, { error: 'message is required' });
    }

    const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY;
    if (!deepseekKey) {
      return jsonRes(res, 500, { error: 'Missing DEEPSEEK_API_KEY' });
    }

    // ── 1. 加载证据上下文 ──────────────────────────────────
    let evidenceContext = '暂无用户提交的证据。';

    if (contract_address) {
      try {
        const supabase = await getSupabase();

        // 查找 project_facts.id
        const { data: proj } = await supabase
          .from('project_facts')
          .select('id')
          .eq('contract_address', contract_address.toLowerCase())
          .single();

        if (proj) {
          const { data: evidences } = await supabase
            .from('evidence_submissions')
            .select('content, image_description, content_type, evidence_category, status, verification_count')
            .eq('project_cache_id', proj.id)
            .order('created_at', { ascending: false });

          if (evidences && evidences.length > 0) {
            // 商业模式对话只加载模式图(pattern_image)证据
            const filteredEvidences = page === 'business'
              ? evidences.filter(e => e.content_type === 'pattern_image')
              : evidences;

            if (filteredEvidences.length > 0) {
              const verified = filteredEvidences.filter(e => e.status === 'verified');
              const partial = filteredEvidences.filter(e => e.status === 'partial');
              const pending = filteredEvidences.filter(e => e.status !== 'verified' && e.status !== 'partial');

            const parts = [];
            if (verified.length > 0) {
              parts.push(`【已验证证据】（社区确认，可信）\n${verified.map(e => {
                const text = e.content || e.image_description || '';
                return `- [${e.evidence_category || '综合'}] ${text.slice(0, 300)}`;
              }).join('\n')}`);
            }
            if (partial.length > 0) {
              const vc = partial[0]?.verification_count || 1;
              parts.push(`【部分验证证据】（已有${vc}人验证）\n${partial.map(e => {
                const text = e.content || e.image_description || '';
                return `- [${e.evidence_category || '综合'}] ${text.slice(0, 300)}`;
              }).join('\n')}`);
            }
            if (pending.length > 0) {
              parts.push(`【待验证证据】（用户提交，尚未验证）\n${pending.map(e => {
                const text = e.content || e.image_description || '';
                return `- [${e.evidence_category || '综合'}] ${text.slice(0, 300)}`;
              }).join('\n')}`);
            }

            if (parts.length > 0) {
              evidenceContext = parts.join('\n\n');
            }
          }
        }
      }
      } catch (evErr) {
        console.error('[对话] 加载证据上下文失败:', evErr.message);
        // 降级：证据加载失败不影响对话
      }
    }

    // ── 1.5 付费状态判断（前端为主，数据库为辅）──────
    let isPaid = !!is_paid;  // 前端 localStorage 权威值（用户已付费解锁）
    let paidSource = isPaid ? '前端localStorage' : '未知';
    if (!isPaid && contract_address && user_address) {
      // 前端未确认付费 → 查数据库兜底（多设备/新浏览器场景）
      try {
        const supabasePaid = await getSupabase();
        const { data: report } = await supabasePaid
          .from('business_reports')
          .select('id')
          .eq('contract_address', contract_address.toLowerCase())
          .ilike('user_address', user_address.toLowerCase())
          .maybeSingle();
        if (report) { isPaid = true; paidSource = '数据库'; }
        console.log(`[对话] DB付费状态: ${isPaid ? '已付费' : '免费'} | project=${project_name || contract_address}`);
      } catch (payErr) {
        console.warn('[对话] 付费状态查询失败，降级为免费模式:', payErr.message);
      }
    }
    console.log(`[对话] 最终付费状态: ${isPaid ? '已付费' : '免费'} | 来源=${paidSource} | project=${project_name || contract_address}`);

    // ── 1.6 免费用户轮数限制 ──────────────────────────────────
    const convCount = parseInt(conversation_count) || 0;
    const remainingCount = 5 - (convCount + 1);  // 剩余免费次数
    if (!isPaid && convCount >= 5) {
      console.log(`[对话] 免费用户对话已达上限 (${convCount}轮)`);
      const limitReply = page === 'business'
        ? '🔒 免费对话次数已用完\n\n您已达到免费对话上限（5轮）。解锁商业模式拆解报告后，可继续与首席分析师深入讨论。'
        : '您已达到免费对话上限。解锁全景风险报告后，可继续深入讨论本项目。';
      return jsonRes(res, 403, {
        error: 'FREE_LIMIT_REACHED',
        reply: limitReply,
        is_paid: false,
        remaining_count: 0,
      });
    }

    // ── 2. 构建对话历史文本 ──────────────────────────────────
    const historyText = (chat_history && chat_history.length > 0)
      ? chat_history.map((h, i) => `${h.type === 'user' ? '用户' : 'AI'}：${h.content}`).join('\n')
      : '（无历史对话）';

    // ── 3. 构建 System Prompt（双模式：付费/免费 + 双页面）──
    // 计算部分验证证据的人数（用于 prompt 内文本替换）
    const partialMatch = evidenceContext.match(/已有(\d+)人验证/);
    const evCount = partialMatch ? partialMatch[1] : 'N';

    let systemPrompt;

    console.log(`[对话] 配置: page=${page}, isPaid=${isPaid}, convCount=${convCount}`);

    // ── 商业模式拆解页面：首席分析师 ──────────────────────
    if (page === 'business') {
      if (isPaid) {
        systemPrompt = `⚠️ 最重要：你的每条回复绝对不能超过 200 字！超过将被截断。

你是「明鉴」平台的**首席分析师**，与已付费用户深入讨论商业模式。

【当前项目/规则】${project_name || '用户提交的商业模式'}
【证据】${evidenceContext}

用户已付费解锁商业模式拆解报告，默认用户已知晓报告中的完整内容。回答时遵循以下规则：

【付费用户回答规范】

1. **长度限制（按问题类型）**：
   - 概念解释类（如"什么是级差返佣"）：≤ 3 句话
   - 项目关联类（如"这个模式在XX项目里意味着什么"）：≤ 4 句话
   - 深度追问类（如"详细解释一下我的奖金如何计算"）：≤ 6 句话
   - 需要列举多个点时，使用简洁列表（每条≤1行）

2. **引用报告的方式**：
   - ✅ "报告里提到该模式对新增资金依赖度高"
   - ❌ 直接复制报告原文段落

3. **互动节奏**：
   - 每个回答末尾预留追问空间（每次换不同说法）
   - "需要我帮你算一下具体数字吗？"
   - "这是报告中提到的风险点，要展开说吗？"
   - "还有其他想了解的吗？"

4. **优先回答用户问题本身**：
   - 用户问"能赚多少钱"→ 先给结论和大致估算，再把其他相关点放到追问里
   - 用户问"这个模式有什么风险"→ 先说核心风险，再说其他风险点（不超过2个）

5. **禁止**：
   - 禁止一上来就输出长篇风险分析。
   - 禁止使用"首先、其次、另外"等分点论述。
   - 禁止说合约漏洞、资金流向等非商业分析相关内容。
   - 禁止超过 200 字。

6. **示例对比**：
   ❌ 错误（过长、像读报告）：
   "根据商业拆解报告，XX项目是一个三级返佣模式。第一级直推10%、第二级间推5%..."
   ✅ 正确（简洁、有互动）：
   "这是一个三级返佣模式，直推10%、间推5%。如果您预算3000U，分3个账户可以利益最大化。需要我帮您算一下具体数字吗？"`
      } else {
        systemPrompt = `⚠️ 最重要：你的每条回复绝对不能超过 200 字！超过将被截断。

你是「明鉴」平台的**首席分析师**，正在与免费用户对话。

【当前项目/规则】${project_name || '用户提交的商业模式'}
【证据】${evidenceContext}

⚠️ 最重要的对话交互准则（必须严格执行）：
━━━━━━━━━━━━━━━━━━━━━━
1️⃣ 数字输入澄清机制：用户仅输入一个数字（1-9）时，决不推断含义，回复标准澄清话术：
"您发送了'{数字}'，请问这是指投资金额、直推人数，还是其他含义？请补充说明，我会据此为您提供对应的分析。"
━━━━━━━━━━━━━━━━━━━━━━
2️⃣ 禁止"自动填空"：绝不将用户数字自动映射到任何预设选项（如静态/动态/混合）。所有用户输入必须经过显式确认后才纳入分析流程。
━━━━━━━━━━━━━━━━━━━━━━
3️⃣ 用户明确表达意图之前，不输出任何计算结果、策略建议或风险判断。
━━━━━━━━━━━━━━━━━━━━━━
4️⃣ 【免费用户收到长规则文本时的回复模板】
当用户发送了一段完整的规则文本（超过50字），且尚未付费时：
- 回复必须控制在 3 句话以内。
- 结构固定：
  第1句：确认收到信息（如"已收到您提供的项目规则"）
  第2句：说明付费后能获得什么（如"解锁后可直接生成完整拆解报告，含计算器、策略建议和风险分析"）
  第3句：给用户补充空间（如"如需补充任何细节，可继续发送"）
- 不主动追问细节，不解释"为什么需要这些信息"，不展开分析。
- 如果用户主动追问，再进行澄清；否则所有深度分析只对付费用户展开。
示例回复：
"已收到您提供的项目规则，信息量比较完整。解锁后可直接生成完整的拆解报告（含计算器、策略建议和风险分析）。如需补充任何细节，可继续发送。"
━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━
✅ 免费用户你可回答的范围：
1. 基础概念解释（什么是级差返佣、矩阵制、静态分红、对碰奖等术语含义）
2. 模式类型的大致分类
3. 引导用户补充完整信息
4. 提示付费后可获得完整分析

❌ 免费用户不可提供的（即使你知道）：
- 回本周期计算 → "回本周期计算属于付费报告内容，解锁后可为您详细分析。"
- 点位布局建议 → "具体点位布局在拆解报告中包含，解锁后可查看。"
- 收益估算 → "具体收益需要输入投资额和推广人数才能计算，解锁报告后可精确测算。"
- 深度风险判断 → "有相关风险因素，解锁报告后有专业预警。"
- 策略建议 → "完整策略建议在拆解报告中包含详细点位布局。"

❌ 不要装模作样分析合约、资金流向等非商业模式内容。

回答结构：
第1句：直接回答用户问题。
第2句：补充1句相关说明。
最后1句：引导追问或自然过渡。

不要自行添加付费引导语，系统会根据轮次自动追加。

❌ 错误示例（禁止）：
用户：3
AI：好的，收到"3"。我理解为这是您对"静态"模式的选择确认...
（错误：猜测了用户意图）

✅ 正确示例：
用户：3
AI：您发送了"3"，请问这是指投资金额、直推人数，还是其他含义？请补充说明，我会据此为您提供对应的分析。

用户：帮我算一下回本
AI：回本周期计算属于付费报告内容，解锁后可为您详细分析。您目前可以告诉我更多规则细节，我会帮您判断这是什么模式。`;
      }
    } else if (isPaid) {
      // ── 付费模式：结构化回答 + 引导深入（冉哥方案）────
      systemPrompt = `⚠️ 最重要：你的每条回复绝对不能超过 200 字！超过将被截断。

你是「明鉴」风险洞察官，与已付费用户对话。

你是「明鉴」风险洞察官，与已付费用户对话。

用户已付费解锁全景风险报告，默认用户已知晓报告中的完整内容。回答时遵循以下规则：

【付费用户回答规范】

1. **长度限制（按问题类型）**：
   - 概念解释类（如"LP锁定什么意思"）：≤ 3 句话
   - 项目关联类（如"这个LP锁定在XX项目里意味着什么"）：≤ 4 句话
   - 深度追问类（如"详细解释一下提现受控的机制"）：≤ 6 句话
   - 需要列举多个点时，使用简洁列表（每条≤1行）

2. **引用报告的方式**：
   - ✅ "报告里提到持仓集中度偏高，单地址占75%"
   - ❌ 直接复制报告原文段落

3. **互动节奏**：
   - 每个回答末尾预留追问空间（每次换不同说法）
   - "需要我深入分析吗？"
   - "这是报告中提到的风险点，要展开说吗？"
   - "还有其他想了解的吗？"

4. **优先回答用户问题本身**：
   - 用户问"公司注册在哪"→ 先给结论（查不到），再解释原因，不把其他问题一并倒出
   - 用户问"LP锁定什么意思"→ 先给定义，再结合项目说1句，不展开其他风险

5. **禁止**：
   - 禁止一上来就展开风险分析。
   - 禁止使用"首先、其次、另外"等分点论述。
   - 禁止超过 200 字。
   - 禁止直接复制报告原文段落。

6. **示例对比**：
   ❌ 错误（过长、像读报告）：
   "根据明鉴全景风险报告，Metya的LP锁定状态存在实质性风险。报告显示，Metya曾宣称锁定LP以证明其'公平'和'安全'..."
   ✅ 正确（简洁、有互动）：
   "LP锁定是指项目方把流动性池的币锁进合约，防止突然撤资。Metya确实锁了，但后来改了核心规则，保护作用被削弱了。需要我详细说一下那次规则变更的内容吗？"`
    } else {
      // ── 免费模式：基础回答 + 分层付费引导 ──
      systemPrompt = `你是「明鉴」风险洞察官，正在与免费用户对话。

【当前项目】${project_name || '未命名项目'}
【证据】${evidenceContext}

⚠️ 回答限制：每条不超过200字。

━━━━━━━━━━━━━━━━━━━━━━
✅ 必须直接回答的问题（不推诿、不让用户自己去查）

1️⃣ 链上公开数据
   - 发行量、总供应量、流通量、流通率
   - 持币地址数、TOP10占比
   - 合约地址、所属链
   - 当前价格、24h交易量
   → 直接给出具体数字，然后1句补充观察，结尾自然引导付费

2️⃣ 项目基本情况
   - 做什么的、什么赛道、代币名称
   - 官网、社群链接、成立时间
   - 融资记录（仅说"有过融资/已完成X轮"，不说金额和估值）
   → 直接回答，不推诿

3️⃣ 基础概念解释
   - LP锁定、RugPull、模式类型等Web3常识
   → 先给定义，再结合本项目情况说1句

4️⃣ 笼统项目评价
   - "有亮点也有风险点，建议进一步了解"
   - 可以说"已完成审计"、"团队匿名"等客观事实
   → 但不给综合评分或风险等级

━━━━━━━━━━━━━━━━━━━━━━
⚠️ 可以提示但不展开的问题

5️⃣ 模式变更 / 风险记录
   - ✅ 可以说："检测到该项目有模式变更记录（据社区反馈）"
   - ❌ 不可说：具体变更几次、每次改了什么、影响多大
   - 引导："具体变更细节和影响，在付费报告中有详细分析"

6️⃣ 出金障碍 / 用户投诉
   - ✅ 可以说："有用户反馈提现遇到问题"
   - ❌ 不可说：具体障碍类型列表、涉及金额
   - 引导："更多细节在付费报告中"

━━━━━━━━━━━━━━━━━━━━━━
❌ 明确不回答的问题

7️⃣ 六维评分和风险等级 → "综合风险等级属于全景风险报告内容，解锁后可查看完整六维评分"
8️⃣ 投资建议和收益预测 → "我无法提供投资建议或预测收益，这是合规要求"（注意：这不是付费限制，是永远不提供的）
9️⃣ 深度风险分析（模式变更详情、资金锁定详情）→ 提示"有记录"但不展开

⚠️ 关键区别（避免歧义）：
- "投资建议/收益预测"→ 永远不提供（合规），不要暗示"解锁后就有"
- "风险等级/六维评分/深度分析"→ 免费版不提供，但**付费版有完整数据**
- ❌ 错误说法："我不能给出综合风险等级"（像AI不会评估）
- ✅ 正确说法："综合风险评估在付费报告中，解锁后可查看六维评分"（说明是模式限制）

━━━━━━━━━━━━━━━━━━━━━━
📌 回答结构（严格执行）

第1句：直接回答用户问题（给数据或定义）
第2句：补充1句相关观察或背景
最后1句：引导追问或付费（每次换不同说法）

✅ 正确回答示例：

用户问："发行量是多少？"
MY总发行量10亿枚，目前流通约2.12亿枚，流通率约21%。持币地址约38.3万个。
需要我帮您分析代币分配结构吗？解锁报告后有详细解读。

用户问："LP锁定什么意思？"
LP锁定是项目方把流动性池代币锁进智能合约，一段时间内不能取出，降低撤池跑路风险。
Metya项目LP确实锁定了，但后来改了核心规则，锁的保护作用已被削弱。
需要我具体分析这个变更的影响吗？

用户问："这项目怎么样？"
从公开信息看，Metya已完成CertiK审计，有融资记录，LP已锁定。但团队匿名，且历史上有模式变更记录。
整体有亮点也有风险点。想了解六维评分和详细风险分析，建议解锁全景风险报告。

用户问："能赚多少？"
我无法提供投资建议或预测收益（合规要求）。但我可以帮您分析：收入来源是什么、用户反馈中收益兑现情况如何、风险点在哪里。
需要我帮您分析其中一个方向吗？

━━━━━━━━━━━━━━━━━━━━━━
📌 引导语（每次随机选一种，不超过15字）：
- "需要我深入分析吗？"
- "还想了解哪方面？"
- "还有其他疑问吗？"
- "要我拆解某个点吗？"
- "需要看具体数据吗？"
- "想聊哪个维度？"

📌 不要自行添加付费引导语，系统会自动根据轮次追加。`;
    }

    // ── 4. 调用 DeepSeek ──────────────────────────────────

    const dsRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `【对话历史】\n${historyText}\n\n【当前消息】\n${message}` },
        ],
        temperature: 0.7,
        max_tokens: isPaid ? 1000 : 600,  // 付费结构化(约300字) vs 免费限长(约150字)
      }),
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      console.error('❌ [对话] DeepSeek 调用失败:', dsRes.status, errText.slice(0, 200));
      return jsonRes(res, 502, { error: `DeepSeek API error: ${dsRes.status}` });
    }

    const dsData = await dsRes.json();
    const aiReply = dsData.choices?.[0]?.message?.content || '抱歉，我暂时无法回答这个问题。';

    // 🔧 免费模式轮次后缀（由后端保证，不依赖 AI 指令遵守）
    let finalReply = aiReply;
    const reportName = page === 'business' ? '商业模式拆解报告' : '全景风险报告';
    if (!isPaid) {
      if (convCount === 4) {
        // 第5轮（最后一次）：强制加"最后一次"提示
        finalReply = aiReply + `\n\n💡 这是最后一次免费对话。解锁后可无限畅聊+查看${reportName}。`;
      } else if (convCount === 3) {
        // 第4轮：50% 概率加引导
        if (Math.random() < 0.5) {
          finalReply = aiReply + `\n\n💡 免费对话次数即将用完。如需深入分析，建议解锁${reportName}。`;
        }
      } else if (convCount === 2) {
        // 第3轮：必须加引导
        finalReply = aiReply + `\n\n💡 您还有${remainingCount}次免费对话。解锁后可查看${reportName}。`;
      }
    }

    console.log(`✅ [对话] AI 回复 ${aiReply.length}字 → 最终 ${finalReply.length}字`);

    return jsonRes(res, 200, {
      success: true,
      reply: finalReply,
      is_paid: isPaid,
      remaining_count: isPaid ? -1 : Math.max(0, 4 - convCount),
    });
  } catch (err) {
    console.error('❌ handleChat:', err.message);
    return jsonRes(res, 500, { error: err.message });
  }
}

// ===== 项目 upsert（统一项目库同步）=====
async function handleProjectsUpsert(req, res) {
  if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' });
  try {
    const body = await readBody(req);
    const { name, contract_address, chain } = body;
    if (!contract_address || !contract_address.trim()) {
      return jsonRes(res, 400, { error: 'contract_address is required' });
    }
    const supabase = await getSupabase();
    const addr = contract_address.toLowerCase().trim();
    // 查是否已存在
    const { data: existing } = await supabase
      .from('projects')
      .select('id, assessment_count')
      .eq('contract_address', addr)
      .maybeSingle();
    if (existing) {
      // 更新：评估次数 +1，更新时间
      const { error: updErr } = await supabase
        .from('projects')
        .update({
          assessment_count: (existing.assessment_count || 0) + 1,
          last_eval_time: new Date().toISOString(),
          name: name || undefined,
        })
        .eq('id', existing.id);
      if (updErr) throw updErr;
      return jsonRes(res, 200, { project_id: existing.id, new_count: (existing.assessment_count || 0) + 1 });
    } else {
      // 插入新项目
      const { data: inserted, error: insErr } = await supabase
        .from('projects')
        .insert({
          name: name || '未命名项目',
          contract_address: addr,
          chain: chain || '未知',
          assessment_count: 1,
          last_eval_time: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      console.log(`📁 [项目库] 新建项目: ${name || addr} → id=${inserted.id}`);
      return jsonRes(res, 201, { project_id: inserted.id });
    }
  } catch (err) {
    console.error('❌ handleProjectsUpsert:', err.message);
    return jsonRes(res, 500, { error: err.message });
  }
}

// ===== 邀请返佣 + 代金券 =====

/** 生成邀请码/链接 */
async function handleInviteGenerate(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const user_address = urlObj.searchParams.get('user_address');
    if (!user_address) return jsonRes(res, 400, { error: 'user_address is required' });

    const supabase = await getSupabase();
    const addr = user_address.toLowerCase();

    const { data: existing } = await supabase.from('invitations').select('invite_code').eq('inviter', addr).maybeSingle();
    if (existing) {
      return jsonRes(res, 200, { invite_code: existing.invite_code, invite_url: `https://wisescan.io/invite?code=${existing.invite_code}` });
    }

    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const invite_code = addr.slice(2, 6).toUpperCase() + suffix;
    const { error: insErr } = await supabase.from('invitations').insert({ inviter: addr, invitee: '', invite_code });
    if (insErr) throw insErr;

    return jsonRes(res, 200, { invite_code, invite_url: `https://wisescan.io/invite?code=${invite_code}` });
  } catch (err) {
    return jsonRes(res, 500, { error: err.message });
  }
}

/** 接受邀请（被邀请人连接钱包后调用）→ 发放代金券 */
async function handleInviteAccept(req, res) {
  try {
    const body = await readBody(req);
    const { invite_code, invitee_address } = body;
    if (!invite_code || !invitee_address) return jsonRes(res, 400, { error: 'invite_code and invitee_address required' });

    const supabase = await getSupabase();
    const invitee = invitee_address.toLowerCase();

    // 查邀请码（含 status 和 invitee 用于防重检查）
    const { data: inv } = await supabase.from('invitations').select('id, inviter, invitee, status').eq('invite_code', invite_code).maybeSingle();
    if (!inv) return jsonRes(res, 404, { error: '邀请码无效' });
    if (inv.invitee) return jsonRes(res, 400, { error: '该邀请码已被使用' });
    if (inv.status !== 'pending') return jsonRes(res, 400, { error: '该邀请码状态异常' });

    // 更新邀请状态为 connected
    const now = new Date().toISOString();
    const { error: updErr } = await supabase.from('invitations').update({
      invitee,
      status: 'connected',
      connected_at: now,
    }).eq('id', inv.id);
    if (updErr) throw updErr;

    // 给邀请人发放 2.99U 代金券（有效期30天）
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: coupErr } = await supabase.from('coupons').insert({
      user_address: inv.inviter,
      amount: 2.99,
      type: 'invite',
      status: 'active',
      expires_at,
    });
    if (coupErr) throw coupErr;

    return jsonRes(res, 200, { success: true, type: 'connected' });
  } catch (err) {
    return jsonRes(res, 500, { error: err.message });
  }
}

/** 获取邀请统计 */
async function handleInviteStats(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const user_address = urlObj.searchParams.get('user_address');
    if (!user_address) return jsonRes(res, 400, { error: 'user_address is required' });

    const supabase = await getSupabase();
    const addr = user_address.toLowerCase();

    const { data: invites } = await supabase.from('invitations').select('status, invitee').eq('inviter', addr);
    const effective_invites = (invites || []).filter(i => i.invitee);
    const invite_count = effective_invites.length;
    const paid_count = effective_invites.filter(i => i.status === 'paid').length;

    // 总返佣 = paid邀请 * 0.5
    const total_commission = paid_count * 0.5;

    // 已提现金额（排除 rejected）
    const { data: ws } = await supabase.from('withdrawals').select('amount').eq('user_address', addr).neq('status', 'rejected');
    const withdrawn = (ws || []).reduce((s, w) => s + parseFloat(w.amount), 0);
    const available_balance = Math.max(0, total_commission - withdrawn);

    // 代金券统计
    const { data: coupons } = await supabase.from('coupons').select('status').eq('user_address', addr);
    const active_coupons = (coupons || []).filter(c => c.status === 'active').length;

    return jsonRes(res, 200, { invite_count, total_commission, available_balance, active_coupons });
  } catch (err) {
    return jsonRes(res, 500, { error: err.message });
  }
}

/** 获取邀请记录列表 */
async function handleInviteHistory(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const user_address = urlObj.searchParams.get('user_address');
    if (!user_address) return jsonRes(res, 400, { error: 'user_address is required' });

    const supabase = await getSupabase();
    const { data: invitations } = await supabase.from('invitations').select('*').eq('inviter', user_address.toLowerCase()).order('created_at', { ascending: false });

    return jsonRes(res, 200, { invitations: invitations || [] });
  } catch (err) {
    return jsonRes(res, 500, { error: err.message });
  }
}

/** 申请提现 */
async function handleWithdrawRequest(req, res) {
  try {
    const body = await readBody(req);
    const { user_address, amount, address } = body;
    if (!user_address || !amount) return jsonRes(res, 400, { error: 'user_address and amount required' });

    const supabase = await getSupabase();
    const addr = user_address.toLowerCase();

    // 计算可用余额（同 stats 逻辑）
    const { data: invites } = await supabase.from('invitations').select('status, invitee').eq('inviter', addr);
    const paid_count = (invites || []).filter(i => i.status === 'paid' && i.invitee).length;
    const total_commission = paid_count * 0.5;
    const { data: ws } = await supabase.from('withdrawals').select('amount').eq('user_address', addr).neq('status', 'rejected');
    const withdrawn = (ws || []).reduce((s, w) => s + parseFloat(w.amount), 0);
    const available_balance = Math.max(0, total_commission - withdrawn);

    if (parseFloat(amount) > available_balance) return jsonRes(res, 400, { error: '余额不足' });
    if (parseFloat(amount) < 5) return jsonRes(res, 400, { error: '最低提现5 USDT' });

    const { data: wd, error } = await supabase.from('withdrawals').insert({
      user_address: addr,
      amount: parseFloat(amount),
      address: address || addr,
      status: 'pending',
    }).select().maybeSingle();

    if (error) throw error;
    return jsonRes(res, 200, { success: true, withdrawal_id: wd?.id, status: 'pending', message: '提现申请已提交，将在3个工作日内处理' });
  } catch (err) {
    return jsonRes(res, 500, { error: err.message });
  }
}

/** 获取提现历史 */
async function handleWithdrawHistory(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const user_address = urlObj.searchParams.get('user_address');
    if (!user_address) return jsonRes(res, 400, { error: 'user_address is required' });

    const supabase = await getSupabase();
    const { data: withdrawals } = await supabase.from('withdrawals').select('*').eq('user_address', user_address.toLowerCase()).order('created_at', { ascending: false });

    return jsonRes(res, 200, { withdrawals: withdrawals || [] });
  } catch (err) {
    return jsonRes(res, 500, { error: err.message });
  }
}

/** 支付回调：被邀请人完成首次付费 → 给邀请人返佣 0.5U */
async function handlePaymentCallback(req, res) {
  try {
    const body = await readBody(req);
    const { user_address } = body;
    if (!user_address) return jsonRes(res, 400, { error: 'user_address required' });

    const supabase = await getSupabase();
    const addr = user_address.toLowerCase();

    // 查该用户是否是被邀请人
    const { data: inv } = await supabase.from('invitations').select('id, inviter').eq('invitee', addr).maybeSingle();
    if (!inv) return jsonRes(res, 200, { success: false, reason: 'not_invited' });

    // 只处理首次付费（状态从 connected → paid）
    if (inv.status === 'paid') return jsonRes(res, 200, { success: false, reason: 'already_paid' });

    await supabase.from('invitations').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', inv.id);

    return jsonRes(res, 200, { success: true, inviter: inv.inviter, commission: 0.5 });
  } catch (err) {
    return jsonRes(res, 500, { error: err.message });
  }
}

/** 获取用户代金券列表 */
async function handleCouponList(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const user_address = urlObj.searchParams.get('user_address');
    if (!user_address) return jsonRes(res, 400, { error: 'user_address is required' });

    const supabase = await getSupabase();
    const { data: coupons } = await supabase.from('coupons').select('*').eq('user_address', user_address.toLowerCase()).order('created_at', { ascending: false });

    return jsonRes(res, 200, { coupons: coupons || [] });
  } catch (err) {
    return jsonRes(res, 500, { error: err.message });
  }
}

// POST /api/coupons/use — 消耗代金券（每次解锁报告消耗1张）
async function handleCouponUse(req, res) {
  if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' });
  try {
    const body = await readBody(req);
    const { user_address } = body;
    if (!user_address) return jsonRes(res, 400, { error: 'user_address is required' });

    const supabase = await getSupabase();
    const addr = user_address.toLowerCase();

    // 查找用户的活跃代金券（按金额降序排，优先用大额）
    const { data: activeCoupons } = await supabase
      .from('coupons')
      .select('id, amount')
      .eq('user_address', addr)
      .eq('status', 'active')
      .order('amount', { ascending: false })
      .limit(1);

    if (!activeCoupons || activeCoupons.length === 0) {
      return jsonRes(res, 200, { success: true, used: 0, amount: 0, message: '无可用代金券' });
    }

    const coupon = activeCoupons[0];
    const now = new Date().toISOString();

    // 标记为已使用
    const { error: updErr } = await supabase
      .from('coupons')
      .update({ status: 'used', used_at: now })
      .eq('id', coupon.id);

    if (updErr) throw updErr;

    console.log(`[Coupon] 用户 ${addr.slice(0, 6)}... 消耗代金券 #${coupon.id}，抵扣 ${coupon.amount} USDT`);
    return jsonRes(res, 200, { success: true, used: 1, amount: parseFloat(coupon.amount) });
  } catch (err) {
    return jsonRes(res, 500, { error: err.message });
  }
}

// ===== 反馈提交（普通用户，无需 admin 登录） =====
async function handleFeedbackSubmit(req, res) {
  if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' });
  try {
    const body = await readBody(req);
    const { content, user_address } = body;
    if (!content || !content.trim()) return jsonRes(res, 400, { error: 'content is required' });

    const supabase = await getSupabase();
    const { data, error } = await supabase.from('feedback').insert({
      content: content.trim(),
      user_address: user_address?.toLowerCase() || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    }).select('id');

    if (error) {
      console.error('[Feedback] 写入失败:', error.message);
      return jsonRes(res, 500, { error: error.message });
    }
    console.log(`[Feedback] 新反馈 #${data?.[0]?.id} 来自 ${user_address || '匿名'}`);
    return jsonRes(res, 200, { success: true, id: data?.[0]?.id });
  } catch (err) {
    return jsonRes(res, 500, { error: err.message });
  }
}

// ===== 站点配置公共读取（前端页面用） =====
async function handleSiteConfig(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const key = url.searchParams.get('key');
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const configPath = join(dirname(fileURLToPath(import.meta.url)), 'config', 'site-config.json');
    let config = {};
    try { config = JSON.parse(readFileSync(configPath, 'utf-8')); } catch {}
    if (key) {
      return jsonRes(res, 200, { success: true, data: { [key]: config[key] || null } });
    }
    return jsonRes(res, 200, { success: true, data: config });
  } catch (err) {
    return jsonRes(res, 500, { error: err.message });
  }
}

// ===== Router =====
const routes = {
  '/api/add-project':              handleAddProject,
  '/api/generate-risk-report':     handleGenerateReport,
  '/api/generate-business-report': handleGenerateBusinessReport,
  '/api/normalize-project-name':  handleNormalizeProjectName,
  '/api/token-info':              handleTokenInfo,
  // 证据验证路由（前缀匹配，支持 query string）
  '/api/evidence/submit':         handleEvidenceSubmit,
  '/api/evidence/list':           handleEvidenceList,
  '/api/evidence/verify':         handleEvidenceVerify,
  // 阶段四：证据融入对话
  '/api/chat':                    handleChat,
  // 阶段六：项目库同步
  '/api/projects/upsert':        handleProjectsUpsert,
  // 邀请返佣 + 代金券
  '/api/invite/generate':        handleInviteGenerate,
  '/api/invite/accept':          handleInviteAccept,
  '/api/invite/stats':           handleInviteStats,
  '/api/invite/history':         handleInviteHistory,
  '/api/withdraw/request':       handleWithdrawRequest,
  '/api/withdraw/history':       handleWithdrawHistory,
  '/api/payment/callback':       handlePaymentCallback,
  '/api/coupons/list':           handleCouponList,
  '/api/coupons/use':            handleCouponUse,
  '/api/feedback':               handleFeedbackSubmit,
  '/api/site-config':            handleSiteConfig,
};

// 前缀匹配路由表（用于 /api/evidence/list?foo=bar 场景）
const prefixRoutes = [
  { prefix: '/api/evidence/submit',  handler: handleEvidenceSubmit },
  { prefix: '/api/evidence/list',    handler: handleEvidenceList },
  { prefix: '/api/evidence/verify',  handler: handleEvidenceVerify },
  { prefix: '/api/chat',             handler: handleChat },
  { prefix: '/api/feedback',         handler: handleFeedbackSubmit },
  { prefix: '/api/coupons/use',      handler: handleCouponUse },
  { prefix: '/api/site-config',      handler: handleSiteConfig },
  // 管理后台
  { prefix: '/api/admin',            handler: handleAdmin },
];

// ===== Health Check =====
function handleHealth(_req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
}

// ===== 证据哈希计算 =====
import { createHash } from 'node:crypto';
function computeEvidenceHash(content) {
  // 对文本内容：SHA-256；对图片 base64：取前 1KB 计算
  const slice = content.length > 1024 ? content.slice(0, 1024) : content;
  return createHash('sha256').update(slice, 'utf8').digest('hex');
}

// ===== 证据提交 =====
async function handleEvidenceSubmit(req, res) {
  if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' });
  try {
    const body = await readBody(req);
    const {
      contract_address,
      project_name,
      content_type,
      content,
      contributor_address,
      evidence_category,
      image_base64,
      image_description: userImageDesc,
      source_type,
    } = body;

    if (!contract_address || !content_type || !contributor_address) {
      return jsonRes(res, 400, { error: 'contract_address, content_type, contributor_address are required' });
    }
    // content 可以空（纯图片提交），但必须有 content 或 image_base64 之一
    if (!content && !image_base64) {
      return jsonRes(res, 400, { error: 'content or image_base64 is required' });
    }
    if (!['screenshot', 'text', 'link', 'pattern_image'].includes(content_type)) {
      return jsonRes(res, 400, { error: 'content_type must be screenshot, text, link, or pattern_image' });
    }

    const supabase = await getSupabase();

    // 查找 project_facts.id（通过 contract_address）
    const { data: proj, error: projErr } = await supabase
      .from('project_facts')
      .select('id')
      .eq('contract_address', contract_address.toLowerCase())
      .single();
    if (projErr || !proj) {
      return jsonRes(res, 404, { error: 'Project not found in cache. Please search the project first.' });
    }
    const projectCacheId = proj.id;

    // ── 图片上传 + AI 分析 ──────────────────────────────────
    let image_url = null;
    let aiImageDesc = '';

    if (image_base64 && typeof image_base64 === 'string') {
      try {
        // 1. 上传到 Supabase Storage
        const base64Data = image_base64.includes(',') ? image_base64.split(',')[1] : image_base64;
        const fileName = `${contract_address.toLowerCase()}_${Date.now()}.png`;
        const { data: upData, error: upErr } = await supabase.storage
          .from('evidence-images')
          .upload(fileName, Buffer.from(base64Data, 'base64'), {
            contentType: 'image/png',
            upsert: false,
          });

        if (upErr) {
          console.error('[证据] 图片上传失败:', upErr.message);
        } else {
          // 获取公开 URL
          const { data: urlData } = supabase.storage
            .from('evidence-images')
            .getPublicUrl(fileName);
          image_url = urlData?.publicUrl || null;

          // 2. 多模态分析
          if (image_url) {
            console.log('[证据] 开始 AI 图片分析:', image_url.slice(0, 60));
            aiImageDesc = await analyzeImage(image_url);
            console.log('[证据] AI 图片分析完成 (' + (aiImageDesc?.length || 0) + '字)');
          }
        }
      } catch (imgErr) {
        console.error('[证据] 图片处理失败:', imgErr.message);
        // 降级：继续提交流程，不影响文字证据
      }
    }

    // 最终图片描述：优先用 AI 分析，如有用户描述则合并
    const finalImageDesc = [
      aiImageDesc || '',
      userImageDesc && userImageDesc.trim() ? `[用户描述] ${userImageDesc.trim()}` : '',
    ].filter(Boolean).join('\n\n') || null;

    // 计算内容哈希（基于 content + finalImageDesc）
    const hashContent = `${content || ''}${finalImageDesc || ''}`;
    const evidenceHash = computeEvidenceHash(hashContent);

    // 查重：同一项目 + 同一哈希
    const { data: existing } = await supabase
      .from('evidence_submissions')
      .select('id, status')
      .eq('project_cache_id', projectCacheId)
      .eq('evidence_hash', evidenceHash)
      .maybeSingle();
    if (existing) {
      return jsonRes(res, 200, {
        success: true,
        status: existing.status,
        id: existing.id,
        message: '该信息已被其他用户提交，感谢你的参与！',
        image_analysis: finalImageDesc ? finalImageDesc.slice(0, 200) : null,
      });
    }

    // 插入新证据
    const { data: inserted, error: insertErr } = await supabase
      .from('evidence_submissions')
      .insert({
        project_cache_id: projectCacheId,
        project_name: project_name || null,
        contributor_address: contributor_address.toLowerCase(),
        content_type,
        content: content || '',
        image_url,
        image_description: finalImageDesc,
        source_type: source_type || 'evidence_button',
        evidence_hash: evidenceHash,
        evidence_category: evidence_category || null,
        status: 'pending',
        verification_count: 0,
        negative_count: 0,
      })
      .select('id, status')
      .single();
    if (insertErr) return jsonRes(res, 500, { error: insertErr.message });

    console.log(`📝 [证据] 新提交: project=${contract_address}, 类别=${evidence_category}, id=${inserted.id}, 有图片=${!!image_url}`);
    
    // 证据提交后清除 Tier1 缓存，确保下次报告生成重新注入证据
    clearReportCache(contract_address).catch(e => console.warn('[证据] 清除缓存失败:', e.message));
    
    return jsonRes(res, 200, {
      success: true,
      status: inserted.status,
      id: inserted.id,
      image_uploaded: !!image_url,
      image_analysis: finalImageDesc ? finalImageDesc.slice(0, 200) : null,
    });
  } catch (err) {
    console.error('❌ handleEvidenceSubmit:', err.message);
    return jsonRes(res, 500, { error: err.message });
  }
}

// ===== 证据列表 =====
async function handleEvidenceList(req, res) {
  if (req.method !== 'GET') return jsonRes(res, 405, { error: 'Method not allowed' });
  try {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const contract_address = urlObj.searchParams.get('contract_address');
    if (!contract_address) return jsonRes(res, 400, { error: 'contract_address is required' });

    const supabase = await getSupabase();

    // 查找 project_facts.id
    const { data: proj, error: projErr } = await supabase
      .from('project_facts')
      .select('id')
      .eq('contract_address', contract_address.toLowerCase())
      .single();
    if (projErr || !proj) {
      return jsonRes(res, 200, { pending: [], partial: [], verified: [], rejected: [] });
    }

    const { data: all, error: listErr } = await supabase
      .from('evidence_submissions')
      .select('id, contributor_address, content_type, content, evidence_category, status, verification_count, negative_count, created_at')
      .eq('project_cache_id', proj.id)
      .order('created_at', { ascending: false });
    if (listErr) return jsonRes(res, 500, { error: listErr.message });

    // 按状态分组，脱敏 contributor_address（只显示前 6 + 后 4）
    const grouped = { pending: [], partial: [], verified: [], rejected: [] };
    for (const ev of all || []) {
      const masked = ev.contributor_address
        ? `${ev.contributor_address.slice(0, 6)}...${ev.contributor_address.slice(-4)}`
        : 'unknown';
      const item = {
        id: ev.id,
        contributor_address_masked: masked,
        content_type: ev.content_type,
        content_preview: ev.content.length > 100 ? ev.content.slice(0, 100) + '...' : ev.content,
        evidence_category: ev.evidence_category,
        status: ev.status,
        verification_count: ev.verification_count,
        negative_count: ev.negative_count,
        created_at: ev.created_at,
      };
      if (grouped[ev.status]) grouped[ev.status].push(item);
    }

    return jsonRes(res, 200, grouped);
  } catch (err) {
    console.error('❌ handleEvidenceList:', err.message);
    return jsonRes(res, 500, { error: err.message });
  }
}

// ===== 证据验证 / 驳回 =====
async function handleEvidenceVerify(req, res) {
  if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Method not allowed' });
  try {
    const body = await readBody(req);
    const { evidence_id, verifier_address, action } = body;
    if (!evidence_id || !verifier_address || !action) {
      return jsonRes(res, 400, { error: 'evidence_id, verifier_address, action are required' });
    }
    if (!['approve', 'reject'].includes(action)) {
      return jsonRes(res, 400, { error: 'action must be approve or reject' });
    }

    const supabase = await getSupabase();
    const verifierLower = verifier_address.toLowerCase();

    // 查询证据
    const { data: evidence, error: evErr } = await supabase
      .from('evidence_submissions')
      .select('id, project_cache_id, contributor_address, status, verification_count, negative_count, evidence_category, content')
      .eq('id', evidence_id)
      .single();
    if (evErr || !evidence) return jsonRes(res, 404, { error: 'Evidence not found' });

    // 自己不能给自己刷票（自己的验证不计入计数，但仍可记录）
    const isSelf = verifierLower === evidence.contributor_address.toLowerCase();

    // 查是否已验证过
    const { data: existingVerify } = await supabase
      .from('evidence_verifications')
      .select('id, action')
      .eq('evidence_id', evidence_id)
      .eq('verifier_address', verifierLower)
      .maybeSingle();
    if (existingVerify) {
      return jsonRes(res, 400, { error: 'You have already verified this evidence.' });
    }

    // 记录验证
    await supabase.from('evidence_verifications').insert({
      evidence_id,
      verifier_address: verifierLower,
      action,
    });

    // 更新计数（自己验证自己的不计入）
    const updateFields = {};
    if (!isSelf) {
      if (action === 'approve') {
        updateFields.verification_count = evidence.verification_count + 1;
      } else {
        updateFields.negative_count = evidence.negative_count + 1;
      }
    } else {
      console.log(`📝 [证据] 提交者自己验证，不计入计数: evidence_id=${evidence_id}`);
    }

    // 状态流转
    const newVerificationCount = isSelf && action === 'approve'
      ? evidence.verification_count
      : (updateFields.verification_count ?? evidence.verification_count);
    const newNegativeCount = isSelf && action === 'reject'
      ? evidence.negative_count
      : (updateFields.negative_count ?? evidence.negative_count);

    let newStatus = evidence.status;
    if (newNegativeCount >= 3) {
      newStatus = 'rejected';
    } else if (newVerificationCount >= 3) {
      newStatus = 'verified';
    } else if (newVerificationCount >= 1) {
      newStatus = 'partial';
    }

    updateFields.status = newStatus;
    const { error: updateErr } = await supabase
      .from('evidence_submissions')
      .update(updateFields)
      .eq('id', evidence_id);
    if (updateErr) return jsonRes(res, 500, { error: updateErr.message });

    console.log(`📝 [证据] 验证: evidence_id=${evidence_id}, action=${action}, self=${isSelf}, status: ${evidence.status} → ${newStatus}`);

    // 如果变为 verified → 触发项目缓存更新
    if (newStatus === 'verified' && evidence.status !== 'verified') {
      await applyVerifiedEvidenceToCache(evidence, supabase);
    }

    return jsonRes(res, 200, { success: true, new_status: newStatus });
  } catch (err) {
    console.error('❌ handleEvidenceVerify:', err.message);
    return jsonRes(res, 500, { error: err.message });
  }
}

// ===== verified 证据联动项目缓存 =====
async function applyVerifiedEvidenceToCache(evidence, supabase) {
  try {
    const category = evidence.evidence_category || '';
    const content = (evidence.content || '').toLowerCase();

    // 自动推断类别（如果未指定）
    let inferredCategory = category;
    if (!inferredCategory || inferredCategory === 'other') {
      if (/模式变更|更名|改名|换模式|迁移|换皮/.test(content)) inferredCategory = 'mode_change';
      else if (/提现困难|无法提现|出金|资金被锁|冻结/.test(content)) inferredCategory = 'withdraw_issue';
      else if (/中心化|可操控|后门|超级权限|owner|管理员/.test(content)) inferredCategory = 'central_control';
      else if (/团队|匿名|实名/.test(content)) inferredCategory = 'team_info';
    }

    console.log(`📝 [证据→缓存] 应用 verified 证据: id=${evidence.id}, 类别=${inferredCategory}`);

    // 读取现有 project_facts（含 verified_evidence 列）
    const { data: proj, error: projErr } = await supabase
      .from('project_facts')
      .select('mode_change_count, withdraw_issue_count, top10_holding_percent, verified_evidence')
      .eq('id', evidence.project_cache_id)
      .single();
    if (projErr || !proj) {
      console.warn('⚠️ [证据→缓存] 未找到 project_facts:', evidence.project_cache_id);
      return;
    }

    const updates = {};

    // 计数更新
    if (inferredCategory === 'mode_change') {
      updates.mode_change_count = (proj.mode_change_count || 0) + 1;
      console.log(`📝 [证据→缓存] mode_change_count: ${proj.mode_change_count} → ${updates.mode_change_count}`);
    }
    if (inferredCategory === 'withdraw_issue') {
      updates.withdraw_issue_count = (proj.withdraw_issue_count || 0) + 1;
      console.log(`📝 [证据→缓存] withdraw_issue_count: ${proj.withdraw_issue_count} → ${updates.withdraw_issue_count}`);
    }

    // 🆕 证据内容写入 verified_evidence JSONB（去重，只增不减）
    const existingEvidence = Array.isArray(proj.verified_evidence) ? proj.verified_evidence : [];
    const truncatedContent = (evidence.content || '').slice(0, 300);
    const isDuplicate = existingEvidence.some(
      e => e.content === truncatedContent && e.category === inferredCategory
    );
    if (!isDuplicate) {
      existingEvidence.push({
        category: inferredCategory,
        content: truncatedContent,
        verification_count: evidence.verification_count || 3,
        verified_at: new Date().toISOString(),
        evidence_id: evidence.id,
      });
      // 限制最多保留 20 条（防膨胀）
      updates.verified_evidence = existingEvidence.slice(-20);
      console.log(`📝 [证据→缓存] verified_evidence 追加: ${inferredCategory} (总计${existingEvidence.length}条)`);
    } else {
      console.log(`📝 [证据→缓存] verified_evidence 去重跳过: 同类别同内容已存在`);
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase
        .from('project_facts')
        .update(updates)
        .eq('id', evidence.project_cache_id);
      if (updateErr) {
        console.error('❌ [证据→缓存] 更新 project_facts 失败:', updateErr.message);
      } else {
        console.log(`✅ [证据→缓存] project_facts 更新完成 (${Object.keys(updates).length}字段)`);
      }
    }
  } catch (err) {
    console.error('❌ applyVerifiedEvidenceToCache:', err.message);
  }
}

// ===== Server =====
const server = createServer(async (req, res) => {
  try {
    setCORS(res);
    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    // Health check
    if (req.url === '/api/health') return handleHealth(req, res);

    // 精确匹配
    const handler = routes[req.url.split('?')[0]];
    if (handler) return await handler(req, res);

    // 前缀匹配（用于 /api/evidence/list?contract_address=0x...）
    const urlPath = req.url.split('?')[0];
    for (const { prefix, handler: h } of prefixRoutes) {
      if (urlPath === prefix || urlPath.startsWith(prefix + '/')) {
        return await h(req, res);
      }
    }

    res.writeHead(404);
    res.end('Not Found');  } catch (err) {
    console.error('❌ 未捕获异常:', err.message);
    console.error(err.stack);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Server error: ${err.message}` }));
  }
});

// 启动时同步 Supabase → 本地缓存（确保 Supabase 宕机时本地有完整 fallback）
syncLocalCacheFromSupabase().then(() => {
  console.log('📦 本地缓存同步检查完成');
});

server.listen(PORT, () => {
  console.log('🚀 API 服务器启动: http://localhost:' + PORT);
  console.log('   路由: /api/add-project, /api/generate-risk-report, /api/generate-business-report, /api/token-info');
  console.log('   证据: /api/evidence/submit, /api/evidence/list, /api/evidence/verify');
  console.log('   对话: /api/chat (证据融入对话)');
  console.log('   邀请返佣+代金券: /api/invite/*, /api/withdraw/*, /api/payment/callback, /api/coupons/list, /api/coupons/use');
  console.log('   反馈: /api/feedback (问题反馈)');
  console.log('   站点配置: /api/site-config (前端展示数字)');
  console.log('   管理后台: /api/admin/* (仪表盘/提现/证据/项目/用户/反馈/配置)\n');
});
