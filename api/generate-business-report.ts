import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

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
  "visualization_tree": {"name":"你（共识账户）","children":[{"name":"B1（共识）","children":[{"name":"C1"},{"name":"C2"}]},{"name":"B2（共识）","children":[{"name":"C3"}]},{"name":"B3（共识）"},{"name":"B4（共识）"},{"name":"B5（共识）","children":[{"name":"C4"},{"name":"C5"}]}]}
}

⚠️ visualization_tree 的直推节点数必须与 strategy_suggestion 中的直推建议数一致（建议5个则树形图5个节点）。
⚠️ 信息不足时设 visualization_tree 为 null。
仅输出JSON，不要包含其他文字。

【证据引用规范】
- 已验证→"【社区验证】"
- 部分验证→"【用户反映】"
- 待验证→"【用户提供，待核实】"

【禁止事项】
- 不得承诺"稳赚不赔"
- 不得输出绝对化的崩盘时间
- 不得输出情绪化表述
- 不得留空字段`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY
  if (!deepseekKey) return res.status(500).json({ error: 'Missing DEEPSEEK_API_KEY' })

  const { project_name, rule_text, rules_text, investment, referrals, user_notes, user_address, contract_address } = req.body
  const finalRuleText = (rule_text || rules_text || '').trim()
  if (!project_name?.trim()) return res.status(400).json({ error: 'project_name is required' })

  // 加载证据上下文
  let businessEvidenceText = ''
  const evAddress = contract_address || ''
  if (evAddress) {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL!
      const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data: proj } = await supabase
          .from('project_facts')
          .select('id')
          .eq('contract_address', evAddress.toLowerCase())
          .maybeSingle()
        if (proj?.id) {
          const { data: bizEv } = await supabase
            .from('evidence_submissions')
            .select('id, evidence_category, content, verification_count, image_url, image_description, status, content_type')
            .eq('project_cache_id', proj.id)
            .order('created_at', { ascending: false })
          if (bizEv && bizEv.length > 0) {
            const patternEv = bizEv.filter(e => e.content_type === 'pattern_image')
            const verified = bizEv.filter(e => e.status === 'verified')
            const partial = bizEv.filter(e => e.status === 'partial' || e.status !== 'verified')
            const parts = []
            if (patternEv.length > 0) {
              parts.push(`\n### 用户上传的模式图\n${patternEv.map(e => `- 📊 ${(e.image_description || e.content || '').slice(0, 200)}`).join('\n')}`)
            }
            if (verified.length > 0) parts.push(`【社区验证】\n${verified.map(e => `- [${e.evidence_category || '综合'}] ${(e.content || '').slice(0, 200)}`).join('\n')}`)
            if (partial.length > 0) parts.push(`【用户反映】\n${partial.map(e => `- [${e.evidence_category || '综合'}] ${(e.content || '').slice(0, 200)}`).join('\n')}`)
            if (parts.length > 0) businessEvidenceText = `\n\n【社区补充信息】\n${parts.join('\n\n')}`
          }
        }
      }
    } catch { /* ignore */ }
  }

  const userPrompt = `请分析以下加密项目的商业模式，并严格按照 System Prompt 的 JSON 格式输出结果。

项目名称：${project_name.trim()}
${finalRuleText ? `规则文本：${finalRuleText}` : '规则文本：未提供'}
${investment ? `投资金额：${investment} U` : '投资金额：未指定'}
${referrals ? `推广人数：${referrals} 人` : '推广人数：未指定'}
${user_notes ? `补充信息：${user_notes}` : ''}
${businessEvidenceText}

请基于用户提供的规则文本进行分析。如果规则不完整，请在分析中注明需要补充的信息。`

  try {
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
        temperature: 0.3,
        max_tokens: 4096,
      }),
    })

    if (!dsRes.ok) {
      const errText = await dsRes.text()
      console.error('DeepSeek error:', errText.slice(0, 200))
      return res.status(502).json({ error: `DeepSeek error ${dsRes.status}`, detail: errText.slice(0, 300) })
    }

    const dsJson = await dsRes.json()
    const rawContent = dsJson?.choices?.[0]?.message?.content
    if (!rawContent) return res.status(502).json({ error: 'Empty response from DeepSeek' })

    const m = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = m ? m[1].trim() : rawContent.trim()
    let reportData
    try { reportData = JSON.parse(jsonStr) }
    catch { return res.status(502).json({ error: 'JSON parse failed' }) }

    // 存库
    let reportId = null
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL!
      const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data: inserted, error: dbErr } = await supabase.from('business_reports').insert({
          user_address: user_address || null,
          project_name: project_name.trim(),
          rule_text: finalRuleText || null,
          report_data: reportData,
          pattern_type: reportData.pattern_type || null,
          created_at: new Date().toISOString(),
        }).select().single()
        if (dbErr) {
          console.warn('Supabase insert failed:', dbErr.message)
        } else {
          reportId = inserted.id
          console.log(`Supabase insert OK, ID: ${reportId}`)
        }
      }
    } catch (e: any) { console.warn('Supabase insert skipped:', e?.message) }

    return res.status(200).json({ success: true, data: reportData })
  } catch (err: any) {
    console.error('Internal error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
