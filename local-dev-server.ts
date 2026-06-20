/**
 * 本地开发服务器：同时服务 Vite 前端和 API 路由
 * 
 * 启动方式：npx tsx local-dev-server.ts
 * 
 * 功能：
 * 1. 代理 Vite 开发服务器（前端热更新）
 * 2. 提供 /api/* 路由（调用真实的 DeepSeek API）
 * 3. 解决 CORS 问题（同源请求）
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createServer as createViteServer } from 'vite';

// 加载环境变量
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 解析 JSON body
app.use(express.json());

// CORS 头（给 API 路由）
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// ===== API 路由：直接在这里实现 =====

/**
 * POST /api/add-project
 * 保存项目到 Supabase
 */
app.post('/api/add-project', async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );

    const { name, contract_address, chain } = req.body;

    // 查询是否已存在
    const { data: existing } = await supabase
      .from('projects')
      .select('id, assessment_count')
      .eq('contract_address', contract_address)
      .maybeSingle();

    if (existing) {
      // 更新
      const { data, error } = await supabase
        .from('projects')
        .update({
          assessment_count: (existing.assessment_count || 0) + 1,
          last_eval_time: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ success: true, data, updated: true });
    } else {
      // 插入
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name,
          contract_address,
          chain: chain || 'BSC',
          assessment_count: 1,
        })
        .select()
        .single();

      if (error) throw error;
      return res.json({ success: true, data, updated: false });
    }
  } catch (err: any) {
    console.error('❌ /api/add-project 错误:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/generate-risk-report
 * 调用 DeepSeek API 生成风险报告
 */
app.post('/api/generate-risk-report', async (req, res) => {
  try {
    const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
    const MODEL = 'deepseek-chat';

    const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY;
    if (!deepseekKey) {
      return res.status(500).json({ error: 'Missing DEEPSEEK_API_KEY' });
    }

    const { project_name, contract_address, user_notes } = req.body || {};
    if (!project_name || typeof project_name !== 'string' || !project_name.trim()) {
      return res.status(400).json({ error: 'project_name is required' });
    }

    const projectName = project_name.trim();
    const address = contract_address?.trim() || '未提供';
    const notes = user_notes?.trim() || '';

    console.log(`\n📡 调用 DeepSeek API: ${projectName} (${address})`);

    const SYSTEM_PROMPT = `你是一个Web3安全审计专家，属于"明鉴·风险洞察官"系统。你的任务是分析区块链项目的安全风险。

## 核心原则（必须遵守）
1. **证据先行**：所有评分必须基于可验证的信息。如果某项信息无法获取，在评分中注明"未审计"/"信息不足"，不得编造。
2. **结论明确**：给出清晰的风险等级（极低风险/低风险/中等风险/高风险/极高风险）和参与建议（可以参与/谨慎参与/不建议参与/严禁参与）。
3. **用户自决**：报告仅提供参考，最终决策权归用户所有。

## 评分维度（总分100）
- 代码与技术安全（25分）：合约是否开源/审计、是否有已知漏洞
- 团队与运营透明度（20分）：团队是否实名、项目信息是否公开
- 经济模型与资金安全（20分）：代币分配是否合理、流动性是否锁定
- 社群与市场热度（15分）：社区活跃度、讨论是否正面
- 历史与执行可靠性（10分）：是否有违约记录、模式是否稳定
- 合规性与法律风险（10分）：是否有法律实体、是否有合规风险

## 输出格式
必须严格输出以下 JSON 结构（字段名固定，值必须根据实际分析填写，不得复制示例值）：
{
  "total_score": <整数，6维得分之和>,
  "risk_level": "<极低风险/低风险/中等风险/高风险/极高风险>",
  "conclusion": "<可以参与/谨慎参与/不建议参与/严禁参与>",
  "six_dimensions": [
    { "name": "代码与技术安全", "score": <整数>, "max": 25, "deduction": "<扣分原因>" },
    { "name": "团队与运营透明度", "score": <整数>, "max": 20, "deduction": "<扣分原因>" },
    { "name": "经济模型与资金安全", "score": <整数>, "max": 20, "deduction": "<扣分原因>" },
    { "name": "社群与市场热度", "score": <整数>, "max": 15, "deduction": "<扣分原因>" },
    { "name": "历史与执行可靠性", "score": <整数>, "max": 10, "deduction": "<扣分原因>" },
    { "name": "合规性与法律风险", "score": <整数>, "max": 10, "deduction": "<扣分原因>" }
  ],
  "radar_data": [<6个整数，与six_dimensions的score一一对应>],
  "public_opinion": "<互联网舆情分析，包含负面关键词、典型抱怨、舆情结论，200字以内>",
  "ai_summary": "<综合风险解读，包含核心风险点和参与建议，200字以内>"
}

⚠️ 重要：以上<...>标注的部分必须根据项目实际情况填写真实分析结果，不得留空，不得使用示例数据。`;

    const userPrompt = `请对以下项目进行安全风险评估：
- 项目名称：${projectName}
- 合约地址：${address}
${notes ? `- 用户备注：${notes}` : ''}

请严格按照系统提示中的 JSON 格式输出评估结果。仅输出JSON，不要包含其他文字。`;

    const startTime = Date.now();
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

    const elapsed = Date.now() - startTime;
    console.log(`⏱️  DeepSeek 响应时间: ${elapsed}ms`);

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      console.error(`❌ DeepSeek API 错误 (${dsRes.status}):`, errText.slice(0, 500));
      return res.status(502).json({ error: `DeepSeek API error (${dsRes.status})`, detail: errText.slice(0, 500) });
    }

    const dsJson = await dsRes.json() as any;
    const rawContent = dsJson?.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error('❌ DeepSeek 返回空响应');
      return res.status(502).json({ error: 'DeepSeek returned empty response' });
    }

    console.log('✅ DeepSeek API 调用成功');

    // 解析 JSON
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();
    
    let reportData: any;
    try {
      reportData = JSON.parse(jsonStr);
    } catch {
      console.error('❌ JSON 解析失败');
      return res.status(502).json({ error: 'Failed to parse DeepSeek JSON' });
    }

    console.log('✅ JSON 解析成功');
    console.log('   总分:', reportData.total_score);
    console.log('   风险等级:', reportData.risk_level);

    // 存到 Supabase
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!
      );

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

      const { data: insertData, error: insertError } = await supabase
        .from('risk_reports')
        .insert({
          user_address: 'anonymous',
          project_id: projectId,
          report_data: reportData,
          total_score: reportData.total_score,
          risk_level: reportData.risk_level,
        })
        .select()
        .single();

      if (insertError) {
        console.warn('⚠️  Supabase 存储失败:', insertError.message);
      } else {
        console.log('✅ Supabase 存储成功! 记录 ID:', insertData.id);
      }
    } catch (dbErr: any) {
      console.warn('⚠️  Supabase 存储失败:', dbErr.message);
    }

    return res.json({ success: true, data: reportData });
  } catch (err: any) {
    console.error('❌ /api/generate-risk-report 错误:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ===== 启动 Vite 开发服务器 =====
(async () => {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server: app as any },
    },
    appType: 'spa',
  });

  // 将 Vite 中间件挂载到 Express
  app.use(vite.middlewares);

  app.listen(PORT, () => {
    console.log('\n🚀 本地开发服务器启动成功!');
    console.log(`   前端: http://localhost:${PORT}`);
    console.log(`   API:  http://localhost:${PORT}/api/*`);
    console.log('\n📡 DeepSeek API 已接入，可以完整测试风险评估报告生成\n');
  });
})();
